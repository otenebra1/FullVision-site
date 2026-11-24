// pages/api/criar-logins-tecnicos.js
// ADM cria de uma vez os logins dos técnicos cadastrados (tabela tecnicos) que ainda não têm acesso.
// confirmar=false só devolve a prévia (quem ganha login e quem já tem). A senha inicial vem
// digitada pelo ADM (não fica no código) e o técnico é obrigado a trocá-la no primeiro acesso.
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { quemChamou } from '../../lib/apiAuth';

const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function emailsComLogin() {
  const usados = new Map();
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    (data?.users || []).forEach(u => usados.set(String(u.email || '').toLowerCase(), u.id));
    if (!data?.users || data.users.length < 1000) break;
  }
  return usados;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const quem = await quemChamou(req);
  if (!quem || quem.role !== 'admin') return res.status(403).json({ error: 'Apenas o ADM pode criar logins.' });

  const { confirmar = false, senha = '' } = req.body || {};
  if (confirmar && String(senha).length < 8) return res.status(400).json({ error: 'A senha inicial precisa ter pelo menos 8 caracteres.' });

  const { data: tecnicos, error } = await supabaseAdmin.from('tecnicos').select('id, nome, email, ativo').order('nome');
  if (error) return res.status(500).json({ error: error.message });

  let usados;
  try { usados = await emailsComLogin(); } catch (e) { return res.status(500).json({ error: e.message }); }

  const lista = [];
  for (const t of tecnicos || []) {
    const email = String(t.email || '').trim().toLowerCase();
    const base = { nome: t.nome, email: email || null };
    if (t.ativo === false) { lista.push({ ...base, situacao: 'inativo' }); continue; }
    if (!email || !emailValido(email)) { lista.push({ ...base, situacao: 'sem_email' }); continue; }
    if (usados.has(email)) { lista.push({ ...base, situacao: 'ja_tem_login' }); continue; }
    if (!confirmar) { lista.push({ ...base, situacao: 'vai_criar' }); continue; }

    const { data: criado, error: e1 } = await supabaseAdmin.auth.admin.createUser({
      email, password: senha, email_confirm: true, user_metadata: { trocar_senha: true },
    });
    if (e1) { lista.push({ ...base, situacao: 'erro', erro: e1.message }); continue; }
    const { error: e2 } = await supabaseAdmin.from('profiles').insert([{ id: criado.user.id, username: t.nome, role: 'tecnico', empresa_id: null }]);
    if (e2) {
      await supabaseAdmin.auth.admin.deleteUser(criado.user.id);
      lista.push({ ...base, situacao: 'erro', erro: e2.message });
      continue;
    }
    usados.set(email, criado.user.id);
    lista.push({ ...base, situacao: 'criado' });
  }
  return res.status(200).json({ lista });
}
