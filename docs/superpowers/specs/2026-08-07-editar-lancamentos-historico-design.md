# Edição de lançamentos no Histórico de Vendas

Data: 2026-08-07

## Problema

Na aba **Histórico de Vendas** (`/vendas/historico`), cada lançamento só oferece a
ação de **Excluir**. Quando um lançamento é registrado com erro (item, quantidade,
preço, forma de pagamento, data ou observação incorretos), a única saída hoje é
excluir e recriar a venda na tela de Vendas. O usuário precisa poder **editar** um
lançamento existente.

## Objetivo

Permitir a edição completa de um lançamento de venda direto na tela de Histórico,
incluindo os itens e os dados da venda, com o total recalculado a partir dos itens.

## Escopo

Editável:

- **Itens**: adicionar item (a partir do catálogo), remover item, alterar quantidade
  e preço unitário de cada item.
- **Forma de pagamento** (Dinheiro, Pix, Cartão Crédito, Cartão Débito).
- **Data/hora** da venda.
- **Observações**.

Recalculado automaticamente (não editável manualmente):

- **Subtotal** de cada item (`preço unitário × quantidade`).
- **Total** da venda (soma dos subtotais).

### Fora de escopo (YAGNI)

- Histórico de auditoria / marca visual de "editado".
- Edição inline direto na linha da tabela.
- Override manual do total (o total sempre deriva dos itens).
- Alteração da tela de Vendas (a edição é isolada no Histórico).

## Abordagem escolhida

**Modal de edição na própria tela de Histórico** — segue o mesmo padrão do modal de
exclusão que já existe na página e mantém a edição isolada, sem tocar na tela de
Vendas (que é o fluxo de produção principal).

## Design

### Backend — `PUT /api/sales/[id]`

Novo handler `PUT` no arquivo existente `src/app/api/sales/[id]/route.ts`
(hoje só tem `DELETE`).

**Request body:**

```jsonc
{
  "payment_method": "Pix",
  "notes": "texto ou null",
  "created_at": "2026-08-07T12:34:00.000Z", // ISO
  "items": [
    { "catalog_item_id": "uuid ou null", "item_name": "Item X", "unit_price": 10.5, "quantity": 2 }
  ]
}
```

**Comportamento:**

1. Validação (retorna `400` com mensagem se falhar):
   - `items` presente e com pelo menos 1 item.
   - Cada item: `item_name` não vazio, `unit_price > 0`, `quantity >= 1` (inteiro).
   - `payment_method` presente.
2. Recalcula no servidor: `subtotal = unit_price × quantity` para cada item, e
   `total = Σ subtotais`. O total do cliente é ignorado.
3. Atualiza a linha em `sales` (`payment_method`, `notes`, `created_at`, `total`).
4. Substitui os itens: `delete` dos `sale_items` com `sale_id = id`, seguido de
   `insert` dos novos itens (com `sale_id = id`).
5. Retorna `{ ok: true }` em caso de sucesso, ou `{ error }` com status `500` se
   qualquer operação do Supabase falhar.

**Limitação conhecida:** o cliente Supabase-JS não expõe transação multi-statement,
então "apagar + inserir" itens não é atômico. Se o `insert` falhar após o `delete`,
os itens da venda podem ficar vazios temporariamente. Para um sistema de operador
único e baixo volume, o risco é aceitável. Mitigação possível no futuro: mover a
substituição para uma função RPC/transação no Postgres.

### Frontend — modal de edição em `historico/page.tsx`

**Gatilho:** novo botão **"Editar"** em cada linha da tabela, ao lado de "Excluir".

**Estado:** ao clicar em Editar, cria-se um *rascunho editável* (cópia profunda) do
lançamento selecionado:

```ts
type EditDraft = {
  id: string
  payment_method: string
  notes: string
  saleDate: string          // valor de <input datetime-local>
  items: EditDraftItem[]
}
type EditDraftItem = {
  key: string               // id do sale_item existente ou id temporário do novo
  catalog_item_id: string | null
  item_name: string
  unit_price: number
  quantity: number
}
```

**Conteúdo do modal:**

- Lista de itens em linhas editáveis: nome (rótulo), quantidade (campo numérico),
  preço unitário (campo numérico), subtotal (calculado), botão remover (✕).
- Seletor **"Adicionar item"**: `select` com os itens ativos do catálogo
  (`GET /api/catalog`, filtrando `active`); ao escolher, adiciona uma linha com o
  preço do catálogo e quantidade 1.
- **Forma de pagamento**: mesmo componente de rádio/seleção usado na tela de Vendas.
- **Data/hora**: `<input type="datetime-local">` (conversão ISO ⇄ datetime-local
  reaproveitando a lógica já usada na tela de Vendas).
- **Observações**: `<textarea>`.
- **Total** recalculado ao vivo conforme as edições.
- Botões **Cancelar** (fecha sem salvar) e **Salvar**.

**Salvar:**

- Desabilitado se não houver itens ou se algum item estiver inválido.
- Chama `PUT /api/sales/[id]` com o rascunho.
- Sucesso: toast "Venda atualizada." + fecha o modal + recarrega a lista
  (`fetchPage(1, ...)` com os filtros atuais).
- Erro: toast "Erro ao atualizar venda."

**Catálogo:** os itens ativos do catálogo são buscados para alimentar o seletor de
"Adicionar item" (uma vez, ao abrir o primeiro modal, ou no carregamento da página).

### Componentes e responsabilidades

- `PUT /api/sales/[id]` — validação, recálculo e persistência (dados + substituição
  de itens). Independente da UI.
- Modal de edição (dentro de `historico/page.tsx`, ou extraído para um componente
  `EditSaleModal` se o arquivo crescer demais) — captura o rascunho e envia ao PUT.
- Lista do Histórico — inalterada, exceto pelo novo botão "Editar" e pelo refresh
  após salvar.

## Fluxo de dados

1. Usuário clica "Editar" → cria rascunho a partir do `SaleWithItems` da linha.
2. Usuário altera itens/dados → rascunho atualizado no estado, total recalculado.
3. Usuário clica "Salvar" → `PUT /api/sales/[id]`.
4. Servidor valida, recalcula total, atualiza `sales`, substitui `sale_items`.
5. Frontend recarrega a lista e fecha o modal.

## Tratamento de erros

- Validação no cliente (Salvar desabilitado) e no servidor (400).
- Falha de rede/servidor → toast de erro, modal permanece aberto para nova tentativa.

## Testes / verificação

O projeto não possui framework de testes automatizados.

- **Typecheck** (`npx tsc --noEmit`) deve passar sem erros.
- **Teste de aceitação** pelo usuário no navegador (dev server já estável fora do
  OneDrive): editar um lançamento de teste — alterar item, quantidade, preço,
  pagamento, data e observação — e confirmar que salvou e a lista reflete a mudança.
- Opcional: teste do endpoint `PUT` via linha de comando contra o dev server local.
