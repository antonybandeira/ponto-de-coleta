import { createClient } from '@supabase/supabase-js'

export type CatalogItem = {
  id: string
  name: string
  price: number
  active: boolean
  sort_order: number
  created_at: string
}

export type Sale = {
  id: string
  created_at: string
  payment_method: string
  total: number
  notes: string | null
}

export type SaleItem = {
  id: string
  sale_id: string
  catalog_item_id: string | null
  item_name: string
  unit_price: number
  quantity: number
  subtotal: number
}

export type SaleWithItems = Sale & { sale_items: SaleItem[] }

export type Occurrence = {
  id: string
  created_at: string
  customer_name: string
  customer_phone: string | null
  platform: string | null
  description: string
  status: 'aberto' | 'em_andamento' | 'resolvido'
  resolved_at: string | null
  resolution_notes: string | null
}

export function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
