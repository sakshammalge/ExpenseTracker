import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../ui/Modal'
import type { Category } from '../../types'

const PRESET_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316',
  '#eab308','#22c55e','#10b981','#0ea5e9','#3b82f6',
  '#64748b','#1e293b',
]

const PRESET_ICONS = [
  '📦','🍔','🛒','🎬','⚽','🏠','🚗','💊','👗','📚',
  '💡','✈️','📱','📈','🔄','🎮','🍕','☕','🎵','🏋️',
  '🐕','👶','🎁','🏖️','💰','🔧','📷','🌿','🏥','🎓',
]

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  category: Category | null
}

export default function CategoryModal({ open, onClose, onSaved, category }: Props) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📦')
  const [color, setColor] = useState('#6366f1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (category) {
      setName(category.name)
      setIcon(category.icon)
      setColor(category.color)
    } else {
      setName('')
      setIcon('📦')
      setColor('#6366f1')
    }
    setError('')
  }, [category, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setError('')

    const payload = { user_id: user.id, name: name.trim(), icon, color }

    const { error: err } = category
      ? await supabase.from('categories').update({ name: name.trim(), icon, color }).eq('id', category.id)
      : await supabase.from('categories').insert(payload)

    if (err) { setError(err.message); setLoading(false); return }
    setLoading(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={category ? 'Edit Category' : 'New Category'}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Preview */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: color + '25' }}
          >
            {icon}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{name || 'Category Name'}</p>
            <p className="text-xs text-gray-400">Preview</p>
          </div>
          <div className="ml-auto w-3 h-10 rounded-full" style={{ backgroundColor: color }} />
        </div>

        <div>
          <label className="label">Category Name *</label>
          <input
            className="input"
            placeholder="e.g. Dining Out"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>

        {/* Icon picker */}
        <div>
          <label className="label">Icon</label>
          <div className="grid grid-cols-10 gap-1 p-2 bg-gray-50 rounded-xl max-h-28 overflow-y-auto">
            {PRESET_ICONS.map(em => (
              <button
                key={em}
                type="button"
                onClick={() => setIcon(em)}
                className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-colors hover:bg-white ${
                  icon === em ? 'bg-white shadow-sm ring-2 ring-indigo-500' : ''
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div>
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${
                  color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="relative">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-7 h-7 rounded-full cursor-pointer border-0 p-0 overflow-hidden"
                title="Custom color"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Saving…' : category ? 'Update' : 'Create Category'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
