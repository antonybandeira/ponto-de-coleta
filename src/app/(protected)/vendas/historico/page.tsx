'use client'
import { useEffect, useState, useCallback } from 'react'
import { formatCurrency, formatDate, isoToDatetimeLocal } from '@/lib/format'
import Toast from '@/components/Toast'
import type { SaleWithItems, CatalogItem } from '@/lib/supabase'

const PERIODS = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'all', label: 'Todas' },
]

const PAYMENTS = ['Todos', 'Dinheiro', 'Pix', 'Cartão Crédito', 'Cartão Débito']
const PAYMENT_METHODS = ['Dinheiro', 'Pix', 'Cartão Crédito', 'Cartão Débito']

type ApiResponse = {
  data: SaleWithItems[]
  totalCount: number
  totalAmount: number
  hasMore: boolean
}

type EditDraftItem = {
  key: string
  catalog_item_id: string | null
  item_name: string
  unit_price: number
  quantity: number
}
type EditDraft = {
  id: string
  payment_method: string
  notes: string
  saleDate: string
  items: EditDraftItem[]
}

export default function HistoricoPage() {
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [period, setPeriod] = useState('month')
  const [payment, setPayment] = useState('Todos')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalAmount, setTotalAmount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [addItemId, setAddItemId] = useState('')

  const usingDateRange = dateFrom !== '' || dateTo !== ''

  useEffect(() => {
    fetch('/api/catalog')
      .then(r => r.json())
      .then((items: CatalogItem[]) => setCatalog(items.filter(i => i.active)))
      .catch(() => {})
  }, [])

  const fetchPage = useCallback((p: number, append: boolean, opts: {
    period: string; payment: string; dateFrom: string; dateTo: string
  }) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (opts.dateFrom || opts.dateTo) {
      if (opts.dateFrom) params.set('date_from', opts.dateFrom)
      if (opts.dateTo) params.set('date_to', opts.dateTo)
    } else {
      params.set('period', opts.period)
    }
    if (opts.payment !== 'Todos') params.set('payment', opts.payment)
    fetch(`/api/sales?${params}`)
      .then(r => r.json())
      .then(({ data, hasMore, totalAmount, totalCount }: ApiResponse) => {
        setSales(prev => append ? [...prev, ...data] : data)
        setHasMore(hasMore)
        setTotalAmount(totalAmount)
        setTotalCount(totalCount)
        setPage(p)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchPage(1, false, { period, payment, dateFrom, dateTo })
  }, [period, payment, dateFrom, dateTo, fetchPage])

  function handlePeriodClick(value: string) {
    setDateFrom('')
    setDateTo('')
    setPeriod(value)
  }

  function clearDateRange() {
    setDateFrom('')
    setDateTo('')
  }

  async function handleDelete() {
    if (!confirmId) return
    setDeleting(true)
    const res = await fetch(`/api/sales/${confirmId}`, { method: 'DELETE' })
    setDeleting(false)
    setConfirmId(null)
    if (res.ok) {
      setToast({ msg: 'Venda excluída.', type: 'success' })
      fetchPage(1, false, { period, payment, dateFrom, dateTo })
    } else {
      setToast({ msg: 'Erro ao excluir venda.', type: 'error' })
    }
  }

  function openEdit(sale: SaleWithItems) {
    setAddItemId('')
    setEditDraft({
      id: sale.id,
      payment_method: sale.payment_method,
      notes: sale.notes ?? '',
      saleDate: isoToDatetimeLocal(sale.created_at),
      items: sale.sale_items.map(si => ({
        key: si.id,
        catalog_item_id: si.catalog_item_id,
        item_name: si.item_name,
        unit_price: si.unit_price,
        quantity: si.quantity,
      })),
    })
  }

  function updateDraftItem(key: string, patch: Partial<EditDraftItem>) {
    setEditDraft(d => d && { ...d, items: d.items.map(it => it.key === key ? { ...it, ...patch } : it) })
  }

  function removeDraftItem(key: string) {
    setEditDraft(d => d && { ...d, items: d.items.filter(it => it.key !== key) })
  }

  function addDraftItem(catalogId: string) {
    const item = catalog.find(c => c.id === catalogId)
    if (!item) return
    setEditDraft(d => d && {
      ...d,
      items: [...d.items, {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        catalog_item_id: item.id,
        item_name: item.name,
        unit_price: item.price,
        quantity: 1,
      }],
    })
    setAddItemId('')
  }

  async function handleSaveEdit() {
    if (!editDraft) return
    const valid = editDraft.items.length > 0 && editDraft.saleDate.trim() !== '' &&
      editDraft.items.every(it => it.unit_price > 0 && Number.isInteger(it.quantity) && it.quantity >= 1)
    if (!valid) return
    setSaving(true)
    try {
      const res = await fetch(`/api/sales/${editDraft.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: editDraft.payment_method,
          notes: editDraft.notes || null,
          created_at: new Date(editDraft.saleDate).toISOString(),
          items: editDraft.items.map(it => ({
            catalog_item_id: it.catalog_item_id,
            item_name: it.item_name,
            unit_price: it.unit_price,
            quantity: it.quantity,
          })),
        }),
      })
      if (res.ok) {
        setEditDraft(null)
        setToast({ msg: 'Venda atualizada.', type: 'success' })
        fetchPage(1, false, { period, payment, dateFrom, dateTo })
      } else {
        setToast({ msg: 'Erro ao atualizar venda.', type: 'error' })
      }
    } catch {
      setToast({ msg: 'Erro ao atualizar venda.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const draftTotal = editDraft?.items.reduce((s, it) => s + it.unit_price * it.quantity, 0) ?? 0
  const draftValid = !!editDraft && editDraft.items.length > 0 && editDraft.saleDate.trim() !== '' &&
    editDraft.items.every(it => it.unit_price > 0 && Number.isInteger(it.quantity) && it.quantity >= 1)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Histórico de Vendas</h1>
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-green-700 font-semibold">
          Total: {formatCurrency(totalAmount)} ({totalCount} venda{totalCount !== 1 ? 's' : ''})
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className={`flex rounded-lg overflow-hidden border ${usingDateRange ? 'border-gray-200 opacity-50' : 'border-gray-200'}`}>
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => handlePeriodClick(p.value)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${!usingDateRange && period === p.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500 font-medium">De</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500 font-medium">até</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:border-blue-400"
            />
          </div>
          {usingDateRange && (
            <button
              onClick={clearDateRange}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2 py-2"
            >
              Limpar
            </button>
          )}
        </div>

        <select
          value={payment}
          onChange={e => setPayment(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          {PAYMENTS.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Data/Hora</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Itens</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Pagamento</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Obs.</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && sales.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Carregando...</td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nenhuma venda encontrada.</td></tr>
            ) : sales.map(sale => (
              <tr key={sale.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-gray-500">{formatDate(sale.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {sale.sale_items.map(si => (
                      <span key={si.id} className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-700">
                        {si.quantity}× {si.item_name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{sale.payment_method}</span>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(sale.total)}</td>
                <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{sale.notes ?? '—'}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => openEdit(sale)}
                    className="text-blue-500 hover:text-blue-700 text-xs font-medium hover:underline mr-3"
                    title="Editar venda"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setConfirmId(sale.id)}
                    className="text-red-400 hover:text-red-600 text-xs font-medium hover:underline"
                    title="Excluir venda"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="text-center">
          <button
            onClick={() => fetchPage(page + 1, true, { period, payment, dateFrom, dateTo })}
            disabled={loading}
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Carregando...' : 'Carregar mais'}
          </button>
        </div>
      )}

      {editDraft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">Editar venda</h3>

            {/* Itens */}
            <div className="space-y-2">
              {editDraft.items.map(it => (
                <div key={it.key} className="flex items-center gap-2 text-sm border-b pb-2">
                  <span className="flex-1 min-w-0 truncate font-medium">{it.item_name}</span>
                  <input
                    type="number" min={1} step={1} value={it.quantity}
                    onChange={e => updateDraftItem(it.key, { quantity: parseInt(e.target.value || '1', 10) })}
                    className="w-14 border border-gray-200 rounded px-2 py-1 text-center focus:outline-none focus:border-blue-400"
                    title="Quantidade"
                  />
                  <span className="text-gray-400">×</span>
                  <input
                    type="number" min={0} step="0.01" value={it.unit_price}
                    onChange={e => updateDraftItem(it.key, { unit_price: parseFloat(e.target.value || '0') })}
                    className="w-20 border border-gray-200 rounded px-2 py-1 text-right focus:outline-none focus:border-blue-400"
                    title="Preço unitário"
                  />
                  <span className="w-20 text-right font-semibold text-gray-700">{formatCurrency(it.unit_price * it.quantity)}</span>
                  <button onClick={() => removeDraftItem(it.key)} className="text-red-400 hover:text-red-600 text-xs" title="Remover item">✕</button>
                </div>
              ))}
              {editDraft.items.length === 0 && (
                <p className="text-xs text-red-500">A venda precisa ter pelo menos um item.</p>
              )}
            </div>

            {/* Adicionar item */}
            <select
              value={addItemId}
              onChange={e => addDraftItem(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">+ Adicionar item...</option>
              {catalog.map(c => <option key={c.id} value={c.id}>{c.name} — {formatCurrency(c.price)}</option>)}
            </select>

            {/* Pagamento */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <label key={m} className={`flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 text-sm transition-colors ${editDraft.payment_method === m ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}>
                    <input type="radio" name="edit-payment" value={m} checked={editDraft.payment_method === m} onChange={() => setEditDraft(d => d && { ...d, payment_method: m })} className="accent-blue-600" />
                    {m}
                  </label>
                ))}
              </div>
            </div>

            {/* Data */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Data da venda</p>
              <input
                type="datetime-local"
                value={editDraft.saleDate}
                onChange={e => setEditDraft(d => d && { ...d, saleDate: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            {/* Observações */}
            <textarea
              value={editDraft.notes}
              onChange={e => setEditDraft(d => d && { ...d, notes: e.target.value })}
              placeholder="Observações (opcional)"
              rows={2}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm resize-none focus:outline-none focus:border-blue-400"
            />

            {/* Total */}
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="font-semibold text-gray-600">Total</span>
              <span className="text-xl font-bold text-gray-900">{formatCurrency(draftTotal)}</span>
            </div>

            {/* Ações */}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditDraft(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSaveEdit} disabled={saving || !draftValid} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-medium">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">Excluir venda?</h3>
            <p className="text-sm text-gray-500">Esta ação não pode ser desfeita. A venda e todos os seus itens serão removidos permanentemente.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmId(null)}
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
