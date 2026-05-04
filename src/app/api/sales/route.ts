import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') ?? 'all'
  const payment = searchParams.get('payment') ?? ''

  let query = supabase
    .from('sales')
    .select('*, sale_items(*)')
    .order('created_at', { ascending: false })

  const now = new Date()
  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    query = query.gte('created_at', start)
  } else if (period === 'week') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('created_at', start)
  } else if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    query = query.gte('created_at', start)
  }

  if (payment) query = query.eq('payment_method', payment)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
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
