'use client'
import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/format'
import Toast from '@/components/Toast'
import type { CatalogItem } from '@/lib/supabase'

export default function CatalogoPage() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [editingPrice, setEditingPrice] = useState<string | null>(null)
  const [priceValue, setPriceValue] = useState('')

  // New item form
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [saving, setSaving] = useState(false)

  function load() {
    fetch('/api/catalog').then(r => r.json()).then(setItems)
  }
  useEffect(load, [])

  async function toggleActive(item: CatalogItem) {
    const res = await fetch(`/api/catalog/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    })
    if (res.ok) load()
  }

  function startEditPrice(item: CatalogItem) {
    setEditingPrice(item.id)
    setPriceValue(item.price.toFixed(2).replace('.', ','))
  }

  async function savePrice(item: CatalogItem) {
    const parsed = parseFloat(priceValue.replace(',', '.'))
    if (isNaN(parsed) || parsed <= 0) { setEditingPrice(null); return }
    const res = await fetch(`/api/catalog/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: parsed }),
    })
    if (res.ok) { load(); setToast({ msg: 'Preço atualizado!', type: 'success' }) }
    setEditingPrice(null)
  }

  async function handleNewItem(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(newPrice.replace(',', '.'))
    if (!newName || isNaN(parsed)) return
    setSaving(true)
    const res = await fetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, price: parsed }),
    })
    setSaving(false)
    if (res.ok) {
      setNewName(''); setNewPrice(''); setShowForm(false)
      load(); setToast({ msg: 'Item criado!', type: 'success' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Catálogo</h1>
        <button
          onClick={() => setShowForm(v => !v)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Novo item
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleNewItem} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Nome</label>
            <input required value={newName} onChange={e => setNewName(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:border-blue-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Preço (R$)</label>
            <input required value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="0,00" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:border-blue-400" />
          </div>
          <button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:bg-green-300">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-2 py-2">Cancelar</button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Item</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Preço</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className={`border-b last:border-0 ${!item.active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                <td className="px-4 py-3">
                  {editingPrice === item.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={priceValue}
                        onChange={e => setPriceValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') savePrice(item); if (e.key === 'Escape') setEditingPrice(null) }}
                        className="border border-blue-400 rounded px-2 py-1 text-sm w-24 focus:outline-none"
                      />
                      <button onClick={() => savePrice(item)} className="text-green-600 hover:text-green-700 font-bold text-xs">✓</button>
                      <button onClick={() => setEditingPrice(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditPrice(item)}
                      className="text-blue-600 hover:underline font-medium"
                      title="Clique para editar"
                    >
                      {formatCurrency(item.price)}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(item)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${item.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {item.active ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
