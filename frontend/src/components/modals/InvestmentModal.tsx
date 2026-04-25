import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../ui/Modal'
import type { Investment, Category } from '../../types'
import { format } from 'date-fns'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  investment: Investment | null
  categories: Category[]
}

const TYPES = ['SIP', 'Stock', 'MutualFund', 'Bond', 'FD', 'PPF', 'NPS', 'Other']
const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'one-time', label: 'One-time' },
]

export default function InvestmentModal({ open, onClose, onSaved, investment, categories }: Props) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [type, setType] = useState<string>('SIP')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<string>('monthly')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (investment) {
      setName(investment.name)
      setType(investment.type)
      setAmount(String(investment.amount))
      setFrequency(investment.frequency)
      setStartDate(investment.start_date)
      setEndDate(investment.end_date ?? '')
      setCategoryId(investment.category_id ?? '')
      setNotes(investment.notes ?? '')
    } else {
      setName('')
      setType('SIP')
      setAmount('')
      setFrequency('monthly')
      setStartDate(format(new Date(), 'yyyy-MM-dd'))
      setEndDate('')
      setCategoryId('')
      setNotes('')
    }
    setError('')
  }, [investment, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return }
    if (endDate && endDate < startDate) { setError('End date must be after start date'); return }
    setLoading(true)
    setError('')

    // Auto-assign to Investments category if none selected
    let catId = categoryId || null
    if (!catId) {
      const { data } = await supabase
        .from('categories')
        .select<{ id: string }>('id')
        .eq('user_id', user.id)
        .eq('name', 'Investments')
        .single()
      catId = data?.id ?? null
    }

    const payload = {
      user_id: user.id,
      name: name.trim(),
      type,
      amount: amt,
      frequency,
      start_date: startDate,
      end_date: endDate || null,
      category_id: catId,
      notes: notes.trim() || null,
      is_active: true,
    }

    const { error: err } = investment
      ? await supabase.from('investments').update(payload).eq('id', investment.id)
      : await supabase.from('investments').insert(payload)

    if (err) { setError(err.message); setLoading(false); return }
    setLoading(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={investment ? 'Edit Investment' : 'Add Investment'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Investment Name *</label>
          <input
            className="input"
            placeholder="e.g. HDFC Nifty 50 SIP"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type *</label>
            <select className="input" value={type} onChange={e => setType(e.target.value)}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Frequency *</label>
            <select className="input" value={frequency} onChange={e => setFrequency(e.target.value)}>
              {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Amount per period (₹) *</label>
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
            <label className="label">Start Date *</label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">
              End Date
              <span className="text-gray-400 font-normal ml-1 text-xs">(optional)</span>
            </label>
            <input
              type="date"
              className="input"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              min={startDate}
            />
          </div>
        </div>

        <div>
          <label className="label">Category</label>
          <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">— Auto (Investments) —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
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

        {frequency !== 'one-time' && (
          <div className="bg-indigo-50 text-indigo-700 text-xs rounded-xl px-3 py-2.5">
            💡 Expenses will be auto-generated for each {frequency} period from start date.
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Saving…' : investment ? 'Update' : 'Add Investment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
