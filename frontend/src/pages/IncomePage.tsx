import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Pencil, Trash2, Wallet, TrendingUp } from 'lucide-react'
import { format, subMonths } from 'date-fns'
import type { Income } from '../types'
import IncomeModal from '../components/modals/IncomeModal'

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function IncomePage() {
  const { user } = useAuth()
  const [income, setIncome] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Income | null>(null)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('income')
      .select('*')
      .eq('user_id', user.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
    setIncome(data as Income[] ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  async function handleDelete(id: string) {
    if (!confirm('Delete this income record?')) return
    await supabase.from('income').delete().eq('id', id)
    setIncome(prev => prev.filter(i => i.id !== id))
  }

  // Compute monthly totals for last 6 months
  const now = new Date()
  const monthlyTotals = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    const total = income.filter(inc => inc.month === m && inc.year === y).reduce((s, i) => s + Number(i.amount), 0)
    return { label: format(d, 'MMM yy'), total, month: m, year: y }
  })

  const totalThisMonth = income
    .filter(i => i.month === now.getMonth() + 1 && i.year === now.getFullYear())
    .reduce((s, i) => s + Number(i.amount), 0)

  const totalAllTime = income.reduce((s, i) => s + Number(i.amount), 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Income</h1>
          <p className="text-sm text-gray-500">Track your monthly salary and other income</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Income</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card flex items-start gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">This Month</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{fmtCurrency(totalThisMonth)}</p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">All-Time Total</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{fmtCurrency(totalAllTime)}</p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Avg Monthly</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              {fmtCurrency(income.length > 0 ? totalAllTime / new Set(income.map(i => `${i.year}-${i.month}`)).size : 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Monthly bar chart */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Income by Month (last 6)</h2>
        <div className="flex items-end gap-3 h-32">
          {monthlyTotals.map(m => {
            const maxVal = Math.max(...monthlyTotals.map(t => t.total), 1)
            const heightPct = (m.total / maxVal) * 100
            return (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-gray-600">{m.total > 0 ? `${(m.total/1000).toFixed(0)}k` : ''}</span>
                <div className="w-full bg-gray-100 rounded-t-lg overflow-hidden" style={{ height: '80px' }}>
                  <div
                    className="w-full bg-green-500 rounded-t-lg transition-all duration-500"
                    style={{ height: `${heightPct}%`, marginTop: `${100 - heightPct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">{m.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Income table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : income.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No income recorded yet</p>
            <p className="text-sm mt-1">Add your salary or other income sources</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Month / Year</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Notes</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {income.map(inc => (
                <tr key={inc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{inc.source}</td>
                  <td className="px-3 py-3 text-gray-500">{MONTH_NAMES[inc.month - 1]} {inc.year}</td>
                  <td className="px-3 py-3 text-gray-400 hidden sm:table-cell">{inc.notes || '—'}</td>
                  <td className="px-5 py-3 text-right font-bold text-green-600">{fmtCurrency(inc.amount)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditing(inc); setModalOpen(true) }}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(inc.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <IncomeModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSaved={loadData}
        income={editing}
      />
    </div>
  )
}
