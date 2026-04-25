import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../ui/Modal'
import type { Expense, Category } from '../../types'
import { format } from 'date-fns'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  expense: Expense | null
  categories: Category[]
}

export default function ExpenseModal({ open, onClose, onSaved, expense, categories }: Props) {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (expense) {
      setAmount(String(expense.amount))
      setDescription(expense.description)
      setCategoryId(expense.category_id ?? '')
      setDate(expense.date)
    } else {
      setAmount('')
      setDescription('')
      setCategoryId('')
      setDate(format(new Date(), 'yyyy-MM-dd'))
    }
    setError('')
  }, [expense, open])

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
      description: description.trim(),
      category_id: categoryId || null,
      date,
    }

    const { error: err } = expense
      ? await supabase.from('expenses').update(payload).eq('id', expense.id)
      : await supabase.from('expenses').insert({ ...payload, source: 'manual' })

    if (err) { setError(err.message); setLoading(false); return }
    setLoading(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={expense ? 'Edit Expense' : 'Add Expense'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Description *</label>
          <input
            className="input"
            placeholder="e.g. Lunch at Zomato"
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <label className="label">Date *</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Category</label>
          <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">— Uncategorized —</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Saving…' : expense ? 'Update' : 'Add Expense'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
