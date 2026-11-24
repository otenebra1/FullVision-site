// Chamadas às rotas do site (/api/tecnico/*), que filtram os dados no servidor
import { supabase } from './supabase';

export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://www.fullvision.one').replace(/\/$/, '');

export async function api(caminho, opcoes = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SITE_URL}${caminho}`, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}`, ...(opcoes.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erro ${res.status} no servidor`);
  return json;
}
