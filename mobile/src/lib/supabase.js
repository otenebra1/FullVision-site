// Cliente Supabase do app. A sessão fica salva no aparelho (expo-sqlite/localStorage).
import 'expo-sqlite/localStorage/install';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Sem as variáveis no build, o createClient quebraria e o app fecharia ao abrir.
// Assim o app abre e mostra o que falta (tela em app/_layout.js).
export const CONFIG_FALTANDO = [
  !SUPABASE_URL && 'EXPO_PUBLIC_SUPABASE_URL',
  !SUPABASE_ANON_KEY && 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
].filter(Boolean);

export const supabase = createClient(SUPABASE_URL || 'https://config-faltando.supabase.co', SUPABASE_ANON_KEY || 'config-faltando', {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Renova o token só com o app em primeiro plano
AppState.addEventListener('change', (estado) => {
  if (estado === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export const urlFoto = (path) => (path ? supabase.storage.from('os-fotos').getPublicUrl(path).data.publicUrl : null);
