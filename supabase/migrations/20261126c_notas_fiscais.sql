-- =====================================================================
-- Notas fiscais de serviço (NFS-e) para os clientes — tela /notas-fiscais (só ADM)
-- Rode uma vez no Supabase: SQL Editor > New query > colar tudo > Run. Pode rodar de novo.
-- Precisa das funções fv_eh_admin() (SQL 20261124e) e da tabela empresas.
-- =====================================================================

-- 1) Configuração fiscal (uma linha só, id = 1) --------------------------
create table if not exists public.nf_config (
  id                              int primary key default 1 check (id = 1),
  ambiente                        text not null default 'homologacao' check (ambiente in ('homologacao', 'producao')),
  padrao                          text not null default 'nacional' check (padrao in ('nacional', 'municipal')),
  cnpj_prestador                  text,           -- CNPJ da Full Vision (só números)
  razao_social                    text,
  inscricao_municipal             text,
  codigo_municipio                text,           -- código IBGE (7 dígitos) da cidade da Full Vision
  codigo_opcao_simples_nacional   smallint not null default 3,  -- 1 não optante, 2 MEI, 3 ME/EPP do Simples
  regime_especial_tributacao      smallint not null default 0,
  codigo_tributacao_nacional_iss  text,           -- NFS-e Nacional: 6 dígitos (ex.: 010701)
  codigo_tributacao_municipal_iss text,           -- se a prefeitura pedir
  item_lista_servico              text,           -- padrão municipal: item da LC 116 (ex.: 01.07)
  codigo_cnae                     text,
  codigo_nbs                      text,
  aliquota_iss                    numeric(6,2),   -- em % (ex.: 2.00)
  iss_retido                      boolean not null default false,
  natureza_operacao               smallint default 1,
  percentual_tributos             numeric(6,2),   -- opcional: % aproximado de tributos para a nota
  modelo_discriminacao            text,
  enviar_email_tomador            boolean not null default true,
  campos_extras                   jsonb,          -- campos a mais que a prefeitura exigir (o contador/Focus informa)
  updated_at                      timestamptz not null default now()
);
insert into public.nf_config (id) values (1) on conflict (id) do nothing;

alter table public.nf_config enable row level security;
drop policy if exists "nf_config adm" on public.nf_config;
create policy "nf_config adm" on public.nf_config
  for all to authenticated using (public.fv_eh_admin()) with check (public.fv_eh_admin());

-- 2) Notas emitidas (histórico) ---------------------------------------
do $$
declare tipo_emp text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_emp
  from pg_attribute a where a.attrelid = 'public.empresas'::regclass and a.attname = 'id';
  execute format($f$
    create table if not exists public.nf_notas (
      id                         uuid primary key default gen_random_uuid(),
      empresa_id                 %s references public.empresas(id) on delete restrict,
      competencia                date not null,           -- 1º dia do mês cobrado
      referencia                 text not null unique,    -- "ref" da nota no emissor
      ambiente                   text not null,           -- homologacao / producao
      padrao                     text not null,           -- nacional / municipal
      status                     text not null default 'PROCESSANDO', -- PROCESSANDO, AUTORIZADA, ERRO, CANCELADA
      valor                      numeric(12,2) not null,
      aliquota_iss               numeric(6,2),
      discriminacao              text,
      placas                     jsonb not null default '[]'::jsonb,  -- placas cobradas (placa, mensalidade, serviços)
      tomador                    jsonb,                   -- dados do cliente no dia da emissão
      avulsa                     boolean not null default false,
      numero                     text,
      codigo_verificacao         text,
      chave                      text,
      data_emissao               timestamptz,
      url_pdf                    text,
      url_xml                    text,
      url_prefeitura             text,
      pdf_path                   text,                    -- cópia no Storage (bucket notas-fiscais)
      xml_path                   text,
      mensagem                   text,                    -- erro ou aviso do emissor/prefeitura
      enviado                    jsonb,                   -- o que foi mandado ao emissor (para conferir erros)
      resposta                   jsonb,                   -- última resposta do emissor
      cancelada_em               timestamptz,
      justificativa_cancelamento text,
      criado_por                 uuid,
      created_at                 timestamptz not null default now(),
      updated_at                 timestamptz not null default now()
    )$f$, tipo_emp);
end $$;

create index if not exists nf_notas_competencia_idx on public.nf_notas (competencia desc);
create index if not exists nf_notas_empresa_idx on public.nf_notas (empresa_id);
create index if not exists nf_notas_status_idx on public.nf_notas (status);
-- Trava: uma nota de mensalidade válida por cliente, por mês e por ambiente (avulsas ficam livres)
create unique index if not exists nf_notas_uma_por_mes
  on public.nf_notas (empresa_id, competencia, ambiente)
  where status in ('PROCESSANDO', 'AUTORIZADA') and not avulsa;

alter table public.nf_notas enable row level security;
drop policy if exists "nf_notas adm" on public.nf_notas;
create policy "nf_notas adm" on public.nf_notas
  for all to authenticated using (public.fv_eh_admin()) with check (public.fv_eh_admin());

-- 3) Storage: cópia do PDF e do XML (privado; o site gera link temporário) ---
insert into storage.buckets (id, name, public)
values ('notas-fiscais', 'notas-fiscais', false)
on conflict (id) do nothing;

drop policy if exists "notas-fiscais adm" on storage.objects;
create policy "notas-fiscais adm" on storage.objects
  for all to authenticated
  using (bucket_id = 'notas-fiscais' and public.fv_eh_admin())
  with check (bucket_id = 'notas-fiscais' and public.fv_eh_admin());
