-- Melhorias de 25/11/2026: observação do veículo, mensalidade automática por serviço
-- (com preço por cliente) e código automático dos produtos do estoque.
-- Rode uma vez no Supabase: SQL Editor > New query > colar tudo > Run. Pode rodar de novo.

-- 1) Observação do veículo --------------------------------------------
alter table public.veiculos add column if not exists observacao text;

-- 2) Mensalidade por serviço ------------------------------------------
-- Padrão (vale para todo cliente sem preço próprio)
alter table public.financeiro_config
  add column if not exists mensalidade_rastreamento  numeric(12,2),
  add column if not exists mensalidade_monitoramento numeric(12,2),
  add column if not exists mensalidade_full_route    numeric(12,2);

-- Preço de cada cliente (vazio = usa o do grupo dele, e depois o padrão)
do $$
declare tipo_id text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_id
  from pg_attribute a where a.attrelid = 'public.empresas'::regclass and a.attname = 'id';
  execute format($f$
    create table if not exists public.mensalidade_cliente (
      empresa_id %s primary key references public.empresas(id) on delete cascade,
      mensalidade_rastreamento  numeric(12,2),
      mensalidade_monitoramento numeric(12,2),
      mensalidade_full_route    numeric(12,2)
    )$f$, tipo_id);
end $$;

alter table public.mensalidade_cliente enable row level security;
drop policy if exists "mensalidade_cliente leitura equipe" on public.mensalidade_cliente;
create policy "mensalidade_cliente leitura equipe" on public.mensalidade_cliente
  for select to authenticated using (public.fv_papel() in ('admin', 'funcionario'));
drop policy if exists "mensalidade_cliente adm grava" on public.mensalidade_cliente;
create policy "mensalidade_cliente adm grava" on public.mensalidade_cliente
  for all to authenticated using (public.fv_eh_admin()) with check (public.fv_eh_admin());

-- Valor de um serviço para uma empresa: dela > do grupo dela > padrão
create or replace function public.fv_valor_mensal(p_empresa_id anyelement, p_coluna text)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  v numeric;
  grupo p_empresa_id%type;
begin
  execute format('select %I from public.mensalidade_cliente where empresa_id = $1', p_coluna) into v using p_empresa_id;
  if v is not null then return v; end if;
  select e.grupo_id into grupo from public.empresas e where e.id = p_empresa_id;
  if grupo is not null then
    execute format('select %I from public.mensalidade_cliente where empresa_id = $1', p_coluna) into v using grupo;
    if v is not null then return v; end if;
  end if;
  execute format('select %I from public.financeiro_config where id = 1', p_coluna) into v;
  return v;
end $$;

-- Mensalidade da placa = soma dos serviços ligados nela (Rastreamento, Monitoramento, Full Route).
-- Enquanto nenhum valor foi preenchido em Preços, o valor digitado à mão continua valendo.
create or replace function public.fv_veiculo_mensalidade_auto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r numeric; m numeric; f numeric;
begin
  if new.empresa_id is null then return new; end if;
  r := public.fv_valor_mensal(new.empresa_id, 'mensalidade_rastreamento');
  m := public.fv_valor_mensal(new.empresa_id, 'mensalidade_monitoramento');
  f := public.fv_valor_mensal(new.empresa_id, 'mensalidade_full_route');
  if r is null and m is null and f is null then return new; end if;
  new.mensalidade :=
      (case when 'RASTREAMENTO'  = any(coalesce(new.servicos, '{}')) then coalesce(r, 0) else 0 end)
    + (case when 'MONITORAMENTO' = any(coalesce(new.servicos, '{}')) then coalesce(m, 0) else 0 end)
    + (case when 'FULL_ROUTE'    = any(coalesce(new.servicos, '{}')) then coalesce(f, 0) else 0 end);
  return new;
end $$;

drop trigger if exists fv_veiculo_mensalidade_auto on public.veiculos;
create trigger fv_veiculo_mensalidade_auto
  before insert or update of servicos, empresa_id on public.veiculos
  for each row execute function public.fv_veiculo_mensalidade_auto();

-- OPCIONAL: depois de preencher os valores em Preços, para recalcular TODAS as placas de uma vez,
-- rode só a linha abaixo (tirando os dois traços do começo). Ela troca a mensalidade atual de cada placa.
-- update public.veiculos set servicos = servicos;

-- 3) Código automático dos produtos do estoque -------------------------
-- No cadastro o banco gera o próximo código da categoria (ex.: SEN-005); depois ninguém altera.
create or replace function public.fv_estoque_produto_codigo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  prefixo text;
  n int;
begin
  if tg_op = 'INSERT' then
    -- Código que já existe passa direto, para o "on conflict do nothing" das cargas iniciais seguir funcionando
    if new.codigo is not null and exists (select 1 from public.estoque_produtos where codigo = new.codigo) then
      return new;
    end if;
    select codigo into prefixo from public.estoque_categorias where id = new.categoria_id;
    perform pg_advisory_xact_lock(hashtext('estoque_produto_codigo_' || prefixo));
    select coalesce(max((regexp_match(codigo, '^' || prefixo || '-(\d+)$'))[1]::int), 0) + 1 into n
    from public.estoque_produtos where codigo ~ ('^' || prefixo || '-\d+$');
    new.codigo := prefixo || '-' || lpad(n::text, 3, '0');
  elsif new.codigo is distinct from old.codigo then
    raise exception 'O código do produto (%) é automático e não pode ser alterado.', old.codigo;
  end if;
  return new;
end $$;

drop trigger if exists fv_estoque_produto_codigo on public.estoque_produtos;
create trigger fv_estoque_produto_codigo
  before insert or update on public.estoque_produtos
  for each row execute function public.fv_estoque_produto_codigo();

-- O código da categoria (LOC, SEN, ATU...) também não muda depois de criado
create or replace function public.fv_estoque_categoria_codigo()
returns trigger language plpgsql as $$
begin
  if new.codigo is distinct from old.codigo then
    raise exception 'O código da categoria (%) não pode ser alterado.', old.codigo;
  end if;
  return new;
end $$;

drop trigger if exists fv_estoque_categoria_codigo on public.estoque_categorias;
create trigger fv_estoque_categoria_codigo
  before update on public.estoque_categorias
  for each row execute function public.fv_estoque_categoria_codigo();
