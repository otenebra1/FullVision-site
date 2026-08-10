// pages/api/update-user.js
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
  if (!admin) return res.status(403).json({ error: 'Apenas administradores podem editar usuários.' });

  const { userId, username, role, trackingUrl, newPassword } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId é obrigatório.' });

  // Atualiza o perfil (username, role, link de rastreio)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      ...(username && { username }),
      ...(role && { role }),
      ...(trackingUrl !== undefined && { tracking_url: trackingUrl }),
    })
    .eq('id', userId)
    .select()
    .single();

  if (profileError) return res.status(400).json({ error: profileError.message });

  // Se veio uma nova senha, reseta via admin API
  if (newPassword) {
    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (pwError) return res.status(400).json({ error: pwError.message });
  }

  return res.status(200).json({ profile });
}