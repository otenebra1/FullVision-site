-- =====================================================================
-- ETAPA 2 do ERP: DRE e FLUXO DE CAIXA da empresa
-- Aba "DRE e caixa" do /financeiro (só ADM). Quase tudo é calculado na tela
-- a partir dos gastos e das contas a receber; aqui só fica o saldo de partida do caixa.
-- Rode uma vez no Supabase: SQL Editor > New query > colar tudo > Run. Pode rodar de novo.
-- Precisa de: fv_eh_admin() (SQL 20261124e).
-- =====================================================================

create table if not exists public.fin_caixa_config (
  id             int primary key default 1 check (id = 1),
  saldo_inicial  numeric(14,2) not null default 0,   -- quanto tinha em conta (somando as contas da empresa)
  saldo_data     date,                               -- em que dia era esse saldo
  updated_at     timestamptz not null default now()
);
insert into public.fin_caixa_config (id) values (1) on conflict (id) do nothing;

alter table public.fin_caixa_config enable row level security;
drop policy if exists "fin so adm" on public.fin_caixa_config;
create policy "fin so adm" on public.fin_caixa_config
  for all to authenticated using (public.fv_eh_admin()) with check (public.fv_eh_admin());

-- Categoria própria para impostos sobre o faturamento (DAS do Simples, ISS),
-- que na DRE saem da receita antes do custo
insert into public.fin_categorias (nome, grupo, ordem) values
  ('Impostos sobre faturamento (DAS/ISS)', 'Impostos', 405)
on conflict (nome) do nothing;
