// pages/api/tecnico/salvar-os.js
// O técnico finaliza a OS dele pelo celular. O servidor confere tudo e calcula os valores
// com as tabelas de preço (que o técnico não enxerga), depois grava como o painel grava.
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { tecnicoDoLogin } from '../../../lib/apiAuth';
import { carregarTabelas, montarContexto, calcularOS } from '../../../lib/precos';
import { salvarOS } from '../../../lib/osSalvar';
import {
  SERVICOS_PRIMARIOS, TAGS_QUE_RETIRAM, normalizaPlaca, categoriaInstalada, ehDaCategoria, itemInstaladoNaPlaca,
  CAT_LOCALIZADOR, CAT_ATUADOR, CAT_SENSOR, SERVICOS_INSTALACAO_UNICA,
} from '../../../lib/osConstants';

const DESTINOS_OK = ['estoque_tecnico', 'estoque_central', 'aguardando_manutencao'];
// Serviços que o técnico pode marcar (os de ADM ficam de fora)
const SERVICOS_DO_TECNICO = new Set(SERVICOS_PRIMARIOS.filter(p => !p.adminOnly).flatMap(p => p.opcoes));

const texto = (v, max = 2000) => (v == null ? '' : String(v).slice(0, max));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const auth = await tecnicoDoLogin(req);
  if (auth.erro) return res.status(auth.status).json({ error: auth.erro });
  const { tecnico } = auth;
  const { osId, dados: d, fotos = [], assinaturaPath = null } = req.body || {};
  if (!osId || !d) return res.status(400).json({ error: 'Dados inválidos.' });

  const { data: os } = await supabaseAdmin.from('ordens_servico').select('*').eq('id', osId).single();
  if (!os || String(os.tecnico_id) !== String(tecnico.id)) return res.status(403).json({ error: 'Esta OS não é sua.' });
  if (os.status !== 'aberta') return res.status(409).json({ error: 'Esta OS já foi finalizada.' });

  // Serviços: só os permitidos ao técnico, com o id do catálogo conferido aqui
  const { data: catalogo } = await supabaseAdmin.from('servicos_catalogo').select('id, nome');
  const idPorNome = new Map((catalogo || []).map(s => [s.nome, s.id]));
  const servicos = (Array.isArray(d.servicos) ? d.servicos : [])
    .filter(s => SERVICOS_DO_TECNICO.has(s.nome))
    .map(s => ({ servicoId: idPorNome.get(s.nome) || null, nome: s.nome, quantidade: Math.min(SERVICOS_INSTALACAO_UNICA.includes(s.nome) ? 1 : 9, Math.max(1, Number(s.quantidade) || 1)) }));
  if (servicos.length === 0 && !(Number(d.km) > 0)) return res.status(400).json({ error: 'Marque ao menos um serviço.' });

  // Placa: confere no cadastro
  const alvo = normalizaPlaca(d.placaTexto);
  if (alvo.length < 5) return res.status(400).json({ error: 'Informe a placa.' });
  const { data: veiculosAlvo } = await supabaseAdmin.from('veiculos').select('id, placa, empresa_id');
  const veiculo = (veiculosAlvo || []).find(v => normalizaPlaca(v.placa) === alvo) || null;

  // Equipamentos: o que for instalado precisa estar em estoque e ser da categoria do serviço marcado;
  // cada placa tem no máximo 1 rastreador e 1 atuador
  const cats = new Set(servicos.map(s => categoriaInstalada(s.nome)).filter(Boolean));
  const { data: daPlaca } = veiculo
    ? await supabaseAdmin.from('rastreadores').select('id, serial, status, categoria, veiculo_id').eq('status', 'instalado').eq('veiculo_id', veiculo.id)
    : { data: [] };
  const rastreadorNaPlaca = itemInstaladoNaPlaca(daPlaca, veiculo?.id, CAT_LOCALIZADOR);
  const atuadorNaPlaca = itemInstaladoNaPlaca(daPlaca, veiculo?.id, CAT_ATUADOR);
  const precisaRetirada = servicos.some(s => TAGS_QUE_RETIRAM.includes(s.nome));
  const retiraAtuador = servicos.some(s => ['RETIRADA BLOQUEIO', 'RETIRADA IMOBILIZADOR SEM FIO'].includes(s.nome));
  if (servicos.some(s => s.nome === 'INSTALAÇÃO LOCALIZADOR') && rastreadorNaPlaca && !precisaRetirada) {
    return res.status(400).json({ error: `Esta placa já tem o rastreador ${rastreadorNaPlaca.serial}. Só cabe 1 por veículo.` });
  }
  if (cats.has(CAT_ATUADOR) && atuadorNaPlaca && !retiraAtuador) {
    return res.status(400).json({ error: `Esta placa já tem o atuador ${atuadorNaPlaca.serial}. Só cabe 1 por veículo.` });
  }

  const buscaEmEstoque = async (id, cat) => {
    const { data: r } = await supabaseAdmin.from('rastreadores').select('id, serial, status, categoria').eq('id', id).single();
    if (!r || !['estoque_central', 'estoque_tecnico'].includes(r.status) || !ehDaCategoria(r, cat)) return null;
    return r;
  };
  let instalado = null;
  if (d.rastreadorInstaladoId && cats.has(CAT_LOCALIZADOR)) {
    instalado = await buscaEmEstoque(d.rastreadorInstaladoId, CAT_LOCALIZADOR);
    if (!instalado) return res.status(400).json({ error: 'O rastreador escolhido não está mais em estoque.' });
  }
  const extras = [];
  for (const id of [...new Set(Array.isArray(d.equipamentosInstaladosIds) ? d.equipamentosInstaladosIds : [])].filter(Boolean).slice(0, 10)) {
    const r = (cats.has(CAT_ATUADOR) && await buscaEmEstoque(id, CAT_ATUADOR)) || (cats.has(CAT_SENSOR) && await buscaEmEstoque(id, CAT_SENSOR));
    if (!r) return res.status(400).json({ error: 'Um dos equipamentos escolhidos não está mais em estoque.' });
    extras.push(r);
  }
  if (extras.filter(r => ehDaCategoria(r, CAT_ATUADOR)).length > 1) return res.status(400).json({ error: 'Só cabe 1 atuador por veículo.' });
  const retiradoId = precisaRetirada && rastreadorNaPlaca ? rastreadorNaPlaca.id : null;
  const atuadorRetiradoId = retiraAtuador && atuadorNaPlaca ? atuadorNaPlaca.id : null;
  const ehExtravio = servicos.some(s => s.nome === 'EXTRAVIO LOCALIZADOR');
  const destino = ehExtravio ? 'baixado' : (DESTINOS_OK.includes(d.rastreadorRetiradoDestino) ? d.rastreadorRetiradoDestino : 'estoque_tecnico');

  // Valores: calculados aqui com as tabelas de preço
  let calculo = null;
  try {
    const tabelas = await carregarTabelas(supabaseAdmin);
    const ctx = montarContexto(tabelas, { tecnicoId: tecnico.id, empresaId: os.empresa_id });
    calculo = calcularOS(ctx, {
      itens: servicos.map(s => ({ ...s, tecnicoManual: null, clienteManual: null })),
      km: Number(d.km) || 0,
      atendimentosMesmoLocal: Math.max(1, Number(d.atendimentos) || 1),
    });
  } catch {
    calculo = null; // sem tabelas: a OS fica com valores zerados para o ADM ajustar
  }

  // Fotos e assinatura já subiram pelo link assinado; só aceitamos caminhos desta OS
  const prefixo = `${os.id}/`;
  const fotosOk = (Array.isArray(fotos) ? fotos : []).filter(f => f && typeof f.path === 'string' && f.path.startsWith(prefixo) && f.tipo);
  if (assinaturaPath && !String(assinaturaPath).startsWith(prefixo)) return res.status(400).json({ error: 'Assinatura inválida.' });

  try {
    const resultado = await salvarOS(supabaseAdmin, {
      data: /^\d{4}-\d{2}-\d{2}$/.test(d.data || '') ? d.data : new Date().toLocaleDateString('en-CA'),
      tecnico: { id: tecnico.id, nome: tecnico.nome, email: tecnico.email },
      empresaId: os.empresa_id,
      servicos,
      veiculoId: veiculo?.id || null,
      placaTexto: alvo,
      placaDoVeiculo: veiculo?.placa || null,
      rastreadorInstaladoId: instalado?.id || null,
      rastreadorInstaladoSerial: instalado?.serial || null,
      rastreadorRetiradoId: retiradoId,
      rastreadorRetiradoDestino: destino,
      equipamentosInstaladosIds: extras.map(r => r.id),
      atuadorRetiradoId,
      local: texto(d.local, 300),
      km: d.km,
      atendimentos: Math.max(1, Number(d.atendimentos) || 1),
      observacoes: texto(d.observacoes),
      problemas: texto(d.problemas),
      checklist: d.checklist && typeof d.checklist === 'object' ? d.checklist : null,
      regioes: Array.isArray(d.regioes) ? d.regioes.map(r => texto(r, 60)) : [],
      calculo,
      totaisManuais: { tecnico: 0, cliente: 0 },
      fotos: {},
      fotoTipos: [],
      assinatura: null,
      assinanteNome: texto(d.assinanteNome, 120),
      geo: d.geo && Number.isFinite(Number(d.geo.lat)) ? { lat: Number(d.geo.lat), lng: Number(d.geo.lng), precisao: Number(d.geo.precisao) || null } : null,
      osExistenteId: os.id,
    });

    const falhas = [...resultado.falhas];
    if (fotosOk.length) {
      const { error } = await supabaseAdmin.from('ordens_servico_fotos').insert(fotosOk.map(f => ({ ordem_servico_id: os.id, tipo: texto(f.tipo, 40), storage_path: f.path })));
      if (error) falhas.push('fotos');
    }
    if (assinaturaPath) {
      const url = supabaseAdmin.storage.from('os-fotos').getPublicUrl(assinaturaPath).data.publicUrl;
      const { error } = await supabaseAdmin.from('ordens_servico').update({ assinatura_url: url }).eq('id', os.id);
      if (error) falhas.push('assinatura');
    }
    return res.status(200).json({ ok: true, falhas });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
