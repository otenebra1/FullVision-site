-- Catálogo do estoque: categorias e produtos, cada um com código próprio.
-- Rode uma vez no Supabase: SQL Editor > New query > colar > Run. Pode rodar de novo sem duplicar.

create table if not exists public.estoque_categorias (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null unique,          -- ex.: LOC, SEN, ATU
  nome       text not null,                 -- ex.: Localizador
  ativo      boolean not null default true,
  ordem      int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.estoque_produtos (
  id           uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.estoque_categorias(id) on delete restrict,
  codigo       text not null unique,        -- ex.: LOC-001
  nome         text not null,               -- ex.: FT4G
  ativo        boolean not null default true,
  ordem        int not null default 0,
  created_at   timestamptz not null default now()
);

-- Cada item do estoque aponta para o produto do catálogo
alter table public.rastreadores
  add column if not exists produto_id uuid references public.estoque_produtos(id) on delete set null;

-- Acesso: qualquer usuário logado lê; só admin cria/edita/apaga
alter table public.estoque_categorias enable row level security;
alter table public.estoque_produtos  enable row level security;

drop policy if exists "estoque_categorias leitura" on public.estoque_categorias;
create policy "estoque_categorias leitura" on public.estoque_categorias for select to authenticated using (true);
drop policy if exists "estoque_categorias admin" on public.estoque_categorias;
create policy "estoque_categorias admin" on public.estoque_categorias for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "estoque_produtos leitura" on public.estoque_produtos;
create policy "estoque_produtos leitura" on public.estoque_produtos for select to authenticated using (true);
drop policy if exists "estoque_produtos admin" on public.estoque_produtos;
create policy "estoque_produtos admin" on public.estoque_produtos for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Carga inicial
insert into public.estoque_categorias (codigo, nome, ordem) values
  ('LOC', 'Localizador', 10),
  ('SEN', 'Sensor', 20),
  ('ATU', 'Atuador', 30)
on conflict (codigo) do nothing;

insert into public.estoque_produtos (categoria_id, codigo, nome, ordem)
select c.id, v.codigo, v.nome, v.ordem
from (values
  ('LOC', 'LOC-001', 'FT4G', 10),
  ('LOC', 'LOC-002', 'NEO', 20),
  ('LOC', 'LOC-003', 'VOLT', 30),
  ('LOC', 'LOC-004', 'CARGO', 40),
  ('LOC', 'LOC-005', 'FROTA', 50),
  ('LOC', 'LOC-006', 'DUO', 60),
  ('LOC', 'LOC-007', 'TRIO', 70),
  ('SEN', 'SEN-001', 'SENSOR DE TEMPERATURA', 10),
  ('SEN', 'SEN-002', 'MÓDULO DE SENSOR DE TEMPERATURA', 20),
  ('SEN', 'SEN-003', 'SENSOR DE PORTA', 30),
  ('SEN', 'SEN-004', 'PRESSOSTATO', 40),
  ('ATU', 'ATU-001', 'BLOQUEIO 12V', 10),
  ('ATU', 'ATU-002', 'BLOQUEIO 24V', 20)
) as v(cat, codigo, nome, ordem)
join public.estoque_categorias c on c.codigo = v.cat
on conflict (codigo) do nothing;

-- Liga os itens que já existem ao produto, pelo nome do modelo (ex.: modelo "FT4G" → LOC-001)
update public.rastreadores r
set produto_id = p.id
from public.estoque_produtos p
where r.produto_id is null and upper(trim(r.modelo)) = p.nome;
