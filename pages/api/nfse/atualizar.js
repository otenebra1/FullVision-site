// POST /api/nfse/atualizar  (só ADM)
// corpo: { ids?: [uuid] }  sem ids = todas as que estão processando.
// Consulta o emissor e atualiza status, número, PDF e XML.
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { soAdmin } from '../../../lib/nfseAuth';
import { atualizarNota } from '../../../lib/focusNfe';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (!(await soAdmin(req, res))) return;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 50) : null;
  let q = supabaseAdmin.from('nf_notas').select('*');
  q = ids && ids.length ? q.in('id', ids) : q.eq('status', 'PROCESSANDO').limit(50);
  const { data: notas, error } = await q;
  if (error) return res.status(500).json({ erro: error.message });
  const atualizadas = [];
  for (const n of notas || []) {
    try { atualizadas.push(await atualizarNota(n)); } catch (e) { atualizadas.push({ ...n, aviso: e.message }); }
  }
  return res.status(200).json({ notas: atualizadas });
}
