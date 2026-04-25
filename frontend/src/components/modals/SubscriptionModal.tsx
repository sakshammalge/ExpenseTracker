import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../ui/Modal'
import type { Subscription, Category } from '../../types'
import { format } from 'date-fns'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  subscription: Subscription | null
  categories: Category[]
}

const BILLING_CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly (every 3 months)' },
  { value: 'yearly', label: 'Yearly' },
]

const POPULAR_SUBS = [
  'Netflix', 'Amazon Prime', 'Spotify', 'YouTube Premium', 'Disney+ Hotstar',
  'Apple Music', 'Microsoft 365', 'Google One', 'Gym Membership', 'Other',
]

export default function SubscriptionModal({ open, onClose, onSaved, subscription, categories }: Props) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [billingCycle, setBillingCycle] = useState<string>('monthly')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [categoryId, setCategoryId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (subscription) {
      setName(subscription.name)
      setAmount(String(subscription.amount))
      setBillingCycle(subscription.billing_cycle)
      setStartDate(subscription.start_date)
      setCategoryId(subscription.category_id ?? '')
      setNotes(subscription.notes ?? '')
    } else {
      setName('')
      setAmount('')
      setBillingCycle('monthly')
      setStartDate(format(new Date(), 'yyyy-MM-dd'))
      setCategoryId('')
      setNotes('')
    }
    setError('')
  }, [subscription, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return }
    setLoading(true)
    setError('')

    // Auto-assign Subscriptions category
    let catId = categoryId || null
    if (!catId) {
      const { data } = await supabase
        .from('categories')
        .select<{ id: string }>('id')
        .eq('user_id', user.id)
        .eq('name', 'Subscriptions')
        .single()
      catId = data?.id ?? null
    }

    const payload = {
      user_id: user.id,
      name: name.trim(),
      amount: amt,
      billing_cycle: billingCycle,
      start_date: startDate,
      category_id: catId,
      notes: notes.trim() || null,
      is_active: true,
    }

    const { error: err } = subscription
      ? await supabase.from('subscriptions').update(payload).eq('id', subscription.id)
      : await supabase.from('subscriptions').insert(payload)

    if (err) { setError(err.message); setLoading(false); return }
    setLoading(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={subscription ? 'Edit Subscription' : 'Add Subscription'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Service Name *</label>
          <input
            className="input"
            list="sub-names"
            placeholder="e.g. Netflix"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <datalist id="sub-names">
            {POPULAR_SUBS.map(s => <option key={s} value={s} />)}
          </datalist>
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
            <label className="label">Billing Cycle *</label>
            <select className="input" value={billingCycle} onChange={e => setBillingCycle(e.target.value)}>
              {BILLING_CYCLES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
        </div>

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
          <label className="label">Category</label>
          <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">— Auto (Subscriptions) —</option>
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

        <div className="bg-violet-50 text-violet-700 text-xs rounded-xl px-3 py-2.5">
          🔄 Expenses will be auto-generated for each {billingCycle} billing period from start date.
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Saving…' : subscription ? 'Update' : 'Add Subscription'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
