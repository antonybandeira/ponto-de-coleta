'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'
import Toast from '@/components/Toast'
import type { CatalogItem } from '@/lib/supabase'

export default function CatalogoPage() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [editingPrice, setEditingPrice] = useState<string | null>(null)
  const [priceValue, setPriceValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  async function generateBarcode(item: CatalogItem) {
    const res = await fetch(`/api/catalog/${item.id}/barcode`, { method: 'POST' })
    if (res.ok) { load(); setToast({ msg: 'Código gerado!', type: 'success' }) }
    else setToast({ msg: 'Erro ao gerar código.', type: 'error' })
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

  async function handleDelete() {
    if (!confirmDeleteId) return
    setDeleting(true)
    const res = await fetch(`/api/catalog/${confirmDeleteId}`, { method: 'DELETE' })
    setDeleting(false)
    setConfirmDeleteId(null)
    if (res.ok) {
      load()
      setToast({ msg: 'Item excluído.', type: 'success' })
    } else {
      setToast({ msg: 'Erro ao excluir item.', type: 'error' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Catálogo</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/catalogo/etiquetas"
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Imprimir etiquetas
          </Link>
          <Link
            href="/catalogo/tabela-precos"
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Tabela de preços
          </Link>
          <button
            onClick={() => setShowForm(v => !v)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Novo item
          </button>
        </div>
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
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Código</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
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
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                  {item.barcode ? item.barcode : (
                    <button
                      onClick={() => generateBarcode(item)}
                      className="text-blue-600 hover:underline font-sans font-medium"
                    >
                      Gerar código
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
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setConfirmDeleteId(item.id)}
                    className="text-red-400 hover:text-red-600 text-xs font-medium hover:underline"
                    title="Excluir item"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">Excluir item?</h3>
            <p className="text-sm text-gray-500">O item será removido do catálogo. O histórico de vendas que já usou este item será preservado.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-lg font-medium"
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
