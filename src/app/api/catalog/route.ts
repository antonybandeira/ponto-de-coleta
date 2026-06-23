import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { nextBarcode } from '@/lib/barcode'

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('catalog_items')
    .select('*')
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const body = await request.json()

  const { data: existing, error: fetchError } = await supabase
    .from('catalog_items')
    .select('barcode')
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  const barcode = nextBarcode(existing.map(i => i.barcode))

  const { data, error } = await supabase
    .from('catalog_items')
    .insert({ name: body.name, price: body.price, sort_order: body.sort_order ?? 99, barcode })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
