// lib/notasFiscais.js
// Emissão de NFS-e para os clientes: regras que valem na tela (/notas-fiscais) e na API (/api/nfse/*).
// Aqui não tem segredo nenhum (o token do emissor fica só no servidor, em lib/focusNfe.js).
import { semServico } from './veiculos';

export const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
const arred = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const STATUS_NOTA = [
  { value: 'PROCESSANDO', label: 'Processando', tom: 'warn', badge: 'bg-amber-500/15 text-amber-300' },
  { value: 'AUTORIZADA', label: 'Emitida', tom: 'ok', badge: 'bg-emerald-500/15 text-emerald-300' },
  { value: 'ERRO', label: 'Com erro', tom: 'bad', badge: 'bg-red-500/15 text-red-300' },
  { value: 'CANCELADA', label: 'Cancelada', tom: 'muted', badge: 'bg-gray-500/20 text-gray-400' },
];
export const statusNota = (v) => STATUS_NOTA.find(s => s.value === v) || { value: v, label: v || '', badge: 'bg-gray-500/20 text-gray-300' };

// Nota que "ocupa" o mês do cliente (não deixa emitir outra igual por engano)
export const notaValida = (n) => n && (n.status === 'PROCESSANDO' || n.status === 'AUTORIZADA');

export const AMBIENTES = [
  { value: 'homologacao', label: 'Homologação (teste, sem valor fiscal)' },
  { value: 'producao', label: 'Produção (nota de verdade)' },
];

export const PADROES = [
  { value: 'nacional', label: 'NFS-e Nacional (Emissor Nacional / gov.br)' },
  { value: 'municipal', label: 'Sistema da prefeitura (padrão municipal)' },
];

// Simples Nacional (campo da NFS-e Nacional)
export const OPCOES_SIMPLES = [
  { value: 1, label: 'Não optante (Lucro Presumido / Real)' },
  { value: 2, label: 'MEI' },
  { value: 3, label: 'ME/EPP optante do Simples Nacional' },
];

export const REGIMES_ESPECIAIS = [
  { value: 0, label: 'Nenhum' },
  { value: 1, label: 'Ato cooperado' },
  { value: 2, label: 'Estimativa' },
  { value: 3, label: 'Microempresa municipal' },
  { value: 4, label: 'Notário ou registrador' },
  { value: 5, label: 'Profissional autônomo' },
  { value: 6, label: 'Sociedade de profissionais' },
];

export const MODELO_DISCRIMINACAO_PADRAO =
  'Serviço de rastreamento e monitoramento veicular referente a {competencia}.\n' +
  '{qtd_placas} placa(s): {placas}.';

export const CONFIG_PADRAO = {
  id: 1,
  ambiente: 'homologacao',
  padrao: 'nacional',
  cnpj_prestador: '',
  inscricao_municipal: '',
  razao_social: '',
  codigo_municipio: '',
  codigo_opcao_simples_nacional: 3,
  regime_especial_tributacao: 0,
  codigo_tributacao_nacional_iss: '',
  codigo_tributacao_municipal_iss: '',
  item_lista_servico: '',
  codigo_cnae: '',
  codigo_nbs: '',
  aliquota_iss: null,
  iss_retido: false,
  natureza_operacao: 1,
  percentual_tributos: null,
  modelo_discriminacao: MODELO_DISCRIMINACAO_PADRAO,
  enviar_email_tomador: true,
  campos_extras: null,
};

// ---------- Datas da competência (mês) ----------
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
// "2026-11" ou "2026-11-01" → "2026-11-01"
export const competenciaIso = (mes) => `${String(mes).slice(0, 7)}-01`;
export const competenciaTexto = (mes) => {
  const [a, m] = String(mes).slice(0, 7).split('-');
  return `${MESES[Number(m) - 1]} de ${a}`;
};
export const competenciaCurta = (mes) => {
  const [a, m] = String(mes).slice(0, 7).split('-');
  return `${m}/${a}`;
};
export const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const fimDoMes = (mes) => {
  const [a, m] = String(mes).slice(0, 7).split('-').map(Number);
  const d = new Date(a, m, 0);
  return `${a}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Placas que entram na nota do mês:
 * mensalidade maior que zero, com algum serviço ligado, instalada até o fim do mês e
 * ativa (ou desinstalada só a partir do 1º dia do mês).
 */
export function placasDoMes(veiculos, empresaId, mes) {
  const ini = competenciaIso(mes);
  const fim = fimDoMes(mes);
  return (veiculos || []).filter(v => {
    if (String(v.empresa_id) !== String(empresaId)) return false;
    if (semServico(v.servicos)) return false;
    if (!(Number(v.mensalidade) > 0)) return false;
    if (v.data_inst && String(v.data_inst).slice(0, 10) > fim) return false;
    if (v.status === 'Ativo') return true;
    return Boolean(v.data_desinst) && String(v.data_desinst).slice(0, 10) >= ini;
  }).sort((a, b) => String(a.placa).localeCompare(String(b.placa)));
}

export function preencherModelo(modelo, { mes, placas, valor, empresa }) {
  const lista = (placas || []).map(p => p.placa).filter(Boolean);
  const subs = {
    '{competencia}': competenciaTexto(mes),
    '{mes}': competenciaCurta(mes),
    '{qtd_placas}': String(lista.length),
    '{placas}': lista.join(', '),
    '{valor}': Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    '{cliente}': empresa?.razao_social || empresa?.nome || '',
  };
  let t = String(modelo || MODELO_DISCRIMINACAO_PADRAO);
  Object.entries(subs).forEach(([k, v]) => { t = t.split(k).join(v); });
  return t.trim();
}

// O que falta no cadastro do cliente para a prefeitura aceitar a nota
export function problemasTomador(e) {
  const p = [];
  if (!e) return ['Cliente não encontrado'];
  const doc = soDigitos(e.cnpj);
  if (doc.length !== 14 && doc.length !== 11) p.push('sem CNPJ');
  if (!(e.razao_social || e.nome)) p.push('sem razão social');
  if (soDigitos(e.cep).length !== 8) p.push('sem CEP');
  if (!e.logradouro) p.push('sem endereço');
  if (!e.cidade || !e.uf) p.push('sem cidade/UF');
  return p;
}

// O que falta na configuração fiscal
export function problemasConfig(c) {
  const p = [];
  if (!c) return ['Configuração fiscal não salva'];
  if (soDigitos(c.cnpj_prestador).length !== 14) p.push('CNPJ da Full Vision');
  if (soDigitos(c.codigo_municipio).length !== 7) p.push('código IBGE do município (7 dígitos)');
  if (c.padrao === 'nacional') {
    if (soDigitos(c.codigo_tributacao_nacional_iss).length !== 6) p.push('código de tributação nacional (6 dígitos)');
  } else {
    if (!c.inscricao_municipal) p.push('inscrição municipal');
    if (!c.item_lista_servico) p.push('item da lista de serviço (LC 116)');
    if (c.aliquota_iss == null || c.aliquota_iss === '') p.push('alíquota do ISS');
  }
  return p;
}

// Linha da tela "Emitir": um cliente com as placas e o valor do mês
export function montarLinhaMes({ empresa, veiculos, mes, config, notas }) {
  const placas = placasDoMes(veiculos, empresa.id, mes);
  const valor = arred(placas.reduce((s, v) => s + (Number(v.mensalidade) || 0), 0));
  const competencia = competenciaIso(mes);
  const ambiente = config?.ambiente || 'homologacao';
  const doMes = (notas || []).filter(n => String(n.empresa_id) === String(empresa.id) && String(n.competencia).slice(0, 10) === competencia && n.ambiente === ambiente);
  return {
    empresa,
    placas,
    valor,
    discriminacao: preencherModelo(config?.modelo_discriminacao, { mes, placas, valor, empresa }),
    problemas: problemasTomador(empresa),
    nota: doMes.find(notaValida) || null,
    notaErro: doMes.find(n => n.status === 'ERRO') || null,
  };
}

// Foto do tomador guardada junto com a nota (o cadastro pode mudar depois)
export function fotoTomador(e) {
  return {
    cnpj: soDigitos(e.cnpj),
    razao_social: e.razao_social || e.nome || '',
    nome: e.nome || '',
    cep: soDigitos(e.cep),
    logradouro: e.logradouro || '',
    numero: e.numero || 'S/N',
    complemento: e.complemento || '',
    bairro: e.bairro || '',
    cidade: e.cidade || '',
    uf: (e.uf || '').toUpperCase(),
    email: (e.contato_financeiro_email || e.contato_comercial_email || '').trim(),
    telefone: soDigitos(e.contato_financeiro_telefone || e.contato_comercial_telefone || ''),
  };
}
