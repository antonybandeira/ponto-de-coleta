'use client'
import { useEffect, useState, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/format'
import Toast from '@/components/Toast'
import type { SaleWithItems } from '@/lib/supabase'

const PERIODS = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'all', label: 'Todas' },
]

const PAYMENTS = ['Todos', 'Dinheiro', 'Pix', 'Cartão Crédito', 'Cartão Débito']

type ApiResponse = {
  data: SaleWithItems[]
  totalCount: number
  totalAmount: number
  hasMore: boolean
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

  const usingDateRange = dateFrom !== '' || dateTo !== ''

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
                <td className="px-4 py-3 text-right">
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
