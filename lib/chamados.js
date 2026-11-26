// lib/chamados.js
// Chamados de suporte (tela /suporte): rótulos e regras simples usadas pelo cliente e pela equipe.

export const CATEGORIAS_CHAMADO = [
  { value: 'SEM_SINAL', label: 'Veículo sem sinal / sem posição' },
  { value: 'EQUIPAMENTO', label: 'Problema no equipamento (bloqueio, sensor...)' },
  { value: 'PLATAFORMA', label: 'Plataforma / aplicativo / acesso' },
  { value: 'INSTALACAO', label: 'Instalação, troca ou retirada' },
  { value: 'FINANCEIRO', label: 'Boleto, nota fiscal, valores' },
  { value: 'OUTRO', label: 'Outro assunto' },
];

export const PRIORIDADES = [
  { value: 'BAIXA', label: 'Baixa', cor: 'text-gray-400', badge: 'bg-gray-500/20 text-gray-300' },
  { value: 'NORMAL', label: 'Normal', cor: 'text-blue-300', badge: 'bg-blue-500/15 text-blue-300' },
  { value: 'ALTA', label: 'Alta (veículo parado / sem rastrear)', curto: 'Alta', cor: 'text-amber-300', badge: 'bg-amber-500/15 text-amber-300' },
  { value: 'URGENTE', label: 'Urgente', cor: 'text-red-300', badge: 'bg-red-500/15 text-red-300' },
];

export const STATUS_CHAMADO = [
  { value: 'ABERTO', label: 'Aberto', badge: 'bg-amber-500/15 text-amber-300', aberto: true },
  { value: 'EM_ATENDIMENTO', label: 'Em atendimento', badge: 'bg-blue-500/15 text-blue-300', aberto: true },
  { value: 'AGUARDANDO_CLIENTE', label: 'Aguardando cliente', badge: 'bg-purple-500/15 text-purple-300', aberto: true },
  { value: 'VIROU_OS', label: 'Visita técnica (OS)', badge: 'bg-cyan-500/15 text-cyan-300', aberto: true },
  { value: 'RESOLVIDO', label: 'Resolvido', badge: 'bg-emerald-500/15 text-emerald-300', aberto: false },
  { value: 'FECHADO', label: 'Fechado', badge: 'bg-gray-500/20 text-gray-400', aberto: false },
];

const achar = (lista, v) => lista.find(x => x.value === v) || { value: v, label: v || '', badge: 'bg-gray-500/20 text-gray-300' };
export const infoStatusChamado = (v) => achar(STATUS_CHAMADO, v);
export const infoPrioridade = (v) => achar(PRIORIDADES, v);
export const rotuloCategoria = (v) => achar(CATEGORIAS_CHAMADO, v).label;
export const chamadoAberto = (s) => infoStatusChamado(s).aberto !== false;

export const BUCKET_CHAMADOS = 'chamados';

export const TIPOS_OS = [
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'troca', label: 'Troca' },
  { value: 'desinstalacao', label: 'Desinstalação' },
  { value: 'nova_instalacao', label: 'Nova instalação' },
];
export const tipoOsDaCategoria = (cat) => (cat === 'INSTALACAO' ? 'nova_instalacao' : 'manutencao');

export const quando = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.round(min / 60)} h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// Horas entre duas datas (para o tempo de resposta)
export const horasEntre = (a, b) => (a && b ? (new Date(b) - new Date(a)) / 3600000 : null);
