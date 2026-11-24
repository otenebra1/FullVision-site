-- Upgrades do painel (24/11/2026)
-- Rode uma vez no Supabase: Dashboard > SQL Editor > New query > colar e Run.
-- É seguro rodar de novo (usa IF NOT EXISTS).

-- Veículo: foto da placa, serviços habilitados e custo de acessórios (entra no DRE)
alter table public.veiculos
  add column if not exists foto_placa_url   text,
  add column if not exists servicos         text[] not null default '{}',
  add column if not exists custo_acessorios numeric(12,2);

comment on column public.veiculos.servicos is 'Serviços habilitados: RASTREAMENTO, MONITORAMENTO, FULL_ROUTE';
comment on column public.veiculos.custo_acessorios is 'Custo dos acessórios instalados na placa (DRE = faturado - serviços - rastreador - acessórios)';

-- Cliente: deadline (fim) do contrato, mostrado no Resumo por cliente
alter table public.empresas
  add column if not exists contrato_fim date;

-- Bucket próprio para as fotos do cadastro de veículos (separado das fotos de OS)
insert into storage.buckets (id, name, public)
values ('veiculos-fotos', 'veiculos-fotos', true)
on conflict (id) do nothing;

-- Leitura pública (as fotos aparecem no painel pela URL pública)
drop policy if exists "veiculos-fotos leitura" on storage.objects;
create policy "veiculos-fotos leitura" on storage.objects
  for select using (bucket_id = 'veiculos-fotos');

-- Só admin envia, troca ou apaga foto
drop policy if exists "veiculos-fotos admin escreve" on storage.objects;
create policy "veiculos-fotos admin escreve" on storage.objects
  for all to authenticated
  using (bucket_id = 'veiculos-fotos' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (bucket_id = 'veiculos-fotos' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
