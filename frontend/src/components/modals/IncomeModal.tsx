import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../ui/Modal'
import type { Income } from '../../types'
import { format } from 'date-fns'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  income: Income | null
}

export default function IncomeModal({ open, onClose, onSaved, income }: Props) {
  const { user } = useAuth()
  const now = new Date()
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState('Salary')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (income) {
      setAmount(String(income.amount))
      setSource(income.source)
      setMonth(income.month)
      setYear(income.year)
      setNotes(income.notes ?? '')
    } else {
      setAmount('')
      setSource('Salary')
      setMonth(now.getMonth() + 1)
      setYear(now.getFullYear())
      setNotes('')
    }
    setError('')
  }, [income, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return }
    setLoading(true)
    setError('')

    const payload = {
      user_id: user.id,
      amount: amt,
      source: source.trim(),
      month,
      year,
      notes: notes.trim() || null,
    }

    const { error: err } = income
      ? await supabase.from('income').update(payload).eq('id', income.id)
      : await supabase.from('income').insert(payload)

    if (err) { setError(err.message); setLoading(false); return }
    setLoading(false)
    onSaved()
    onClose()
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ]

  return (
    <Modal open={open} onClose={onClose} title={income ? 'Edit Income' : 'Add Income'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Source *</label>
          <input
            className="input"
            list="income-sources"
            placeholder="e.g. Salary, Freelance, Bonus…"
            value={source}
            onChange={e => setSource(e.target.value)}
            required
          />
          <datalist id="income-sources">
            <option value="Salary" />
            <option value="Freelance" />
            <option value="Bonus" />
            <option value="Rental Income" />
            <option value="Dividends" />
            <option value="Other" />
          </datalist>
        </div>

        <div>
          <label className="label">Amount (₹) *</label>
          <input
            type="number"
            className="input"
            placeholder="0.00"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Month *</label>
            <select className="input" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {months.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year *</label>
            <select className="input" value={year} onChange={e => setYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            className="input resize-none"
            rows={2}
            placeholder="Optional notes…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Saving…' : income ? 'Update' : 'Add Income'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
