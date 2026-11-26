// POST /api/nfse/arquivo  (só ADM)
// corpo: { id, tipo: 'pdf' | 'xml' }  devolve { url } para abrir/baixar (link vale 5 minutos)
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { soAdmin } from '../../../lib/nfseAuth';
import { BUCKET_NOTAS, atualizarNota } from '../../../lib/focusNfe';

export default async function handler(req, res) {
  if (!(await soAdmin(req, res))) return;
  const { id, tipo } = req.body || {};
  let { data: nota } = await supabaseAdmin.from('nf_notas').select('*').eq('id', id).single();
  if (!nota) return res.status(404).json({ erro: 'Nota não encontrada.' });
  const campo = tipo === 'xml' ? 'xml_path' : 'pdf_path';
  // Ainda não guardou a cópia? Tenta buscar no emissor agora
  if (!nota[campo] && (nota.status === 'AUTORIZADA' || nota.status === 'CANCELADA')) {
    try { nota = await atualizarNota(nota); } catch { /* segue com o link do emissor */ }
  }
  if (nota[campo]) {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET_NOTAS).createSignedUrl(nota[campo], 300);
    if (!error && data?.signedUrl) return res.status(200).json({ url: data.signedUrl });
  }
  const reserva = tipo === 'xml' ? nota.url_xml : (nota.url_pdf || nota.url_prefeitura);
  if (reserva) return res.status(200).json({ url: reserva });
  return res.status(404).json({ erro: `O ${tipo === 'xml' ? 'XML' : 'PDF'} ainda não está disponível.` });
}
