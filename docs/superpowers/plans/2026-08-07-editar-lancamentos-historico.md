# Edição de lançamentos no Histórico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir editar um lançamento de venda completo (itens + dados) na aba Histórico, via modal, com o total recalculado no servidor.

**Architecture:** Novo endpoint `PUT /api/sales/[id]` valida, recalcula o total a partir dos itens, atualiza a linha em `sales` e substitui os `sale_items`. Na UI, um botão "Editar" em cada linha do Histórico abre um modal que edita um rascunho da venda e envia ao PUT. A tela de Vendas não é tocada.

**Tech Stack:** Next.js 16.2.4 (App Router, Turbopack), React 19, Supabase JS (service role via `getSupabase()`), Tailwind CSS v4.

## Global Constraints

- **Next.js modificado:** conforme `AGENTS.md`, esta versão do Next tem breaking changes — consultar `node_modules/next/dist/docs/` antes de escrever código de framework e respeitar avisos de deprecação.
- **App em produção:** não alterar a tela de Vendas (`src/app/(protected)/vendas/page.tsx`) nem o fluxo de login. Manter as mudanças isoladas no Histórico e na API de sales.
- **Acesso a dados:** sempre via `getSupabase()` de `@/lib/supabase` (service role, `persistSession: false`).
- **Rotas protegidas:** `/api/*` (exceto `/api/auth`) exigem o cookie `auth_token === AUTH_SECRET` (ver `src/proxy.ts`). Testes via curl precisam enviar esse cookie.
- **Total nunca vem do cliente:** o servidor recalcula `subtotal` e `total` a partir dos itens.
- **Copy em português.** Padrão de commit termina com:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Sem framework de testes** no projeto: a verificação é `npx tsc --noEmit` + smoke test por curl (backend) + teste de aceitação no navegador (frontend).

## File Structure

- `src/app/api/sales/[id]/route.ts` — **Modify.** Adicionar handler `PUT` ao lado do `DELETE` existente. Responsável pela validação, recálculo e persistência.
- `src/lib/format.ts` — **Modify.** Adicionar helper `isoToDatetimeLocal` (novo export, não altera funções existentes).
- `src/app/(protected)/vendas/historico/page.tsx` — **Modify.** Botão "Editar" + modal de edição + busca do catálogo + envio ao PUT.

---

### Task 1: Backend — `PUT /api/sales/[id]`

**Files:**
- Modify: `src/app/api/sales/[id]/route.ts`

**Interfaces:**
- Consumes: `getSupabase()` de `@/lib/supabase`; tabelas `sales` e `sale_items`.
- Produces: rota `PUT /api/sales/:id` que recebe
  `{ payment_method: string, notes: string | null, created_at?: string (ISO), items: Array<{ catalog_item_id: string | null, item_name: string, unit_price: number, quantity: number }> }`
  e retorna `{ ok: true }` (200) ou `{ error: string }` (400 validação / 500 banco).

- [ ] **Step 1: Adicionar o handler PUT**

Abrir `src/app/api/sales/[id]/route.ts` e adicionar a função abaixo após o `DELETE` existente (o import de `NextRequest, NextResponse` e `getSupabase` já existe no arquivo):

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sai com código 0, sem erros.

- [ ] **Step 3: Smoke test do endpoint via curl**

Pré-requisito: dev server rodando (`npm run dev`, já em uso nesta sessão) em `http://localhost:3000`.

Rodar (Git Bash), a partir da raiz do projeto:

```bash
SECRET=$(grep '^AUTH_SECRET=' .env.local | cut -d= -f2- | tr -d '"'"'"'"'\r')
# Pega o id e os itens de uma venda existente
SALE=$(curl -s "http://localhost:3000/api/sales?period=all" -H "Cookie: auth_token=$SECRET")
echo "$SALE" | head -c 400; echo
ID=$(echo "$SALE" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.data[0].id)})")
echo "ID de teste: $ID"
# PUT idempotente: reenvia os mesmos itens da 1a venda com pagamento 'Pix'
echo "$SALE" | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  const sale=JSON.parse(s).data[0];
  const body={payment_method:'Pix',notes:sale.notes,created_at:sale.created_at,
    items:sale.sale_items.map(i=>({catalog_item_id:i.catalog_item_id,item_name:i.item_name,unit_price:i.unit_price,quantity:i.quantity}))};
  process.stdout.write(JSON.stringify(body));
});" > /tmp/put_body.json
curl -s -X PUT "http://localhost:3000/api/sales/$ID" -H "Content-Type: application/json" -H "Cookie: auth_token=$SECRET" --data @/tmp/put_body.json
echo
```

Expected: a última linha imprime `{"ok":true}`. (O pagamento da 1ª venda passa a "Pix" e o total é recalculado a partir dos itens.)

- [ ] **Step 4: Teste de validação (deve rejeitar venda sem itens)**

```bash
SECRET=$(grep '^AUTH_SECRET=' .env.local | cut -d= -f2- | tr -d '"'"'"'"'\r')
curl -s -o /dev/null -w "%{http_code}\n" -X PUT "http://localhost:3000/api/sales/qualquer-id" \
  -H "Content-Type: application/json" -H "Cookie: auth_token=$SECRET" \
  --data '{"payment_method":"Pix","items":[]}'
```

Expected: imprime `400`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/sales/[id]/route.ts"
git commit -m "feat: endpoint PUT para editar venda (dados + itens)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Frontend — modal de edição no Histórico

**Files:**
- Modify: `src/lib/format.ts`
- Modify: `src/app/(protected)/vendas/historico/page.tsx`

**Interfaces:**
- Consumes: `PUT /api/sales/:id` (Task 1); `GET /api/catalog` (retorna `CatalogItem[]`); `GET /api/sales` (já usado). Tipos `SaleWithItems`, `CatalogItem` de `@/lib/supabase`; `formatCurrency`, `formatDate` de `@/lib/format`.
- Produces: nada consumido por tarefas posteriores (última tarefa).

- [ ] **Step 1: Adicionar helper de data em `format.ts`**

Adicionar ao final de `src/lib/format.ts`:

```ts
/** Converte um ISO para o valor de um <input type="datetime-local"> no fuso local. */
export function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
```

- [ ] **Step 2: Atualizar imports e constantes no topo de `historico/page.tsx`**

Trocar a linha de import de tipos e a de format, e adicionar a constante de pagamentos.

Import de format (linha ~3) passa a:

```ts
import { formatCurrency, formatDate, isoToDatetimeLocal } from '@/lib/format'
```

Import de tipos (linha ~5) passa a:

```ts
import type { SaleWithItems, CatalogItem } from '@/lib/supabase'
```

Logo após `const PAYMENTS = [...]` (linha ~14), adicionar:

```ts
const PAYMENT_METHODS = ['Dinheiro', 'Pix', 'Cartão Crédito', 'Cartão Débito']
```

- [ ] **Step 3: Adicionar tipos do rascunho e estado**

Antes de `export default function HistoricoPage()`, adicionar os tipos:

```ts
type EditDraftItem = {
  key: string
  catalog_item_id: string | null
  item_name: string
  unit_price: number
  quantity: number
}
type EditDraft = {
  id: string
  payment_method: string
  notes: string
  saleDate: string
  items: EditDraftItem[]
}
```

Dentro do componente, junto aos outros `useState` (após a linha do `toast`, ~linha 36), adicionar:

```ts
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [addItemId, setAddItemId] = useState('')
```

- [ ] **Step 4: Buscar o catálogo ao montar**

Adicionar um `useEffect` logo após os `useState` (antes do `fetchPage`):

```ts
  useEffect(() => {
    fetch('/api/catalog')
      .then(r => r.json())
      .then((items: CatalogItem[]) => setCatalog(items.filter(i => i.active)))
      .catch(() => {})
  }, [])
```

- [ ] **Step 5: Adicionar as funções do rascunho**

Adicionar dentro do componente, após `handleDelete`:

```ts
  function openEdit(sale: SaleWithItems) {
    setAddItemId('')
    setEditDraft({
      id: sale.id,
      payment_method: sale.payment_method,
      notes: sale.notes ?? '',
      saleDate: isoToDatetimeLocal(sale.created_at),
      items: sale.sale_items.map(si => ({
        key: si.id,
        catalog_item_id: si.catalog_item_id,
        item_name: si.item_name,
        unit_price: si.unit_price,
        quantity: si.quantity,
      })),
    })
  }

  function updateDraftItem(key: string, patch: Partial<EditDraftItem>) {
    setEditDraft(d => d && { ...d, items: d.items.map(it => it.key === key ? { ...it, ...patch } : it) })
  }

  function removeDraftItem(key: string) {
    setEditDraft(d => d && { ...d, items: d.items.filter(it => it.key !== key) })
  }

  function addDraftItem(catalogId: string) {
    const item = catalog.find(c => c.id === catalogId)
    if (!item) return
    setEditDraft(d => d && {
      ...d,
      items: [...d.items, {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        catalog_item_id: item.id,
        item_name: item.name,
        unit_price: item.price,
        quantity: 1,
      }],
    })
    setAddItemId('')
  }

  async function handleSaveEdit() {
    if (!editDraft) return
    const valid = editDraft.items.length > 0 &&
      editDraft.items.every(it => it.unit_price > 0 && Number.isInteger(it.quantity) && it.quantity >= 1)
    if (!valid) return
    setSaving(true)
    const res = await fetch(`/api/sales/${editDraft.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_method: editDraft.payment_method,
        notes: editDraft.notes || null,
        created_at: new Date(editDraft.saleDate).toISOString(),
        items: editDraft.items.map(it => ({
          catalog_item_id: it.catalog_item_id,
          item_name: it.item_name,
          unit_price: it.unit_price,
          quantity: it.quantity,
        })),
      }),
    })
    setSaving(false)
    if (res.ok) {
      setEditDraft(null)
      setToast({ msg: 'Venda atualizada.', type: 'success' })
      fetchPage(1, false, { period, payment, dateFrom, dateTo })
    } else {
      setToast({ msg: 'Erro ao atualizar venda.', type: 'error' })
    }
  }
```

- [ ] **Step 6: Adicionar os derivados de total/validação antes do `return`**

Logo antes do `return (` do componente, adicionar:

```ts
  const draftTotal = editDraft?.items.reduce((s, it) => s + it.unit_price * it.quantity, 0) ?? 0
  const draftValid = !!editDraft && editDraft.items.length > 0 &&
    editDraft.items.every(it => it.unit_price > 0 && Number.isInteger(it.quantity) && it.quantity >= 1)
```

- [ ] **Step 7: Adicionar o botão "Editar" na célula de ações**

Na tabela, substituir a célula de ações (hoje só com "Excluir", ~linhas 190-198) por:

```tsx
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => openEdit(sale)}
                    className="text-blue-500 hover:text-blue-700 text-xs font-medium hover:underline mr-3"
                    title="Editar venda"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setConfirmId(sale.id)}
                    className="text-red-400 hover:text-red-600 text-xs font-medium hover:underline"
                    title="Excluir venda"
                  >
                    Excluir
                  </button>
                </td>
```

- [ ] **Step 8: Adicionar o modal de edição**

Adicionar o bloco abaixo logo antes do bloco `{confirmId && (` (o modal de exclusão):

```tsx
      {editDraft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">Editar venda</h3>

            {/* Itens */}
            <div className="space-y-2">
              {editDraft.items.map(it => (
                <div key={it.key} className="flex items-center gap-2 text-sm border-b pb-2">
                  <span className="flex-1 min-w-0 truncate font-medium">{it.item_name}</span>
                  <input
                    type="number" min={1} step={1} value={it.quantity}
                    onChange={e => updateDraftItem(it.key, { quantity: parseInt(e.target.value || '1', 10) })}
                    className="w-14 border border-gray-200 rounded px-2 py-1 text-center focus:outline-none focus:border-blue-400"
                    title="Quantidade"
                  />
                  <span className="text-gray-400">×</span>
                  <input
                    type="number" min={0} step="0.01" value={it.unit_price}
                    onChange={e => updateDraftItem(it.key, { unit_price: parseFloat(e.target.value || '0') })}
                    className="w-20 border border-gray-200 rounded px-2 py-1 text-right focus:outline-none focus:border-blue-400"
                    title="Preço unitário"
                  />
                  <span className="w-20 text-right font-semibold text-gray-700">{formatCurrency(it.unit_price * it.quantity)}</span>
                  <button onClick={() => removeDraftItem(it.key)} className="text-red-400 hover:text-red-600 text-xs" title="Remover item">✕</button>
                </div>
              ))}
              {editDraft.items.length === 0 && (
                <p className="text-xs text-red-500">A venda precisa ter pelo menos um item.</p>
              )}
            </div>

            {/* Adicionar item */}
            <select
              value={addItemId}
              onChange={e => addDraftItem(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">+ Adicionar item...</option>
              {catalog.map(c => <option key={c.id} value={c.id}>{c.name} — {formatCurrency(c.price)}</option>)}
            </select>

            {/* Pagamento */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <label key={m} className={`flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 text-sm transition-colors ${editDraft.payment_method === m ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}>
                    <input type="radio" name="edit-payment" value={m} checked={editDraft.payment_method === m} onChange={() => setEditDraft(d => d && { ...d, payment_method: m })} className="accent-blue-600" />
                    {m}
                  </label>
                ))}
              </div>
            </div>

            {/* Data */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Data da venda</p>
              <input
                type="datetime-local"
                value={editDraft.saleDate}
                onChange={e => setEditDraft(d => d && { ...d, saleDate: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            {/* Observações */}
            <textarea
              value={editDraft.notes}
              onChange={e => setEditDraft(d => d && { ...d, notes: e.target.value })}
              placeholder="Observações (opcional)"
              rows={2}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm resize-none focus:outline-none focus:border-blue-400"
            />

            {/* Total */}
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="font-semibold text-gray-600">Total</span>
              <span className="text-xl font-bold text-gray-900">{formatCurrency(draftTotal)}</span>
            </div>

            {/* Ações */}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditDraft(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSaveEdit} disabled={saving || !draftValid} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-medium">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: sai com código 0, sem erros.

- [ ] **Step 10: Teste de aceitação no navegador (pelo usuário)**

Com o dev server em `http://localhost:3000`, logar e ir em **Vendas → Histórico**. Em um lançamento de teste:
1. Clicar em **Editar** → o modal abre com os itens e dados corretos.
2. Alterar quantidade e preço de um item → o **Total** atualiza ao vivo.
3. **Adicionar item** pelo seletor e **remover** um item.
4. Trocar **pagamento**, **data** e **observações**.
5. Clicar **Salvar** → toast "Venda atualizada." e a linha reflete as mudanças.
6. Reabrir o Editar para confirmar que os valores persistiram.

Expected: todas as edições persistem; total = soma dos itens.

- [ ] **Step 11: Commit**

```bash
git add src/lib/format.ts "src/app/(protected)/vendas/historico/page.tsx"
git commit -m "feat: editar lançamentos no histórico de vendas

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** itens (add/remover/qty/preço) → Task 2 steps 5,8; pagamento/data/observações → Task 2 step 8; recálculo do total no servidor → Task 1 step 1; validação (≥1 item, preço>0, qty≥1) → Task 1 step 1 + Task 2 steps 5/6; substituição de itens → Task 1 step 1; botão Editar + modal → Task 2 steps 7/8; catálogo para "adicionar item" → Task 2 step 4; verificação (typecheck + curl + aceitação) → Task 1 steps 2-4, Task 2 steps 9-10. Sem lacunas.
- **Placeholder scan:** sem TBD/TODO; todo passo de código traz o código real.
- **Type consistency:** `EditDraft`/`EditDraftItem` definidos em Task 2 step 3 e usados de forma consistente nos steps 5,6,8; corpo do PUT em Task 1 casa com o `body` enviado em `handleSaveEdit` (Task 2 step 5).
