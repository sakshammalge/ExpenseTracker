/// <reference types="vite/client" />

type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in'

interface Filter {
  op: FilterOp
  column: string
  value: unknown
}

interface SessionUser {
  id: string
  email: string | null
  user_metadata?: Record<string, unknown>
}

interface SessionData {
  access_token: string
  refresh_token?: string | null
  expires_at?: number | null
  user: SessionUser
}

export interface Session {
  access_token: string
  user: SessionUser
}

export interface User extends SessionUser {}

interface DbResponse<T = unknown> {
  data: T | null
  error: { message: string } | null
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:5000'
const TOKEN_KEY = 'smartexpense_access_token'

const authListeners = new Set<(event: 'SIGNED_IN' | 'SIGNED_OUT', session: Session | null) => void>()

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers = new Headers(options.headers || {})
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body?.error || `Request failed: ${res.status}`
    throw new Error(msg)
  }
  return body as T
}

class SelectQueryBuilder<T = unknown> implements PromiseLike<DbResponse<T[]>> {
  private readonly table: string
  private readonly selectClause: string
  private filters: Filter[] = []
  private orderBy?: { column: string; ascending: boolean }
  private rowLimit?: number

  constructor(table: string, selectClause: string) {
    this.table = table
    this.selectClause = selectClause
  }

  eq(column: string, value: unknown) {
    this.filters.push({ op: 'eq', column, value })
    return this
  }

  neq(column: string, value: unknown) {
    this.filters.push({ op: 'neq', column, value })
    return this
  }

  gt(column: string, value: unknown) {
    this.filters.push({ op: 'gt', column, value })
    return this
  }

  gte(column: string, value: unknown) {
    this.filters.push({ op: 'gte', column, value })
    return this
  }

  lt(column: string, value: unknown) {
    this.filters.push({ op: 'lt', column, value })
    return this
  }

  lte(column: string, value: unknown) {
    this.filters.push({ op: 'lte', column, value })
    return this
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending ?? true }
    return this
  }

  limit(limit: number) {
    this.rowLimit = limit
    return this
  }

  single(): Promise<DbResponse<T>> {
    return this.executeSingle()
  }

  async executeMany(): Promise<DbResponse<T[]>> {
    try {
      const body = await apiFetch<{ data: T[] | null; error: string | null }>('/db/query', {
        method: 'POST',
        body: JSON.stringify({
          table: this.table,
          select: this.selectClause,
          filters: this.filters,
          order: this.orderBy,
          limit: this.rowLimit,
          single: false,
        }),
      })
      return { data: body.data ?? [], error: body.error ? { message: body.error } : null }
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : 'Unknown query error' } }
    }
  }

  async executeSingle(): Promise<DbResponse<T>> {
    try {
      const body = await apiFetch<{ data: T | null; error: string | null }>('/db/query', {
        method: 'POST',
        body: JSON.stringify({
          table: this.table,
          select: this.selectClause,
          filters: this.filters,
          order: this.orderBy,
          limit: this.rowLimit,
          single: true,
        }),
      })
      return { data: body.data ?? null, error: body.error ? { message: body.error } : null }
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : 'Unknown query error' } }
    }
  }

  then<TResult1 = DbResponse<T[]>, TResult2 = never>(
    onfulfilled?: ((value: DbResponse<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.executeMany().then(onfulfilled ?? undefined, onrejected ?? undefined)
  }
}

class MutationBuilder<T = unknown> implements PromiseLike<DbResponse<T[]>> {
  private readonly table: string
  private readonly action: 'update' | 'delete'
  private readonly payload?: Record<string, unknown>
  private filters: Filter[] = []

  constructor(table: string, action: 'update' | 'delete', payload?: Record<string, unknown>) {
    this.table = table
    this.action = action
    this.payload = payload
  }

  eq(column: string, value: unknown) {
    this.filters.push({ op: 'eq', column, value })
    return this
  }

  neq(column: string, value: unknown) {
    this.filters.push({ op: 'neq', column, value })
    return this
  }

  async execute(): Promise<DbResponse<T[]>> {
    try {
      const body = await apiFetch<{ data: T[] | null; error: string | null }>('/db/mutate', {
        method: 'POST',
        body: JSON.stringify({
          table: this.table,
          action: this.action,
          payload: this.payload,
          filters: this.filters,
        }),
      })
      return { data: body.data ?? [], error: body.error ? { message: body.error } : null }
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : 'Unknown mutation error' } }
    }
  }

  then<TResult1 = DbResponse<T[]>, TResult2 = never>(
    onfulfilled?: ((value: DbResponse<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined)
  }
}

class TableApi {
  private readonly table: string

  constructor(table: string) {
    this.table = table
  }

  select<T = unknown>(clause = '*') {
    return new SelectQueryBuilder<T>(this.table, clause)
  }

  insert<T = unknown>(payload: Record<string, unknown> | Record<string, unknown>[]) {
    return apiFetch<{ data: T[] | null; error: string | null }>('/db/mutate', {
      method: 'POST',
      body: JSON.stringify({ table: this.table, action: 'insert', payload }),
    }).then((body) => ({ data: body.data ?? [], error: body.error ? { message: body.error } : null }))
      .catch((err) => ({ data: null, error: { message: err instanceof Error ? err.message : 'Unknown mutation error' } }))
  }

  update<T = unknown>(payload: Record<string, unknown>) {
    return new MutationBuilder<T>(this.table, 'update', payload)
  }

  delete<T = unknown>() {
    return new MutationBuilder<T>(this.table, 'delete')
  }
}

const auth = {
  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { full_name?: string } } }) {
    try {
      const result = await apiFetch<{ session: SessionData | null }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          full_name: options?.data?.full_name,
        }),
      })

      if (result.session?.access_token) {
        const session = result.session
        setToken(session.access_token)
        authListeners.forEach((listener) => listener('SIGNED_IN', { access_token: session.access_token, user: session.user }))
      }

      return { data: { session: result.session }, error: null }
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : 'Signup failed' } }
    }
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const result = await apiFetch<{ session: SessionData | null }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      if (result.session?.access_token) {
        const session = result.session
        setToken(session.access_token)
        authListeners.forEach((listener) => listener('SIGNED_IN', { access_token: session.access_token, user: session.user }))
      }

      return { data: { session: result.session }, error: null }
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : 'Sign-in failed' } }
    }
  },

  async getSession() {
    const token = getToken()

    if (!token) {
      return { data: { session: null }, error: null }
    }

    try {
      const result = await apiFetch<{ session: Session | null }>('/auth/session', { method: 'GET' })
      return { data: { session: result.session }, error: null }
    } catch {
      setToken(null)
      return { data: { session: null }, error: null }
    }
  },

  onAuthStateChange(callback: (event: 'SIGNED_IN' | 'SIGNED_OUT', session: Session | null) => void) {
    authListeners.add(callback)
    return {
      data: {
        subscription: {
          unsubscribe: () => authListeners.delete(callback),
        },
      },
    }
  },

  async signOut() {
    setToken(null)
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } catch {
      // Ignore logout errors; token removal is authoritative on frontend.
    }
    authListeners.forEach((listener) => listener('SIGNED_OUT', null))
    return { error: null }
  },
}

export const supabase = {
  auth,
  from(table: string) {
    return new TableApi(table)
  },
}
