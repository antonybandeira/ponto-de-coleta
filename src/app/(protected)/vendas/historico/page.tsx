'use client'
import { useEffect, useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/format'
import type { SaleWithItems } from '@/lib/supabase'

const PERIODS = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'all', label: 'Todas' },
]

const PAYMENTS = ['Todos', 'Dinheiro', 'Pix', 'Cartão Crédito', 'Cartão Débito']
const PAGE_SIZE = 20

export default function HistoricoPage() {
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [period, setPeriod] = useState('month')
  const [payment, setPayment] = useState('Todos')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ period })
    if (payment !== 'Todos') params.set('payment', payment)
    fetch(`/api/sales?${params}`).then(r => r.json()).then((data: SaleWithItems[]) => {
      setSales(data)
      setPage(1)
      setLoading(false)
    })
  }, [period, payment])

  const total = sales.reduce((s, r) => s + r.total, 0)
  const paged = sales.slice(0, page * PAGE_SIZE)
  const hasMore = paged.length < sales.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Histórico de Vendas</h1>
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-green-700 font-semibold">
          Total: {formatCurrency(total)} ({sales.length} vendas)
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${period === p.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {p.label}
            </button>
          ))}
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Carregando...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Nenhuma venda encontrada.</td></tr>
            ) : paged.map(sale => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="text-center">
          <button
            onClick={() => setPage(p => p + 1)}
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Carregar mais
          </button>
        </div>
      )}
    </div>
  )
}
