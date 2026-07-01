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

-- O app em produção acessa o Supabase com a chave anon/publishable (sujeita a RLS);
-- a proteção real é o login por PIN no próprio app. Por isso usamos a mesma política
-- PERMISSIVE "Acesso total" das demais tabelas (sales, occurrences), liberando acesso
-- via RLS. (NÃO use política restritiva de negação aqui: ela bloquearia os inserts
-- do app em produção, já que a chave anon não ignora RLS como a service role faz.)
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total" ON public.contacts
  AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
