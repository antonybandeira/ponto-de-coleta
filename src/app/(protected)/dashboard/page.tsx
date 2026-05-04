'use client'
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/format'

type DashData = {
  today: { count: number; total: number }
  month: { count: number; total: number }
  openOccurrences: number
  topItems: { name: string; qty: number }[]
  dailyChart: { date: string; total: number }[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null)

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <div className="text-gray-400 py-12 text-center">Carregando...</div>

  const bestItem = data.topItems[0]?.name ?? '—'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Vendas hoje" value={formatCurrency(data.today.total)} sub={`${data.today.count} venda${data.today.count !== 1 ? 's' : ''}`} color="blue" />
        <Card title="Vendas no mês" value={formatCurrency(data.month.total)} sub={`${data.month.count} venda${data.month.count !== 1 ? 's' : ''}`} color="green" />
        <Card title="Ocorrências abertas" value={String(data.openOccurrences)} sub="aguardando" color="yellow" />
        <Card title="Item mais vendido" value={bestItem} sub="no mês" color="purple" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top 5 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Top 5 itens do mês</h2>
          {data.topItems.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhuma venda este mês.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b">
                  <th className="text-left pb-2">Item</th>
                  <th className="text-right pb-2">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {data.topItems.map((item, i) => (
                  <tr key={item.name} className="border-b last:border-0">
                    <td className="py-2 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                      {item.name}
                    </td>
                    <td className="py-2 text-right font-medium">{item.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Vendas — últimos 30 dias</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.dailyChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${v}`} width={48} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} labelStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function Card({ title, value, sub, color }: { title: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    purple: 'bg-purple-50 border-purple-200',
  }
  const textColors: Record<string, string> = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    yellow: 'text-yellow-700',
    purple: 'text-purple-700',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${textColors[color]} truncate`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}
