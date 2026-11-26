-- =====================================================================
-- ETAPA 1 do ERP: CONTAS A RECEBER e COBRANÇA (boleto/PIX pelo Asaas)
-- Aba "A receber" do /financeiro (só ADM).
-- Rode uma vez no Supabase: SQL Editor > New query > colar tudo > Run. Pode rodar de novo.
-- Precisa de: fv_eh_admin() (SQL 20261124e), empresas, nf_notas (SQL 20261126c).
-- =====================================================================

-- 1) Configuração da cobrança (uma linha só, id = 1) --------------------
create table if not exists public.fin_cobranca_config (
  id                 int primary key default 1 check (id = 1),
  ambiente           text not null default 'sandbox' check (ambiente in ('sandbox', 'producao')),
  forma_padrao       text not null default 'BOLETO' check (forma_padrao in ('BOLETO', 'PIX', 'UNDEFINED')),
  dia_vencimento     smallint not null default 10 check (dia_vencimento between 1 and 31), -- quando o cliente não tem dia próprio
  multa_percentual   numeric(6,2) not null default 2,     -- multa por atraso (%)
  juros_mensal       numeric(6,2) not null default 1,     -- juros ao mês (%)
  desconto_valor     numeric(12,2) not null default 0,    -- desconto para pagar até o vencimento (R$)
  avisar_cliente     boolean not null default true,       -- Asaas manda e-mail/SMS ao cliente
  updated_at         timestamptz not null default now()
);
insert into public.fin_cobranca_config (id) values (1) on conflict (id) do nothing;

-- 2) Id do cliente no Asaas (um por ambiente) ----------------------------
alter table public.empresas
  add column if not exists asaas_cliente_sandbox  text,
  add column if not exists asaas_cliente_producao text;

-- 3) Contas a receber ----------------------------------------------------
do $$
declare tipo_emp text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_emp
  from pg_attribute a where a.attrelid = 'public.empresas'::regclass and a.attname = 'id';
  execute format($f$
    create table if not exists public.fin_recebimentos (
      id               uuid primary key default gen_random_uuid(),
      empresa_id       %s references public.empresas(id) on delete restrict,
      descricao        text not null,
      competencia      date,                         -- 1º dia do mês cobrado (mensalidade)
      tipo             text not null default 'MENSALIDADE', -- MENSALIDADE, AVULSA, INSTALACAO, OUTRO
      valor            numeric(12,2) not null check (valor > 0),
      vencimento       date not null,
      status           text not null default 'ABERTO',      -- ABERTO, PAGO, CANCELADO
      forma            text,                          -- BOLETO, PIX, UNDEFINED (cliente escolhe), TRANSFERENCIA, DINHEIRO, OUTRO
      nota_id          uuid references public.nf_notas(id) on delete set null,
      -- Asaas
      ambiente         text,                          -- sandbox / producao (quando foi para o Asaas)
      asaas_id         text unique,
      asaas_status     text,                          -- PENDING, RECEIVED, CONFIRMED, OVERDUE, ...
      link_fatura      text,                          -- página do Asaas com boleto e PIX
      link_boleto      text,                          -- PDF do boleto
      linha_digitavel  text,
      pix_copia_cola   text,
      mensagem         text,                          -- último erro do Asaas
      -- Pagamento
      data_pagamento   date,
      valor_pago       numeric(12,2),
      valor_liquido    numeric(12,2),                 -- o que caiu na conta (sem a tarifa do Asaas)
      observacao       text,
      criado_por       uuid default auth.uid(),
      created_at       timestamptz not null default now(),
      updated_at       timestamptz not null default now()
    )$f$, tipo_emp);
end $$;

create index if not exists fin_recebimentos_venc_idx on public.fin_recebimentos (vencimento);
create index if not exists fin_recebimentos_empresa_idx on public.fin_recebimentos (empresa_id);
create index if not exists fin_recebimentos_status_idx on public.fin_recebimentos (status);
-- Trava: uma cobrança de mensalidade ativa por cliente e mês
create unique index if not exists fin_recebimentos_uma_mensalidade
  on public.fin_recebimentos (empresa_id, competencia)
  where tipo = 'MENSALIDADE' and status <> 'CANCELADO';

create or replace function public.fv_fin_receb_updated()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists fv_fin_receb_updated on public.fin_recebimentos;
create trigger fv_fin_receb_updated before update on public.fin_recebimentos
  for each row execute function public.fv_fin_receb_updated();

-- 4) Acesso: só o ADM (tem valores em R$) --------------------------------
do $$
declare t text;
begin
  foreach t in array array['fin_cobranca_config','fin_recebimentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "fin so adm" on public.%I', t);
    execute format('create policy "fin so adm" on public.%I for all to authenticated using (public.fv_eh_admin()) with check (public.fv_eh_admin())', t);
  end loop;
end $$;
