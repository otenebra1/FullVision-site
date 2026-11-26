// lib/cobranca.js
// Contas a receber: regras que valem na tela (aba "A receber" do /financeiro) e na API (/api/cobranca/*).
// Sem segredo nenhum aqui (o token do Asaas fica só no servidor, em lib/asaas.js).

export const STATUS_RECEB = [
  { value: 'ABERTO', label: 'Em aberto', badge: 'bg-amber-500/15 text-amber-300' },
  { value: 'VENCIDO', label: 'Vencido', badge: 'bg-red-500/15 text-red-300' },
  { value: 'PAGO', label: 'Pago', badge: 'bg-emerald-500/15 text-emerald-300' },
  { value: 'CANCELADO', label: 'Cancelado', badge: 'bg-gray-500/20 text-gray-400' },
];

export const FORMAS_RECEB = [
  { value: 'BOLETO', label: 'Boleto (com PIX junto)' },
  { value: 'PIX', label: 'Só PIX' },
  { value: 'UNDEFINED', label: 'Cliente escolhe (boleto, PIX ou cartão)' },
  { value: 'TRANSFERENCIA', label: 'Transferência / depósito' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'OUTRO', label: 'Outro' },
];
export const FORMAS_ASAAS = ['BOLETO', 'PIX', 'UNDEFINED'];

export const TIPOS_RECEB = [
  { value: 'MENSALIDADE', label: 'Mensalidade' },
  { value: 'INSTALACAO', label: 'Instalação' },
  { value: 'AVULSA', label: 'Avulsa' },
  { value: 'OUTRO', label: 'Outro' },
];

export const AMBIENTES_ASAAS = [
  { value: 'sandbox', label: 'Sandbox (teste, sem dinheiro de verdade)' },
  { value: 'producao', label: 'Produção (cobrança de verdade)' },
];

export const CONFIG_COBRANCA_PADRAO = {
  id: 1, ambiente: 'sandbox', forma_padrao: 'BOLETO', dia_vencimento: 10,
  multa_percentual: 2, juros_mensal: 1, desconto_valor: 0, avisar_cliente: true,
};

const pad = (n) => String(n).padStart(2, '0');
export const hojeIsoLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Situação na tela: ABERTO com vencimento passado vira VENCIDO
export const situacao = (r) => (r.status === 'ABERTO' && r.vencimento && String(r.vencimento).slice(0, 10) < hojeIsoLocal() ? 'VENCIDO' : r.status);
export const infoSituacao = (v) => STATUS_RECEB.find(s => s.value === v) || { value: v, label: v || '', badge: 'bg-gray-500/20 text-gray-300' };

// Dia de vencimento no mês (dia 31 em fevereiro vira o último dia)
const diaNoMes = (ano, mes1a12, dia) => {
  const ultimo = new Date(ano, mes1a12, 0).getDate();
  return `${ano}-${pad(mes1a12)}-${pad(Math.min(dia, ultimo))}`;
};

/**
 * Vencimento sugerido: o próximo "dia do boleto" do cliente que esteja pelo menos 3 dias à frente.
 * (O ADM pode mudar antes de gerar.)
 */
export function vencimentoSugerido(diaCliente, diaPadrao = 10, base = new Date()) {
  const dia = Number(diaCliente) || Number(diaPadrao) || 10;
  const minimo = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 3);
  const minIso = `${minimo.getFullYear()}-${pad(minimo.getMonth() + 1)}-${pad(minimo.getDate())}`;
  let ano = base.getFullYear();
  let mes = base.getMonth() + 1;
  for (let i = 0; i < 3; i += 1) {
    const iso = diaNoMes(ano, mes, dia);
    if (iso >= minIso) return iso;
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return diaNoMes(ano, mes, dia);
}

// Status do Asaas → nosso status
export function statusDoAsaas(st) {
  if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(st)) return 'PAGO';
  if (['REFUNDED', 'DELETED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED'].includes(st)) return 'CANCELADO';
  return 'ABERTO'; // PENDING, OVERDUE, AWAITING_RISK_ANALYSIS...
}

export const ROTULO_ASAAS = {
  PENDING: 'Aguardando pagamento',
  RECEIVED: 'Pago',
  CONFIRMED: 'Pago (confirmado)',
  OVERDUE: 'Vencido',
  REFUNDED: 'Estornado',
  RECEIVED_IN_CASH: 'Pago em dinheiro',
  DELETED: 'Removido no Asaas',
  AWAITING_RISK_ANALYSIS: 'Em análise',
};

// O que falta no cadastro do cliente para o Asaas aceitar
export function problemasCliente(e) {
  const p = [];
  const doc = String(e?.cnpj || '').replace(/\D/g, '');
  if (doc.length !== 14 && doc.length !== 11) p.push('CNPJ/CPF');
  if (!(e?.razao_social || e?.nome)) p.push('nome');
  return p;
}
