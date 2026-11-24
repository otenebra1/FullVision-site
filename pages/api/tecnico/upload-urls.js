// pages/api/tecnico/upload-urls.js
// Gera links assinados para o técnico enviar fotos e assinatura da OS direto ao Storage,
// sem precisar de permissão de escrita no bucket.
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { tecnicoDoLogin } from '../../../lib/apiAuth';

const EXT_OK = ['jpg', 'jpeg', 'png', 'webp', 'heic'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const auth = await tecnicoDoLogin(req);
  if (auth.erro) return res.status(auth.status).json({ error: auth.erro });

  const { osId, arquivos } = req.body || {};
  if (!osId || !Array.isArray(arquivos) || arquivos.length === 0 || arquivos.length > 20) {
    return res.status(400).json({ error: 'Dados inválidos.' });
  }
  const { data: os } = await supabaseAdmin.from('ordens_servico').select('id, tecnico_id, status').eq('id', osId).single();
  if (!os || String(os.tecnico_id) !== String(auth.tecnico.id) || os.status !== 'aberta') {
    return res.status(403).json({ error: 'Esta OS não está aberta para você.' });
  }

  const urls = [];
  for (const a of arquivos) {
    const chave = String(a.chave || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'arquivo';
    const ext = String(a.ext || 'jpg').toLowerCase();
    if (!EXT_OK.includes(ext)) return res.status(400).json({ error: `Tipo de arquivo não aceito: ${ext}` });
    const path = `${os.id}/${chave}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { data, error } = await supabaseAdmin.storage.from('os-fotos').createSignedUploadUrl(path);
    if (error) return res.status(500).json({ error: error.message });
    urls.push({ chave: a.chave, path: data.path || path, token: data.token });
  }
  return res.status(200).json({ urls });
}
