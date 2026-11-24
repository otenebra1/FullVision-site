-- Avaria e Extravio valem para qualquer equipamento: uma opção por equipamento (cada uma pode ter preço).
-- Rode no SQL Editor; pode rodar de novo.
insert into public.servicos_catalogo (nome, tipo, ativo, ordem)
select v.tipo || ' ' || e.nome, 'servico', true, v.base + e.ordem
from (values ('AVARIA', 100), ('EXTRAVIO', 120)) as v(tipo, base)
cross join (values
  ('LOCALIZADOR', 1), ('BLOQUEIO', 2), ('IMOBILIZADOR SEM FIO', 3), ('ANTIBASCULANTE', 4), ('IDENTIFICADOR DE MOTORISTA', 5),
  ('SENSOR DE PORTA', 6), ('SENSOR DE TEMPERATURA', 7), ('SENSOR INTERNO CABINE', 8), ('SENSOR EXTERNO CABINE', 9), ('DASHCAM', 10)
) as e(nome, ordem)
where not exists (select 1 from public.servicos_catalogo c where upper(c.nome) = v.tipo || ' ' || e.nome);

-- Socorro 24 horas continua
insert into public.servicos_catalogo (nome, tipo, ativo, ordem)
select 'SOCORRO 24 HORAS', 'servico', true, 90
where not exists (select 1 from public.servicos_catalogo c where upper(c.nome) = 'SOCORRO 24 HORAS');

-- O item genérico "AVARIA" foi substituído pelas opções por equipamento
update public.servicos_catalogo set ativo = false where upper(nome) = 'AVARIA';
