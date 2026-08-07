// pages/api/create-user.js
import { supabaseAdmin } from '../../lib/supabaseAdmin';

// Confere se quem está chamando a API é realmente um admin logado
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
  if (!admin) return res.status(403).json({ error: 'Apenas administradores podem criar usuários.' });

  const { email, password, username, role, trackingUrl } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: 'email, password e username são obrigatórios.' });
  }

  // 1) Cria o usuário na auth.users (senha já sai com hash)
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // não exige confirmação por e-mail
  });

  if (createError) {
    return res.status(400).json({ error: createError.message });
  }

  // 2) Cria o perfil vinculado (mesmo id/uuid)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert([{
      id: created.user.id,
      username,
      role: role || 'cliente',
      tracking_url: trackingUrl || null,
    }])
    .select()
    .single();

  if (profileError) {
    // rollback: remove o usuário de auth se o perfil falhar
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return res.status(400).json({ error: profileError.message });
  }

  return res.status(200).json({ profile: { ...profile, email } });
}