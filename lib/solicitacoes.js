// lib/solicitacoes.js
// Solicitação de serviço → pré-OS (OS com status 'aberta', completada depois no assistente de OS).

export const TIPO_SERVICO_LABEL = { manutencao: 'Manutenção', troca: 'Troca', desinstalacao: 'Desinstalação', nova_instalacao: 'Nova Instalação' };

const SELECT_SOLICITACAO = '*, empresas(nome), veiculos(placa, modelo)';

const dataLocal = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Cria a pré-OS a partir da solicitação e grava o vínculo nela. Devolve { os, solicitacao }.
// tecnico: { id, nome, email } escolhido pelo admin (pode ser null e ser atribuído depois)
export async function criarPreOS(client, s, tecnico = null) {
  const novaPlaca = s.tipo_servico === 'nova_instalacao' || !s.veiculo_id;
  const { data: os, error } = await client.from('ordens_servico').insert([{
    status: 'aberta',
    data: dataLocal(s.data_hora_prevista),
    horario_previsto: s.data_hora_prevista || null,
    empresa_id: s.empresa_id,
    veiculo_id: novaPlaca ? null : s.veiculo_id,
    placa_texto: novaPlaca ? (s.placa_nova || null) : null,
    servico_realizado: (TIPO_SERVICO_LABEL[s.tipo_servico] || s.tipo_servico || '').toUpperCase(),
    local_instalacao: s.endereco || null,
    telefone_contato: s.telefone_contato || null,
    observacoes: s.descricao || null,
    tecnico_id: tecnico?.id || null,
    tecnico_nome: tecnico?.nome || null,
    tecnico_email: tecnico?.email || null,
    finalizada_em: null,
  }]).select('*, empresas(nome), veiculos(placa)').single();
  if (error) throw new Error(error.message);

  const { data: sol, error: e2 } = await client.from('solicitacoes_servico')
    .update({ os_id: os.id, updated_at: new Date().toISOString() })
    .eq('id', s.id).select(SELECT_SOLICITACAO).single();
  if (e2) throw new Error(e2.message);
  return { os, solicitacao: sol };
}

// Admin cria a solicitação (em nome do cliente) e a pré-OS de uma vez
export async function criarSolicitacaoComOS(client, dados) {
  const { data: s, error } = await client.from('solicitacoes_servico').insert([{
    empresa_id: dados.empresaId,
    veiculo_id: dados.tipo === 'nova_instalacao' ? null : dados.veiculoId,
    placa_nova: dados.tipo === 'nova_instalacao' ? dados.placaNova.trim().toUpperCase() : null,
    tipo_servico: dados.tipo,
    descricao: dados.descricao || null,
    endereco: dados.endereco || null,
    telefone_contato: dados.telefone || null,
    data_hora_prevista: dados.dataHora ? new Date(dados.dataHora).toISOString() : null,
    status: dados.dataHora ? 'confirmado' : 'pendente',
  }]).select(SELECT_SOLICITACAO).single();
  if (error) throw new Error(error.message);
  try {
    return await criarPreOS(client, s, dados.tecnico || null);
  } catch (e) {
    // A solicitação ficou salva; só a OS falhou
    return { os: null, solicitacao: s, erroOS: e.message };
  }
}

// Técnicos ativos para escolher na solicitação/OS
export async function carregarTecnicos(client) {
  const { data, error } = await client.from('tecnicos').select('id, nome, email, ativo').order('nome');
  if (error) return [];
  return (data || []).filter(t => t.ativo !== false);
}

// Atribui (ou troca) o técnico de uma OS aberta
export async function atribuirTecnico(client, osId, tecnico) {
  const { data, error } = await client.from('ordens_servico').update({
    tecnico_id: tecnico?.id || null, tecnico_nome: tecnico?.nome || null, tecnico_email: tecnico?.email || null,
  }).eq('id', osId).select('*, empresas(nome), veiculos(placa)').single();
  if (error) throw new Error(error.message);
  return data;
}
