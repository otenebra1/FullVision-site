// lib/financeiro.js
// Constantes e funções do painel financeiro (/financeiro)

export const TIPOS_DOCUMENTO = [
  { value: 'NFE', label: 'NF-e (produto)' },
  { value: 'NFSE', label: 'NFS-e (serviço)' },
  { value: 'NF', label: 'Nota fiscal (outra)' },
  { value: 'ROMANEIO', label: 'Romaneio' },
  { value: 'CUPOM', label: 'Cupom fiscal' },
  { value: 'RECIBO', label: 'Recibo' },
  { value: 'BOLETO', label: 'Boleto / fatura' },
  { value: 'SEM_DOC', label: 'Sem documento' },
];

export const FORMAS_PAGAMENTO = [
  { value: 'PIX', label: 'PIX' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de crédito' },
  { value: 'CARTAO_DEBITO', label: 'Cartão de débito' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
];

export const STATUS_PAGAMENTO = [
  { value: 'PAGO', label: 'Pago' },
  { value: 'A_PAGAR', label: 'A pagar' },
];

export const GRUPOS_CATEGORIA = ['Viagens', 'Equipamentos', 'Materiais', 'Operacional', 'Administrativo', 'Ajustes', 'Outros'];

export const UNIDADES = ['UN', 'PCT', 'CX', 'M', 'KG', 'L', 'PAR', 'KIT', 'DIA', 'SERV'];

export const rotulo = (lista, v) => lista.find(o => o.value === v)?.label || v || '';

export const reais = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const reaisCurto = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const numBR = (n, casas = 2) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas });

// "12,50" ou "12.50" → 12.5
export const lerNumero = (s) => {
  if (typeof s === 'number') return s;
  const t = String(s ?? '').trim();
  if (!t) return 0;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : 0;
};

export const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const dataBR = (iso) => (iso ? new Date(String(iso).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : '');

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const mesRotulo = (yyyymm) => {
  const [a, m] = yyyymm.split('-');
  return `${MESES_CURTOS[Number(m) - 1]}/${a.slice(2)}`;
};

// Atalhos de período
export function periodoPreset(chave) {
  const d = new Date();
  const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const ano = d.getFullYear(); const mes = d.getMonth();
  switch (chave) {
    case 'mes': return { from: iso(new Date(ano, mes, 1)), to: iso(new Date(ano, mes + 1, 0)) };
    case 'mes_passado': return { from: iso(new Date(ano, mes - 1, 1)), to: iso(new Date(ano, mes, 0)) };
    case '3m': return { from: iso(new Date(ano, mes - 2, 1)), to: iso(new Date(ano, mes + 1, 0)) };
    case 'ano': return { from: `${ano}-01-01`, to: `${ano}-12-31` };
    default: return { from: '', to: '' };
  }
}

// Despesa "vencida": a pagar com vencimento antes de hoje
export const estaVencida = (d) => d.status === 'A_PAGAR' && d.vencimento && d.vencimento < hojeIso();

// Exporta linhas para CSV (abre no Excel com acentos e ; como separador)
export function baixarCsv(nomeArquivo, cabecalho, linhas) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const conteudo = [cabecalho, ...linhas].map(l => l.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeArquivo;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const BUCKET_FINANCEIRO = 'financeiro';

// Etapas da solicitação de compra (fluxo: ADM aprova → compras orça → ADM escolhe → compras compra)
export const STATUS_SOLICITACAO = [
  { value: 'PENDENTE', label: 'Aguardando aprovação', tom: 'warn', badge: 'bg-amber-500/15 text-amber-300' },
  { value: 'APROVADA', label: 'Em orçamento', tom: 'info', badge: 'bg-blue-500/15 text-blue-300' },
  { value: 'ORCADA', label: 'Orçamentos para aprovar', tom: 'warn', badge: 'bg-amber-500/15 text-amber-300' },
  { value: 'COMPRA_APROVADA', label: 'Compra aprovada', tom: 'info', badge: 'bg-cyan-500/15 text-cyan-300' },
  { value: 'EM_COMPRA', label: 'Em processo de compra', tom: 'info', badge: 'bg-indigo-500/15 text-indigo-300' },
  { value: 'COMPRADA', label: 'Compra realizada', tom: 'ok', badge: 'bg-emerald-500/15 text-emerald-300' },
  { value: 'ENTREGUE', label: 'Entregue', tom: 'ok', badge: 'bg-emerald-500/15 text-emerald-300' },
  { value: 'FINALIZADA', label: 'Finalizada', tom: 'muted', badge: 'bg-gray-500/20 text-gray-300' },
  { value: 'RECUSADA', label: 'Recusada', tom: 'bad', badge: 'bg-red-500/15 text-red-300' },
];
export const statusInfo = (v) => STATUS_SOLICITACAO.find(s => s.value === v) || { value: v, label: v || '', tom: 'muted', badge: 'bg-gray-500/20 text-gray-300' };
// Etapas que a equipe de compras vai avançando depois que o ADM aprova a compra
export const ETAPAS_COMPRA = ['COMPRA_APROVADA', 'EM_COMPRA', 'COMPRADA', 'ENTREGUE', 'FINALIZADA'];
export const proximaEtapaCompra = (status) => {
  const i = ETAPAS_COMPRA.indexOf(status);
  return i >= 0 && i < ETAPAS_COMPRA.length - 1 ? ETAPAS_COMPRA[i + 1] : null;
};
export const ROTULO_BOTAO_ETAPA = {
  EM_COMPRA: 'Iniciar compra',
  COMPRADA: 'Compra realizada',
  ENTREGUE: 'Marcar como entregue',
  FINALIZADA: 'Finalizar',
};
// Ainda em andamento (não finalizada nem recusada)
export const solicitacaoAberta = (status) => status !== 'FINALIZADA' && status !== 'RECUSADA';
// Onde a bola está: quem precisa agir agora
export const quemAge = (status) => (
  status === 'PENDENTE' || status === 'ORCADA' ? 'ADM'
    : status === 'APROVADA' || ['COMPRA_APROVADA', 'EM_COMPRA', 'COMPRADA', 'ENTREGUE'].includes(status) ? 'Compras' : null
);

// Sugestões de centro de custo na solicitação de compra (a pessoa também pode escrever outro)
export const CENTROS_CUSTO = ['Operacional', 'Instalação / Manutenção', 'Administrativo', 'Comercial', 'Frota própria', 'Estoque'];

// Recorrência do gasto
export const TIPOS_RECORRENCIA = [
  { value: 'PONTUAL', label: 'Pontual' },
  { value: 'RECORRENTE', label: 'Recorrente' },
];
export const TIPOS_VALOR_RECORRENTE = [
  { value: 'FIXO', label: 'Fixo' },
  { value: 'VARIAVEL', label: 'Variável' },
];

// Gasto variável criado automaticamente que ainda não foi conferido pelo operador
export const precisaConferir = (d) => d.recorrencia === 'RECORRENTE' && d.valor_tipo === 'VARIAVEL' && d.conferido === false;
