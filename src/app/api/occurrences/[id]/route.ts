import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabase()
  const body = await request.json()

  const update: Record<string, unknown> = { status: body.status }
  if (body.status === 'resolvido') {
    update.resolved_at = new Date().toISOString()
    update.resolution_notes = body.resolution_notes ?? null
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
