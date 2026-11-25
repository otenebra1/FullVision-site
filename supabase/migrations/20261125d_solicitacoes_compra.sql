-- =====================================================================
-- Solicitação de compra: ADM, funcionário e técnico pedem itens
-- (do estoque ou qualquer outro), e o pedido cai no painel /financeiro.
-- Rode DEPOIS do 20261125b_financeiro.sql. Pode rodar de novo.
-- Se o Supabase avisar sobre RLS, clique em "Run and enable RLS".
-- =====================================================================

create table if not exists public.fin_solicitacoes (
  id               uuid primary key default gen_random_uuid(),
  item_id          uuid references public.fin_itens(id) on delete set null,   -- item do catálogo (opcional)
  descricao        text not null,                                            -- o que precisa
  quantidade       numeric(14,2) not null default 1,
  unidade          text not null default 'UN',
  motivo           text not null,                                            -- por que precisa comprar
  urgencia         text not null default 'NORMAL',                           -- NORMAL, URGENTE
  status           text not null default 'PENDENTE',                         -- PENDENTE, APROVADA, COMPRADA, RECUSADA
  solicitante_id   uuid default auth.uid(),
  solicitante_nome text,
  solicitante_perfil text,
  resposta         text,                                                     -- comentário do ADM (ex.: motivo da recusa)
  decidido_em      timestamptz,
  despesa_id       uuid references public.fin_despesas(id) on delete set null, -- gasto lançado para atender o pedido
  created_at       timestamptz not null default now()
);
create index if not exists fin_solicitacoes_status_idx on public.fin_solicitacoes (status);

alter table public.fin_solicitacoes enable row level security;

-- Nome de quem pediu é preenchido pelo banco (não dá para pedir em nome de outro)
create or replace function public.fv_fin_solicitante()
returns trigger language plpgsql security definer set search_path = public as $$
declare nome text; papel text; mail text;
begin
  if tg_op = 'INSERT' then
    new.solicitante_id := auth.uid();
    select p.username, p.role into nome, papel from public.profiles p where p.id = auth.uid();
    select u.email into mail from auth.users u where u.id = auth.uid();
    if papel = 'tecnico' then
      select t.nome into nome from public.tecnicos t
       where lower(trim(t.email)) = lower(trim(mail)) limit 1;
    end if;
    new.solicitante_nome := coalesce(nullif(trim(nome), ''), mail, 'Usuário');
    new.solicitante_perfil := papel;
    if not public.fv_eh_admin() then
      new.status := 'PENDENTE';
      new.despesa_id := null;
      new.resposta := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists fv_fin_solicitante on public.fin_solicitacoes;
create trigger fv_fin_solicitante
  before insert on public.fin_solicitacoes
  for each row execute function public.fv_fin_solicitante();

-- Acesso
alter table public.fin_solicitacoes enable row level security;
drop policy if exists "fin so adm" on public.fin_solicitacoes;
create policy "fin so adm" on public.fin_solicitacoes for all to authenticated
  using (public.fv_eh_admin()) with check (public.fv_eh_admin());

drop policy if exists "solicitacao criar" on public.fin_solicitacoes;
create policy "solicitacao criar" on public.fin_solicitacoes for insert to authenticated
  with check (public.fv_papel() in ('admin', 'funcionario', 'tecnico'));

drop policy if exists "solicitacao ver as minhas" on public.fin_solicitacoes;
create policy "solicitacao ver as minhas" on public.fin_solicitacoes for select to authenticated
  using (solicitante_id = auth.uid());

drop policy if exists "solicitacao cancelar pendente" on public.fin_solicitacoes;
create policy "solicitacao cancelar pendente" on public.fin_solicitacoes for delete to authenticated
  using (solicitante_id = auth.uid() and status = 'PENDENTE');

-- Quem solicita pode escolher da lista de itens (só nome e unidade, sem valores)
drop policy if exists "fin_itens leitura para solicitar" on public.fin_itens;
create policy "fin_itens leitura para solicitar" on public.fin_itens for select to authenticated
  using (public.fv_papel() in ('funcionario', 'tecnico'));
