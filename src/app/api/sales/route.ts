import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { startOfDayBRT, startOfMonthBRT } from '@/lib/format'

const PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') ?? 'all'
  const payment = searchParams.get('payment') ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const now = new Date()
  let dateFilter: string | null = null
  if (period === 'today') dateFilter = startOfDayBRT(now).toISOString()
  else if (period === 'week') dateFilter = startOfDayBRT(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).toISOString()
  else if (period === 'month') dateFilter = startOfMonthBRT(now).toISOString()

  let itemsQuery = supabase
    .from('sales')
    .select('*, sale_items(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  let totalsQuery = supabase.from('sales').select('total')

  if (dateFilter) {
    itemsQuery = itemsQuery.gte('created_at', dateFilter)
    totalsQuery = totalsQuery.gte('created_at', dateFilter)
  }
  if (payment) {
    itemsQuery = itemsQuery.eq('payment_method', payment)
    totalsQuery = totalsQuery.eq('payment_method', payment)
  }

  const [{ data, error, count }, { data: allTotals }] = await Promise.all([itemsQuery, totalsQuery])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const totalCount = count ?? 0
  const totalAmount = allTotals?.reduce((s, r) => s + r.total, 0) ?? 0

  return NextResponse.json({
    data,
    totalCount,
    totalAmount,
    hasMore: page * PAGE_SIZE < totalCount,
  })
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const body = await request.json()

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      payment_method: body.payment_method,
      total: body.total,
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (saleError) return NextResponse.json({ error: saleError.message }, { status: 500 })

  const items = body.items.map((item: {
    catalog_item_id?: string
    item_name: string
    unit_price: number
    quantity: number
    subtotal: number
  }) => ({
    sale_id: sale.id,
    catalog_item_id: item.catalog_item_id ?? null,
    item_name: item.item_name,
    unit_price: item.unit_price,
    quantity: item.quantity,
    subtotal: item.subtotal,
  }))

  const { error: itemsError } = await supabase.from('sale_items').insert(items)
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

  return NextResponse.json(sale)
}
