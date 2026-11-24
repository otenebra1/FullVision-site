// lib/apiAuth.js
// Identifica quem chamou uma API route (token do Supabase no header Authorization).
// Só para uso em /pages/api/* (usa a service role).
import { supabaseAdmin } from './supabaseAdmin';

export async function quemChamou(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin.from('profiles').select('id, username, role').eq('id', user.id).single();
  return { user, profile, role: profile?.role || null };
}

// Técnico logado: o cadastro em "Técnicos" com o mesmo e-mail do login
export async function tecnicoDoLogin(req) {
  const quem = await quemChamou(req);
  if (!quem || quem.role !== 'tecnico') return { erro: 'Acesso só para técnicos.', status: 403 };
  const email = String(quem.user.email || '').trim().toLowerCase();
  const { data: tecnicos, error } = await supabaseAdmin.from('tecnicos').select('*');
  if (error) return { erro: error.message, status: 500 };
  const tecnico = (tecnicos || []).find(t => String(t.email || '').trim().toLowerCase() === email && t.ativo !== false);
  if (!tecnico) {
    return { erro: `Seu login (${email}) não está ligado a nenhum técnico ativo. Peça ao ADM para usar este mesmo e-mail no cadastro de Técnicos.`, status: 403 };
  }
  return { quem, tecnico };
}
