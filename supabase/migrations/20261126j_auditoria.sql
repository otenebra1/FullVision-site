-- =====================================================================
-- ETAPA 6 do ERP: REGISTRO DE ALTERAÇÕES (AUDITORIA)
--   - toda inclusão, alteração e exclusão nas tabelas importantes fica gravada:
--     quem fez, quando, o que era antes e o que ficou depois (só os campos que mudaram)
--   - ninguém edita nem apaga o registro pela tela/API (nem o ADM); só o ADM consulta
--   - campos sensíveis (token, senha, certificado) aparecem como "(oculto)"
-- Rode uma vez no Supabase: SQL Editor > New query > colar tudo > Run. Pode rodar de novo.
-- Para ligar a auditoria numa tabela nova depois: select public.fv_auditoria_ligar('nome_da_tabela', 'campo_rotulo');
-- =====================================================================

create table if not exists public.fv_auditoria (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  tabela        text not null,
  registro_id   text,
  rotulo        text,             -- placa, nome, serial... para achar fácil
  acao          text not null check (acao in ('INCLUIU', 'ALTEROU', 'EXCLUIU')),
  campos        text[],           -- campos que mudaram (ALTEROU)
  antes         jsonb,
  depois        jsonb,
  usuario_id    uuid,
  usuario_nome  text,
  usuario_papel text,
  automatico    boolean not null default false   -- mudança feita pelo próprio sistema (gatilho, rotina)
);
create index if not exists fv_auditoria_data_idx on public.fv_auditoria (created_at desc);
create index if not exists fv_auditoria_tabela_idx on public.fv_auditoria (tabela, registro_id, created_at desc);
create index if not exists fv_auditoria_usuario_idx on public.fv_auditoria (usuario_id, created_at desc);

alter table public.fv_auditoria enable row level security;
drop policy if exists "auditoria adm le" on public.fv_auditoria;
create policy "auditoria adm le" on public.fv_auditoria for select to authenticated
  using (public.fv_papel() = 'admin');
-- sem policy de insert/update/delete: só o gatilho (security definer) grava
revoke all on public.fv_auditoria from anon, authenticated;
grant select on public.fv_auditoria to authenticated;

-- Campos que não interessam no histórico (mudam sozinhos)
create or replace function public.fv_auditoria_ignorar(campo text)
returns boolean language sql immutable as $$
  select campo in ('updated_at', 'atualizado_em', 'created_at', 'ultima_atualizacao', 'search', 'busca')
$$;

-- Campos que nunca vão para o histórico em texto
create or replace function public.fv_auditoria_sensivel(campo text)
returns boolean language sql immutable as $$
  select campo ~* '(token|senha|password|secret|segredo|certificado|api_key|apikey|chave_privada)'
$$;

create or replace function public.fv_auditoria_limpo(j jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(k, case when public.fv_auditoria_sensivel(k) and v <> 'null'::jsonb then to_jsonb('(oculto)'::text) else v end), '{}'::jsonb)
    from jsonb_each(j) as e(k, v)
   where not public.fv_auditoria_ignorar(k)
$$;

-- 1) O gatilho que grava ---------------------------------------------------
-- argumento opcional: campos de rótulo separados por vírgula (o primeiro que tiver valor vira o rótulo)
create or replace function public.fv_auditoria_registrar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  j_old jsonb; j_new jsonb; j jsonb;
  mudou text[]; a jsonb := null; d jsonb := null;
  rid text; rot text; c text; acao text;
  uid uuid := auth.uid();
  nome text; papel text;
begin
  if tg_op = 'INSERT' then
    j_new := to_jsonb(new); j := j_new; acao := 'INCLUIU'; d := public.fv_auditoria_limpo(j_new);
  elsif tg_op = 'DELETE' then
    j_old := to_jsonb(old); j := j_old; acao := 'EXCLUIU'; a := public.fv_auditoria_limpo(j_old);
  else
    j_old := to_jsonb(old); j_new := to_jsonb(new); j := j_new; acao := 'ALTEROU';
    select array_agg(k order by k) into mudou
      from jsonb_each(j_new) as e(k, v)
     where not public.fv_auditoria_ignorar(k)
       and v is distinct from j_old -> k;
    if mudou is null then return null; end if;   -- nada de verdade mudou
    select jsonb_object_agg(k, j_old -> k), jsonb_object_agg(k, j_new -> k) into a, d
      from unnest(mudou) as k;
    a := public.fv_auditoria_limpo(a); d := public.fv_auditoria_limpo(d);
  end if;

  -- id do registro: campo "id" ou a chave primária (pode ser composta)
  rid := j ->> 'id';
  if rid is null then
    select string_agg(j ->> att.attname, '/' order by array_position(i.indkey::int2[], att.attnum)) into rid
      from pg_index i join pg_attribute att on att.attrelid = i.indrelid and att.attnum = any(i.indkey)
     where i.indrelid = tg_relid and i.indisprimary;
  end if;

  -- rótulo legível
  if tg_nargs > 0 then
    foreach c in array string_to_array(tg_argv[0], ',') loop
      rot := nullif(trim(j ->> trim(c)), '');
      exit when rot is not null;
    end loop;
  end if;

  if uid is not null then
    select p.username, p.role into nome, papel from public.profiles p where p.id = uid;
  end if;

  insert into public.fv_auditoria (tabela, registro_id, rotulo, acao, campos, antes, depois, usuario_id, usuario_nome, usuario_papel, automatico)
  values (tg_table_name, rid, left(rot, 200), acao, mudou, a, d, uid,
          coalesce(nome, case when uid is null then 'Sistema' end), papel,
          uid is null or coalesce(current_setting('fv.sistema', true), '') = '1' or pg_trigger_depth() > 1);
  return null;
end $$;

-- 2) Liga a auditoria numa tabela (se ela existir) -------------------------
create or replace function public.fv_auditoria_ligar(p_tabela text, p_rotulo text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if to_regclass('public.' || p_tabela) is null then return false; end if;
  execute format('drop trigger if exists fv_auditoria on public.%I', p_tabela);
  execute format('create trigger fv_auditoria after insert or update or delete on public.%I for each row execute function public.fv_auditoria_registrar(%L)',
                 p_tabela, coalesce(p_rotulo, ''));
  return true;
end $$;
revoke execute on function public.fv_auditoria_ligar(text, text) from public, anon, authenticated;

-- Tabelas acompanhadas (as que não existirem no banco são puladas).
-- Ficam de fora as que mudam o tempo todo ou já são histórico: localização do técnico, notificações,
-- movimentos de estoque, mensagens de chamado, eventos de solicitação.
select public.fv_auditoria_ligar(t.tabela, t.rotulo) from (values
  ('profiles',               'username'),
  ('empresas',               'nome,razao_social,cnpj'),
  ('veiculos',               'placa'),
  ('rastreadores',           'serial,imei'),
  ('tecnicos',               'nome'),
  ('ordens_servico',         'numero,placa,tipo'),
  ('solicitacoes_servico',   'descricao,tipo'),
  ('servicos_catalogo',      'nome'),
  ('precos_cliente_padrao',  'servico_id'),
  ('precos_cliente_empresa', 'empresa_id'),
  ('mensalidade_cliente',    'empresa_id'),
  ('faixas_tecnico',         'nome'),
  ('faixa_tecnico_precos',   'faixa_id'),
  ('tecnico_precos',         'tecnico_id'),
  ('financeiro_config',      ''),
  ('fin_despesas',           'descricao,fornecedor_nome'),
  ('fin_despesa_itens',      'descricao'),
  ('fin_fornecedores',       'nome,razao_social'),
  ('fin_categorias',         'nome'),
  ('fin_itens',              'nome,descricao'),
  ('fin_solicitacoes',       'descricao'),
  ('fin_orcamentos',         'fornecedor_nome,fornecedor'),
  ('fin_viagens',            'destino,titulo,nome'),
  ('fin_recebimentos',       'descricao,competencia'),
  ('fin_cobranca_config',    ''),
  ('fin_caixa_config',       ''),
  ('nf_config',              ''),
  ('nf_notas',               'numero,referencia'),
  ('contratos',              'numero'),
  ('contrato_modelo',        ''),
  ('contrato_reajustes',     'indice'),
  ('estoque_produtos',       'codigo,nome'),
  ('estoque_categorias',     'nome'),
  ('chamados',               'numero,titulo')
) as t(tabela, rotulo);

-- 3) Lista das tabelas que têm auditoria ligada (para o filtro da tela) -----
create or replace function public.fv_auditoria_tabelas()
returns setof text language sql stable security definer set search_path = public as $$
  select c.relname::text from pg_trigger tr join pg_class c on c.oid = tr.tgrelid
   where tr.tgname = 'fv_auditoria' and not tr.tgisinternal and public.fv_papel() = 'admin'
   order by 1
$$;
grant execute on function public.fv_auditoria_tabelas() to authenticated;

-- 4) Limpeza opcional de registros antigos (só ADM; mínimo 1 ano) ------------
create or replace function public.fv_auditoria_limpar(p_dias int default 730)
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if public.fv_papel() is distinct from 'admin' then raise exception 'Só o ADM.'; end if;
  if p_dias < 365 then raise exception 'Guarde pelo menos 365 dias.'; end if;
  delete from public.fv_auditoria where created_at < now() - make_interval(days => p_dias);
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.fv_auditoria_limpar(int) to authenticated;
