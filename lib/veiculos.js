// lib/veiculos.js
// Serviços contratados por placa e cálculo do DRE da placa.
import { ehDaCategoria, CAT_LOCALIZADOR } from './osConstants';

// Serviços que podem ser habilitados em cada veículo (guardados em veiculos.servicos como text[])
// coluna: onde fica o valor mensal do serviço em financeiro_config
export const SERVICOS_VEICULO = [
  { key: 'RASTREAMENTO', label: 'Rastreamento', coluna: 'mensalidade_rastreamento' },
  { key: 'MONITORAMENTO', label: 'Monitoramento', coluna: 'mensalidade_monitoramento' },
  { key: 'FULL_ROUTE', label: 'Full Route', coluna: 'mensalidade_full_route' },
];

const temValor = (obj) => Boolean(obj) && SERVICOS_VEICULO.some(s => obj[s.coluna] != null);

// A regra só vale depois que algum valor foi preenchido em Preços (padrão ou do cliente)
export const mensalidadeConfigurada = (cfg, empresa = null, grupo = null) => temValor(cfg) || temValor(empresa) || temValor(grupo);

// Valor mensal de um serviço para um cliente: o do próprio cliente > o do grupo dele > o padrão
export function valorServicoMensal(coluna, cfg, empresa = null, grupo = null) {
  for (const fonte of [empresa, grupo, cfg]) {
    if (fonte && fonte[coluna] != null) return Number(fonte[coluna]) || 0;
  }
  return 0;
}

/**
 * Mensalidade da placa = soma dos valores mensais dos serviços ligados nela,
 * com o preço do cliente da placa (ou do grupo dele, ou o padrão).
 * Retorna null enquanto a regra não está configurada (aí vale o valor digitado à mão).
 * O banco faz a mesma conta num trigger, então o valor gravado é sempre esse.
 */
export function calcularMensalidade(servicos, cfg, empresa = null, grupo = null) {
  // Sem nenhum serviço ligado a placa não paga mensalidade
  if (semServico(servicos)) return 0;
  if (!mensalidadeConfigurada(cfg, empresa, grupo)) return null;
  const total = SERVICOS_VEICULO
    .filter(s => (servicos || []).includes(s.key))
    .reduce((soma, s) => soma + valorServicoMensal(s.coluna, cfg, empresa, grupo), 0);
  return Math.round(total * 100) / 100;
}

// Placa sem Rastreamento, Monitoramento nem Full Route: mensalidade zero (vale para listas, totais e DRE)
export const semServico = (servicos) => !(servicos || []).some(k => SERVICOS_VEICULO.some(s => s.key === k));
export const comMensalidadeEfetiva = (v) => (v && semServico(v.servicos) && Number(v.mensalidade) ? { ...v, mensalidade: 0 } : v);

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
    // Atuadores e sensores também ficam ligados à placa, mas o DRE usa só o rastreador (localizador)
    if (!ehDaCategoria(r, CAT_LOCALIZADOR)) return;
    if (r.veiculo_id) porId[r.veiculo_id] = r;
    if (r.serial) porSerial[String(r.serial).trim()] = r;
  });
  const map = {};
  (veiculos || []).forEach(v => {
    map[v.id] = porId[v.id] || (v.id_instalado ? porSerial[String(v.id_instalado).trim()] : null) || null;
  });
  return map;
}
