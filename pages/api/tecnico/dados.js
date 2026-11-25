// pages/api/tecnico/dados.js
// Tudo o que o app do técnico precisa, já filtrado no servidor:
// só as OS dele, sem valores em R$, e só os clientes/placas/rastreadores dessas OS.
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { tecnicoDoLogin } from '../../../lib/apiAuth';

const CAMPOS_FINANCEIROS = ['custo_tecnico', 'faturamento_cliente', 'deslocamento_tecnico', 'deslocamento_cliente', 'valor_km'];
const semValores = (os) => {
  const limpa = { ...os };
  CAMPOS_FINANCEIROS.forEach(k => { delete limpa[k]; });
  return limpa;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  const auth = await tecnicoDoLogin(req);
  if (auth.erro) return res.status(auth.status).json({ error: auth.erro });
  const { tecnico } = auth;

  // OS abertas dele + finalizadas nos últimos 45 dias
  const desde = new Date(Date.now() - 45 * 864e5).toLocaleDateString('en-CA');
  const sel = '*, empresas(id, nome), veiculos(id, placa, modelo)';
  const [abertas, finalizadas] = await Promise.all([
    supabaseAdmin.from('ordens_servico').select(sel).eq('tecnico_id', tecnico.id).eq('status', 'aberta').order('data', { ascending: true }),
    supabaseAdmin.from('ordens_servico').select(sel).eq('tecnico_id', tecnico.id).neq('status', 'aberta').gte('data', desde).order('data', { ascending: false }).limit(60),
  ]);
  const erro = abertas.error || finalizadas.error;
  if (erro) return res.status(500).json({ error: erro.message });
  const ordens = [...(abertas.data || []), ...(finalizadas.data || [])].map(semValores);

  // Clientes das OS abertas (o assistente precisa das placas e rastreadores deles)
  const empresaIds = [...new Set((abertas.data || []).map(o => o.empresa_id).filter(Boolean))];
  let empresas = [];
  let veiculos = [];
  let rastreadores = [];
  if (empresaIds.length) {
    const [e, v] = await Promise.all([
      supabaseAdmin.from('empresas').select('id, nome').in('id', empresaIds),
      supabaseAdmin.from('veiculos').select('id, placa, modelo, empresa_id').in('empresa_id', empresaIds).order('placa'),
    ]);
    empresas = e.data || [];
    veiculos = v.data || [];
    const veiculoIds = veiculos.map(x => x.id);
    const [disp, inst] = await Promise.all([
      supabaseAdmin.from('rastreadores').select('id, serial, modelo, categoria, status, veiculo_id').in('status', ['estoque_central', 'estoque_tecnico']).order('serial'),
      veiculoIds.length
        ? supabaseAdmin.from('rastreadores').select('id, serial, modelo, categoria, status, veiculo_id').eq('status', 'instalado').in('veiculo_id', veiculoIds)
        : Promise.resolve({ data: [] }),
    ]);
    rastreadores = [...(disp.data || []), ...(inst.data || [])];
  }

  // Catálogo de serviços (só nomes; os preços ficam no servidor)
  const { data: servicos } = await supabaseAdmin.from('servicos_catalogo').select('id, nome, tipo, ativo, ordem').order('ordem');

  return res.status(200).json({
    tecnico: { id: tecnico.id, nome: tecnico.nome, email: tecnico.email, ativo: true },
    ordens,
    empresas,
    veiculos,
    rastreadores,
    servicos: servicos || [],
  });
}
