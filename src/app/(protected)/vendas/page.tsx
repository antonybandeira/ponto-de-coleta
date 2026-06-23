'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { formatCurrency } from '@/lib/format'
import Toast from '@/components/Toast'
import type { CatalogItem } from '@/lib/supabase'

type CartItem = {
  id: string
  name: string
  unit_price: number
  quantity: number
}

const PAYMENT_METHODS = ['Dinheiro', 'Pix', 'Cartão Crédito', 'Cartão Débito']

function defaultDatetime() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 16)
}

export default function VendasPage() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [payment, setPayment] = useState('Dinheiro')
  const [notes, setNotes] = useState('')
  const [saleDate, setSaleDate] = useState(defaultDatetime)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [scanValue, setScanValue] = useState('')
  const scanInputRef = useRef<HTMLInputElement>(null)

  // Edição de preço no carrinho
  const [editingPrice, setEditingPrice] = useState<string | null>(null)
  const [editPriceValue, setEditPriceValue] = useState('')

  useEffect(() => {
    fetch('/api/catalog').then(r => r.json()).then((items: CatalogItem[]) =>
      setCatalog(items.filter(i => i.active))
    )
  }, [])

  useEffect(() => {
    scanInputRef.current?.focus()
  }, [catalog])

  function addItem(item: CatalogItem) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { id: item.id, name: item.name, unit_price: item.price, quantity: 1 }]
    })
  }

  function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = scanValue.trim()
    setScanValue('')
    if (!code) return
    const item = catalog.find(i => i.barcode === code)
    if (item) {
      addItem(item)
    } else {
      setToast('Código não encontrado.')
    }
  }

  function updateQty(id: string, delta: number) {
    setCart(prev =>
      prev.map(c => c.id === id ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c)
    )
  }

  function removeItem(id: string) {
    setCart(prev => prev.filter(c => c.id !== id))
  }

  function startEditPrice(item: CartItem) {
    setEditingPrice(item.id)
    setEditPriceValue(item.unit_price.toFixed(2).replace('.', ','))
  }

  function saveEditPrice(id: string) {
    const parsed = parseFloat(editPriceValue.replace(',', '.'))
    if (!isNaN(parsed) && parsed > 0) {
      setCart(prev => prev.map(c => c.id === id ? { ...c, unit_price: parsed } : c))
    }
    setEditingPrice(null)
  }

  const total = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0)

  const handleFinalize = useCallback(async () => {
    if (cart.length === 0) return
    setLoading(true)
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_method: payment,
        total,
        notes: notes || null,
        created_at: new Date(saleDate).toISOString(),
        items: cart.map(c => ({
          catalog_item_id: c.id,
          item_name: c.name,
          unit_price: c.unit_price,
          quantity: c.quantity,
          subtotal: c.unit_price * c.quantity,
        })),
      }),
    })
    setLoading(false)
    if (res.ok) {
      setCart([])
      setNotes('')
      setPayment('Dinheiro')
      setSaleDate(defaultDatetime())
      setToast('Venda registrada com sucesso!')
    } else {
      setToast('Erro ao registrar venda.')
    }
  }, [cart, payment, total, notes, saleDate])

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[calc(100vh-80px)]">
      {/* Catalog grid */}
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Itens</h2>
        <form onSubmit={handleScanSubmit} className="mb-3">
          <input
            ref={scanInputRef}
            value={scanValue}
            onChange={e => setScanValue(e.target.value)}
            onBlur={() => scanInputRef.current?.focus()}
            placeholder="Bipe o código de barras aqui..."
            className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            autoComplete="off"
          />
        </form>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {catalog.map(item => (
            <button
              key={item.id}
              onClick={() => addItem(item)}
              className="bg-white border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl p-4 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 min-h-[100px]"
            >
              <span className="font-semibold text-gray-800 text-center text-sm leading-tight">{item.name}</span>
              <span className="text-blue-600 font-bold text-base">{formatCurrency(item.price)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <div className="w-full lg:w-80 xl:w-96 bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3 self-start sticky top-16">
        <h2 className="text-lg font-semibold text-gray-700">Carrinho</h2>

        {cart.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">Nenhum item adicionado</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {cart.map(item => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <div className="flex items-center gap-1 text-gray-400">
                    {editingPrice === item.id ? (
                      <input
                        autoFocus
                        value={editPriceValue}
                        onChange={e => setEditPriceValue(e.target.value)}
                        onBlur={() => saveEditPrice(item.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEditPrice(item.id)
                          if (e.key === 'Escape') setEditingPrice(null)
                        }}
                        className="border border-blue-400 rounded px-1 py-0.5 text-xs w-16 focus:outline-none text-gray-700"
                      />
                    ) : (
                      <button
                        onClick={() => startEditPrice(item)}
                        className="text-blue-600 hover:underline font-medium text-xs"
                        title="Clique para editar o preço"
                      >
                        {formatCurrency(item.unit_price)}
                      </button>
                    )}
                    <span>× {item.quantity} =</span>
                    <span className="text-gray-700 font-semibold">{formatCurrency(item.unit_price * item.quantity)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 font-bold text-gray-600 flex items-center justify-center">−</button>
                  <span className="w-6 text-center font-semibold">{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 font-bold text-gray-600 flex items-center justify-center">+</button>
                  <button onClick={() => removeItem(item.id)} className="ml-1 text-red-400 hover:text-red-600 text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <div className="border-t pt-3 flex justify-between items-center">
          <span className="font-semibold text-gray-600">Total</span>
          <span className="text-2xl font-bold text-gray-900">{formatCurrency(total)}</span>
        </div>

        {/* Payment */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pagamento</p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map(m => (
              <label
                key={m}
                className={`flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 text-sm transition-colors ${payment === m ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}
              >
                <input type="radio" name="payment" value={m} checked={payment === m} onChange={() => setPayment(m)} className="accent-blue-600" />
                {m}
              </label>
            ))}
          </div>
        </div>

        {/* Sale date */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Data da venda</p>
          <input
            type="datetime-local"
            value={saleDate}
            onChange={e => setSaleDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>

        {/* Notes */}
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Observações (opcional)"
          rows={2}
          className="border border-gray-200 rounded-lg p-2 text-sm resize-none focus:outline-none focus:border-blue-400"
        />

        <button
          onClick={handleFinalize}
          disabled={cart.length === 0 || loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl text-lg transition-colors active:scale-95"
        >
          {loading ? 'Registrando...' : 'Finalizar Venda'}
        </button>
      </div>

      {toast && <Toast message={toast} type={toast.includes('Erro') ? 'error' : 'success'} onClose={() => setToast(null)} />}
    </div>
  )
}
