// pages/api/tecnico/localizacao.js
// O app do técnico manda a posição atual (com o app aberto) para a equipe ver no mapa.
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { tecnicoDoLogin } from '../../../lib/apiAuth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const auth = await tecnicoDoLogin(req);
  if (auth.erro) return res.status(auth.status).json({ error: auth.erro });
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'Posição inválida.' });
  }
  const precisao = Number.isFinite(Number(req.body?.precisao)) ? Number(req.body.precisao) : null;
  const { error } = await supabaseAdmin.from('tecnico_localizacao').upsert({
    tecnico_id: auth.tecnico.id, tecnico_nome: auth.tecnico.nome, lat, lng, precisao, atualizado_em: new Date().toISOString(),
  }, { onConflict: 'tecnico_id' });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
