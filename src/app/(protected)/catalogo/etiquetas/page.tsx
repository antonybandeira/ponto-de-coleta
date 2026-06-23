'use client'
import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/format'
import BarcodeSvg from '@/components/BarcodeSvg'
import type { CatalogItem } from '@/lib/supabase'

export default function EtiquetasPage() {
  const [items, setItems] = useState<CatalogItem[]>([])

  useEffect(() => {
    fetch('/api/catalog')
      .then(r => r.json())
      .then((data: CatalogItem[]) => setItems(data.filter(i => i.active && i.barcode)))
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-gray-800">Etiquetas para impressão</h1>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Imprimir
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-400 text-sm print:hidden">
          Nenhum item ativo com código de barras. Gere códigos na tela de Catálogo primeiro.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
          {items.map(item => (
            <div
              key={item.id}
              className="border border-gray-300 rounded-lg p-3 flex flex-col items-center text-center print:break-inside-avoid"
            >
              <span className="font-semibold text-gray-800 text-sm">{item.name}</span>
              <span className="text-blue-600 font-bold text-sm mb-1">{formatCurrency(item.price)}</span>
              <BarcodeSvg value={item.barcode!} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
