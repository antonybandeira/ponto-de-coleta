-- Cria a tabela de contatos (clientes/parceiros) e habilita RLS.
-- Execute este script no SQL Editor do painel Supabase.

CREATE TABLE public.contacts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name       text NOT NULL,
  nickname   text,
  phone      text NOT NULL,
  type       text NOT NULL CHECK (type IN ('vendedor', 'comprador'))
);

-- Mesmo padrão de segurança das outras tabelas: o app usa o SERVICE_ROLE_KEY
-- no servidor (ignora RLS). A política restritiva bloqueia acesso via chave
-- anon/authenticated (client-side).
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sem acesso público" ON public.contacts
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);
