import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { nextBarcode } from '@/lib/barcode'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabase()

  const { data: existing, error: fetchError } = await supabase
    .from('catalog_items')
    .select('barcode')
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  const barcode = nextBarcode(existing.map(i => i.barcode))

  const { data, error } = await supabase
    .from('catalog_items')
    .update({ barcode })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
