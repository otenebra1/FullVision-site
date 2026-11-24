// Sessão e perfil do usuário logado, disponíveis no app inteiro
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';

const Ctx = createContext(null);

export const ehEquipe = (role) => role === 'admin' || role === 'funcionario';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [pronto, setPronto] = useState(false);

  const carregarPerfil = useCallback(async (s) => {
    if (!s?.user) { setPerfil(null); return; }
    const { data } = await supabase.from('profiles').select('id, username, role, empresa_id').eq('id', s.user.id).single();
    setPerfil(data || null);
  }, []);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return;
      setSession(data.session);
      await carregarPerfil(data.session);
      setPronto(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSession(s);
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') carregarPerfil(s);
    });
    return () => { ativo = false; sub.subscription.unsubscribe(); };
  }, [carregarPerfil]);

  const valor = {
    session,
    perfil,
    pronto,
    role: perfil?.role || null,
    precisaTrocarSenha: Boolean(session?.user?.user_metadata?.trocar_senha),
    sair: () => supabase.auth.signOut(),
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
