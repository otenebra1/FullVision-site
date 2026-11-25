-- =====================================================================
-- Painel FINANCEIRO (página /financeiro): gastos da empresa, NF/romaneio,
-- viagens, itens, categorias e fornecedores. Só o ADM lê e grava.
-- Rode uma vez no Supabase: SQL Editor > New query > colar tudo > Run.
-- Pode rodar de novo sem duplicar nada.
-- =====================================================================

-- 1) Categorias de gasto ----------------------------------------------
create table if not exists public.fin_categorias (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  grupo      text not null default 'Outros',   -- Viagens, Equipamentos, Materiais, Operacional, Administrativo, Ajustes
  ordem      int not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) Fornecedores ------------------------------------------------------
create table if not exists public.fin_fornecedores (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,                    -- razão social
  cnpj       text unique,                      -- só números (CNPJ ou CPF)
  created_at timestamptz not null default now()
);
alter table public.fin_fornecedores
  add column if not exists nome_fantasia text,
  add column if not exists contato       text,                -- nome do vendedor / pessoa de contato
  add column if not exists telefone      text,
  add column if not exists email         text,
  add column if not exists cidade        text,
  add column if not exists uf            text,
  add column if not exists endereco      text,
  add column if not exists pix           text,                -- chave PIX / dados bancários
  add column if not exists categoria_id  uuid references public.fin_categorias(id) on delete set null,              -- o que costuma vender (sugere a categoria)
  add column if not exists observacao    text,
  add column if not exists ativo         boolean not null default true;

-- 3) Itens (catálogo do que a empresa compra) --------------------------
create table if not exists public.fin_itens (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null unique,
  categoria_id uuid references public.fin_categorias(id) on delete set null,
  unidade      text not null default 'UN',
  produto_id   uuid references public.estoque_produtos(id) on delete set null, -- liga ao catálogo do estoque (rastreador, sensor...)
  ativo        boolean not null default true,
  created_at   timestamptz not null default now()
);

-- 4) Viagens (técnico e cliente com o mesmo tipo de id das tabelas existentes)
do $$
declare tipo_emp text; tipo_tec text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_emp
  from pg_attribute a where a.attrelid = 'public.empresas'::regclass and a.attname = 'id';
  select format_type(a.atttypid, a.atttypmod) into tipo_tec
  from pg_attribute a where a.attrelid = 'public.tecnicos'::regclass and a.attname = 'id';
  execute format($f$
    create table if not exists public.fin_viagens (
      id          uuid primary key default gen_random_uuid(),
      titulo      text not null,
      destino     text,
      data_ida    date,
      data_volta  date,
      tecnico_id  %s references public.tecnicos(id) on delete set null,
      empresa_id  %s references public.empresas(id) on delete set null,
      km          numeric(12,1),
      observacao  text,
      created_at  timestamptz not null default now()
    )$f$, tipo_tec, tipo_emp);
end $$;

-- 5) Despesas (cabeçalho: NF, romaneio, recibo...) ----------------------
create table if not exists public.fin_despesas (
  id              uuid primary key default gen_random_uuid(),
  data            date not null default current_date,       -- data da compra / emissão
  tipo_documento  text not null default 'SEM_DOC',          -- NFE, NF, ROMANEIO, RECIBO, CUPOM, BOLETO, SEM_DOC
  numero          text,                                     -- número da NF / romaneio
  serie           text,
  chave_nfe       text unique,                              -- 44 dígitos (evita importar a mesma NF duas vezes)
  fornecedor_id   uuid references public.fin_fornecedores(id) on delete set null,
  viagem_id       uuid references public.fin_viagens(id) on delete set null,
  descricao       text,
  forma_pagamento text,                                     -- PIX, BOLETO, CARTAO_CREDITO, CARTAO_DEBITO, DINHEIRO, TRANSFERENCIA
  status          text not null default 'PAGO',             -- PAGO, A_PAGAR
  vencimento      date,
  data_pagamento  date,
  valor_total     numeric(14,2) not null default 0,         -- soma das linhas (atualizado pelo banco)
  anexos          jsonb not null default '[]'::jsonb,       -- [{ path, nome, tipo }] no bucket "financeiro"
  observacao      text,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists fin_despesas_data_idx on public.fin_despesas (data);
create index if not exists fin_despesas_viagem_idx on public.fin_despesas (viagem_id);

-- 6) Linhas da despesa (cada item da NF / do romaneio) ------------------
create table if not exists public.fin_despesa_itens (
  id               uuid primary key default gen_random_uuid(),
  despesa_id       uuid not null references public.fin_despesas(id) on delete cascade,
  item_id          uuid references public.fin_itens(id) on delete set null,
  categoria_id     uuid references public.fin_categorias(id) on delete set null,
  descricao        text,                                    -- texto como veio na NF
  codigo_fornecedor text,                                   -- cProd da NF-e
  quantidade       numeric(14,4) not null default 1,
  unidade          text,
  valor_unitario   numeric(14,4) not null default 0,
  valor_total      numeric(14,2) not null default 0,        -- pode ser negativo (desconto)
  ordem            int not null default 0
);
create index if not exists fin_despesa_itens_despesa_idx on public.fin_despesa_itens (despesa_id);

-- 7) "Memória" da NF-e: código do produto no fornecedor → item/categoria
-- (na próxima NF do mesmo fornecedor, as linhas já vêm classificadas)
create table if not exists public.fin_item_vinculos (
  fornecedor_cnpj text not null,
  codigo          text not null,
  item_id         uuid references public.fin_itens(id) on delete cascade,
  categoria_id    uuid references public.fin_categorias(id) on delete cascade,
  primary key (fornecedor_cnpj, codigo)
);

-- 8) Total da despesa sempre igual à soma das linhas -------------------
create or replace function public.fv_fin_recalcula_total()
returns trigger language plpgsql security definer set search_path = public as $$
declare alvo uuid;
begin
  alvo := coalesce(new.despesa_id, old.despesa_id);
  update public.fin_despesas
     set valor_total = coalesce((select sum(valor_total) from public.fin_despesa_itens where despesa_id = alvo), 0),
         updated_at = now()
   where id = alvo;
  return null;
end $$;

drop trigger if exists fv_fin_recalcula_total on public.fin_despesa_itens;
create trigger fv_fin_recalcula_total
  after insert or update or delete on public.fin_despesa_itens
  for each row execute function public.fv_fin_recalcula_total();

-- 9) Acesso: só o ADM ---------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['fin_categorias','fin_fornecedores','fin_itens','fin_viagens','fin_despesas','fin_despesa_itens','fin_item_vinculos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "fin so adm" on public.%I', t);
    execute format('create policy "fin so adm" on public.%I for all to authenticated using (public.fv_eh_admin()) with check (public.fv_eh_admin())', t);
  end loop;
end $$;

-- 10) Pasta (bucket) privada para NF, romaneio, cupom e recibos --------
insert into storage.buckets (id, name, public)
values ('financeiro', 'financeiro', false)
on conflict (id) do nothing;

drop policy if exists "financeiro arquivos adm" on storage.objects;
create policy "financeiro arquivos adm" on storage.objects for all to authenticated
  using (bucket_id = 'financeiro' and public.fv_eh_admin())
  with check (bucket_id = 'financeiro' and public.fv_eh_admin());

-- 11) Carga inicial ----------------------------------------------------
insert into public.fin_categorias (nome, grupo, ordem) values
  ('Combustível',                'Viagens',        10),
  ('Pedágio',                    'Viagens',        20),
  ('Hospedagem',                 'Viagens',        30),
  ('Alimentação',                'Viagens',        40),
  ('Passagens e transporte',     'Viagens',        50),
  ('Estacionamento',             'Viagens',        60),
  ('Rastreadores',               'Equipamentos',  110),
  ('Sensores',                   'Equipamentos',  120),
  ('Atuadores e bloqueios',      'Equipamentos',  130),
  ('Chips e planos M2M',         'Equipamentos',  140),
  ('Materiais de instalação',    'Materiais',     210),
  ('Ferramentas',                'Operacional',   310),
  ('Veículo da empresa',         'Operacional',   320),
  ('Frete',                      'Operacional',   330),
  ('Serviços de terceiros',      'Operacional',   340),
  ('Escritório e software',      'Administrativo',410),
  ('Impostos e taxas',           'Administrativo',420),
  ('Outros',                     'Administrativo',490),
  ('Descontos',                  'Ajustes',       910)
on conflict (nome) do nothing;

-- Itens: os produtos do catálogo do estoque + materiais de instalação comuns
insert into public.fin_itens (nome, categoria_id, unidade, produto_id)
select p.nome,
       (select id from public.fin_categorias where nome = case c.codigo
          when 'LOC' then 'Rastreadores' when 'SEN' then 'Sensores' when 'ATU' then 'Atuadores e bloqueios' else 'Outros' end),
       'UN', p.id
from public.estoque_produtos p
join public.estoque_categorias c on c.id = p.categoria_id
on conflict (nome) do nothing;

insert into public.fin_itens (nome, categoria_id, unidade)
select v.nome, (select id from public.fin_categorias where nome = v.cat), v.un
from (values
  ('Fita isolante',               'Materiais de instalação', 'UN'),
  ('Abraçadeira de nylon',        'Materiais de instalação', 'PCT'),
  ('Fio / cabo elétrico',         'Materiais de instalação', 'M'),
  ('Relé automotivo',             'Materiais de instalação', 'UN'),
  ('Conector / terminal',         'Materiais de instalação', 'UN'),
  ('Fusível e porta-fusível',     'Materiais de instalação', 'UN'),
  ('Espaguete termo-retrátil',    'Materiais de instalação', 'M'),
  ('Fita dupla face',             'Materiais de instalação', 'UN'),
  ('Chip M2M',                    'Chips e planos M2M',      'UN'),
  ('Gasolina',                    'Combustível',             'L'),
  ('Diesel',                      'Combustível',             'L'),
  ('Etanol',                      'Combustível',             'L')
) as v(nome, cat, un)
on conflict (nome) do nothing;
