import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Pencil, Trash2, Lock, Tag } from 'lucide-react'
import type { Category } from '../types'
import CategoryModal from '../components/modals/CategoryModal'

export default function CategoriesPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('is_system', { ascending: false })
      .order('name')
    setCategories(data as Category[] ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  async function handleDelete(id: string) {
    if (!confirm('Delete this category? Expenses linked to it will become uncategorized.')) return
    await supabase.from('categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  const system = categories.filter(c => c.is_system)
  const custom = categories.filter(c => !c.is_system)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500">Organize your expenses with categories</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Category</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Custom categories */}
          <div>
            <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
              <Tag className="w-4 h-4" /> Custom Categories
              <span className="badge bg-indigo-100 text-indigo-700">{custom.length}</span>
            </h2>
            {custom.length === 0 ? (
              <div className="card text-center py-10 text-gray-400">
                <Tag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium text-sm">No custom categories yet</p>
                <p className="text-xs mt-1">Create one to organize your unique expenses</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {custom.map(cat => (
                  <CategoryCard
                    key={cat.id}
                    category={cat}
                    onEdit={() => { setEditing(cat); setModalOpen(true) }}
                    onDelete={() => handleDelete(cat.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* System categories */}
          <div>
            <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
              <Lock className="w-4 h-4" /> Default Categories
              <span className="badge bg-gray-100 text-gray-600">{system.length}</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {system.map(cat => (
                <CategoryCard key={cat.id} category={cat} readonly />
              ))}
            </div>
          </div>
        </>
      )}

      <CategoryModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSaved={loadData}
        category={editing}
      />
    </div>
  )
}

function CategoryCard({
  category, onEdit, onDelete, readonly,
}: {
  category: Category
  onEdit?: () => void
  onDelete?: () => void
  readonly?: boolean
}) {
  return (
    <div className="card flex items-center gap-3 group py-4">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ backgroundColor: category.color + '20' }}
      >
        {category.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm truncate">{category.name}</p>
        {readonly && (
          <div className="flex items-center gap-1 mt-0.5">
            <Lock className="w-2.5 h-2.5 text-gray-300" />
            <span className="text-xs text-gray-400">System</span>
          </div>
        )}
      </div>
      {!readonly && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {/* Color swatch */}
      <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
    </div>
  )
}
