import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Pencil, Trash2, Search, Filter, Receipt } from 'lucide-react'
import { format } from 'date-fns'
import type { Expense, Category } from '../types'
import ExpenseModal from '../components/modals/ExpenseModal'

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  manual: { label: 'Manual', color: 'bg-gray-100 text-gray-600' },
  investment: { label: 'Investment', color: 'bg-indigo-100 text-indigo-700' },
  subscription: { label: 'Subscription', color: 'bg-violet-100 text-violet-700' },
}

export default function ExpensesPage() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [filterSource, setFilterSource] = useState('')

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [year, month] = filterMonth.split('-')
    const start = `${year}-${month}-01`
    const end = new Date(Number(year), Number(month), 0).toISOString().split('T')[0]

    let query = supabase
      .from('expenses')
      .select('*, categories(id,name,icon,color)')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })

    if (filterCat) query = query.eq('category_id', filterCat)
    if (filterSource) query = query.eq('source', filterSource)

    const { data } = await query
    const catRes = await supabase.from('categories').select('*').eq('user_id', user.id).order('name')

    setExpenses((data as any[] ?? []).map(e => ({ ...e, category: e.categories })))
    setCategories(catRes.data as Category[] ?? [])
    setLoading(false)
  }, [user, filterMonth, filterCat, filterSource])

  useEffect(() => { loadData() }, [loadData])

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const filtered = expenses.filter(e =>
    !search || e.description.toLowerCase().includes(search.toLowerCase())
  )

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500">Track and manage your spending</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Expense</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="input pl-8 text-sm"
              placeholder="Search expenses…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <select className="input pl-8 text-sm" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <input
            type="month"
            className="input text-sm"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
          />
          <select className="input text-sm" value={filterSource} onChange={e => setFilterSource(e.target.value)}>
            <option value="">All sources</option>
            <option value="manual">Manual</option>
            <option value="investment">Investment</option>
            <option value="subscription">Subscription</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-gray-500">{filtered.length} expense{filtered.length !== 1 ? 's' : ''}</p>
        <p className="text-sm font-bold text-gray-900">Total: {fmtCurrency(total)}</p>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No expenses found</p>
            <p className="text-sm mt-1">Add your first expense to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Category</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Source</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(exp => {
                  const src = SOURCE_LABELS[exp.source] ?? SOURCE_LABELS.manual
                  return (
                    <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900">{exp.description}</td>
                      <td className="px-3 py-3 text-gray-500 hidden sm:table-cell">
                        {exp.category ? (
                          <span className="flex items-center gap-1.5">
                            <span className="text-base leading-none">{exp.category.icon}</span>
                            {exp.category.name}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <span className={`badge ${src.color}`}>{src.label}</span>
                      </td>
                      <td className="px-3 py-3 text-gray-400">{format(new Date(exp.date), 'MMM d, yyyy')}</td>
                      <td className="px-5 py-3 text-right font-bold text-gray-900">{fmtCurrency(exp.amount)}</td>
                      <td className="px-5 py-3 text-right">
                        {exp.source === 'manual' && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setEditing(exp); setModalOpen(true) }}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(exp.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExpenseModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSaved={loadData}
        expense={editing}
        categories={categories}
      />
    </div>
  )
}
