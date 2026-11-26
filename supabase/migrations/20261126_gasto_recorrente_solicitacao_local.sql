-- =====================================================================
-- 1) Solicitação de compra: local de entrega e centro de custo
-- 2) Gasto recorrente (fixo ou variável) com prazo opcional
--    O gasto recorrente "nasce" todo mês copiando o do mês anterior.
--    Variável nasce marcado como "conferir" até o operador abrir e salvar.
-- Rode DEPOIS do 20261125b_financeiro.sql e do 20261125d_solicitacoes_compra.sql.
-- Pode rodar de novo sem problema.
-- =====================================================================

-- ---------- 1) Solicitação de compra ----------
alter table public.fin_solicitacoes add column if not exists local_entrega text;
alter table public.fin_solicitacoes add column if not exists centro_custo  text;

-- ---------- 2) Gasto recorrente ----------
alter table public.fin_despesas add column if not exists recorrencia      text not null default 'PONTUAL'; -- PONTUAL, RECORRENTE
alter table public.fin_despesas add column if not exists valor_tipo       text;                            -- FIXO, VARIAVEL (só recorrente)
alter table public.fin_despesas add column if not exists recorrencia_ate  date;                            -- prazo: repete até este mês (vazio = sem fim)
alter table public.fin_despesas add column if not exists recorrencia_serie uuid;                           -- liga os lançamentos da mesma série
alter table public.fin_despesas add column if not exists competencia      date;                            -- 1º dia do mês do lançamento
alter table public.fin_despesas add column if not exists conferido        boolean not null default true;  -- false = variável gerado, falta conferir

-- Um lançamento por mês em cada série
create unique index if not exists fin_despesas_serie_mes_uk
  on public.fin_despesas (recorrencia_serie, competencia) where recorrencia_serie is not null;

-- Ao salvar: mês de competência, série própria para o 1º lançamento recorrente
create or replace function public.fv_fin_despesa_recorrencia()
returns trigger language plpgsql as $$
begin
  new.competencia := date_trunc('month', new.data)::date;
  if new.recorrencia = 'RECORRENTE' then
    if new.valor_tipo is null then new.valor_tipo := 'FIXO'; end if;
    if new.recorrencia_serie is null then new.recorrencia_serie := new.id; end if;
  else
    new.valor_tipo := null;
    new.recorrencia_ate := null;
    new.conferido := true;
  end if;
  return new;
end $$;

drop trigger if exists fv_fin_despesa_recorrencia on public.fin_despesas;
create trigger fv_fin_despesa_recorrencia
  before insert or update of data, recorrencia, valor_tipo, recorrencia_ate, recorrencia_serie on public.fin_despesas
  for each row execute function public.fv_fin_despesa_recorrencia();

-- Preenche a competência dos gastos antigos
update public.fin_despesas set competencia = date_trunc('month', data)::date where competencia is null;

-- Gera os lançamentos que faltam até o mês atual (o painel chama ao abrir o /financeiro).
-- Cada série parte do último lançamento dela: se ele virou Pontual, a série para.
create or replace function public.fv_fin_gerar_recorrentes()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  mes date;
  limite date;
  dia int;
  nova uuid;
  qtd int := 0;
  mes_atual date := date_trunc('month', current_date)::date;
  passos int;
  nova_data date;
begin
  if not public.fv_eh_admin() then return 0; end if;

  for r in
    select distinct on (recorrencia_serie) *
      from public.fin_despesas
     where recorrencia_serie is not null
     order by recorrencia_serie, competencia desc, created_at desc
  loop
    continue when r.recorrencia <> 'RECORRENTE';
    limite := case when r.recorrencia_ate is null then mes_atual
                   else least(mes_atual, date_trunc('month', r.recorrencia_ate)::date) end;
    mes := (r.competencia + interval '1 month')::date;
    dia := extract(day from r.data)::int;

    while mes <= limite loop
      passos := (extract(year from mes) - extract(year from r.competencia))::int * 12
              + (extract(month from mes) - extract(month from r.competencia))::int;
      nova_data := least(mes + (dia - 1), (mes + interval '1 month' - interval '1 day')::date);
      insert into public.fin_despesas (
        data, tipo_documento, fornecedor_id, viagem_id, descricao, forma_pagamento,
        status, vencimento, data_pagamento, anexos, observacao,
        recorrencia, valor_tipo, recorrencia_ate, recorrencia_serie, conferido
      ) values (
        nova_data,
        r.tipo_documento, r.fornecedor_id, null, r.descricao, r.forma_pagamento,
        'A_PAGAR',
        -- vencimento: o do mês anterior empurrado 1 mês; sem vencimento, vale a data do lançamento
        coalesce((r.vencimento + make_interval(months => passos))::date, nova_data),
        null, '[]'::jsonb, r.observacao,
        'RECORRENTE', r.valor_tipo, r.recorrencia_ate, r.recorrencia_serie,
        coalesce(r.valor_tipo, 'FIXO') <> 'VARIAVEL'
      )
      on conflict (recorrencia_serie, competencia) where recorrencia_serie is not null do nothing
      returning id into nova;

      if nova is not null then
        -- mesmas linhas (valor do mês anterior); o banco recalcula o total
        insert into public.fin_despesa_itens (despesa_id, item_id, categoria_id, descricao, codigo_fornecedor, quantidade, unidade, valor_unitario, valor_total, ordem)
        select nova, item_id, categoria_id, descricao, codigo_fornecedor, quantidade, unidade, valor_unitario, valor_total, ordem
          from public.fin_despesa_itens where despesa_id = r.id;
        qtd := qtd + 1;
      end if;
      nova := null;
      mes := (mes + interval '1 month')::date;
    end loop;
  end loop;

  return qtd;
end $$;

grant execute on function public.fv_fin_gerar_recorrentes() to authenticated;
