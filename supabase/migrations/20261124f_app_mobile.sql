-- =====================================================================
-- App Android (equipe e técnicos). Rode no SQL Editor do Supabase,
-- DEPOIS do arquivo de perfis (20261124e). Pode rodar mais de uma vez.
-- =====================================================================

-- 1) Última posição de cada técnico (o app manda a cada 3 min com ele aberto)
do $$
declare tipo text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo
  from pg_attribute a where a.attrelid = 'public.tecnicos'::regclass and a.attname = 'id';
  execute format($f$
    create table if not exists public.tecnico_localizacao (
      tecnico_id %s primary key references public.tecnicos(id) on delete cascade,
      tecnico_nome text,
      lat double precision not null,
      lng double precision not null,
      precisao double precision,
      atualizado_em timestamptz not null default now()
    )$f$, tipo);
end $$;

alter table public.tecnico_localizacao enable row level security;
drop policy if exists fv_equipe_le_localizacao on public.tecnico_localizacao;
create policy fv_equipe_le_localizacao on public.tecnico_localizacao
  for select to authenticated using (public.fv_papel() in ('admin','funcionario'));
-- quem grava é o servidor (/api/tecnico/localizacao), com a service role

-- 2) Atualização ao vivo no app da equipe (OS e mapa)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'ordens_servico') then
      alter publication supabase_realtime add table public.ordens_servico;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tecnico_localizacao') then
      alter publication supabase_realtime add table public.tecnico_localizacao;
    end if;
  end if;
end $$;
