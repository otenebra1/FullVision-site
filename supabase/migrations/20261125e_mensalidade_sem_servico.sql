-- Correção de 25/11/2026: placa sem nenhum serviço ligado (Rastreamento, Monitoramento, Full Route)
-- não cobra mensalidade. Rode no Supabase: SQL Editor > New query > colar tudo > Run. Pode rodar de novo.
-- Precisa ter rodado antes o 20261125_veiculo_obs_mensalidade_codigo.sql.

-- 1) Regra no banco: sem serviço, mensalidade = 0; com serviço, soma dos preços (cliente > grupo > padrão)
create or replace function public.fv_veiculo_mensalidade_auto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r numeric; m numeric; f numeric;
begin
  if not (coalesce(new.servicos, '{}') && array['RASTREAMENTO', 'MONITORAMENTO', 'FULL_ROUTE']) then
    new.mensalidade := 0;
    return new;
  end if;
  if new.empresa_id is null then return new; end if;
  r := public.fv_valor_mensal(new.empresa_id, 'mensalidade_rastreamento');
  m := public.fv_valor_mensal(new.empresa_id, 'mensalidade_monitoramento');
  f := public.fv_valor_mensal(new.empresa_id, 'mensalidade_full_route');
  if r is null and m is null and f is null then return new; end if;
  new.mensalidade :=
      (case when 'RASTREAMENTO'  = any(new.servicos) then coalesce(r, 0) else 0 end)
    + (case when 'MONITORAMENTO' = any(new.servicos) then coalesce(m, 0) else 0 end)
    + (case when 'FULL_ROUTE'    = any(new.servicos) then coalesce(f, 0) else 0 end);
  return new;
end $$;

drop trigger if exists fv_veiculo_mensalidade_auto on public.veiculos;
create trigger fv_veiculo_mensalidade_auto
  before insert or update of servicos, empresa_id, mensalidade on public.veiculos
  for each row execute function public.fv_veiculo_mensalidade_auto();

-- 2) Acerta as placas que já existem: sem serviço ligado, mensalidade vai para 0
--    (mostra antes quantas são e quais placas)
select placa, mensalidade from public.veiculos
where not (coalesce(servicos, '{}') && array['RASTREAMENTO', 'MONITORAMENTO', 'FULL_ROUTE'])
  and coalesce(mensalidade, 0) <> 0
order by placa;

update public.veiculos
set mensalidade = 0
where not (coalesce(servicos, '{}') && array['RASTREAMENTO', 'MONITORAMENTO', 'FULL_ROUTE'])
  and coalesce(mensalidade, 0) <> 0;
