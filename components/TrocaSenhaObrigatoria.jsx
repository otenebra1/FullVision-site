// Login criado com senha inicial (user_metadata.trocar_senha): obriga a trocar antes de usar o sistema
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function TrocaSenhaObrigatoria() {
  const [precisa, setPrecisa] = useState(false);
  const [senha, setSenha] = useState('');
  const [repete, setRepete] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const confere = (session) => setPrecisa(Boolean(session?.user?.user_metadata?.trocar_senha));
    supabase.auth.getSession().then(({ data }) => confere(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => confere(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!precisa) return null;

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    if (senha.length < 8) { setErro('A nova senha precisa ter pelo menos 8 caracteres.'); return; }
    if (senha.toLowerCase().includes('fullvision')) { setErro('Escolha uma senha diferente da senha inicial.'); return; }
    if (senha !== repete) { setErro('As duas senhas não são iguais.'); return; }
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha, data: { trocar_senha: false } });
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    setPrecisa(false);
  };

  const sair = async () => { await supabase.auth.signOut(); setPrecisa(false); };
  const campo = 'w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-base text-white outline-none focus:border-blue-500';

  return (
    <div className="fixed inset-0 z-[100] bg-gray-950/95 backdrop-blur flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Criar nova senha">
      <form onSubmit={salvar} className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Crie sua senha</h2>
          <p className="text-sm text-gray-400 mt-1">Este é seu primeiro acesso. Troque a senha inicial por uma só sua.</p>
        </div>
        <input type="password" autoComplete="new-password" placeholder="Nova senha" value={senha} onChange={e => setSenha(e.target.value)} className={campo} />
        <input type="password" autoComplete="new-password" placeholder="Repita a nova senha" value={repete} onChange={e => setRepete(e.target.value)} className={campo} />
        {erro && <p className="text-sm text-red-400">{erro}</p>}
        <button type="submit" disabled={salvando} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl py-3">{salvando ? 'Salvando...' : 'Salvar senha'}</button>
        <button type="button" onClick={sair} className="w-full text-sm text-gray-400 hover:text-white">Sair</button>
      </form>
    </div>
  );
}
