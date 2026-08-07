import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabase()
  const { error } = await supabase.from('sales').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabase()
  const body = await request.json()

  // Validação
  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) {
    return NextResponse.json({ error: 'A venda precisa ter pelo menos um item.' }, { status: 400 })
  }
  if (!body.payment_method) {
    return NextResponse.json({ error: 'Forma de pagamento é obrigatória.' }, { status: 400 })
  }
  for (const it of items) {
    const price = Number(it.unit_price)
    const qty = Number(it.quantity)
    if (!it.item_name || !(price > 0) || !Number.isInteger(qty) || qty < 1) {
      return NextResponse.json({ error: 'Item inválido.' }, { status: 400 })
    }
  }

  // Recalcula subtotais e total no servidor (ignora o total do cliente)
  const normalizedItems = items.map((it: {
    catalog_item_id?: string | null; item_name: string; unit_price: number; quantity: number
  }) => ({
    sale_id: id,
    catalog_item_id: it.catalog_item_id ?? null,
    item_name: it.item_name,
    unit_price: Number(it.unit_price),
    quantity: Number(it.quantity),
    subtotal: Number(it.unit_price) * Number(it.quantity),
  }))
  const total = normalizedItems.reduce((s: number, it: { subtotal: number }) => s + it.subtotal, 0)

  // Atualiza a venda
  const { error: saleError } = await supabase
    .from('sales')
    .update({
      payment_method: body.payment_method,
      notes: body.notes ?? null,
      total,
      ...(body.created_at ? { created_at: body.created_at } : {}),
    })
    .eq('id', id)
  if (saleError) return NextResponse.json({ error: saleError.message }, { status: 500 })

  // Substitui os itens (apagar + inserir; ver limitação no spec)
  const { error: delError } = await supabase.from('sale_items').delete().eq('sale_id', id)
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

  const { error: insError } = await supabase.from('sale_items').insert(normalizedItems)
  if (insError) return NextResponse.json({ error: insError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
