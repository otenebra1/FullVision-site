-- =====================================================================
-- Fluxo de compras com aprovação
--
--  PENDENTE ........ pedido feito, aguardando o ADM aprovar
--  APROVADA ........ ADM aprovou: equipe de compras faz os orçamentos
--  ORCADA .......... compras concluiu os orçamentos: ADM escolhe e aprova
--  COMPRA_APROVADA . ADM aprovou a compra com um orçamento
--  EM_COMPRA ....... em processo de compra
--  COMPRADA ........ compra realizada
--  ENTREGUE ........ entregue
--  FINALIZADA ...... finalizado (todos que participaram são avisados)
--  RECUSADA ........ recusada pelo ADM
--
-- Também cria:
--  - permissão "Área de compras" no usuário (profiles.compras), marcada
--    pelo ADM em Gerenciar Usuários;
--  - orçamentos (fin_orcamentos) e histórico de etapas (fin_solicitacao_eventos);
--  - notificações dentro do site (fv_notificacoes), o sino no topo das telas.
--
-- Rode DEPOIS do 20261125d_solicitacoes_compra.sql e do
-- 20261126_gasto_recorrente_solicitacao_local.sql. Pode rodar de novo.
-- =====================================================================

-- ---------- 1) Permissão "Área de compras" no usuário ----------
alter table public.profiles add column if not exists compras boolean not null default false;

-- ADM sempre pode; funcionário e técnico só com a permissão marcada
create or replace function public.fv_eh_compras()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select role = 'admin' or (compras and role in ('funcionario', 'tecnico'))
      from public.profiles where id = auth.uid()
  ), false)
$$;
grant execute on function public.fv_eh_compras() to authenticated;

-- Só o ADM (ou o servidor) liga/desliga a permissão
create or replace function public.fv_profiles_trava_compras()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.fv_eh_admin() then
    if tg_op = 'INSERT' then new.compras := false;
    else new.compras := old.compras;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists fv_profiles_trava_compras on public.profiles;
create trigger fv_profiles_trava_compras
  before insert or update on public.profiles
  for each row execute function public.fv_profiles_trava_compras();

-- Nome de exibição de um usuário (técnico: nome do cadastro de Técnicos)
create or replace function public.fv_nome_usuario(uid uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare nome text; papel text; mail text;
begin
  if uid is null then return 'Sistema'; end if;
  select p.username, p.role into nome, papel from public.profiles p where p.id = uid;
  select u.email into mail from auth.users u where u.id = uid;
  if papel = 'tecnico' then
    select t.nome into nome from public.tecnicos t where lower(trim(t.email)) = lower(trim(mail)) limit 1;
  end if;
  return coalesce(nullif(trim(nome), ''), mail, 'Usuário');
end $$;
revoke execute on function public.fv_nome_usuario(uuid) from public, anon, authenticated;

-- ---------- 2) Notificações dentro do site ----------
create table if not exists public.fv_notificacoes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  titulo     text not null,
  mensagem   text,
  link       text,
  lida       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists fv_notificacoes_user_idx on public.fv_notificacoes (user_id, lida, created_at desc);

alter table public.fv_notificacoes enable row level security;
drop policy if exists "notificacao ver as minhas" on public.fv_notificacoes;
create policy "notificacao ver as minhas" on public.fv_notificacoes for select to authenticated using (user_id = auth.uid());
drop policy if exists "notificacao marcar lida" on public.fv_notificacoes;
create policy "notificacao marcar lida" on public.fv_notificacoes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notificacao apagar" on public.fv_notificacoes;
create policy "notificacao apagar" on public.fv_notificacoes for delete to authenticated using (user_id = auth.uid());
-- (ninguém cria notificação direto: só o banco, pelas funções abaixo)

-- Cria uma notificação para cada pessoa da lista (menos quem fez a ação)
create or replace function public.fv_notificar(destinos uuid[], p_titulo text, p_mensagem text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.fv_notificacoes (user_id, titulo, mensagem, link)
  select distinct d, p_titulo, p_mensagem, p_link
    from unnest(destinos) as d
   where d is not null
     and d is distinct from auth.uid()
     and exists (select 1 from auth.users u where u.id = d);
end $$;
revoke execute on function public.fv_notificar(uuid[], text, text, text) from public, anon, authenticated;

-- ---------- 3) Solicitação: colunas novas ----------
alter table public.fin_solicitacoes add column if not exists local_entrega    text;
alter table public.fin_solicitacoes add column if not exists centro_custo     text;
alter table public.fin_solicitacoes add column if not exists status_em        timestamptz;   -- quando entrou na etapa atual
alter table public.fin_solicitacoes add column if not exists comentario_etapa text;          -- só de passagem: vai para o histórico

-- ---------- 4) Orçamentos ----------
create table if not exists public.fin_orcamentos (
  id                 uuid primary key default gen_random_uuid(),
  solicitacao_id     uuid not null references public.fin_solicitacoes(id) on delete cascade,
  fornecedor_id      uuid references public.fin_fornecedores(id) on delete set null,
  fornecedor_nome    text not null,
  contato            text,
  quantidade         numeric(14,2),
  valor_unitario     numeric(14,2) not null default 0,
  frete              numeric(14,2) not null default 0,
  valor_total        numeric(14,2) not null default 0,   -- calculado pelo banco
  prazo_entrega      text,
  condicao_pagamento text,
  validade           date,
  observacao         text,
  anexos             jsonb not null default '[]'::jsonb,
  criado_por         uuid default auth.uid(),
  criado_por_nome    text,
  created_at         timestamptz not null default now()
);
create index if not exists fin_orcamentos_solicitacao_idx on public.fin_orcamentos (solicitacao_id);

-- Orçamento escolhido pelo ADM
alter table public.fin_solicitacoes add column if not exists orcamento_id uuid references public.fin_orcamentos(id) on delete set null;

create or replace function public.fv_fin_orcamento_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare qtd numeric;
begin
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(auth.uid(), new.criado_por);
    new.criado_por_nome := public.fv_nome_usuario(new.criado_por);
  else
    new.criado_por := old.criado_por;
    new.criado_por_nome := old.criado_por_nome;
    new.solicitacao_id := old.solicitacao_id;
  end if;
  select s.quantidade into qtd from public.fin_solicitacoes s where s.id = new.solicitacao_id;
  new.quantidade := coalesce(new.quantidade, qtd, 1);
  new.valor_total := round(coalesce(new.valor_unitario, 0) * new.quantidade + coalesce(new.frete, 0), 2);
  return new;
end $$;
drop trigger if exists fv_fin_orcamento_antes on public.fin_orcamentos;
create trigger fv_fin_orcamento_antes
  before insert or update on public.fin_orcamentos
  for each row execute function public.fv_fin_orcamento_antes();

-- ---------- 5) Histórico das etapas ----------
create table if not exists public.fin_solicitacao_eventos (
  id             uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.fin_solicitacoes(id) on delete cascade,
  de_status      text,
  para_status    text,
  comentario     text,
  usuario_id     uuid,
  usuario_nome   text,
  created_at     timestamptz not null default now()
);
create index if not exists fin_solicitacao_eventos_idx on public.fin_solicitacao_eventos (solicitacao_id, created_at);

-- ---------- 6) Regras de etapa + histórico (antes de gravar) ----------
create or replace function public.fv_fin_solicitacao_fluxo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  adm boolean := public.fv_eh_admin();
  sistema boolean := auth.uid() is null;            -- SQL editor / servidor
  etapas text[] := array['COMPRA_APROVADA', 'EM_COMPRA', 'COMPRADA', 'ENTREGUE', 'FINALIZADA'];
  i_de int; i_para int;
  coment text := nullif(trim(coalesce(new.comentario_etapa, '')), '');
begin
  if not adm and not sistema then
    -- Quem não é ADM só muda a etapa (o resto do pedido fica como está)
    new.item_id := old.item_id;           new.descricao := old.descricao;
    new.quantidade := old.quantidade;     new.unidade := old.unidade;
    new.motivo := old.motivo;             new.urgencia := old.urgencia;
    new.solicitante_id := old.solicitante_id; new.solicitante_nome := old.solicitante_nome;
    new.solicitante_perfil := old.solicitante_perfil;
    new.resposta := old.resposta;         new.despesa_id := old.despesa_id;
    new.orcamento_id := old.orcamento_id; new.decidido_em := old.decidido_em;
    new.local_entrega := old.local_entrega; new.centro_custo := old.centro_custo;

    if new.status is distinct from old.status then
      if not public.fv_eh_compras() then
        raise exception 'Só a equipe de compras ou o ADM muda a etapa da solicitação.';
      end if;
      i_de := array_position(etapas, old.status);
      i_para := array_position(etapas, new.status);
      if old.status = 'APROVADA' and new.status = 'ORCADA' then
        if not exists (select 1 from public.fin_orcamentos o where o.solicitacao_id = new.id) then
          raise exception 'Cadastre pelo menos um orçamento antes de enviar para o ADM.';
        end if;
      elsif i_de is null or i_para is null or i_para <= i_de then
        raise exception 'Mudança de etapa não permitida (% para %).', old.status, new.status;
      end if;
    end if;
  end if;

  if new.status is distinct from old.status then
    new.status_em := now();
    insert into public.fin_solicitacao_eventos (solicitacao_id, de_status, para_status, comentario, usuario_id, usuario_nome)
    values (new.id, old.status, new.status, coment, auth.uid(), public.fv_nome_usuario(auth.uid()));
  elsif coment is not null then
    insert into public.fin_solicitacao_eventos (solicitacao_id, de_status, para_status, comentario, usuario_id, usuario_nome)
    values (new.id, old.status, old.status, coment, auth.uid(), public.fv_nome_usuario(auth.uid()));
  end if;
  new.comentario_etapa := null;
  return new;
end $$;
drop trigger if exists fv_fin_solicitacao_fluxo on public.fin_solicitacoes;
create trigger fv_fin_solicitacao_fluxo
  before update on public.fin_solicitacoes
  for each row execute function public.fv_fin_solicitacao_fluxo();

-- ---------- 7) Avisos (depois de gravar) ----------
create or replace function public.fv_fin_solicitacao_avisos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  item text;
  admins uuid[];
  equipe_compras uuid[];
  participantes uuid[];
  link_adm text := '/financeiro?aba=solicitacoes';
  link_compras text := '/compras';
  coment text;
begin
  item := new.descricao || ' (' || rtrim(rtrim(new.quantidade::text, '0'), '.') || ' ' || coalesce(new.unidade, 'UN') || ')';
  select array_agg(p.id) into admins from public.profiles p where p.role = 'admin';
  select array_agg(p.id) into equipe_compras from public.profiles p where p.compras and p.role in ('admin', 'funcionario', 'tecnico');

  if tg_op = 'INSERT' then
    insert into public.fin_solicitacao_eventos (solicitacao_id, de_status, para_status, usuario_id, usuario_nome)
    values (new.id, null, new.status, new.solicitante_id, coalesce(new.solicitante_nome, public.fv_nome_usuario(new.solicitante_id)));
    if new.status = 'PENDENTE' then
      perform public.fv_notificar(admins, 'Nova solicitação de compra',
        coalesce(new.solicitante_nome, 'Alguém') || ' pediu ' || item || '. Aguardando sua aprovação.', link_adm);
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then return new; end if;

  select comentario into coment from public.fin_solicitacao_eventos
   where solicitacao_id = new.id order by created_at desc limit 1;

  select array_agg(distinct x) into participantes from (
    select new.solicitante_id as x
    union select usuario_id from public.fin_solicitacao_eventos where solicitacao_id = new.id
    union select criado_por from public.fin_orcamentos where solicitacao_id = new.id
  ) p where x is not null;

  if new.status = 'APROVADA' and old.status = 'PENDENTE' then
    perform public.fv_notificar(equipe_compras, 'Nova compra para orçar', item || ' foi aprovado pelo ADM. Faça os orçamentos.', link_compras);
    perform public.fv_notificar(array[new.solicitante_id], 'Solicitação aprovada', item || ' foi aprovado e seguiu para a equipe de compras.', null);
  elsif new.status = 'APROVADA' then
    perform public.fv_notificar(equipe_compras, 'ADM pediu novos orçamentos',
      item || coalesce('. ' || coment, '.'), link_compras);
  elsif new.status = 'ORCADA' then
    perform public.fv_notificar(admins, 'Orçamentos prontos para aprovar', item || ': escolha o melhor orçamento e aprove a compra.', link_adm);
  elsif new.status = 'COMPRA_APROVADA' then
    perform public.fv_notificar(equipe_compras, 'Compra aprovada: pode comprar', item || coalesce('. ' || coment, '.'), link_compras);
    perform public.fv_notificar(array[new.solicitante_id], 'Compra aprovada', item || ' teve a compra aprovada.', null);
  elsif new.status = 'COMPRADA' then
    perform public.fv_notificar(array[new.solicitante_id], 'Compra realizada', item || ' foi comprado.', null);
  elsif new.status = 'ENTREGUE' then
    perform public.fv_notificar(array[new.solicitante_id], 'Compra entregue', item || ' foi entregue' || coalesce(' em ' || new.local_entrega, '') || '.', null);
  elsif new.status = 'FINALIZADA' then
    perform public.fv_notificar(participantes, 'Compra finalizada', item || ' foi finalizado.' || coalesce(' ' || coment, ''), null);
  elsif new.status = 'RECUSADA' then
    perform public.fv_notificar(participantes, 'Solicitação recusada', item || ' foi recusado.' || coalesce(' Motivo: ' || new.resposta, ''), null);
  end if;
  return new;
end $$;
drop trigger if exists fv_fin_solicitacao_avisos on public.fin_solicitacoes;
create trigger fv_fin_solicitacao_avisos
  after insert or update of status on public.fin_solicitacoes
  for each row execute function public.fv_fin_solicitacao_avisos();

-- ---------- 8) Acesso (RLS) ----------
-- Solicitações: compras vê todas e muda a etapa das que estão com ela
drop policy if exists "solicitacao compras ver" on public.fin_solicitacoes;
create policy "solicitacao compras ver" on public.fin_solicitacoes for select to authenticated
  using (public.fv_eh_compras());
drop policy if exists "solicitacao compras etapa" on public.fin_solicitacoes;
create policy "solicitacao compras etapa" on public.fin_solicitacoes for update to authenticated
  using (public.fv_eh_compras() and status in ('APROVADA', 'COMPRA_APROVADA', 'EM_COMPRA', 'COMPRADA', 'ENTREGUE'))
  with check (public.fv_eh_compras());

-- Orçamentos
alter table public.fin_orcamentos enable row level security;
drop policy if exists "orcamento adm" on public.fin_orcamentos;
create policy "orcamento adm" on public.fin_orcamentos for all to authenticated
  using (public.fv_eh_admin()) with check (public.fv_eh_admin());
drop policy if exists "orcamento compras ver" on public.fin_orcamentos;
create policy "orcamento compras ver" on public.fin_orcamentos for select to authenticated
  using (public.fv_eh_compras());
drop policy if exists "orcamento compras criar" on public.fin_orcamentos;
create policy "orcamento compras criar" on public.fin_orcamentos for insert to authenticated
  with check (public.fv_eh_compras() and exists (
    select 1 from public.fin_solicitacoes s where s.id = solicitacao_id and s.status = 'APROVADA'));
drop policy if exists "orcamento compras editar" on public.fin_orcamentos;
create policy "orcamento compras editar" on public.fin_orcamentos for update to authenticated
  using (public.fv_eh_compras() and exists (
    select 1 from public.fin_solicitacoes s where s.id = solicitacao_id and s.status = 'APROVADA'))
  with check (public.fv_eh_compras());
drop policy if exists "orcamento compras excluir" on public.fin_orcamentos;
create policy "orcamento compras excluir" on public.fin_orcamentos for delete to authenticated
  using (public.fv_eh_compras() and exists (
    select 1 from public.fin_solicitacoes s where s.id = solicitacao_id and s.status = 'APROVADA'));

-- Histórico: ADM, compras e quem pediu
alter table public.fin_solicitacao_eventos enable row level security;
drop policy if exists "evento ver" on public.fin_solicitacao_eventos;
create policy "evento ver" on public.fin_solicitacao_eventos for select to authenticated
  using (public.fv_eh_admin() or public.fv_eh_compras() or exists (
    select 1 from public.fin_solicitacoes s where s.id = solicitacao_id and s.solicitante_id = auth.uid()));

-- Fornecedores: compras consulta e cadastra
drop policy if exists "fornecedores compras ver" on public.fin_fornecedores;
create policy "fornecedores compras ver" on public.fin_fornecedores for select to authenticated
  using (public.fv_eh_compras());
drop policy if exists "fornecedores compras criar" on public.fin_fornecedores;
create policy "fornecedores compras criar" on public.fin_fornecedores for insert to authenticated
  with check (public.fv_eh_compras());

-- Itens do catálogo: compras lê (para ver o nome do item)
drop policy if exists "fin_itens compras ver" on public.fin_itens;
create policy "fin_itens compras ver" on public.fin_itens for select to authenticated
  using (public.fv_eh_compras());

-- Arquivos dos orçamentos (PDF, print) na pasta financeiro/orcamentos/
drop policy if exists "financeiro orcamentos compras" on storage.objects;
create policy "financeiro orcamentos compras" on storage.objects for all to authenticated
  using (bucket_id = 'financeiro' and name like 'orcamentos/%' and public.fv_eh_compras())
  with check (bucket_id = 'financeiro' and name like 'orcamentos/%' and public.fv_eh_compras());

-- Pedidos antigos: começam o histórico com a etapa em que estão
insert into public.fin_solicitacao_eventos (solicitacao_id, de_status, para_status, usuario_id, usuario_nome, created_at)
select s.id, null, s.status, s.solicitante_id, s.solicitante_nome, s.created_at
  from public.fin_solicitacoes s
 where not exists (select 1 from public.fin_solicitacao_eventos e where e.solicitacao_id = s.id);
