// Sino de notificações da equipe (tabela fv_notificacoes, criada pelo banco).
// Aparece no topo do painel, do financeiro, de compras e do app do técnico.
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { FaBell, FaCheckDouble } from 'react-icons/fa';
import { supabase } from '../lib/supabase';

const quando = (iso) => {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.round(min / 60)} h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export default function Notificacoes({ className = '' }) {
  const router = useRouter();
  const [lista, setLista] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(true); // some se a tabela ainda não existe
  const [uid, setUid] = useState(null);

  const carregar = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const id = session?.user?.id;
    if (!id) return;
    setUid(id);
    const { data, error } = await supabase.from('fv_notificacoes').select('*')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(40);
    if (error) { setAtivo(false); return; }
    setLista(data || []);
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60000);
    const aoVoltar = () => { if (document.visibilityState === 'visible') carregar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar); };
  }, [carregar]);

  if (!ativo) return null;
  const naoLidas = lista.filter(n => !n.lida).length;

  const abrir = async (n) => {
    if (!n.lida) {
      setLista(xs => xs.map(x => (x.id === n.id ? { ...x, lida: true } : x)));
      await supabase.from('fv_notificacoes').update({ lida: true }).eq('id', n.id);
    }
    if (n.link) {
      setAberto(false);
      if (router.asPath !== n.link) router.push(n.link);
    }
  };

  const lerTodas = async () => {
    setLista(xs => xs.map(x => ({ ...x, lida: true })));
    if (uid) await supabase.from('fv_notificacoes').update({ lida: true }).eq('user_id', uid).eq('lida', false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { setAberto(v => !v); if (!aberto) carregar(); }}
        aria-label={naoLidas ? `Notificações (${naoLidas} novas)` : 'Notificações'}
        title="Notificações"
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white transition-colors"
      >
        <FaBell size={14} />
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <button type="button" aria-label="Fechar notificações" className="fixed inset-0 z-[70] cursor-default" onClick={() => setAberto(false)} />
          <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-20 sm:top-12 z-[71] sm:w-96 max-h-[70vh] flex flex-col bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-sm font-semibold text-white">Notificações</span>
              {naoLidas > 0 && (
                <button type="button" onClick={lerTodas} className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
                  <FaCheckDouble size={10} /> Marcar todas como lidas
                </button>
              )}
            </div>
            <ul className="overflow-y-auto divide-y divide-gray-800/70">
              {lista.length === 0 && <li className="px-4 py-10 text-center text-sm text-gray-500">Nenhuma notificação.</li>}
              {lista.map(n => (
                <li key={n.id}>
                  <button type="button" onClick={() => abrir(n)} className={`w-full text-left px-4 py-3 hover:bg-gray-800/60 flex gap-3 ${n.lida ? 'opacity-60' : ''}`}>
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.lida ? 'bg-transparent' : 'bg-blue-400'}`} />
                    <span className="min-w-0">
                      <span className="block text-sm text-white font-medium">{n.titulo}</span>
                      {n.mensagem && <span className="block text-xs text-gray-400 mt-0.5">{n.mensagem}</span>}
                      <span className="block text-[11px] text-gray-500 mt-1">{quando(n.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
