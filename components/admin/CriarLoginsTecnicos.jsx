// Prévia e criação em lote dos logins dos técnicos (só ADM, dentro de Gerenciar Usuários)
import React, { useState } from 'react';
import { FaSpinner, FaUserPlus } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';

const SITUACAO = {
  vai_criar: { txt: 'Vai ganhar login', cls: 'text-blue-300' },
  criado: { txt: 'Login criado', cls: 'text-emerald-400' },
  ja_tem_login: { txt: 'Já tem login', cls: 'text-gray-500' },
  sem_email: { txt: 'Sem e-mail no cadastro', cls: 'text-amber-400' },
  inativo: { txt: 'Técnico inativo', cls: 'text-gray-500' },
  erro: { txt: 'Erro', cls: 'text-red-400' },
};

async function chamar(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/criar-logins-tecnicos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
  return json.lista || [];
}

export default function CriarLoginsTecnicos({ showToast, onCriados }) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState(null);
  const [senha, setSenha] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const verPrevia = async () => {
    setAberto(true); setOcupado(true);
    try { setLista(await chamar({ confirmar: false })); } catch (e) { showToast(e.message, 'error'); setAberto(false); }
    setOcupado(false);
  };
  const criar = async () => {
    setOcupado(true);
    try {
      const r = await chamar({ confirmar: true, senha });
      setLista(r);
      const n = r.filter(x => x.situacao === 'criado').length;
      showToast(n ? `${n} ${n === 1 ? 'login criado' : 'logins criados'}. No primeiro acesso cada técnico troca a senha.` : 'Nenhum login novo criado.');
      setSenha('');
      if (n) onCriados();
    } catch (e) { showToast(e.message, 'error'); }
    setOcupado(false);
  };

  if (!aberto) {
    return (
      <button type="button" onClick={verPrevia} className="inline-flex items-center gap-2 text-sm text-amber-300 border border-amber-500/30 hover:bg-amber-500/10 rounded-lg px-3 py-2">
        <FaUserPlus /> Criar logins dos técnicos
      </button>
    );
  }

  const novos = (lista || []).filter(x => x.situacao === 'vai_criar').length;
  return (
    <div className="bg-gray-950 p-4 rounded-xl border border-amber-500/30 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">Logins dos técnicos</div>
        <button type="button" onClick={() => { setAberto(false); setLista(null); }} className="text-xs text-gray-400 hover:text-white">Fechar</button>
      </div>
      {!lista ? (
        <div className="text-sm text-gray-400 flex items-center gap-2"><FaSpinner className="animate-spin" /> Conferindo o cadastro de técnicos...</div>
      ) : (
        <>
          <ul className="divide-y divide-gray-800 text-sm max-h-64 overflow-y-auto">
            {lista.map(t => (
              <li key={`${t.nome}-${t.email}`} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0"><div className="text-white truncate">{t.nome}</div><div className="text-xs text-gray-500 truncate">{t.email || 'sem e-mail'}</div></div>
                <span className={`text-xs shrink-0 ${SITUACAO[t.situacao]?.cls}`} title={t.erro || ''}>{SITUACAO[t.situacao]?.txt}{t.erro ? `: ${t.erro}` : ''}</span>
              </li>
            ))}
            {lista.length === 0 && <li className="py-2 text-gray-500">Nenhum técnico cadastrado.</li>}
          </ul>
          {novos > 0 && (
            <div className="flex flex-col md:flex-row gap-3 md:items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Senha inicial (todos trocam no primeiro acesso)</label>
                <input type="text" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="off" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500" />
              </div>
              <button type="button" disabled={ocupado || senha.length < 8} onClick={criar} className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap inline-flex items-center gap-2">
                {ocupado && <FaSpinner className="animate-spin" />} Criar {novos} {novos === 1 ? 'login' : 'logins'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
