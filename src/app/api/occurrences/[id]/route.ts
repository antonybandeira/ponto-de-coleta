import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabase()
  const body = await request.json()

  let update: Record<string, unknown>
  if (body.status !== undefined) {
    update = { status: body.status }
    if (body.status === 'resolvido') {
      update.resolved_at = new Date().toISOString()
      update.resolution_notes = body.resolution_notes ?? null
    }
  } else {
    update = {
      customer_name: body.customer_name,
      customer_phone: body.customer_phone ?? null,
      platform: body.platform ?? null,
      description: body.description,
    }
  }

  const { data, error } = await supabase
    .from('occurrences')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabase()
  const { error } = await supabase.from('occurrences').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
