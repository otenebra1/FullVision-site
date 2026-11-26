// POST /api/nfse/emitir  (só ADM)
// corpo: { notas: [{ empresa_id, competencia: 'AAAA-MM', valor?, discriminacao?, avulsa? }] }
// Sem valor/discriminação, o servidor calcula pelas placas do mês. Emite uma por vez e devolve o resultado de cada uma.
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { soAdmin } from '../../../lib/nfseAuth';
import { carregarConfig, emitirNota } from '../../../lib/focusNfe';
import {
  competenciaIso, placasDoMes, preencherModelo, problemasTomador, problemasConfig,
} from '../../../lib/notasFiscais';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const quem = await soAdmin(req, res);
  if (!quem) return;
  const pedidos = Array.isArray(req.body?.notas) ? req.body.notas.slice(0, 200) : [];
  if (!pedidos.length) return res.status(400).json({ erro: 'Nenhuma nota para emitir.' });

  let cfg;
  try { cfg = await carregarConfig(); } catch (e) { return res.status(400).json({ erro: e.message }); }
  const faltando = problemasConfig(cfg);
  if (faltando.length) return res.status(400).json({ erro: `Configuração fiscal incompleta: ${faltando.join(', ')}.` });

  const ids = [...new Set(pedidos.map(p => p.empresa_id))];
  const [{ data: empresas, error: e1 }, { data: veiculos, error: e2 }] = await Promise.all([
    supabaseAdmin.from('empresas').select('*').in('id', ids),
    supabaseAdmin.from('veiculos').select('id, placa, empresa_id, mensalidade, servicos, status, data_inst, data_desinst').in('empresa_id', ids),
  ]);
  if (e1 || e2) return res.status(500).json({ erro: (e1 || e2).message });

  const resultados = [];
  for (const p of pedidos) {
    const empresa = (empresas || []).find(e => String(e.id) === String(p.empresa_id));
    const nome = empresa?.nome || String(p.empresa_id);
    try {
      if (!empresa) throw new Error('Cliente não encontrado.');
      const prob = problemasTomador(empresa);
      if (prob.length) throw new Error(`Cadastro incompleto (${prob.join(', ')}).`);
      const mes = String(p.competencia || '').slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error('Mês inválido.');
      const placas = p.avulsa ? [] : placasDoMes(veiculos, empresa.id, mes);
      const calculado = Math.round(placas.reduce((s, v) => s + (Number(v.mensalidade) || 0), 0) * 100) / 100;
      const valor = Math.round(Number(p.valor ?? calculado) * 100) / 100;
      if (!(valor > 0)) throw new Error('Valor da nota zerado (nenhuma placa com mensalidade no mês).');
      const discriminacao = String(p.discriminacao || '').trim()
        || preencherModelo(cfg.modelo_discriminacao, { mes, placas, valor, empresa });
      const nota = await emitirNota({
        cfg, empresa, competencia: competenciaIso(mes), valor, discriminacao,
        placas: placas.map(v => ({ id: v.id, placa: v.placa, mensalidade: Number(v.mensalidade) || 0, servicos: v.servicos || [] })),
        criadoPor: quem.user.id, avulsa: Boolean(p.avulsa),
      });
      resultados.push({ empresa_id: p.empresa_id, nome, ok: nota.status !== 'ERRO', nota });
    } catch (e) {
      resultados.push({ empresa_id: p.empresa_id, nome, ok: false, erro: e.message });
    }
  }
  return res.status(200).json({ resultados });
}
