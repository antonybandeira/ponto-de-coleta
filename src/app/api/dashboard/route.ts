import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabase()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const [todaySales, monthSales, openOccurrences, last30Sales] = await Promise.all([
    supabase.from('sales').select('id, total').gte('created_at', todayStart),
    supabase.from('sales').select('id, total').gte('created_at', monthStart),
    supabase.from('occurrences').select('id', { count: 'exact' }).eq('status', 'aberto'),
    supabase
      .from('sales')
      .select('id, created_at, total, sale_items(item_name, quantity)')
      .gte('created_at', thirtyDaysAgo.toISOString()),
  ])

  // top items this month
  const { data: monthItems } = await supabase
    .from('sale_items')
    .select('item_name, quantity, sale_id, sales!inner(created_at)')
    .gte('sales.created_at', monthStart)

  const itemTotals: Record<string, number> = {}
  for (const row of monthItems ?? []) {
    itemTotals[row.item_name] = (itemTotals[row.item_name] ?? 0) + row.quantity
  }
  const topItems = Object.entries(itemTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }))

  // daily totals last 30 days
  const dailyMap: Record<string, number> = {}
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo)
    d.setDate(thirtyDaysAgo.getDate() + i)
    dailyMap[d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })] = 0
  }
  for (const sale of last30Sales.data ?? []) {
    const key = new Date(sale.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    if (key in dailyMap) dailyMap[key] = (dailyMap[key] ?? 0) + sale.total
  }
  const dailyChart = Object.entries(dailyMap).map(([date, total]) => ({ date, total }))

  return NextResponse.json({
    today: {
      count: todaySales.data?.length ?? 0,
      total: todaySales.data?.reduce((s, r) => s + r.total, 0) ?? 0,
    },
    month: {
      count: monthSales.data?.length ?? 0,
      total: monthSales.data?.reduce((s, r) => s + r.total, 0) ?? 0,
    },
    openOccurrences: openOccurrences.count ?? 0,
    topItems,
    dailyChart,
  })
}
