// /compras — painel da equipe de compras
// Quem acessa: ADM e quem tem a permissão "Área de compras" (Gerenciar Usuários).
// Mostra as solicitações já aprovadas pelo ADM: fazer orçamentos, e depois da compra aprovada
// ir atualizando as etapas (em processo de compra, compra realizada, entregue, finalizado).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { FaSpinner, FaArrowLeft, FaCheckCircle, FaExclamationCircle, FaChevronRight } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { podeCompras, ehAdmin } from '../lib/perfis';
import { TabBar, SearchInput, norm } from '../components/admin/ui';
import Notificacoes from '../components/Notificacoes';
import SolicitacaoDetalhe, { BadgeStatus } from '../components/financeiro/SolicitacaoDetalhe';
import { reais } from '../lib/financeiro';

const ABAS = [
  { key: 'orcar', label: 'Para orçar', status: ['APROVADA'] },
  { key: 'adm', label: 'Com o ADM', status: ['ORCADA'] },
  { key: 'comprar', label: 'Comprar e acompanhar', status: ['COMPRA_APROVADA', 'EM_COMPRA', 'COMPRADA', 'ENTREGUE'] },
  { key: 'finalizadas', label: 'Finalizadas', status: ['FINALIZADA'] },
];
const qtdTxt = (n) => Number(n || 0).toLocaleString('pt-BR');
const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

export default function Compras() {
  const router = useRouter();
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [orcamentos, setOrcamentos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [itens, setItens] = useState([]);
  const [aba, setAba] = useState('orcar');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ---------- Acesso ----------
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/area-cliente'); return; }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (!podeCompras(profile)) {
        router.replace(profile?.role === 'tecnico' ? '/tecnico' : profile?.role === 'funcionario' ? '/painel-admin' : '/area-cliente');
        return;
      }
      setPerfil(profile);
    })();
  }, [router]);

  const carregar = useCallback(async () => {
    const [s, o, f, i] = await Promise.all([
      supabase.from('fin_solicitacoes').select('*').not('status', 'in', '("PENDENTE","RECUSADA")').order('created_at', { ascending: false }),
      supabase.from('fin_orcamentos').select('id, solicitacao_id, valor_total'),
      supabase.from('fin_fornecedores').select('id, nome, nome_fantasia, contato, telefone, ativo').order('nome'),
      supabase.from('fin_itens').select('id, nome').order('nome'),
    ]);
    if (s.error || o.error) {
      const msg = (s.error || o.error).message;
      setErro(/orcamentos|status_em|comentario_etapa/.test(msg) ? 'O fluxo de compras ainda não foi ligado no banco: rode o SQL 20261126b_fluxo_compras.sql no Supabase.' : msg);
    } else setErro('');
    setSolicitacoes(s.data || []);
    setOrcamentos(o.data || []);
    setFornecedores(f.data || []);
    setItens(i.data || []);
    setCarregando(false);
  }, []);
  useEffect(() => { if (perfil) carregar(); }, [perfil, carregar]);

  // Abre direto uma solicitação (?id=...)
  useEffect(() => {
    if (!router.query.id || !solicitacoes.length) return;
    const s = solicitacoes.find(x => x.id === router.query.id);
    if (s) setAberta(s);
  }, [router.query.id, solicitacoes]);

  const orcPorSolicitacao = useMemo(() => {
    const m = {};
    orcamentos.forEach(o => { (m[o.solicitacao_id] ||= []).push(o); });
    return m;
  }, [orcamentos]);

  const contagem = useMemo(() => Object.fromEntries(ABAS.map(a => [a.key, solicitacoes.filter(s => a.status.includes(s.status)).length])), [solicitacoes]);

  const lista = useMemo(() => {
    const st = ABAS.find(a => a.key === aba)?.status || [];
    const q = norm(busca);
    return solicitacoes
      .filter(s => st.includes(s.status) && (!q || norm(`${s.descricao} ${s.solicitante_nome} ${s.motivo} ${s.local_entrega || ''} ${s.centro_custo || ''}`).includes(q)))
      .sort((a, b) => ((b.urgencia === 'URGENTE') - (a.urgencia === 'URGENTE')) || (a.created_at < b.created_at ? (aba === 'finalizadas' ? 1 : -1) : (aba === 'finalizadas' ? -1 : 1)));
  }, [solicitacoes, aba, busca]);

  if (!perfil) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><FaSpinner className="animate-spin text-3xl text-blue-500" /></div>;
  }

  return (
    <>
      <Head><title>Compras | Full Vision</title></Head>

      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold ${toast.type === 'success' ? 'bg-emerald-950 border-emerald-500/40 text-emerald-400' : 'bg-red-950 border-red-500/40 text-red-400'}`}>
          {toast.type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />} {toast.message}
        </div>
      )}

      <div className="min-h-screen bg-black text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Compras</h1>
              <p className="text-gray-400 text-sm mt-1">Solicitações aprovadas pelo ADM: orçamentos, compra e entrega</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Notificacoes />
              {ehAdmin(perfil.role) && (
                <a href="/financeiro?aba=solicitacoes" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2">
                  Solicitações no financeiro
                </a>
              )}
              <a href={perfil.role === 'tecnico' ? '/tecnico' : '/painel-admin'} className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2">
                <FaArrowLeft size={12} /> {perfil.role === 'tecnico' ? 'Minhas OS' : 'Painel administrativo'}
              </a>
            </div>
          </div>

          {erro && (
            <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3">
              <FaExclamationCircle className="mt-0.5 shrink-0" /> {erro}
            </div>
          )}

          {carregando ? (
            <div className="flex items-center justify-center py-24 text-gray-500"><FaSpinner className="animate-spin text-2xl mr-3" /> Carregando...</div>
          ) : (
            <>
              <TabBar active={aba} onChange={setAba} tabs={ABAS.map(a => ({ key: a.key, label: a.label, count: contagem[a.key] }))} />
              <SearchInput value={busca} onChange={setBusca} placeholder="Buscar item, quem pediu, local ou centro de custo" />

              <ul className="space-y-2">
                {lista.length === 0 && (
                  <li className="text-center text-gray-500 text-sm py-16 border border-dashed border-gray-800 rounded-2xl">
                    {aba === 'orcar' ? 'Nada para orçar agora.' : aba === 'adm' ? 'Nenhum orçamento esperando o ADM.' : aba === 'comprar' ? 'Nenhuma compra em andamento.' : 'Nenhuma compra finalizada.'}
                  </li>
                )}
                {lista.map(s => {
                  const orcs = orcPorSolicitacao[s.id] || [];
                  const escolhido = orcs.find(o => o.id === s.orcamento_id);
                  return (
                    <li key={s.id}>
                      <button type="button" onClick={() => setAberta(s)} className="w-full text-left rounded-xl border border-gray-800 bg-gray-900/50 hover:bg-gray-800/50 hover:border-gray-700 p-4 flex items-center gap-4 transition-colors">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <BadgeStatus status={s.status} />
                            {s.urgencia === 'URGENTE' && <span className="text-[11px] font-semibold text-red-400">URGENTE</span>}
                          </div>
                          <div className="text-white font-medium">{qtdTxt(s.quantidade)} {s.unidade} · {s.descricao}</div>
                          <div className="text-xs text-gray-400">
                            Pedido por {s.solicitante_nome || '—'} em {dataBR(s.created_at)}
                            {s.local_entrega && <> · Entrega: {s.local_entrega}</>}
                            {s.centro_custo && <> · {s.centro_custo}</>}
                          </div>
                        </div>
                        <div className="text-right text-xs text-gray-400 shrink-0">
                          {escolhido ? <div className="text-emerald-300 font-semibold tabular-nums">{reais(escolhido.valor_total)}</div> : <div className="tabular-nums">{orcs.length} orçamento(s)</div>}
                        </div>
                        <FaChevronRight className="text-gray-600 shrink-0" size={12} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>

      {aberta && (
        <SolicitacaoDetalhe
          solicitacao={aberta}
          modo={ehAdmin(perfil.role) ? 'adm' : 'compras'}
          fornecedores={fornecedores}
          itens={itens}
          showToast={showToast}
          onChanged={carregar}
          onClose={() => { setAberta(null); carregar(); if (router.query.id) router.replace('/compras', undefined, { shallow: true }); }}
        />
      )}
    </>
  );
}
