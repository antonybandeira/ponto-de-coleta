# Venda por Código de Barras + Tabela de Preços — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the employee scan catalog items (envelopes, boxes) with a USB barcode scanner to add them to the cart on the Vendas screen automatically, and provide two printable pages: barcode labels (for the scanner cheat-sheet next to the computer) and a customer-facing price table (for the counter).

**Architecture:** Add a `barcode` column to `catalog_items` (Supabase/Postgres). A small server-side helper generates unique EAN-13-style barcodes. The catalog API generates a barcode on item creation and exposes an endpoint to backfill one for existing items. The Vendas screen gets an always-focused hidden input that captures scanner keystrokes (digits + Enter) and matches against the already-loaded catalog. Two new pages under `/catalogo` render printable views using `jsbarcode` for the barcode SVGs and `@media print` CSS.

**Tech Stack:** Next.js (App Router) 16, React 19, Supabase (Postgres), TypeScript, Tailwind CSS, `jsbarcode` (new dependency).

**Note on testing:** This codebase has no test framework configured (no Jest/Vitest/RTL, no `test` script in `package.json`). Following the existing project convention, this plan uses manual verification via the dev server instead of automated tests. Each task's verification step tells you exactly what to run and what to check in the browser.

---

### Task 1: Add `barcode` column to `catalog_items`

**Files:**
- Create: `supabase/add_barcode_column.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Adiciona coluna de código de barras aos itens do catálogo
-- Execute este script no SQL Editor do painel Supabase

ALTER TABLE public.catalog_items
  ADD COLUMN barcode text UNIQUE;
```

- [ ] **Step 2: Run it against the Supabase project**

Open the Supabase SQL Editor for this project and run the contents of `supabase/add_barcode_column.sql`. Verify it succeeds with no errors, and that `catalog_items` now has a `barcode` column (nullable, unique) — check via Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/add_barcode_column.sql
git commit -m "feat: add barcode column to catalog_items"
```

---

### Task 2: Barcode generation helper

**Files:**
- Create: `src/lib/barcode.ts`

- [ ] **Step 1: Write the helper**

```typescript
// Gera códigos de barras únicos no formato EAN-13, prefixo fixo 200
// (faixa reservada para uso interno, nunca emitida pela GS1 para produtos reais).
const PREFIX = '200'

function calculateCheckDigit(digits12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = Number(digits12[i])
    sum += i % 2 === 0 ? digit : digit * 3
  }
  return (10 - (sum % 10)) % 10
}

/**
 * Recebe a lista de barcodes já existentes (podem incluir nulls/outros formatos)
 * e retorna o próximo código EAN-13 disponível com o prefixo interno.
 */
export function nextBarcode(existingBarcodes: (string | null)[]): string {
  const usedSequences = existingBarcodes
    .filter((b): b is string => !!b && b.startsWith(PREFIX) && b.length === 13)
    .map(b => Number(b.slice(PREFIX.length, 12)))
    .filter(n => !isNaN(n))

  const nextSeq = usedSequences.length > 0 ? Math.max(...usedSequences) + 1 : 1
  const seqStr = String(nextSeq).padStart(9, '0')
  const digits12 = PREFIX + seqStr
  const checkDigit = calculateCheckDigit(digits12)
  return digits12 + String(checkDigit)
}
```

- [ ] **Step 2: Manual verification**

Run: `npx tsx -e "import { nextBarcode } from './src/lib/barcode'; console.log(nextBarcode([])); console.log(nextBarcode(['2000000000017']))"`

Expected output: two 13-digit strings starting with `200`, the second one's sequence one higher than the first (e.g. `2000000000017` then `2000000000024` — exact check digits will follow the math above, just confirm both are 13 digits, start with `200`, and are different from each other).

If `tsx` is not available, add it temporarily with `npx --yes tsx ...` (it runs via npx without installing as a dependency).

- [ ] **Step 3: Commit**

```bash
git add src/lib/barcode.ts
git commit -m "feat: add EAN-13 barcode generation helper"
```

---

### Task 3: Expose `barcode` on the `CatalogItem` type

**Files:**
- Modify: `src/lib/supabase.ts:3-10`

- [ ] **Step 1: Add the field**

In `src/lib/supabase.ts`, update the `CatalogItem` type:

```typescript
export type CatalogItem = {
  id: string
  name: string
  price: number
  active: boolean
  sort_order: number
  created_at: string
  barcode: string | null
}
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors related to `CatalogItem` (there may be pre-existing unrelated errors — only check that nothing about `barcode` shows up, since the column already exists in the DB from Task 1 and Supabase's `select('*')` will return it).

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add barcode field to CatalogItem type"
```

---

### Task 4: Generate barcode automatically on catalog item creation

**Files:**
- Modify: `src/app/api/catalog/route.ts`

- [ ] **Step 1: Update the POST handler**

Replace the full contents of `src/app/api/catalog/route.ts` with:

```typescript
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
```

- [ ] **Step 2: Manual verification**

Run `npm run dev`, then in the Catálogo screen (`/catalogo`), create a new item ("Teste Barcode", price `1,00`). Check via Supabase Table Editor (or the Network tab response of the `POST /api/catalog` call) that the new row has a non-null `barcode` starting with `200`.

Then delete the test item from the Catálogo screen to clean up.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/catalog/route.ts
git commit -m "feat: auto-generate barcode when creating catalog items"
```

---

### Task 5: Backfill endpoint for items missing a barcode

**Files:**
- Create: `src/app/api/catalog/[id]/barcode/route.ts`

- [ ] **Step 1: Write the route**

```typescript
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
```

- [ ] **Step 2: Manual verification**

With the dev server running, pick an existing catalog item with `barcode = null` (e.g. via Supabase Table Editor, or any item created before Task 1's migration). Run:

`curl -X POST http://localhost:3000/api/catalog/<item-id>`  — wait, the route is `/api/catalog/<item-id>/barcode`, so:

`curl -X POST http://localhost:3000/api/catalog/<item-id>/barcode`

Expected: JSON response for the item with a non-null `barcode` field starting with `200`. Confirm in Supabase Table Editor that the row was updated.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/catalog/[id]/barcode/route.ts"
git commit -m "feat: add endpoint to backfill barcode for existing items"
```

---

### Task 6: "Gerar código" button + barcode column in Catálogo screen

**Files:**
- Modify: `src/app/(protected)/catalogo/page.tsx`

- [ ] **Step 1: Add a `generateBarcode` handler**

In `src/app/(protected)/catalogo/page.tsx`, add this function near `toggleActive`:

```typescript
  async function generateBarcode(item: CatalogItem) {
    const res = await fetch(`/api/catalog/${item.id}/barcode`, { method: 'POST' })
    if (res.ok) { load(); setToast({ msg: 'Código gerado!', type: 'success' }) }
    else setToast({ msg: 'Erro ao gerar código.', type: 'error' })
  }
```

- [ ] **Step 2: Add a "Código" column to the table**

In the `<thead>`, add a new `<th>` after "Preço":

```tsx
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Código</th>
```

In the `<tbody>` row, add a new `<td>` after the price `<td>` (right before the "Status" `<td>`):

```tsx
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                  {item.barcode ? item.barcode : (
                    <button
                      onClick={() => generateBarcode(item)}
                      className="text-blue-600 hover:underline font-sans font-medium"
                    >
                      Gerar código
                    </button>
                  )}
                </td>
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`, open `/catalogo`. Confirm the table shows a "Código" column. For any item without a barcode, click "Gerar código" and confirm it's replaced by a numeric code and a success toast appears. Refresh the page and confirm the code persists.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(protected)/catalogo/page.tsx"
git commit -m "feat: show barcode and add generate button in catalog screen"
```

---

### Task 7: Scanner input on the Vendas screen

**Files:**
- Modify: `src/app/(protected)/vendas/page.tsx`

- [ ] **Step 1: Add scanner state and a ref for the hidden input**

In `src/app/(protected)/vendas/page.tsx`, add to the imports:

```typescript
import { useEffect, useState, useCallback, useRef } from 'react'
```

(replacing the existing `useEffect, useState, useCallback` import line)

Add new state near the other `useState` calls:

```typescript
  const [scanValue, setScanValue] = useState('')
  const scanInputRef = useRef<HTMLInputElement>(null)
```

- [ ] **Step 2: Add the scan handler**

Add this function near `addItem`:

```typescript
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
```

- [ ] **Step 3: Add an effect to keep the scanner input focused**

Add near the other `useEffect` calls:

```typescript
  useEffect(() => {
    scanInputRef.current?.focus()
  }, [catalog])
```

- [ ] **Step 4: Render the scanner input**

In the JSX, right after the opening `<h2>Itens</h2>` line inside the catalog column (before the `<div className="grid ...">`), add:

```tsx
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
```

(Using a visible-but-unobtrusive input rather than a hidden one — this gives the employee visual confirmation the scanner is "armed" and lets them click into it if focus is ever lost, e.g. after editing a cart price.)

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open `/vendas`. Confirm the new input is visible and focused by default. Pick an item that has a `barcode` (from Task 4/6), and manually type its barcode value into the input then press Enter (simulating a scan) — confirm the item is added to the cart with quantity 1, and the input clears. Type a bogus code (e.g. `0000000000000`) and press Enter — confirm a "Código não encontrado." toast appears and nothing is added to the cart. Click elsewhere on the page, then check the scanner input regains focus on blur.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(protected)/vendas/page.tsx"
git commit -m "feat: scan barcode to add items to cart on vendas screen"
```

---

### Task 8: Print-safe header (hide nav when printing)

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add a print rule**

Append to `src/app/globals.css`:

```css
@media print {
  header {
    display: none;
  }
}
```

- [ ] **Step 2: Manual verification**

This will be verified together with Tasks 9 and 10 (the print preview should not show the top nav bar). No standalone check needed yet.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: hide header when printing"
```

---

### Task 9: Install `jsbarcode`

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install the dependency**

Run: `npm install jsbarcode`

- [ ] **Step 2: Verify**

Check `package.json` now lists `jsbarcode` under `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jsbarcode dependency"
```

---

### Task 10: Barcode label sheet (`/catalogo/etiquetas`)

**Files:**
- Create: `src/app/(protected)/catalogo/etiquetas/page.tsx`
- Create: `src/components/BarcodeSvg.tsx`

- [ ] **Step 1: Create a small barcode-rendering component**

```tsx
// src/components/BarcodeSvg.tsx
'use client'
import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

type Props = {
  value: string
  height?: number
}

export default function BarcodeSvg({ value, height = 40 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, value, {
        format: 'EAN13',
        height,
        fontSize: 12,
        margin: 4,
      })
    }
  }, [value, height])

  return <svg ref={svgRef} />
}
```

- [ ] **Step 2: Create the labels page**

```tsx
// src/app/(protected)/catalogo/etiquetas/page.tsx
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
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`, open `/catalogo/etiquetas`. Confirm it lists every active item that has a barcode, each showing name, price, and a scannable-looking barcode image. Open the browser's print preview (Ctrl+P) and confirm the header/nav and the "Imprimir" button/title are hidden, leaving just the grid of labels.

- [ ] **Step 4: Commit**

```bash
git add src/components/BarcodeSvg.tsx "src/app/(protected)/catalogo/etiquetas/page.tsx"
git commit -m "feat: add printable barcode labels page"
```

---

### Task 11: Customer price table (`/catalogo/tabela-precos`)

**Files:**
- Create: `src/app/(protected)/catalogo/tabela-precos/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// src/app/(protected)/catalogo/tabela-precos/page.tsx
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
```

- [ ] **Step 2: Manual verification**

Run `npm run dev`, open `/catalogo/tabela-precos`. Confirm it lists every active item with name and price, large and legible. Open print preview (Ctrl+P) and confirm the header/nav and "Imprimir" button/title are hidden, leaving a clean list suitable for a counter sign.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(protected)/catalogo/tabela-precos/page.tsx"
git commit -m "feat: add printable customer price table page"
```

---

### Task 12: Link the two print pages from the Catálogo screen

**Files:**
- Modify: `src/app/(protected)/catalogo/page.tsx`

- [ ] **Step 1: Add navigation buttons**

In `src/app/(protected)/catalogo/page.tsx`, add the import:

```typescript
import Link from 'next/link'
```

In the header row (the `<div className="flex items-center justify-between">` containing the "Catálogo" title and "+ Novo item" button), wrap the existing button and add two links, so the row becomes:

```tsx
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Catálogo</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/catalogo/etiquetas"
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Imprimir etiquetas
          </Link>
          <Link
            href="/catalogo/tabela-precos"
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Tabela de preços
          </Link>
          <button
            onClick={() => setShowForm(v => !v)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Novo item
          </button>
        </div>
      </div>
```

- [ ] **Step 2: Manual verification**

Run `npm run dev`, open `/catalogo`. Confirm two new buttons/links ("Imprimir etiquetas" and "Tabela de preços") appear next to "+ Novo item", and clicking each navigates to the corresponding page from Tasks 10 and 11.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(protected)/catalogo/page.tsx"
git commit -m "feat: link barcode label and price table pages from catalog screen"
```

---

### Task 13: End-to-end manual walkthrough

**Files:** none (verification only)

- [ ] **Step 1: Full flow check**

With `npm run dev` running:

1. Go to `/catalogo`, create a new item "Envelope Teste" at `2,50` — confirm it gets a barcode automatically (Task 4/6).
2. Click "Imprimir etiquetas" — confirm "Envelope Teste" appears with a barcode image (Task 10).
3. Note the barcode value shown in the "Código" column on `/catalogo`.
4. Go to `/vendas`, type that barcode value into the scan input and press Enter — confirm "Envelope Teste" lands in the cart at `R$ 2,50` (Task 7).
5. Finish the sale (any payment method) — confirm it succeeds like before (pre-existing flow, unchanged).
6. Go to `/catalogo/tabela-precos` — confirm "Envelope Teste" appears with name + price, no barcode shown (Task 11).
7. Go back to `/catalogo` and delete "Envelope Teste" to clean up test data.

- [ ] **Step 2: No commit needed**

This task is verification-only; nothing to commit. If any step fails, fix the relevant task above and re-run this walkthrough.

---

## Self-review notes

- **Spec coverage:** catalog barcode field + auto-generation (Tasks 1–6), scanner capture on Vendas (Task 7), printable labels page (Tasks 8–10), printable price table (Tasks 8, 9, 11), navigation between catalog and the two print pages (Task 12), end-to-end check (Task 13). All five spec components covered.
- **Type consistency:** `CatalogItem.barcode: string | null` (Task 3) is used consistently across `route.ts` (Task 4/5), `catalogo/page.tsx` (Task 6/12), `vendas/page.tsx` (Task 7), and both print pages (Tasks 10/11).
- **No placeholders:** every step has complete code; no "TBD" or "similar to Task N" shortcuts.
