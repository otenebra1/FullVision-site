// lib/veiculos.js
// Serviços contratados por placa e cálculo do DRE da placa.

// Serviços que podem ser habilitados em cada veículo (guardados em veiculos.servicos como text[])
export const SERVICOS_VEICULO = [
  { key: 'RASTREAMENTO', label: 'Rastreamento' },
  { key: 'MONITORAMENTO', label: 'Monitoramento' },
  { key: 'FULL_ROUTE', label: 'Full Route' },
];

export const servicoLabel = (key) => SERVICOS_VEICULO.find(s => s.key === key)?.label || key;

const num = (n) => Number(n) || 0;
const arredonda = (n) => Math.round(n * 100) / 100;

const parseData = (iso) => (iso ? new Date(String(iso).slice(0, 10) + 'T00:00:00') : null);

// Meses completos de cobrança entre a instalação e a desinstalação (ou hoje)
export function mesesCobrados(v, hoje = new Date()) {
  const ini = parseData(v.data_inst);
  if (!ini) return 0;
  const fim = parseData(v.data_desinst) || hoje;
  if (fim < ini) return 0;
  let meses = (fim.getFullYear() - ini.getFullYear()) * 12 + (fim.getMonth() - ini.getMonth());
  if (fim.getDate() < ini.getDate()) meses -= 1;
  return Math.max(0, meses);
}

/**
 * DRE da placa = valor faturado pela placa − serviços realizados − equipamento e acessórios
 *   faturado    = mensalidade × meses cobrados + valor cobrado do cliente nas OS da placa
 *   serviços    = custo do técnico nas OS da placa
 *   equipamento = custo de aquisição do rastreador instalado + custo_acessorios da placa
 * ordensDaPlaca: linhas de ordens_servico com veiculo_id = v.id
 * rastreador: linha de rastreadores instalada nessa placa (ou null)
 */
export function calcularDrePlaca(v, ordensDaPlaca = [], rastreador = null, hoje = new Date()) {
  const meses = mesesCobrados(v, hoje);
  const mensalidades = num(v.mensalidade) * meses;
  const faturadoOs = ordensDaPlaca.reduce((s, o) => s + num(o.faturamento_cliente), 0);
  const faturado = mensalidades + faturadoOs;
  const servicos = ordensDaPlaca.reduce((s, o) => s + num(o.custo_tecnico), 0);
  const custoRastreador = num(rastreador?.custo_aquisicao);
  const acessorios = num(v.custo_acessorios);
  const equipamento = custoRastreador + acessorios;
  return {
    meses,
    mensalidades: arredonda(mensalidades),
    faturadoOs: arredonda(faturadoOs),
    faturado: arredonda(faturado),
    servicos: arredonda(servicos),
    custoRastreador: arredonda(custoRastreador),
    acessorios: arredonda(acessorios),
    rastreadorSerial: rastreador?.serial || null,
    equipamento: arredonda(equipamento),
    dre: arredonda(faturado - servicos - equipamento),
    qtdOs: ordensDaPlaca.length,
  };
}

// Agrupa as OS por veiculo_id
export function ordensPorVeiculo(ordens) {
  const map = {};
  (ordens || []).forEach(o => {
    if (!o.veiculo_id) return;
    (map[o.veiculo_id] = map[o.veiculo_id] || []).push(o);
  });
  return map;
}

// Rastreador instalado em cada veículo: pelo vínculo veiculo_id ou, se faltar, pelo serial em id_instalado
export function rastreadorPorVeiculo(veiculos, rastreadores) {
  const porId = {};
  const porSerial = {};
  (rastreadores || []).forEach(r => {
    if (r.veiculo_id) porId[r.veiculo_id] = r;
    if (r.serial) porSerial[String(r.serial).trim()] = r;
  });
  const map = {};
  (veiculos || []).forEach(v => {
    map[v.id] = porId[v.id] || (v.id_instalado ? porSerial[String(v.id_instalado).trim()] : null) || null;
  });
  return map;
}
