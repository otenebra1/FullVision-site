-- =====================================================================
-- VIAGENS: lançamento rápido de gastos e inventário da viagem
--  1) Gasto de viagem: "quem pagou" e categorias Aluguel de veículo / Outros
--  2) Inventário: retirada de itens do estoque para a viagem e devolução
--     na volta, com histórico (quem pegou, quando, para qual viagem)
-- Rode DEPOIS do 20261125b_financeiro.sql. Pode rodar de novo sem problema.
-- Supabase: SQL Editor > New query > colar tudo > Run.
-- =====================================================================

-- ---------- 1) Gastos da viagem ----------
alter table public.fin_despesas add column if not exists pago_por text;  -- quem pagou (técnico, cartão da empresa...)
alter table public.fin_despesas add column if not exists origem   text;  -- 'VIAGEM' = lançado pelo atalho da viagem

insert into public.fin_categorias (nome, grupo, ordem) values
  ('Aluguel de veículo',      'Viagens', 55),
  ('Outros gastos de viagem', 'Viagens', 70)
on conflict (nome) do nothing;

-- ---------- 2) Inventário da viagem ----------
-- Item do estoque que está numa viagem aponta para ela
alter table public.rastreadores
  add column if not exists viagem_id uuid references public.fin_viagens(id) on delete set null;
create index if not exists rastreadores_viagem_idx on public.rastreadores (viagem_id);

-- Histórico de retiradas e devoluções (id do item com o mesmo tipo da tabela rastreadores)
do $$
declare tipo_r text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_r
  from pg_attribute a where a.attrelid = 'public.rastreadores'::regclass and a.attname = 'id';
  execute format($f$
    create table if not exists public.fin_viagem_estoque (
      id            uuid primary key default gen_random_uuid(),
      viagem_id     uuid not null references public.fin_viagens(id) on delete cascade,
      tipo          text not null check (tipo in ('RETIRADA','DEVOLUCAO')),
      rastreador_id %s references public.rastreadores(id) on delete set null, -- item com serial do estoque
      descricao     text,             -- "SERIAL — MODELO" ou material avulso (ex.: Abraçadeira)
      quantidade    numeric(12,2) not null default 1,
      unidade       text not null default 'UN',
      pessoa        text,             -- quem pegou / quem devolveu
      data          timestamptz not null default now(),
      observacao    text,
      created_by    uuid default auth.uid(),
      created_at    timestamptz not null default now()
    )$f$, tipo_r);
end $$;
create index if not exists fin_viagem_estoque_viagem_idx on public.fin_viagem_estoque (viagem_id);

alter table public.fin_viagem_estoque enable row level security;
drop policy if exists "fin so adm" on public.fin_viagem_estoque;
create policy "fin so adm" on public.fin_viagem_estoque for all to authenticated
  using (public.fv_eh_admin()) with check (public.fv_eh_admin());

-- Retirar itens do estoque para a viagem (baixa: vira "Estoque c/ Técnico" ligado à viagem)
create or replace function public.fv_viagem_retirar(p_viagem uuid, p_itens text[], p_pessoa text, p_data timestamptz default now(), p_obs text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v record; r record; n int := 0;
begin
  if not public.fv_eh_admin() then raise exception 'Só o ADM pode registrar retirada.'; end if;
  select * into v from public.fin_viagens where id = p_viagem;
  if not found then raise exception 'Viagem não encontrada.'; end if;
  for r in select * from public.rastreadores where id::text = any(p_itens) for update loop
    if r.status not in ('estoque_central','estoque_tecnico') or r.viagem_id is not null then
      raise exception 'O item % não está disponível no estoque.', r.serial;
    end if;
    update public.rastreadores
       set status = 'estoque_tecnico', viagem_id = p_viagem,
           localizacao_atual = left('Viagem: ' || v.titulo || coalesce(' (' || nullif(trim(p_pessoa), '') || ')', ''), 200)
     where id = r.id;
    insert into public.fin_viagem_estoque (viagem_id, tipo, rastreador_id, descricao, quantidade, pessoa, data, observacao)
    values (p_viagem, 'RETIRADA', r.id, trim(coalesce(r.serial, '') || ' — ' || coalesce(r.modelo, r.categoria, '')),
            1, nullif(trim(p_pessoa), ''), coalesce(p_data, now()), nullif(trim(p_obs), ''));
    n := n + 1;
  end loop;
  return n;
end $$;

-- Devolver na volta (o que sobrou volta para o Estoque Central)
create or replace function public.fv_viagem_devolver(p_viagem uuid, p_itens text[], p_pessoa text, p_data timestamptz default now(), p_obs text default null)
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if not public.fv_eh_admin() then raise exception 'Só o ADM pode registrar devolução.'; end if;
  for r in select * from public.rastreadores where id::text = any(p_itens) for update loop
    if r.viagem_id is distinct from p_viagem or r.status = 'instalado' then
      raise exception 'O item % não está com a equipe desta viagem.', r.serial;
    end if;
    update public.rastreadores
       set status = 'estoque_central', viagem_id = null, localizacao_atual = null
     where id = r.id;
    insert into public.fin_viagem_estoque (viagem_id, tipo, rastreador_id, descricao, quantidade, pessoa, data, observacao)
    values (p_viagem, 'DEVOLUCAO', r.id, trim(coalesce(r.serial, '') || ' — ' || coalesce(r.modelo, r.categoria, '')),
            1, nullif(trim(p_pessoa), ''), coalesce(p_data, now()), nullif(trim(p_obs), ''));
    n := n + 1;
  end loop;
  return n;
end $$;

grant execute on function public.fv_viagem_retirar(uuid, text[], text, timestamptz, text) to authenticated;
grant execute on function public.fv_viagem_devolver(uuid, text[], text, timestamptz, text) to authenticated;

-- Item instalado numa placa sai da viagem sozinho? Não: continua ligado a ela,
-- para o inventário mostrar "usado na viagem". Se voltar ao estoque por outro
-- caminho (ex.: retirado do veículo no painel), o vínculo é limpo aqui.
create or replace function public.fv_rastreador_sai_viagem()
returns trigger language plpgsql as $$
begin
  if new.viagem_id is not null and new.status in ('estoque_central','baixado','aguardando_manutencao')
     and old.status is distinct from new.status then
    new.viagem_id := null;
  end if;
  return new;
end $$;
drop trigger if exists fv_rastreador_sai_viagem on public.rastreadores;
create trigger fv_rastreador_sai_viagem before update on public.rastreadores
  for each row execute function public.fv_rastreador_sai_viagem();
