// pages/api/delete-user.js
import { supabaseAdmin } from '../../lib/supabaseAdmin';

async function getRequestingAdmin(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin' ? user : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const admin = await getRequestingAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Apenas administradores podem excluir usuários.' });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId é obrigatório.' });

  if (userId === admin.id) {
    return res.status(400).json({ error: 'Você não pode excluir a si mesmo.' });
  }

  // Apaga de auth.users -> profiles cai junto (on delete cascade)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return res.status(400).json({ error: error.message });

  return res.status(200).json({ success: true });
}