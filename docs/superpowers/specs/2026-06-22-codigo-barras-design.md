# Venda por código de barras + Tabela de preços

## Contexto / Problema

O sistema é pouco usado no dia a dia: o funcionário trabalha sozinho na agência e fica muito atarefado para lançar cada venda de insumo (envelopes, caixas) clicando na tela. O dono acaba fazendo os lançamentos manualmente quando dá tempo.

## Objetivo

Reduzir o atrito do lançamento de vendas de itens do catálogo (envelopes, caixas) usando um leitor de código de barras USB (tipo teclado). O funcionário bipa o item e ele entra automaticamente no carrinho da tela de Vendas, sem precisar tocar na tela.

Como ganho adicional, criar uma tabela de preços para fixar no balcão, para os clientes verem os preços sem precisar perguntar.

## Fora de escopo

- Leitores com driver especial/serial (apenas USB tipo teclado/HID).
- Geração de PDF no backend (impressão via `window.print()` do navegador).
- Uso de código de barras de fábrica/embalagem — os códigos são gerados pelo próprio sistema.

## Componentes

### 1. Catálogo de itens

- Nova coluna `barcode text unique` na tabela `catalog_items`.
- Ao criar um item novo, o sistema gera automaticamente um código numérico único (formato tipo EAN-13: prefixo fixo `200` + sequencial + dígito verificador).
- Itens já existentes sem `barcode` ganham um botão "Gerar código" na tela de Catálogo ([catalogo/page.tsx](../../../src/app/(protected)/catalogo/page.tsx)).
- O código gerado é exibido na lista de itens do catálogo (texto, não a imagem do barcode).

### 2. Geração de código de barras

- Geração do número: lógica simples no backend (rota de catálogo), incrementando a partir do maior `barcode` existente com o prefixo `200`, com cálculo de dígito verificador EAN-13.
- Renderização visual do código (para impressão): usar uma lib leve no client, ex. `jsbarcode` (gera SVG/canvas a partir do número), evitando dependência de serviço externo.

### 3. Tela de Vendas — captura do scanner

- Um input de texto sempre focado (visualmente discreto, mas presente) captura a digitação do leitor.
- O leitor "digita" os dígitos do código e envia Enter automaticamente.
- Ao detectar Enter no input: busca o item pelo `barcode` na lista de catálogo já carregada (`catalog` state) e chama `addItem()` da mesma forma que o clique no card do item.
- Limpa o input após cada leitura, mantendo o foco para a próxima bipagem.
- Código não encontrado → toast de erro "Código não encontrado" e input limpo.
- Não interfere no fluxo de clique manual já existente — ambos coexistem.

### 4. Página de etiquetas (`/catalogo/etiquetas`)

- Nova rota, acessível por um botão na tela de Catálogo.
- Lista todos os itens ativos com `barcode`, em grade.
- Cada etiqueta: nome do item, preço, código de barras renderizado (via `jsbarcode`).
- CSS de impressão (`@media print`) para organizar bem numa folha A4 (grade de etiquetas recortáveis).
- Botão "Imprimir" que chama `window.print()`.

### 5. Página de tabela de preços (`/catalogo/tabela-precos`)

- Nova rota, acessível por outro botão na tela de Catálogo.
- Layout tipo cartaz/lista: nome + preço, sem código de barras, fonte grande e legível à distância (para fixar no balcão, voltado para o cliente).
- CSS de impressão própria, independente da página de etiquetas.
- Botão "Imprimir" que chama `window.print()`.

## Dados e tipos

- `CatalogItem` ([src/lib/supabase.ts](../../../src/lib/supabase.ts)) ganha o campo `barcode: string | null`.
- Migration SQL em `supabase/` adicionando a coluna `barcode text unique` à tabela `catalog_items`.

## Tratamento de erros

- Geração de código: se a geração colidir com um código existente (corrida rara), tentar o próximo sequencial.
- Leitura na tela de Vendas: código não cadastrado não trava a tela, apenas mostra toast e permite tentar de novo.
- Páginas de impressão: se não houver itens ativos, mostrar mensagem vazia ao invés de grade quebrada.

## Testes manuais esperados

1. Criar item novo no catálogo → recebe `barcode` automaticamente.
2. Gerar código para item antigo sem `barcode`.
3. Na tela de Vendas, bipar (simular digitação + Enter) um código válido → item entra no carrinho.
4. Bipar código inválido → toast de erro, nada adicionado.
5. Abrir `/catalogo/etiquetas` → ver grade de etiquetas com nome, preço e barras; imprimir.
6. Abrir `/catalogo/tabela-precos` → ver lista nome+preço grande; imprimir.
