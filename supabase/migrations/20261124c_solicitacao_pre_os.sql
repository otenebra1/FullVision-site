-- Solicitação de serviço criada pelo admin já gera uma OS "aberta" (pré-OS).
-- Rode uma vez no Supabase: SQL Editor > New query > colar > Run. Pode rodar de novo.

-- OS passa a ter status: 'aberta' (pré-OS, ainda não executada) ou 'finalizada'
alter table public.ordens_servico
  add column if not exists status            text not null default 'finalizada',
  add column if not exists horario_previsto  timestamptz,
  add column if not exists telefone_contato  text;

do $$ begin
  alter table public.ordens_servico add constraint ordens_servico_status_chk check (status in ('aberta', 'finalizada'));
exception when duplicate_object then null; end $$;

-- A pré-OS ainda não tem técnico nem finalização
do $$ begin
  alter table public.ordens_servico alter column tecnico_nome drop not null;
exception when undefined_column then null; end $$;
do $$ begin
  alter table public.ordens_servico alter column finalizada_em drop not null;
exception when undefined_column then null; end $$;

-- Liga a solicitação à OS que ela gerou
alter table public.solicitacoes_servico
  add column if not exists os_id uuid references public.ordens_servico(id) on delete set null;
