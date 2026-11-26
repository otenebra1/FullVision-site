-- =====================================================================
-- ETAPA 4 do ERP: ESTOQUE POR QUANTIDADE e ESTOQUE MÍNIMO
--   - produto do catálogo pode ser controlado por SERIAL (rastreador, sensor: conta os itens em estoque)
--     ou por QUANTIDADE (material: abraçadeira, chicote, relé...) com saldo e movimentos
--   - estoque mínimo e quantidade ideal por produto
--   - ficou abaixo do mínimo → o banco abre sozinho uma solicitação de compra (fluxo do /compras)
--   - compra de material ENTREGUE → entra no saldo sozinha
-- Rode uma vez no Supabase: SQL Editor > New query > colar tudo > Run. Pode rodar de novo.
-- Precisa de: estoque_produtos (20261124b), fin_solicitacoes + fluxo (20261125d e 20261126b).
-- =====================================================================

-- 1) Produto: tipo de controle, unidade, mínimo, ideal e saldo -----------------
alter table public.estoque_produtos
  add column if not exists controle          text not null default 'SERIAL',
  add column if not exists unidade           text not null default 'UN',
  add column if not exists estoque_minimo    numeric(14,2),
  add column if not exists estoque_ideal     numeric(14,2),     -- até quanto repor quando pedir compra
  add column if not exists saldo             numeric(14,2) not null default 0, -- só para QUANTIDADE
  add column if not exists repor_automatico  boolean not null default true;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'estoque_produtos_controle_chk') then
    alter table public.estoque_produtos add constraint estoque_produtos_controle_chk check (controle in ('SERIAL', 'QUANTIDADE'));
  end if;
end $$;

-- Categoria para os materiais de instalação
insert into public.estoque_categorias (codigo, nome, ordem) values ('MAT', 'Material de instalação', 90)
on conflict (codigo) do nothing;

-- 2) Movimentos (entrada, saída, ajuste) dos materiais por quantidade ------------
create table if not exists public.estoque_movimentos (
  id              uuid primary key default gen_random_uuid(),
  produto_id      uuid not null references public.estoque_produtos(id) on delete cascade,
  tipo            text not null check (tipo in ('ENTRADA', 'SAIDA', 'AJUSTE')),
  quantidade      numeric(14,2) not null,         -- com sinal: entrada +, saída −, ajuste = diferença
  saldo_apos      numeric(14,2) not null,
  motivo          text,                            -- Compra, Instalação, Viagem, Perda, Inventário...
  pessoa          text,                            -- quem pegou / quem recebeu
  solicitacao_id  uuid references public.fin_solicitacoes(id) on delete set null,
  usuario_id      uuid default auth.uid(),
  usuario_nome    text,
  created_at      timestamptz not null default now()
);
create index if not exists estoque_movimentos_produto_idx on public.estoque_movimentos (produto_id, created_at desc);

alter table public.estoque_movimentos enable row level security;
drop policy if exists "movimentos equipe le" on public.estoque_movimentos;
create policy "movimentos equipe le" on public.estoque_movimentos for select to authenticated
  using (public.fv_papel() in ('admin', 'funcionario'));
-- (ninguém grava direto: só pela função fv_estoque_movimentar)

-- 3) Solicitação de compra ligada ao produto do estoque --------------------
alter table public.fin_solicitacoes
  add column if not exists produto_id uuid references public.estoque_produtos(id) on delete set null,
  add column if not exists origem     text;   -- ESTOQUE_MINIMO = aberta sozinha pelo estoque

-- Nome de quem "pediu" quando foi o próprio estoque (roda depois do fv_fin_solicitante)
create or replace function public.fv_fin_solicitante_zauto()
returns trigger language plpgsql as $$
begin
  if new.origem = 'ESTOQUE_MINIMO' then
    new.solicitante_nome := 'Estoque (automático)';
    new.solicitante_perfil := 'sistema';
    new.status := 'PENDENTE';
  end if;
  return new;
end $$;
drop trigger if exists fv_fin_solicitante_zauto on public.fin_solicitacoes;
create trigger fv_fin_solicitante_zauto before insert on public.fin_solicitacoes
  for each row execute function public.fv_fin_solicitante_zauto();

-- 4) Quanto tem disponível (serial: itens no estoque central ou com técnico; quantidade: saldo) --
create or replace function public.fv_estoque_disponivel(p_produto uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case when p.controle = 'QUANTIDADE' then p.saldo
              else (select count(*) from public.rastreadores r
                     where r.produto_id = p.id and r.status in ('estoque_central', 'estoque_tecnico'))::numeric end
    from public.estoque_produtos p where p.id = p_produto
$$;
grant execute on function public.fv_estoque_disponivel(uuid) to authenticated;

-- 5) Abaixo do mínimo → abre solicitação de compra (se não houver uma em andamento) --------
create or replace function public.fv_estoque_verificar_minimo(p_produto uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p public.estoque_produtos%rowtype;
  disp numeric;
  qtd numeric;
  item uuid;
  nova uuid;
begin
  select * into p from public.estoque_produtos where id = p_produto;
  if not found or not p.ativo or not p.repor_automatico or p.estoque_minimo is null then return null; end if;
  disp := public.fv_estoque_disponivel(p_produto);
  if disp >= p.estoque_minimo then return null; end if;
  if exists (select 1 from public.fin_solicitacoes s
              where s.produto_id = p_produto and s.status not in ('FINALIZADA', 'RECUSADA')) then
    return null;
  end if;
  qtd := greatest(coalesce(p.estoque_ideal, p.estoque_minimo * 2) - disp, 1);
  select id into item from public.fin_itens where produto_id = p_produto order by created_at limit 1;
  insert into public.fin_solicitacoes (item_id, produto_id, origem, descricao, quantidade, unidade, motivo, urgencia, centro_custo)
  values (item, p_produto, 'ESTOQUE_MINIMO', p.codigo || ' ' || p.nome, qtd, coalesce(p.unidade, 'UN'),
          format('Reposição automática: tem %s %s no estoque, o mínimo é %s.',
                 trim(to_char(disp, 'FM999999990.##')), lower(coalesce(p.unidade, 'UN')), trim(to_char(p.estoque_minimo, 'FM999999990.##'))),
          case when disp <= 0 then 'URGENTE' else 'NORMAL' end, 'Estoque')
  returning id into nova;
  -- O aviso normal não vai para quem fez a ação; se foi um ADM que mexeu no estoque, avisa ele também
  if auth.uid() is not null and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    insert into public.fv_notificacoes (user_id, titulo, mensagem, link)
    values (auth.uid(), 'Estoque abaixo do mínimo', p.codigo || ' ' || p.nome || ': abri uma solicitação de compra de '
            || trim(to_char(qtd, 'FM999999990.##')) || ' ' || lower(coalesce(p.unidade, 'UN')) || '.', '/financeiro?aba=solicitacoes');
  end if;
  return nova;
end $$;
grant execute on function public.fv_estoque_verificar_minimo(uuid) to authenticated;

-- Confere todos os produtos (a tela chama ao abrir; serve também depois de mudar o mínimo)
create or replace function public.fv_estoque_verificar_todos()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if public.fv_papel() not in ('admin', 'funcionario') then return 0; end if;
  for r in select id from public.estoque_produtos where ativo and estoque_minimo is not null loop
    if public.fv_estoque_verificar_minimo(r.id) is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;
grant execute on function public.fv_estoque_verificar_todos() to authenticated;

-- 6) Entrada / saída / ajuste de material (ADM e funcionário) -------------------
create or replace function public.fv_estoque_movimentar(p_produto uuid, p_tipo text, p_quantidade numeric, p_motivo text default null, p_pessoa text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  p public.estoque_produtos%rowtype;
  delta numeric;
  novo numeric;
begin
  if coalesce(public.fv_papel(), '') not in ('admin', 'funcionario') and auth.uid() is not null then
    raise exception 'Só o ADM ou funcionário movimenta o estoque.';
  end if;
  select * into p from public.estoque_produtos where id = p_produto for update;
  if not found then raise exception 'Produto não encontrado.'; end if;
  if p.controle <> 'QUANTIDADE' then raise exception 'O produto % é controlado por serial: cadastre ou baixe os itens um a um.', p.codigo; end if;
  if p_quantidade is null or p_quantidade < 0 or (p_tipo <> 'AJUSTE' and p_quantidade = 0) then raise exception 'Quantidade inválida.'; end if;
  delta := case p_tipo when 'ENTRADA' then p_quantidade when 'SAIDA' then -p_quantidade when 'AJUSTE' then p_quantidade - p.saldo end;
  if delta is null then raise exception 'Tipo inválido: %', p_tipo; end if;
  novo := p.saldo + delta;
  if novo < 0 then raise exception 'Saldo de % ficaria negativo (tem %).', p.nome, p.saldo; end if;
  update public.estoque_produtos set saldo = novo where id = p_produto;
  insert into public.estoque_movimentos (produto_id, tipo, quantidade, saldo_apos, motivo, pessoa, usuario_nome)
  values (p_produto, p_tipo, delta, novo, nullif(trim(coalesce(p_motivo, '')), ''), nullif(trim(coalesce(p_pessoa, '')), ''),
          (select coalesce(username, '') from public.profiles where id = auth.uid()));
  perform public.fv_estoque_verificar_minimo(p_produto);
  return novo;
end $$;
grant execute on function public.fv_estoque_movimentar(uuid, text, numeric, text, text) to authenticated;

-- 7) Itens com serial: quando sai do estoque (instalado, baixado...) confere o mínimo --------
create or replace function public.fv_rastreador_confere_minimo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.produto_id is not null then
    perform public.fv_estoque_verificar_minimo(old.produto_id);
  end if;
  if tg_op = 'UPDATE' and new.produto_id is not null and new.produto_id is distinct from old.produto_id then
    perform public.fv_estoque_verificar_minimo(new.produto_id);
  end if;
  return null;
end $$;
drop trigger if exists fv_rastreador_confere_minimo on public.rastreadores;
create trigger fv_rastreador_confere_minimo
  after update of status, produto_id or delete on public.rastreadores
  for each row execute function public.fv_rastreador_confere_minimo();

-- 8) Compra de material entregue → entra no saldo (uma vez só por solicitação) ----------
create or replace function public.fv_solicitacao_entra_estoque()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.estoque_produtos%rowtype; novo numeric;
begin
  if new.produto_id is null or new.status not in ('ENTREGUE', 'FINALIZADA') or new.status is not distinct from old.status then return null; end if;
  select * into p from public.estoque_produtos where id = new.produto_id for update;
  if not found or p.controle <> 'QUANTIDADE' then return null; end if;
  if exists (select 1 from public.estoque_movimentos where solicitacao_id = new.id and tipo = 'ENTRADA') then return null; end if;
  novo := p.saldo + new.quantidade;
  update public.estoque_produtos set saldo = novo where id = p.id;
  insert into public.estoque_movimentos (produto_id, tipo, quantidade, saldo_apos, motivo, solicitacao_id, usuario_nome)
  values (p.id, 'ENTRADA', new.quantidade, novo, 'Compra entregue', new.id, public.fv_nome_usuario(auth.uid()));
  return null;
end $$;
drop trigger if exists fv_solicitacao_entra_estoque on public.fin_solicitacoes;
create trigger fv_solicitacao_entra_estoque
  after update of status on public.fin_solicitacoes
  for each row execute function public.fv_solicitacao_entra_estoque();
