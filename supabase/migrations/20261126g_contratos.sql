-- =====================================================================
-- ETAPA 3 do ERP: CONTRATOS (tela /contratos, só ADM)
--   - contrato por cliente: número automático, início, duração, fim, renovação automática
--   - modelo de contrato com campos que se preenchem sozinhos (gera o PDF pelo navegador)
--   - PDF assinado guardado no Storage (bucket "contratos", privado)
--   - alerta de renovação e de reajuste no sino (fv_notificacoes)
--   - reajuste anual por índice (IPCA, IGP-M, INPC ou % fixo) aplicado na tabela de preço do cliente
-- Rode uma vez no Supabase: SQL Editor > New query > colar tudo > Run. Pode rodar de novo.
-- Precisa de: fv_eh_admin() (20261124e), mensalidade_cliente e fv_valor_mensal() (20261125),
--             fv_notificacoes (20261126b), precos_cliente_empresa/precos_cliente_padrao (tabela de preço).
-- =====================================================================

-- 1) Contratos ---------------------------------------------------------
do $$
declare tipo_emp text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_emp
  from pg_attribute a where a.attrelid = 'public.empresas'::regclass and a.attname = 'id';
  execute format($f$
    create table if not exists public.contratos (
      id                    uuid primary key default gen_random_uuid(),
      numero                text unique,                      -- FV-2026-001 (automático)
      empresa_id            %s not null references public.empresas(id) on delete restrict,
      status                text not null default 'ATIVO',    -- RASCUNHO, ATIVO, ENCERRADO, CANCELADO
      inicio                date not null,
      duracao_meses         integer not null default 12 check (duracao_meses > 0),
      fim                   date,                             -- calculado: início + duração
      renovacao_automatica  boolean not null default true,
      renovacoes            integer not null default 0,
      aviso_dias            integer not null default 60,      -- avisa X dias antes do fim
      indice_reajuste       text not null default 'IPCA',     -- IPCA, IGPM, INPC, FIXO, NENHUM
      percentual_fixo       numeric(6,2),                     -- quando o índice é FIXO (percentual ao ano)
      proximo_reajuste      date,                             -- aniversário do contrato
      ultimo_reajuste       date,
      valor_mensal_ref      numeric(12,2),                    -- valor por placa combinado (só referência no contrato)
      qtd_placas_ref        integer,
      dia_vencimento        smallint check (dia_vencimento is null or dia_vencimento between 1 and 31),
      fidelidade_meses      integer,
      multa_rescisao        text,                             -- ex.: "metade das mensalidades restantes"
      objeto                text,                             -- resumo do que foi contratado
      texto                 text,                             -- texto do contrato (vem do modelo, pode ser editado)
      observacoes           text,
      arquivo_path          text,                             -- PDF assinado (bucket contratos)
      arquivo_nome          text,
      assinado_em           date,
      alerta_renovacao_em   timestamptz,                      -- já avisou da renovação deste período
      alerta_reajuste_ref   date,                             -- já avisou do reajuste desta data
      encerrado_em          date,
      motivo_encerramento   text,
      criado_por            uuid default auth.uid(),
      created_at            timestamptz not null default now(),
      updated_at            timestamptz not null default now()
    )$f$, tipo_emp);
end $$;
create index if not exists contratos_empresa_idx on public.contratos (empresa_id);
create index if not exists contratos_fim_idx on public.contratos (fim);

-- Número automático, fim e próximo reajuste calculados
create sequence if not exists public.contratos_numero_seq;
create or replace function public.fv_contrato_antes()
returns trigger language plpgsql as $$
begin
  if new.numero is null or new.numero = '' then
    new.numero := 'FV-' || to_char(coalesce(new.inicio, current_date), 'YYYY') || '-' || lpad(nextval('public.contratos_numero_seq')::text, 3, '0');
  end if;
  if tg_op = 'INSERT' or new.inicio is distinct from old.inicio or new.duracao_meses is distinct from old.duracao_meses or new.renovacoes is distinct from old.renovacoes then
    new.fim := (new.inicio + make_interval(months => new.duracao_meses * (new.renovacoes + 1)) - interval '1 day')::date;
  end if;
  if new.proximo_reajuste is null and new.indice_reajuste <> 'NENHUM' then
    new.proximo_reajuste := (new.inicio + interval '12 months')::date;
    while new.proximo_reajuste < current_date - 31 loop
      new.proximo_reajuste := (new.proximo_reajuste + interval '12 months')::date;
    end loop;
  end if;
  if tg_op = 'UPDATE' and new.fim is distinct from old.fim then new.alerta_renovacao_em := null; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists fv_contrato_antes on public.contratos;
create trigger fv_contrato_antes before insert or update on public.contratos
  for each row execute function public.fv_contrato_antes();

-- O contrato ativo atualiza o cadastro do cliente (início, duração, fim e dia do boleto)
create or replace function public.fv_contrato_sincroniza_empresa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ATIVO' then
    update public.empresas
       set contrato_inicio = new.inicio,
           contrato_duracao_meses = new.duracao_meses,
           contrato_fim = new.fim,
           dia_vencimento_boleto = coalesce(new.dia_vencimento, dia_vencimento_boleto)
     where id = new.empresa_id;
  end if;
  return null;
end $$;
drop trigger if exists fv_contrato_sincroniza_empresa on public.contratos;
create trigger fv_contrato_sincroniza_empresa after insert or update on public.contratos
  for each row execute function public.fv_contrato_sincroniza_empresa();

-- 2) Histórico de reajustes ------------------------------------------------
create table if not exists public.contrato_reajustes (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid not null references public.contratos(id) on delete cascade,
  data          date not null default current_date,
  indice        text not null,
  referencia    text,                 -- ex.: "IPCA 12 meses até out/2026"
  percentual    numeric(8,4) not null,
  antes         jsonb,                -- preços e soma das mensalidades antes
  depois        jsonb,
  aplicado_por  uuid default auth.uid(),
  created_at    timestamptz not null default now()
);
create index if not exists contrato_reajustes_contrato_idx on public.contrato_reajustes (contrato_id, data desc);

-- 3) Modelo do contrato (uma linha só) --------------------------------------
create table if not exists public.contrato_modelo (
  id         int primary key default 1 check (id = 1),
  texto      text,
  updated_at timestamptz not null default now()
);
insert into public.contrato_modelo (id) values (1) on conflict (id) do nothing;
alter table public.contrato_modelo add column if not exists prestador_cidade text; -- cidade do foro / da assinatura

-- 4) Acesso: só o ADM ----------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['contratos','contrato_reajustes','contrato_modelo'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "contrato so adm" on public.%I', t);
    execute format('create policy "contrato so adm" on public.%I for all to authenticated using (public.fv_eh_admin()) with check (public.fv_eh_admin())', t);
  end loop;
end $$;

-- 5) Storage: PDF assinado ----------------------------------------------
insert into storage.buckets (id, name, public) values ('contratos', 'contratos', false) on conflict (id) do nothing;
drop policy if exists "contratos adm" on storage.objects;
create policy "contratos adm" on storage.objects for all to authenticated
  using (bucket_id = 'contratos' and public.fv_eh_admin())
  with check (bucket_id = 'contratos' and public.fv_eh_admin());

-- 6) Reajuste: aplica o % na tabela de preço do cliente e recalcula as placas ----------
create or replace function public.fv_contrato_reajustar(
  p_contrato uuid, p_percentual numeric, p_indice text, p_referencia text, p_incluir_servicos boolean default true
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.contratos%rowtype;
  fator numeric;
  r numeric; m numeric; f numeric;
  soma_antes numeric; soma_depois numeric;
  antes jsonb; depois jsonb;
  qtd_serv int := 0;
begin
  if not public.fv_eh_admin() then raise exception 'Só o ADM aplica reajuste.'; end if;
  select * into c from public.contratos where id = p_contrato;
  if not found then raise exception 'Contrato não encontrado.'; end if;
  if p_percentual is null or p_percentual <= -50 or p_percentual > 100 then raise exception 'Percentual fora do normal: %', p_percentual; end if;
  fator := 1 + p_percentual / 100.0;

  r := public.fv_valor_mensal(c.empresa_id, 'mensalidade_rastreamento');
  m := public.fv_valor_mensal(c.empresa_id, 'mensalidade_monitoramento');
  f := public.fv_valor_mensal(c.empresa_id, 'mensalidade_full_route');
  select coalesce(sum(mensalidade), 0) into soma_antes from public.veiculos where empresa_id = c.empresa_id and status = 'Ativo';
  antes := jsonb_build_object('rastreamento', r, 'monitoramento', m, 'full_route', f, 'soma_mensalidades', soma_antes, 'valor_mensal_ref', c.valor_mensal_ref);

  if r is not null or m is not null or f is not null then
    -- Preço por serviço: grava o valor novo na tabela do cliente; o banco recalcula as placas
    insert into public.mensalidade_cliente (empresa_id, mensalidade_rastreamento, mensalidade_monitoramento, mensalidade_full_route)
    values (c.empresa_id, round(r * fator, 2), round(m * fator, 2), round(f * fator, 2))
    on conflict (empresa_id) do update set
      mensalidade_rastreamento  = excluded.mensalidade_rastreamento,
      mensalidade_monitoramento = excluded.mensalidade_monitoramento,
      mensalidade_full_route    = excluded.mensalidade_full_route;
    update public.veiculos set servicos = servicos where empresa_id = c.empresa_id;
  else
    -- Sem tabela de mensalidade: reajusta o valor digitado em cada placa
    update public.veiculos set mensalidade = round(mensalidade * fator, 2)
     where empresa_id = c.empresa_id and coalesce(mensalidade, 0) > 0;
  end if;

  if p_incluir_servicos then
    insert into public.precos_cliente_empresa (empresa_id, servico_id, valor)
    select c.empresa_id, s.servico_id, round(s.base * fator, 2)
      from (
        select coalesce(pe.servico_id, pp.servico_id) as servico_id, coalesce(pe.valor, pp.valor) as base
          from public.precos_cliente_padrao pp
          full join (select * from public.precos_cliente_empresa where empresa_id = c.empresa_id) pe on pe.servico_id = pp.servico_id
      ) s
     where s.base is not null and s.base > 0
    on conflict (empresa_id, servico_id) do update set valor = excluded.valor;
    get diagnostics qtd_serv = row_count;
  end if;

  select coalesce(sum(mensalidade), 0) into soma_depois from public.veiculos where empresa_id = c.empresa_id and status = 'Ativo';
  depois := jsonb_build_object(
    'rastreamento', round(r * fator, 2), 'monitoramento', round(m * fator, 2), 'full_route', round(f * fator, 2),
    'soma_mensalidades', soma_depois, 'servicos_reajustados', qtd_serv,
    'valor_mensal_ref', case when c.valor_mensal_ref is null then null else round(c.valor_mensal_ref * fator, 2) end);

  insert into public.contrato_reajustes (contrato_id, indice, referencia, percentual, antes, depois)
  values (c.id, p_indice, p_referencia, p_percentual, antes, depois);

  update public.contratos
     set ultimo_reajuste = current_date,
         proximo_reajuste = (greatest(coalesce(proximo_reajuste, current_date), current_date - 31) + interval '12 months')::date,
         valor_mensal_ref = case when valor_mensal_ref is null then null else round(valor_mensal_ref * fator, 2) end
   where id = c.id;

  return jsonb_build_object('antes', antes, 'depois', depois);
end $$;
grant execute on function public.fv_contrato_reajustar(uuid, numeric, text, text, boolean) to authenticated;

-- 7) Alertas e renovação automática (o site chama ao abrir o painel, o financeiro e os contratos) --
create or replace function public.fv_contratos_alertas()
returns integer language plpgsql security definer set search_path = public as $$
declare
  c record;
  qtd int := 0;
  adms uuid[];
begin
  if not public.fv_eh_admin() then return 0; end if;
  select array_agg(id) into adms from public.profiles where role = 'admin';

  -- Renovação automática: venceu e está marcado para renovar → soma mais um período
  for c in select * from public.contratos where status = 'ATIVO' and renovacao_automatica and fim < current_date loop
    update public.contratos set renovacoes = renovacoes + 1 where id = c.id;
    insert into public.fv_notificacoes (user_id, titulo, mensagem, link)
    select unnest(adms), 'Contrato renovado', format('%s (%s) renovou automaticamente por mais %s meses.', c.numero,
      (select nome from public.empresas where id = c.empresa_id), c.duracao_meses), '/contratos';
    qtd := qtd + 1;
  end loop;

  -- Aviso de fim do contrato
  for c in select k.*, e.nome as cliente from public.contratos k join public.empresas e on e.id = k.empresa_id
            where k.status = 'ATIVO' and k.alerta_renovacao_em is null and k.fim <= current_date + k.aviso_dias loop
    insert into public.fv_notificacoes (user_id, titulo, mensagem, link)
    select unnest(adms),
      case when c.renovacao_automatica then 'Contrato renova em breve' else 'Contrato vencendo' end,
      format('%s · %s vence em %s.%s', c.numero, c.cliente, to_char(c.fim, 'DD/MM/YYYY'),
        case when c.renovacao_automatica then ' Renova sozinho se ninguém mexer.' else ' Precisa renovar.' end),
      '/contratos';
    update public.contratos set alerta_renovacao_em = now() where id = c.id;
    qtd := qtd + 1;
  end loop;

  -- Aviso de reajuste (15 dias antes do aniversário)
  for c in select k.*, e.nome as cliente from public.contratos k join public.empresas e on e.id = k.empresa_id
            where k.status = 'ATIVO' and k.indice_reajuste <> 'NENHUM' and k.proximo_reajuste is not null
              and k.proximo_reajuste <= current_date + 15 and k.alerta_reajuste_ref is distinct from k.proximo_reajuste loop
    insert into public.fv_notificacoes (user_id, titulo, mensagem, link)
    select unnest(adms), 'Reajuste de contrato',
      format('%s · %s faz aniversário em %s: aplicar reajuste (%s).', c.numero, c.cliente, to_char(c.proximo_reajuste, 'DD/MM/YYYY'), c.indice_reajuste),
      '/contratos';
    update public.contratos set alerta_reajuste_ref = c.proximo_reajuste where id = c.id;
    qtd := qtd + 1;
  end loop;
  return qtd;
end $$;
grant execute on function public.fv_contratos_alertas() to authenticated;
