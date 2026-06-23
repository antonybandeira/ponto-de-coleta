'use client'
import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/format'
import type { CatalogItem } from '@/lib/supabase'

export default function TabelaPrecosPage() {
  const [items, setItems] = useState<CatalogItem[]>([])

  useEffect(() => {
    fetch('/api/catalog')
      .then(r => r.json())
      .then((data: CatalogItem[]) => setItems(data.filter(i => i.active)))
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-gray-800">Tabela de preços</h1>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Imprimir
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-400 text-sm print:hidden">Nenhum item ativo no catálogo.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 print:border-0 print:p-0">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-6 print:text-4xl">Tabela de Preços</h2>
          <div className="divide-y divide-gray-200">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between py-4 print:break-inside-avoid">
                <span className="text-xl font-semibold text-gray-800 print:text-2xl">{item.name}</span>
                <span className="text-xl font-bold text-blue-600 print:text-2xl">{formatCurrency(item.price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
