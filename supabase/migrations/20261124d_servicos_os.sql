-- Serviços da OS (regras do zeca): garante que todas as opções existem no catálogo,
-- para poderem ter preço de técnico e de cliente. Rode no SQL Editor; pode rodar de novo.
insert into public.servicos_catalogo (nome, tipo, ativo, ordem)
select v.nome, 'servico', true, v.ordem
from (values
  ('INSTALAÇÃO LOCALIZADOR', 10), ('INSTALAÇÃO BLOQUEIO', 11), ('INSTALAÇÃO IMOBILIZADOR SEM FIO', 12),
  ('INSTALAÇÃO IDENTIFICADOR DE MOTORISTA', 13), ('INSTALAÇÃO DASHCAM', 14), ('INSTALAÇÃO SENSOR DE PORTA', 15),
  ('INSTALAÇÃO SENSOR DE TEMPERATURA', 16), ('INSTALAÇÃO SENSOR TOMADA DE FORÇA ANALÓGICO', 17),
  ('INSTALAÇÃO SENSOR TOMADA DE FORÇA ELETRÔNICO', 18), ('INSTALAÇÃO SENSOR INTERNO CABINE', 19),
  ('INSTALAÇÃO SENSOR EXTERNO CABINE', 20), ('INSTALAÇÃO ANTIBASCULANTE', 21), ('INSTALAÇÃO REDE CAN', 22),
  ('RETIRADA LOCALIZADOR', 30), ('RETIRADA BLOQUEIO', 31), ('RETIRADA IMOBILIZADOR SEM FIO', 32),
  ('RETIRADA ANTIBASCULANTE', 33), ('RETIRADA IDENTIFICADOR DE MOTORISTA', 34), ('RETIRADA SENSOR DE PORTA', 35),
  ('RETIRADA SENSOR DE TEMPERATURA', 36), ('RETIRADA SENSOR INTERNO CABINE', 37), ('RETIRADA SENSOR EXTERNO CABINE', 38),
  ('RETIRADA DASHCAM', 39),
  ('MANUTENÇÃO', 50), ('TROCA EQUIPAMENTO', 60), ('UPGRADE LOCALIZADOR', 61),
  ('VISITA IMPRODUTIVA', 70), ('AVARIA', 80), ('EXTRAVIO LOCALIZADOR', 81), ('VISITA TÉCNICA', 82), ('TREINAMENTO', 83)
) as v(nome, ordem)
where not exists (select 1 from public.servicos_catalogo c where upper(c.nome) = v.nome);
