-- =====================================================================
-- Perfis de login: ADM (admin), FUNCIONÁRIO (funcionario), TÉCNICO (tecnico), CLIENTE (cliente)
-- Rode no SQL Editor do Supabase. Pode rodar mais de uma vez sem problema.
--
-- Como funciona: quase todas as regras abaixo são "RESTRICTIVE". Elas não liberam
-- nada novo; só cortam acesso em cima das regras (policies) que você já tem, então
-- não quebram o que funciona hoje para ADM e cliente. A única que libera é a 3e:
-- dá ao funcionário o mesmo acesso de equipe que o ADM tem nas tabelas internas.
--   * Técnico: não lê nem grava nenhuma tabela direto. O app dele usa as rotas
--     /api/tecnico/*, que conferem no servidor quais OS são dele e escondem os R$.
--   * Funcionário: não grava nas tabelas de preço e não exclui clientes, veículos,
--     estoque nem OS.
--   * Ninguém além do ADM consegue trocar o próprio perfil (role) pela API.
-- =====================================================================

-- 1) Perfis aceitos na coluna profiles.role ---------------------------
do $$
begin
  if exists (select 1 from public.profiles where role is not null and role not in ('admin','funcionario','tecnico','cliente')) then
    raise notice 'Há perfis com valores fora da lista; a trava de valores não foi criada. Confira: select distinct role from profiles;';
  else
    alter table public.profiles drop constraint if exists profiles_role_check;
    alter table public.profiles add constraint profiles_role_check
      check (role in ('admin','funcionario','tecnico','cliente'));
  end if;
end $$;

-- 2) Funções de apoio (security definer: leem o perfil sem cair em loop de RLS)
create or replace function public.fv_papel()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.fv_eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

grant execute on function public.fv_papel() to authenticated, anon;
grant execute on function public.fv_eh_admin() to authenticated, anon;

-- 3) Regras por tabela ------------------------------------------------
-- Só cria a regra em tabela que existe E já tem RLS ligado (ligar RLS numa
-- tabela sem regras travaria todo mundo; essas aparecem no relatório do fim).
create or replace function pg_temp.fv_regra(tabela text, nome text, comando text, condicao text, tipo text default 'restrictive')
returns void language plpgsql as $$
declare
  rls boolean;
begin
  select c.relrowsecurity into rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = tabela;
  if rls is null then
    raise notice 'Tabela % não existe, pulando.', tabela;
    return;
  end if;
  if not rls then
    raise notice 'Tabela % está SEM RLS, regra % não criada.', tabela, nome;
    return;
  end if;
  execute format('drop policy if exists %I on public.%I', nome, tabela);
  if comando in ('insert') then
    execute format('create policy %I on public.%I as %s for %s to authenticated with check (%s)', nome, tabela, tipo, comando, condicao);
  elsif comando in ('update', 'all') then
    execute format('create policy %I on public.%I as %s for %s to authenticated using (%s) with check (%s)', nome, tabela, tipo, comando, condicao, condicao);
  else
    execute format('create policy %I on public.%I as %s for %s to authenticated using (%s)', nome, tabela, tipo, comando, condicao);
  end if;
end $$;

-- 3a) Técnico fora de todas as tabelas (o app dele passa pelo servidor)
select pg_temp.fv_regra(t, 'fv_sem_tecnico', 'all', $c$coalesce(public.fv_papel(), '') <> 'tecnico'$c$)
from unnest(array[
  'empresas','veiculos','rastreadores','ordens_servico','ordens_servico_itens','ordens_servico_fotos',
  'solicitacoes_servico','steps','comments','notifications','quests','quest_comments','prospects','prospect_notes',
  'estoque_categorias','estoque_produtos','servicos_catalogo','tecnicos',
  'faixas_tecnico','faixa_tecnico_precos','tecnico_precos','precos_cliente_padrao','precos_cliente_empresa','financeiro_config'
]) as t;

-- Técnico só enxerga o próprio perfil
select pg_temp.fv_regra('profiles', 'fv_tecnico_so_proprio_perfil', 'select',
  $c$coalesce(public.fv_papel(), '') <> 'tecnico' or id = auth.uid()$c$);

-- 3b) Tabelas de preço: só o ADM grava; funcionário e cliente não leem
select pg_temp.fv_regra(t, 'fv_preco_le_equipe', 'select', $c$public.fv_papel() in ('admin','funcionario')$c$)
from unnest(array['faixas_tecnico','faixa_tecnico_precos','tecnico_precos','precos_cliente_padrao','precos_cliente_empresa','financeiro_config']) as t;
select pg_temp.fv_regra(t, 'fv_preco_insert_adm', 'insert', 'public.fv_eh_admin()')
from unnest(array['faixas_tecnico','faixa_tecnico_precos','tecnico_precos','precos_cliente_padrao','precos_cliente_empresa','financeiro_config','servicos_catalogo','tecnicos']) as t;
select pg_temp.fv_regra(t, 'fv_preco_update_adm', 'update', 'public.fv_eh_admin()')
from unnest(array['faixas_tecnico','faixa_tecnico_precos','tecnico_precos','precos_cliente_padrao','precos_cliente_empresa','financeiro_config','servicos_catalogo','tecnicos']) as t;
select pg_temp.fv_regra(t, 'fv_preco_delete_adm', 'delete', 'public.fv_eh_admin()')
from unnest(array['faixas_tecnico','faixa_tecnico_precos','tecnico_precos','precos_cliente_padrao','precos_cliente_empresa','financeiro_config','servicos_catalogo','tecnicos']) as t;

-- 3c) Excluir clientes, veículos, estoque e OS: funcionário não pode
select pg_temp.fv_regra(t, 'fv_funcionario_nao_exclui', 'delete', $c$coalesce(public.fv_papel(), '') <> 'funcionario'$c$)
from unnest(array['empresas','veiculos','rastreadores','ordens_servico','estoque_categorias','estoque_produtos']) as t;

-- 3d) Ninguém além do ADM muda o perfil (role) de alguém pela API
select pg_temp.fv_regra('profiles', 'fv_role_so_adm', 'update',
  $c$public.fv_eh_admin() or role is not distinct from public.fv_papel()$c$);

-- 3e) Funcionário trabalha como equipe: mesmo acesso do ADM às tabelas internas
-- (as travas 3b, 3c e 3d continuam valendo por cima disso)
select pg_temp.fv_regra(t, 'fv_equipe_acesso', 'all', $c$public.fv_papel() in ('admin','funcionario')$c$, 'permissive')
from unnest(array[
  'empresas','veiculos','rastreadores','ordens_servico','ordens_servico_itens','ordens_servico_fotos',
  'solicitacoes_servico','steps','comments','notifications','quests','quest_comments','prospects','prospect_notes',
  'estoque_categorias','estoque_produtos','servicos_catalogo','tecnicos',
  'faixas_tecnico','faixa_tecnico_precos','tecnico_precos','precos_cliente_padrao','precos_cliente_empresa','financeiro_config'
]) as t;
select pg_temp.fv_regra('profiles', 'fv_equipe_le_perfis', 'select', $c$public.fv_papel() in ('admin','funcionario')$c$, 'permissive');

-- 4) Relatório: tabelas do sistema que estão SEM RLS (qualquer login lê tudo nelas)
select c.relname as tabela_sem_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
order by 1;
