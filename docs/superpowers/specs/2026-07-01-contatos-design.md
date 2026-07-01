# Contatos (clientes/parceiros)

## Contexto / Problema

A agência lida todo dia com dois tipos de gente: **vendedores** que deixam pacotes
conosco e **compradores** que optam por retirar/devolver pacotes conosco. Hoje não
existe um cadastro desses contatos. Isso dificulta a comunicação — principalmente
avisar em massa sobre coisas como horário de fechamento diferenciado.

## Objetivo

Criar um cadastro de contatos (nome, WhatsApp, tipo e apelido/loja) que sirva de base
para comunicação. A partir dele, montar rapidamente listas filtradas por tipo e disparar
avisos via WhatsApp (links `wa.me`), sem custo e sem integração com API oficial.

## Fora de escopo

- Envio automático via API oficial do WhatsApp Business (custo + cadastro na Meta).
- Modelos de mensagem salvos (a mensagem é digitada na hora).
- Campos de plataforma e observações no cadastro.
- Ligação com Ocorrências (reaproveitar/vincular cadastros). Fica para depois.
- Um contato ser vendedor **e** comprador ao mesmo tempo (o tipo é exclusivo).

## Componentes

### 1. Banco de dados

Nova tabela `contacts` (migration SQL em `supabase/`):

| campo        | tipo                                   | notas                          |
|--------------|----------------------------------------|--------------------------------|
| `id`         | uuid, pk, default `gen_random_uuid()`  |                                |
| `name`       | text, not null                         | nome do contato                |
| `nickname`   | text, null                             | apelido / nome da loja         |
| `phone`      | text, not null                         | WhatsApp, guardado como digitado |
| `type`       | text, not null, check `in ('vendedor','comprador')` | tipo do contato   |
| `created_at` | timestamptz, default `now()`           |                                |

Seguir o padrão de RLS já usado nas outras tabelas (ver `supabase/enable_rls.sql`).

### 2. Tipo `Contact`

Adicionar em [src/lib/supabase.ts](../../../src/lib/supabase.ts), no mesmo estilo de `Occurrence`:

```ts
export type Contact = {
  id: string
  created_at: string
  name: string
  nickname: string | null
  phone: string
  type: 'vendedor' | 'comprador'
}
```

### 3. API

Espelha o padrão de Ocorrências.

- `GET /api/contacts` — lista todos, ordenado por `name` ascendente.
- `POST /api/contacts` — cria (`name`, `nickname`, `phone`, `type`).
- `PATCH /api/contacts/[id]` — edita os mesmos campos.
- `DELETE /api/contacts/[id]` — exclui (retorna 204).

Erros do Supabase → resposta 500 com `{ error }`, igual às rotas existentes.

### 4. Utilitário de telefone / wa.me

Função pequena (em `src/lib/format.ts` ou um `src/lib/whatsapp.ts` novo) que converte
um telefone digitado em número pronto para `wa.me`:

- Remove tudo que não é dígito.
- Se não começar com `55` e tiver 10–11 dígitos (DDD + número), prefixa `55`.
- Monta o link: `https://wa.me/<numero>?text=<mensagem url-encoded>` (texto opcional).

### 5. Página `/contatos`

Nova rota protegida, seguindo o estilo visual das demais páginas.

- **Formulário de cadastro** (topo): Nome*, Apelido/loja, WhatsApp*, Tipo* (select
  vendedor/comprador). Ao salvar, limpa o form, recarrega a lista e mostra toast.
- **Barra de filtro**: campo de busca (filtra por nome ou apelido) + filtro por tipo
  (Todos / Vendedores / Compradores). O filtro é client-side sobre a lista carregada.
- **Painel de aviso**: um `textarea` com a mensagem. Essa mensagem:
  - alimenta o link `wa.me` de cada botão WhatsApp individual (abre a conversa já com o texto);
  - é usada junto do botão **"Copiar números da lista filtrada"**, que copia para a área
    de transferência os telefones (normalizados) dos contatos atualmente visíveis, para
    colar numa lista de transmissão do WhatsApp. Toast confirma a cópia.
- **Lista de contatos**: cards com nome, apelido (se houver), selo do tipo (cores
  distintas para vendedor/comprador) e telefone. Cada card tem:
  - **WhatsApp** — abre `wa.me` (com a mensagem do painel, se preenchida) em nova aba;
  - **Editar** — abre modal de edição (mesmos campos do cadastro);
  - **Excluir** — abre modal de confirmação.
- Modais de editar e excluir seguem o padrão de Ocorrências.

### 6. Navegação

Adicionar `{ href: '/contatos', label: 'Contatos' }` ao array de links do
[Header](../../../src/components/Header.tsx), entre "Ocorrências" e "Catálogo".

## Tratamento de erros / bordas

- Lista vazia (ou filtro sem resultados) → mensagem em vez de grade quebrada.
- Telefone que não vira número válido → o link `wa.me` ainda abre; não trava a tela.
- "Copiar números" usa `navigator.clipboard`; se falhar, toast de erro.
- Falha de rede em criar/editar/excluir → toast de erro, sem quebrar o estado da tela.

## Testes manuais esperados

1. Cadastrar um vendedor e um comprador → aparecem na lista com o selo correto.
2. Buscar por nome/apelido → lista filtra corretamente.
3. Filtrar por tipo → mostra só vendedores / só compradores / todos.
4. Clicar em WhatsApp de um contato (sem mensagem) → abre o wa.me daquele número.
5. Escrever mensagem no painel e clicar em WhatsApp → wa.me abre já com o texto.
6. Filtrar por "Vendedores" e clicar em "Copiar números da lista filtrada" → área de
   transferência recebe só os números dos vendedores; toast confirma.
7. Editar um contato → alterações persistem.
8. Excluir um contato → some da lista após confirmação.
