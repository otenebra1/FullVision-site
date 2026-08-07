// lib/supabaseAdmin.js
// ATENÇÃO: este client usa a SERVICE ROLE KEY e ignora RLS.
// NUNCA importar este arquivo em código que roda no browser.
// Só pode ser usado dentro de /pages/api/*.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // sem prefixo NEXT_PUBLIC_

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada nas variáveis de ambiente.');
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});