import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { syncInvestmentExpenses } from '../lib/autoExpenses'
import { Plus, Pencil, Trash2, TrendingUp, RefreshCw } from 'lucide-react'
import { format, parseISO, differenceInMonths } from 'date-fns'
import type { Investment, Category } from '../types'
import InvestmentModal from '../components/modals/InvestmentModal'

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const TYPE_COLORS: Record<string, string> = {
  SIP: 'bg-indigo-100 text-indigo-700',
  Stock: 'bg-green-100 text-green-700',
  MutualFund: 'bg-violet-100 text-violet-700',
  Bond: 'bg-blue-100 text-blue-700',
  FD: 'bg-amber-100 text-amber-700',
  PPF: 'bg-teal-100 text-teal-700',
  NPS: 'bg-cyan-100 text-cyan-700',
  Other: 'bg-gray-100 text-gray-600',
}

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly', 'one-time': 'One-time',
}

export default function InvestmentsPage() {
  const { user } = useAuth()
  const [investments, setInvestments] = useState<Investment[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Investment | null>(null)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: inv }, { data: cat }] = await Promise.all([
      supabase.from('investments').select('*, categories(id,name,icon,color)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
    ])
    setInvestments((inv as any[] ?? []).map(i => ({ ...i, category: i.categories })))
    setCategories(cat as Category[] ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  async function handleDelete(id: string) {
    if (!confirm('Delete this investment? Related auto-generated expenses will remain.')) return
    await supabase.from('investments').delete().eq('id', id)
    setInvestments(prev => prev.filter(i => i.id !== id))
  }

  async function handleSync() {
    if (!user) return
    setSyncing(true)
    await syncInvestmentExpenses(user.id)
    setSyncing(false)
  }

  async function toggleActive(inv: Investment) {
    await supabase.from('investments').update({ is_active: !inv.is_active }).eq('id', inv.id)
    setInvestments(prev => prev.map(i => i.id === inv.id ? { ...i, is_active: !i.is_active } : i))
  }

  const active = investments.filter(i => i.is_active)
  const inactive = investments.filter(i => !i.is_active)
  const monthlyTotal = active
    .filter(i => i.frequency === 'monthly')
    .reduce((s, i) => s + Number(i.amount), 0)
  const totalInvested = investments.reduce((s, i) => s + Number(i.amount), 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Investments</h1>
          <p className="text-sm text-gray-500">Track SIPs, stocks, and recurring investment plans</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-secondary flex items-center gap-2 text-sm"
            title="Sync investment expenses to date"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>
          <button
            onClick={() => { setEditing(null); setModalOpen(true) }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Investment</span>
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card flex items-start gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Monthly SIP</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{fmtCurrency(monthlyTotal)}</p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Active Plans</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{active.length}</p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Per Investment Avg</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              {fmtCurrency(investments.length > 0 ? totalInvested / investments.length : 0)}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Active investments */}
          <div>
            <h2 className="text-sm font-semibold text-gray-600 mb-3">Active Investments ({active.length})</h2>
            {active.length === 0 ? (
              <div className="card text-center py-10 text-gray-400">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No active investments</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {active.map(inv => (
                  <InvestmentCard
                    key={inv.id}
                    investment={inv}
                    onEdit={() => { setEditing(inv); setModalOpen(true) }}
                    onDelete={() => handleDelete(inv.id)}
                    onToggle={() => toggleActive(inv)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Inactive investments */}
          {inactive.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-600 mb-3">Completed / Inactive ({inactive.length})</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {inactive.map(inv => (
                  <InvestmentCard
                    key={inv.id}
                    investment={inv}
                    onEdit={() => { setEditing(inv); setModalOpen(true) }}
                    onDelete={() => handleDelete(inv.id)}
                    onToggle={() => toggleActive(inv)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <InvestmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSaved={() => { loadData(); handleSync() }}
        investment={editing}
        categories={categories}
      />
    </div>
  )
}

function InvestmentCard({ investment: inv, onEdit, onDelete, onToggle }: {
  investment: Investment
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const now = new Date()
  const start = parseISO(inv.start_date)
  const end = inv.end_date ? parseISO(inv.end_date) : null
  const totalMonths = end ? Math.max(differenceInMonths(end, start), 1) : null
  const elapsedMonths = Math.max(differenceInMonths(now, start), 0)
  const progress = totalMonths ? Math.min((elapsedMonths / totalMonths) * 100, 100) : null

  return (
    <div className={`card group transition-all ${!inv.is_active ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{inv.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`badge ${TYPE_COLORS[inv.type] ?? 'bg-gray-100 text-gray-600'}`}>{inv.type}</span>
              <span className="badge bg-gray-100 text-gray-500">{FREQ_LABELS[inv.frequency]}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl font-bold text-gray-900">{fmtCurrency(inv.amount)}</span>
        <button
          onClick={onToggle}
          className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
            inv.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {inv.is_active ? 'Active' : 'Inactive'}
        </button>
      </div>

      <div className="text-xs text-gray-400 flex justify-between mb-2">
        <span>Start: {format(start, 'MMM d, yyyy')}</span>
        {end && <span>End: {format(end, 'MMM d, yyyy')}</span>}
      </div>

      {progress !== null && (
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Progress</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="h-1.5 bg-indigo-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
