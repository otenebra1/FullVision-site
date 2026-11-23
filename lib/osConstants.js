// lib/osConstants.js
// Constantes e helpers compartilhados pelas telas de Ordem de Serviço (OS)

// Tags de serviço usadas na Ordem de Serviço (mesmas da planilha original)
export const SERVICO_TAGS = [
  'MANUTENÇÃO', 'TROCA EQUIPAMENTO', 'INSTALAÇÃO LOCALIZADOR', 'RETIRADA LOCALIZADOR',
  'INSTALAÇÃO BLOQUEIO', 'INSTALAÇÃO SENSOR EXTERNO CABINE', 'INSTALAÇÃO SENSOR INTERNO CABINE',
  'UPGRADE LOCALIZADOR', 'EXTRAVIO LOCALIZADOR', 'KM',
];

// As 7 fotos obrigatórias de toda Ordem de Serviço
export const FOTO_TIPOS = [
  { key: 'equipamento_placa', curto: 'Equipamento + placa', label: 'Equipamento na frente da placa (com o ID visível)' },
  { key: 'painel_ligado_antes', curto: 'Painel ligado (antes)', label: 'Painel com o motor ligado (antes)' },
  { key: 'regiao_desmontada', curto: 'Região desmontada', label: 'Região que será desmontada' },
  { key: 'fiacao', curto: 'Fiação', label: 'Fiação onde o equipamento será instalado' },
  { key: 'acabamento', curto: 'Acabamento', label: 'Acabamento da instalação/retirada' },
  { key: 'painel_fechado', curto: 'Painel fechado', label: 'Painel fechado' },
  { key: 'painel_ligado_depois', curto: 'Painel ligado (depois)', label: 'Painel com o motor ligado (depois do serviço)' },
];

// Como as fotos aparecem no detalhe da OS: o "antes" é a prova do estado em que o veículo estava
export const FOTO_GRUPOS = [
  { titulo: 'Identificação do equipamento', keys: ['equipamento_placa'] },
  { titulo: 'Antes de mexer', keys: ['painel_ligado_antes', 'regiao_desmontada', 'fiacao'] },
  { titulo: 'Depois do serviço', keys: ['acabamento', 'painel_fechado', 'painel_ligado_depois'] },
];

// Código curto e legível da OS (enquanto não existe numeração sequencial)
export const osCodigo = (id) => 'OS-' + String(id || '').replace(/-/g, '').slice(0, 6).toUpperCase();

export const splitServicos = (s) => (s || '').split(',').map(x => x.trim()).filter(Boolean);

// Estado do veículo ANTES do serviço (prova do que já estava com defeito quando chegamos)
export const CHECKLIST_ITENS = [
  { key: 'partida', label: 'Dá partida normalmente' },
  { key: 'painel', label: 'Painel acende e funciona' },
  { key: 'luzes_aviso', label: 'Luzes de aviso do painel apagadas' },
  { key: 'iluminacao', label: 'Iluminação externa e setas' },
  { key: 'vidros_travas', label: 'Vidros e travas elétricos' },
  { key: 'ar_condicionado', label: 'Ar-condicionado' },
  { key: 'som_multimidia', label: 'Som e multimídia' },
  { key: 'buzina', label: 'Buzina' },
];
export const CHECKLIST_RESPOSTAS = [
  { key: 'ok', label: 'Funciona' },
  { key: 'defeito', label: 'Com defeito' },
  { key: 'nao_tem', label: 'Não possui' },
];

// Regiões do veículo: o que NÃO for marcado como mexido aparece no laudo como "não alterado"
export const REGIOES = [
  'Painel de instrumentos', 'Console central', 'Coluna de direção', 'Porta-luvas', 'Forro do teto',
  'Assoalho e tapetes', 'Cofre do motor', 'Chicote traseiro', 'Para-choque', 'Cabine (geral)',
];

// Serviços em que faz sentido informar o rastreador instalado / retirado
export const TAGS_QUE_RETIRAM = ['MANUTENÇÃO', 'TROCA EQUIPAMENTO', 'RETIRADA LOCALIZADOR', 'EXTRAVIO LOCALIZADOR'];
export const TAGS_QUE_INSTALAM = ['INSTALAÇÃO LOCALIZADOR', 'TROCA EQUIPAMENTO', 'UPGRADE LOCALIZADOR', 'MANUTENÇÃO'];

export const normalizaPlaca = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
