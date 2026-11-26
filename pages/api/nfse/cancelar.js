// POST /api/nfse/cancelar  (só ADM)
// corpo: { id, justificativa }  (a prefeitura pede de 15 a 255 letras)
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { soAdmin } from '../../../lib/nfseAuth';
import { cancelarNota } from '../../../lib/focusNfe';

export default async function handler(req, res) {
  if (!(await soAdmin(req, res))) return;
  const { id } = req.body || {};
  const justificativa = String(req.body?.justificativa || '').trim();
  if (justificativa.length < 15 || justificativa.length > 255) {
    return res.status(400).json({ erro: 'Escreva o motivo do cancelamento com 15 a 255 letras.' });
  }
  const { data: nota, error } = await supabaseAdmin.from('nf_notas').select('*').eq('id', id).single();
  if (error || !nota) return res.status(404).json({ erro: 'Nota não encontrada.' });
  if (nota.status !== 'AUTORIZADA') return res.status(400).json({ erro: 'Só dá para cancelar nota emitida.' });
  try {
    const atualizada = await cancelarNota(nota, justificativa);
    return res.status(200).json({ nota: atualizada });
  } catch (e) {
    return res.status(400).json({ erro: e.message });
  }
}
