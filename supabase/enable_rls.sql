-- Habilitar RLS nas tabelas públicas
-- Execute este script no SQL Editor do painel Supabase

ALTER TABLE public.sales            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occurrences      ENABLE ROW LEVEL SECURITY;

-- O app usa SUPABASE_SERVICE_ROLE_KEY no servidor, que ignora RLS por padrão.
-- As políticas abaixo bloqueiam acesso via chave anon/authenticated (client-side),
-- garantindo que nenhum dado seja exposto publicamente.

-- Nenhuma política permissiva é necessária para o app funcionar,
-- pois o service_role ignora RLS. Mas adicionamos políticas explícitas
-- de negação para documentar a intenção:

-- sales
CREATE POLICY "Sem acesso público" ON public.sales
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- sale_items
CREATE POLICY "Sem acesso público" ON public.sale_items
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- catalog_items
CREATE POLICY "Sem acesso público" ON public.catalog_items
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- occurrences
CREATE POLICY "Sem acesso público" ON public.occurrences
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);
