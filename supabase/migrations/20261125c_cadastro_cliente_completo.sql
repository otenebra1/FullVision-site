-- Cadastro completo do cliente (25/11/2026)
-- Rode uma vez no Supabase: SQL Editor > New query > colar tudo > Run. Pode rodar de novo.
-- Só acrescenta colunas na tabela empresas, que já tem RLS e as regras de acesso
-- (ADM e FUNCIONARIO leem e gravam; TÉCNICO fica de fora).

alter table public.empresas
  add column if not exists cnpj                         text,
  add column if not exists razao_social                 text,
  -- Endereço
  add column if not exists cep                          text,
  add column if not exists logradouro                   text,
  add column if not exists numero                       text,
  add column if not exists complemento                  text,
  add column if not exists bairro                       text,
  add column if not exists cidade                       text,
  add column if not exists uf                           text,
  -- Contatos
  add column if not exists responsavel_comercial        text,
  add column if not exists contato_comercial_telefone   text,
  add column if not exists contato_comercial_email      text,
  add column if not exists contato_financeiro_nome      text,
  add column if not exists contato_financeiro_telefone  text,
  add column if not exists contato_financeiro_email     text,
  -- Contrato (o fim/deadline já existe em contrato_fim)
  add column if not exists contrato_inicio              date,
  add column if not exists contrato_duracao_meses       integer,
  add column if not exists dia_vencimento_boleto        smallint;

-- Regras simples de validação (criadas só se ainda não existirem)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'empresas_dia_vencimento_boleto_chk') then
    alter table public.empresas add constraint empresas_dia_vencimento_boleto_chk
      check (dia_vencimento_boleto is null or dia_vencimento_boleto between 1 and 31);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'empresas_contrato_duracao_chk') then
    alter table public.empresas add constraint empresas_contrato_duracao_chk
      check (contrato_duracao_meses is null or contrato_duracao_meses > 0);
  end if;
end $$;

comment on column public.empresas.cnpj is 'CNPJ só com números (14 dígitos)';
comment on column public.empresas.dia_vencimento_boleto is 'Dia do mês em que o boleto vence (1 a 31)';
comment on column public.empresas.contrato_duracao_meses is 'Duração do contrato em meses; o fim fica em contrato_fim';

-- Busca rápida por CNPJ
create index if not exists empresas_cnpj_idx on public.empresas (cnpj);
