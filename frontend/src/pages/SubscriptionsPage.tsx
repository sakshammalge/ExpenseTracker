import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { syncSubscriptionExpenses } from '../lib/autoExpenses'
import { Plus, Pencil, Trash2, RefreshCcw, RefreshCw, Calendar } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import type { Subscription, Category } from '../types'
import SubscriptionModal from '../components/modals/SubscriptionModal'

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const CYCLE_COLORS: Record<string, string> = {
  monthly: 'bg-blue-100 text-blue-700',
  quarterly: 'bg-violet-100 text-violet-700',
  yearly: 'bg-amber-100 text-amber-700',
}

// Popular subscription icons (emoji fallback)
const SUB_ICONS: Record<string, string> = {
  netflix: '🎬', prime: '📦', spotify: '🎵', youtube: '▶️',
  hotstar: '⭐', apple: '🍎', google: '🔍', microsoft: '💻',
  gym: '💪', default: '🔄',
}

function getSubIcon(name: string) {
  const lower = name.toLowerCase()
  return Object.entries(SUB_ICONS).find(([k]) => lower.includes(k))?.[1] ?? SUB_ICONS.default
}

export default function SubscriptionsPage() {
  const { user } = useAuth()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Subscription | null>(null)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: subs }, { data: cat }] = await Promise.all([
      supabase.from('subscriptions').select('*, categories(id,name,icon,color)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
    ])
    setSubscriptions((subs as any[] ?? []).map(s => ({ ...s, category: s.categories })))
    setCategories(cat as Category[] ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  async function handleDelete(id: string) {
    if (!confirm('Delete this subscription? Related expenses will remain.')) return
    await supabase.from('subscriptions').delete().eq('id', id)
    setSubscriptions(prev => prev.filter(s => s.id !== id))
  }

  async function handleSync() {
    if (!user) return
    setSyncing(true)
    await syncSubscriptionExpenses(user.id)
    await loadData()
    setSyncing(false)
  }

  async function toggleActive(sub: Subscription) {
    await supabase.from('subscriptions').update({ is_active: !sub.is_active }).eq('id', sub.id)
    setSubscriptions(prev => prev.map(s => s.id === sub.id ? { ...s, is_active: !s.is_active } : s))
  }

  const active = subscriptions.filter(s => s.is_active)
  const inactive = subscriptions.filter(s => !s.is_active)
  const monthlyEquivalent = active.reduce((sum, s) => {
    if (s.billing_cycle === 'monthly') return sum + Number(s.amount)
    if (s.billing_cycle === 'quarterly') return sum + Number(s.amount) / 3
    if (s.billing_cycle === 'yearly') return sum + Number(s.amount) / 12
    return sum
  }, 0)

  const upcomingIn7Days = active.filter(s => {
    if (!s.next_billing_date) return false
    const days = differenceInDays(parseISO(s.next_billing_date), new Date())
    return days >= 0 && days <= 7
  })

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-sm text-gray-500">Manage recurring subscriptions and billing</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>
          <button
            onClick={() => { setEditing(null); setModalOpen(true) }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Subscription</span>
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card flex items-start gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <RefreshCcw className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Monthly Cost</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{fmtCurrency(monthlyEquivalent)}</p>
            <p className="text-xs text-gray-400">Yearly: {fmtCurrency(monthlyEquivalent * 12)}</p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <RefreshCcw className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Active</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{active.length}</p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${upcomingIn7Days.length > 0 ? 'bg-amber-100' : 'bg-gray-100'}`}>
            <Calendar className={`w-5 h-5 ${upcomingIn7Days.length > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Due in 7 days</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{upcomingIn7Days.length}</p>
          </div>
        </div>
      </div>

      {/* Upcoming billing alert */}
      {upcomingIn7Days.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">
            🔔 Upcoming billing in the next 7 days
          </p>
          <div className="flex flex-wrap gap-2">
            {upcomingIn7Days.map(s => (
              <div key={s.id} className="bg-white rounded-xl px-3 py-1.5 border border-amber-200 text-xs">
                <span className="font-medium text-gray-900">{s.name}</span>
                <span className="text-gray-400 mx-1">·</span>
                <span className="text-amber-700">{fmtCurrency(s.amount)}</span>
                {s.next_billing_date && (
                  <>
                    <span className="text-gray-400 mx-1">·</span>
                    <span className="text-gray-500">{format(parseISO(s.next_billing_date), 'MMM d')}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Active */}
          <div>
            <h2 className="text-sm font-semibold text-gray-600 mb-3">Active Subscriptions ({active.length})</h2>
            {active.length === 0 ? (
              <div className="card text-center py-10 text-gray-400">
                <RefreshCcw className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No active subscriptions</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {active.map(sub => (
                  <SubscriptionCard
                    key={sub.id}
                    subscription={sub}
                    onEdit={() => { setEditing(sub); setModalOpen(true) }}
                    onDelete={() => handleDelete(sub.id)}
                    onToggle={() => toggleActive(sub)}
                  />
                ))}
              </div>
            )}
          </div>

          {inactive.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-600 mb-3">Cancelled ({inactive.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {inactive.map(sub => (
                  <SubscriptionCard
                    key={sub.id}
                    subscription={sub}
                    onEdit={() => { setEditing(sub); setModalOpen(true) }}
                    onDelete={() => handleDelete(sub.id)}
                    onToggle={() => toggleActive(sub)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <SubscriptionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSaved={() => { loadData(); handleSync() }}
        subscription={editing}
        categories={categories}
      />
    </div>
  )
}

function SubscriptionCard({ subscription: sub, onEdit, onDelete, onToggle }: {
  subscription: Subscription
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const daysUntilBilling = sub.next_billing_date
    ? differenceInDays(parseISO(sub.next_billing_date), new Date())
    : null

  const isUrgent = daysUntilBilling !== null && daysUntilBilling <= 7 && daysUntilBilling >= 0

  return (
    <div className={`card group transition-all ${!sub.is_active ? 'opacity-60' : ''} ${isUrgent ? 'ring-2 ring-amber-400' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${isUrgent ? 'bg-amber-50' : 'bg-violet-50'}`}>
            {getSubIcon(sub.name)}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{sub.name}</p>
            <span className={`badge ${CYCLE_COLORS[sub.billing_cycle]}`}>
              {sub.billing_cycle.charAt(0).toUpperCase() + sub.billing_cycle.slice(1)}
            </span>
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

      <p className="text-2xl font-bold text-gray-900 mb-3">{fmtCurrency(sub.amount)}</p>

      <div className="space-y-1 text-xs text-gray-400">
        {sub.next_billing_date && (
          <div className={`flex items-center gap-1 ${isUrgent ? 'text-amber-600 font-medium' : ''}`}>
            <Calendar className="w-3 h-3" />
            Next: {format(parseISO(sub.next_billing_date), 'MMM d, yyyy')}
            {isUrgent && <span className="ml-1 text-amber-600">({daysUntilBilling}d)</span>}
          </div>
        )}
        <div>Started: {format(parseISO(sub.start_date), 'MMM d, yyyy')}</div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
        <button
          onClick={onToggle}
          className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
            sub.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {sub.is_active ? 'Active' : 'Cancelled'}
        </button>
        {sub.category && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            {sub.category.icon} {sub.category.name}
          </span>
        )}
      </div>
    </div>
  )
}
