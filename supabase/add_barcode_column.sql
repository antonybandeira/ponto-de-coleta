-- Adiciona coluna de código de barras aos itens do catálogo
-- Execute este script no SQL Editor do painel Supabase

ALTER TABLE public.catalog_items
  ADD COLUMN barcode text UNIQUE;
