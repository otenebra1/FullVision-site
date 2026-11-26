// /suporte — chamados de suporte
// Cliente: abre chamado, conversa com a equipe, manda foto, fecha e avalia.
// Equipe (ADM e funcionário): responde, nota interna, prioridade, responsável e "virar OS" (pré-OS do fluxo que já existe).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  FaSpinner, FaArrowLeft, FaCheckCircle, FaExclamationCircle, FaPlus, FaPaperclip, FaPaperPlane, FaTools, FaStar,
  FaLock, FaHeadset, FaRedoAlt, FaTimes,
} from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { ehEquipe } from '../lib/perfis';
import { criarSolicitacaoComOS, carregarTecnicos } from '../lib/solicitacoes';
import { StatStrip, SearchInput, inputBase, norm } from '../components/admin/ui';
import Notificacoes from '../components/Notificacoes';
import {
  CATEGORIAS_CHAMADO, PRIORIDADES, STATUS_CHAMADO, infoStatusChamado, infoPrioridade, rotuloCategoria, chamadoAberto,
  BUCKET_CHAMADOS, TIPOS_OS, tipoOsDaCategoria, quando, horasEntre,
} from '../lib/chamados';

const inputCls = `w-full px-3 py-2 ${inputBase}`;
const Badge = ({ info, children }) => <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${info.badge}`}>{children || info.curto || info.label}</span>;
const Campo = ({ label, children, className = '' }) => (
  <label className={`block space-y-1.5 ${className}`}><span className="text-sm text-gray-300">{label}</span>{children}</label>
);
function Modal({ titulo, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6 space-y-4 my-10" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white">{titulo}</h3>
        {children}
      </div>
    </div>
  );
}

async function enviarArquivos(chamadoId, files) {
  const out = [];
  for (const f of files) {
    const nome = f.name.replace(/[^\w.-]+/g, '_');
    const path = `${chamadoId}/${Date.now()}-${nome}`;
    const { error } = await supabase.storage.from(BUCKET_CHAMADOS).upload(path, f, { contentType: f.type || undefined });
    if (error) throw new Error(`Não consegui enviar ${f.name}: ${error.message}`);
    out.push({ path, nome: f.name, tipo: f.type || '' });
  }
  return out;
}

export default function Suporte() {
  const router = useRouter();
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 4000); }, []);

  const [chamados, setChamados] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [equipe, setEquipe] = useState([]);
  const [selId, setSelId] = useState(null);
  const [filtro, setFiltro] = useState('abertos');
  const [busca, setBusca] = useState('');
  const [novo, setNovo] = useState(false);

  const souEquipe = ehEquipe(perfil?.role);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/area-cliente'); return; }
      const { data: p } = await supabase.from('profiles').select('id, username, role, empresa_id').eq('id', session.user.id).single();
      if (p?.role === 'tecnico') { router.replace('/tecnico'); return; }
      setPerfil(p || { id: session.user.id, role: 'cliente' });
    })();
  }, [router]);

  const carregar = useCallback(async () => {
    if (!perfil) return;
    const [c, e, v, q] = await Promise.all([
      supabase.from('chamados').select('*').order('ultima_msg_em', { ascending: false }),
      supabase.from('empresas').select('id, nome').order('nome'),
      supabase.from('veiculos').select('id, empresa_id, placa, modelo, status').order('placa'),
      ehEquipe(perfil.role) ? supabase.from('profiles').select('id, username, role').in('role', ['admin', 'funcionario']) : Promise.resolve({ data: [] }),
    ]);
    if (c.error) setErro(/chamados/.test(c.error.message) ? 'Os chamados ainda não estão ligados. Rode o SQL 20261126i_chamados.sql no Supabase.' : c.error.message);
    else setErro('');
    setChamados(c.data || []);
    setEmpresas(e.data || []);
    setVeiculos(v.data || []);
    setEquipe(q.data || []);
    setCarregando(false);
  }, [perfil]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (router.query.c) setSelId(String(router.query.c)); }, [router.query.c]);
  // Atualiza a lista a cada 30 s
  useEffect(() => { const t = setInterval(carregar, 30000); return () => clearInterval(t); }, [carregar]);

  const empPorId = useMemo(() => Object.fromEntries(empresas.map(x => [String(x.id), x])), [empresas]);
  const veiPorId = useMemo(() => Object.fromEntries(veiculos.map(x => [String(x.id), x])), [veiculos]);
  const sel = chamados.find(c => c.id === selId) || null;

  const lista = chamados
    .filter(c => {
      if (filtro === 'abertos') return chamadoAberto(c.status);
      if (filtro === 'esperando') return chamadoAberto(c.status) && c.ultima_msg_de === 'CLIENTE' && c.status !== 'VIROU_OS';
      if (filtro === 'meus') return chamadoAberto(c.status) && c.responsavel_id === perfil?.id;
      if (filtro === 'fechados') return !chamadoAberto(c.status);
      return true;
    })
    .filter(c => !busca || norm(`#${c.numero} ${c.titulo} ${empPorId[String(c.empresa_id)]?.nome || ''} ${veiPorId[String(c.veiculo_id)]?.placa || ''}`).includes(norm(busca)))
    .sort((a, b) => {
      if (filtro !== 'fechados' && souEquipe) {
        const pa = PRIORIDADES.findIndex(p => p.value === a.prioridade);
        const pb = PRIORIDADES.findIndex(p => p.value === b.prioridade);
        if (pa !== pb) return pb - pa;
      }
      return String(b.ultima_msg_em).localeCompare(String(a.ultima_msg_em));
    });

  const resumo = useMemo(() => {
    const abertos = chamados.filter(c => chamadoAberto(c.status));
    const trinta = Date.now() - 30 * 86400000;
    const resp = chamados.filter(c => c.primeira_resposta_em && new Date(c.created_at).getTime() > trinta && !c.aberto_pela_equipe)
      .map(c => horasEntre(c.created_at, c.primeira_resposta_em));
    const notas = chamados.filter(c => c.avaliacao).map(c => c.avaliacao);
    return {
      abertos: abertos.length,
      altos: abertos.filter(c => ['ALTA', 'URGENTE'].includes(c.prioridade)).length,
      semResposta: abertos.filter(c => !c.primeira_resposta_em && !c.aberto_pela_equipe).length,
      tempoResp: resp.length ? resp.reduce((s, x) => s + x, 0) / resp.length : null,
      nota: notas.length ? notas.reduce((s, x) => s + x, 0) / notas.length : null,
    };
  }, [chamados]);

  if (!perfil) return <div className="min-h-screen bg-black flex items-center justify-center"><FaSpinner className="animate-spin text-3xl text-blue-500" /></div>;

  const abrir = (id) => { setSelId(id); router.replace({ pathname: '/suporte', query: id ? { c: id } : {} }, undefined, { shallow: true }); };

  return (
    <>
      <Head><title>Suporte | Full Vision</title></Head>
      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold ${toast.type === 'success' ? 'bg-emerald-950 border-emerald-500/40 text-emerald-400' : 'bg-red-950 border-red-500/40 text-red-400'}`}>
          {toast.type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />} {toast.message}
        </div>
      )}
      <div className="min-h-screen bg-black text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3"><FaHeadset className="text-blue-400" /> Suporte</h1>
              <p className="text-gray-400 text-sm mt-1">{souEquipe ? 'Chamados dos clientes: responda, acompanhe e transforme em OS quando precisar de visita' : 'Abra um chamado e acompanhe a resposta da nossa equipe'}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setNovo(true)} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-lg text-sm font-semibold"><FaPlus size={11} /> Novo chamado</button>
              <a href={souEquipe ? '/painel-admin' : '/area-cliente'} className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2"><FaArrowLeft size={12} /> {souEquipe ? 'Painel administrativo' : 'Área do cliente'}</a>
              <Notificacoes />
            </div>
          </div>

          {erro && <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3"><FaExclamationCircle className="mt-0.5 shrink-0" /> {erro}</div>}

          {souEquipe && !carregando && (
            <StatStrip
              colsClass="grid-cols-2 lg:grid-cols-5" spanLast
              items={[
                { label: 'Chamados abertos', value: resumo.abertos },
                { label: 'Alta / urgente', value: resumo.altos, valueClass: resumo.altos ? 'text-red-300' : 'text-white' },
                { label: 'Sem nenhuma resposta', value: resumo.semResposta, valueClass: resumo.semResposta ? 'text-amber-300' : 'text-white' },
                { label: '1ª resposta (média 30 dias)', value: resumo.tempoResp == null ? '—' : resumo.tempoResp < 1 ? `${Math.round(resumo.tempoResp * 60)} min` : `${resumo.tempoResp.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h` },
                { label: 'Nota dos clientes', value: resumo.nota == null ? '—' : `${resumo.nota.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ★` },
              ]}
            />
          )}

          {carregando ? (
            <div className="flex items-center justify-center py-24 text-gray-500"><FaSpinner className="animate-spin text-2xl mr-3" /> Carregando...</div>
          ) : (
            <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
              {/* Lista */}
              <div className={`space-y-3 ${sel ? 'hidden lg:block' : ''}`}>
                <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-gray-950 border border-gray-800">
                  {[['abertos', 'Abertos'], ...(souEquipe ? [['esperando', 'Esperando equipe'], ['meus', 'Comigo']] : []), ['fechados', 'Resolvidos'], ['todos', 'Todos']].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setFiltro(k)} className={`px-3 py-1.5 rounded-lg text-sm ${filtro === k ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}>{l}</button>
                  ))}
                </div>
                <SearchInput value={busca} onChange={setBusca} placeholder={souEquipe ? 'Buscar nº, assunto, cliente ou placa' : 'Buscar'} />
                <div className="space-y-2">
                  {lista.length === 0 && <p className="text-sm text-gray-500 py-8 text-center">Nenhum chamado aqui.</p>}
                  {lista.map(c => {
                    const esperando = souEquipe ? c.ultima_msg_de === 'CLIENTE' : c.ultima_msg_de === 'EQUIPE';
                    return (
                      <button key={c.id} type="button" onClick={() => abrir(c.id)}
                        className={`w-full text-left rounded-xl border p-3 transition-colors ${c.id === selId ? 'border-blue-500/60 bg-blue-950/30' : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-500">#{c.numero}{souEquipe ? ` · ${empPorId[String(c.empresa_id)]?.nome || ''}` : ''}</span>
                          <span className="text-xs text-gray-500">{quando(c.ultima_msg_em)}</span>
                        </div>
                        <div className="text-sm text-white font-medium mt-0.5 flex items-center gap-2">
                          {esperando && chamadoAberto(c.status) && <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" title={souEquipe ? 'Cliente aguardando resposta' : 'Resposta nova da equipe'} />}
                          <span className="truncate">{c.titulo}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <Badge info={infoStatusChamado(c.status)} />
                          {souEquipe && c.prioridade !== 'NORMAL' && <Badge info={infoPrioridade(c.prioridade)} />}
                          {c.veiculo_id && <span className="text-xs text-gray-400">{veiPorId[String(c.veiculo_id)]?.placa}</span>}
                          {souEquipe && c.responsavel_nome && <span className="text-xs text-gray-500">· {c.responsavel_nome}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Detalhe */}
              <div className={sel ? '' : 'hidden lg:block'}>
                {sel ? (
                  <Detalhe
                    key={sel.id} chamado={sel} souEquipe={souEquipe} perfil={perfil} empresa={empPorId[String(sel.empresa_id)]}
                    veiculo={veiPorId[String(sel.veiculo_id)]} veiculos={veiculos} equipe={equipe}
                    showToast={showToast} onVoltar={() => abrir(null)} onMudou={carregar}
                  />
                ) : (
                  <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-10 text-center text-gray-500">
                    Escolha um chamado na lista{souEquipe ? '' : ' ou abra um novo'}.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {novo && (
        <NovoChamado
          souEquipe={souEquipe} perfil={perfil} empresas={empresas} veiculos={veiculos} showToast={showToast}
          onClose={() => setNovo(false)} onCriado={(c) => { setNovo(false); carregar().then(() => abrir(c.id)); }}
        />
      )}
    </>
  );
}

// =====================================================================
function NovoChamado({ souEquipe, perfil, empresas, veiculos, showToast, onClose, onCriado }) {
  const [f, setF] = useState({ empresa_id: souEquipe ? '' : String(perfil.empresa_id || ''), veiculo_id: '', categoria: 'SEM_SINAL', prioridade: 'NORMAL', titulo: '', descricao: '' });
  const [arquivos, setArquivos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const placas = veiculos.filter(v => String(v.empresa_id) === f.empresa_id);
  const prioridades = souEquipe ? PRIORIDADES : PRIORIDADES.filter(p => p.value !== 'URGENTE');

  const salvar = async () => {
    if (!f.empresa_id) return showToast(souEquipe ? 'Escolha o cliente.' : 'Sua conta não está ligada a uma empresa. Fale com a Full Vision.', 'error');
    if (!f.titulo.trim()) return showToast('Escreva o assunto.', 'error');
    setSalvando(true);
    const { data, error } = await supabase.from('chamados').insert({
      empresa_id: f.empresa_id, veiculo_id: f.veiculo_id || null, categoria: f.categoria, prioridade: f.prioridade,
      titulo: f.titulo.trim(), descricao: f.descricao.trim() || null,
    }).select('*').single();
    if (error) { setSalvando(false); return showToast(error.message, 'error'); }
    if (arquivos.length) {
      try {
        const anexos = await enviarArquivos(data.id, arquivos);
        await supabase.from('chamado_mensagens').insert({ chamado_id: data.id, texto: `Enviou ${anexos.length} arquivo(s).`, anexos });
      } catch (e) { showToast(e.message, 'error'); }
    }
    setSalvando(false);
    showToast(`Chamado #${data.numero} aberto.`);
    onCriado(data);
    return null;
  };

  return (
    <Modal titulo="Novo chamado" onClose={onClose}>
      {souEquipe && (
        <Campo label="Cliente">
          <select value={f.empresa_id} onChange={e => { set('empresa_id', e.target.value); set('veiculo_id', ''); }} className={inputCls}>
            <option value="">Escolha...</option>
            {empresas.map(e => <option key={e.id} value={String(e.id)}>{e.nome}</option>)}
          </select>
        </Campo>
      )}
      <Campo label="Assunto">
        <select value={f.categoria} onChange={e => set('categoria', e.target.value)} className={inputCls}>
          {CATEGORIAS_CHAMADO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Placa (se for de um veículo)">
          <select value={f.veiculo_id} onChange={e => set('veiculo_id', e.target.value)} className={inputCls}>
            <option value="">Nenhuma / várias</option>
            {placas.map(v => <option key={v.id} value={String(v.id)}>{v.placa}{v.modelo ? ` · ${v.modelo}` : ''}</option>)}
          </select>
        </Campo>
        <Campo label="Prioridade">
          <select value={f.prioridade} onChange={e => set('prioridade', e.target.value)} className={inputCls}>
            {prioridades.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Campo>
      </div>
      <Campo label="Resumo do problema"><input value={f.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex.: Caminhão ABC1D23 sem posição desde ontem" className={inputCls} /></Campo>
      <Campo label="Detalhes"><textarea rows={4} value={f.descricao} onChange={e => set('descricao', e.target.value)} placeholder="O que aconteceu, desde quando, onde o veículo está..." className={inputCls} /></Campo>
      <label className="inline-flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <FaPaperclip /> {arquivos.length ? `${arquivos.length} arquivo(s)` : 'Anexar fotos ou prints'}
        <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={e => setArquivos([...e.target.files])} />
      </label>
      <div className="flex gap-3 pt-2">
        <button type="button" disabled={salvando} onClick={salvar} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
          {salvando && <FaSpinner className="animate-spin" />} Abrir chamado
        </button>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
      </div>
    </Modal>
  );
}

// =====================================================================
function Detalhe({ chamado: c, souEquipe, perfil, empresa, veiculo, veiculos, equipe, showToast, onVoltar, onMudou }) {
  const [msgs, setMsgs] = useState([]);
  const [urls, setUrls] = useState({});
  const [texto, setTexto] = useState('');
  const [interno, setInterno] = useState(false);
  const [arquivos, setArquivos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [virarOs, setVirarOs] = useState(false);
  const [fechar, setFechar] = useState(false);
  const fim = useRef(null);

  const carregarMsgs = useCallback(async () => {
    const { data } = await supabase.from('chamado_mensagens').select('*').eq('chamado_id', c.id).order('created_at');
    setMsgs(data || []);
    const paths = (data || []).flatMap(m => (m.anexos || []).map(a => a.path));
    if (paths.length) {
      const { data: s } = await supabase.storage.from(BUCKET_CHAMADOS).createSignedUrls(paths, 3600);
      setUrls(Object.fromEntries((s || []).filter(x => x.signedUrl).map(x => [x.path, x.signedUrl])));
    }
  }, [c.id]);
  useEffect(() => { carregarMsgs(); const t = setInterval(carregarMsgs, 20000); return () => clearInterval(t); }, [carregarMsgs]);
  useEffect(() => { fim.current?.scrollIntoView({ block: 'nearest' }); }, [msgs.length]);

  const enviar = async () => {
    if (!texto.trim() && !arquivos.length) return;
    setEnviando(true);
    try {
      const anexos = arquivos.length ? await enviarArquivos(c.id, arquivos) : [];
      const { error } = await supabase.from('chamado_mensagens').insert({ chamado_id: c.id, texto: texto.trim() || `Enviou ${anexos.length} arquivo(s).`, interno: souEquipe && interno, anexos });
      if (error) throw new Error(error.message);
      setTexto(''); setArquivos([]); setInterno(false);
      await carregarMsgs();
      onMudou();
    } catch (e) { showToast(e.message, 'error'); }
    setEnviando(false);
  };

  const mudar = async (campos) => {
    const { error } = await supabase.from('chamados').update(campos).eq('id', c.id);
    if (error) showToast(error.message, 'error'); else onMudou();
  };
  const acaoCliente = async (acao, nota, comentario) => {
    const { error } = await supabase.rpc('fv_chamado_cliente_acao', { p_chamado: c.id, p_acao: acao, p_nota: nota ?? null, p_comentario: comentario ?? null });
    if (error) showToast(error.message, 'error'); else { showToast(acao === 'REABRIR' ? 'Chamado reaberto.' : 'Obrigado! Chamado fechado.'); onMudou(); }
  };

  const st = infoStatusChamado(c.status);
  const aberto = chamadoAberto(c.status);

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-800 space-y-2">
        <button type="button" onClick={onVoltar} className="lg:hidden text-sm text-gray-400 hover:text-white inline-flex items-center gap-1.5"><FaArrowLeft size={11} /> Voltar</button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-gray-500">#{c.numero} · {rotuloCategoria(c.categoria)} · aberto {quando(c.created_at)} por {c.aberto_por_nome}{c.aberto_pela_equipe ? ' (equipe)' : ''}</div>
            <h2 className="text-lg font-semibold text-white">{c.titulo}</h2>
            <div className="text-sm text-gray-400">{souEquipe && empresa ? `${empresa.nome} · ` : ''}{veiculo ? `Placa ${veiculo.placa}` : 'Sem placa'}</div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5"><Badge info={st} />{(souEquipe || c.prioridade !== 'NORMAL') && <Badge info={infoPrioridade(c.prioridade)} />}</div>
        </div>
        {c.descricao && <p className="text-sm text-gray-300 whitespace-pre-wrap">{c.descricao}</p>}
        {c.os_id && (
          <p className="text-sm text-cyan-300 inline-flex items-center gap-2"><FaTools size={12} /> Virou OS (visita técnica){souEquipe ? <a href="/painel-admin" className="underline text-cyan-200">ver no painel</a> : null}</p>
        )}

        {souEquipe && (
          <div className="grid sm:grid-cols-3 gap-2 pt-2">
            <select value={c.status} onChange={e => mudar({ status: e.target.value })} className={`${inputCls} text-xs`} aria-label="Situação">
              {STATUS_CHAMADO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={c.prioridade} onChange={e => mudar({ prioridade: e.target.value })} className={`${inputCls} text-xs`} aria-label="Prioridade">
              {PRIORIDADES.map(p => <option key={p.value} value={p.value}>Prioridade: {p.curto || p.label}</option>)}
            </select>
            <select value={c.responsavel_id || ''} onChange={e => mudar({ responsavel_id: e.target.value || null })} className={`${inputCls} text-xs`} aria-label="Responsável">
              <option value="">Sem responsável</option>
              {equipe.map(u => <option key={u.id} value={u.id}>{u.username}{u.id === perfil.id ? ' (eu)' : ''}</option>)}
            </select>
            {!c.os_id && aberto && (
              <button type="button" onClick={() => setVirarOs(true)} className="sm:col-span-3 inline-flex items-center justify-center gap-2 border border-cyan-500/40 text-cyan-300 hover:text-white rounded-lg px-3 py-2 text-sm">
                <FaTools size={12} /> Precisa de visita: virar OS
              </button>
            )}
          </div>
        )}
      </div>

      {/* Conversa */}
      <div className="p-4 sm:p-5 space-y-3 max-h-[55vh] overflow-y-auto">
        {msgs.length === 0 && <p className="text-sm text-gray-500 text-center py-6">{souEquipe ? 'Ainda sem respostas. Escreva para o cliente abaixo.' : 'Recebemos seu chamado. A equipe responde por aqui.'}</p>}
        {msgs.map(m => {
          const minha = m.autor_id === perfil.id;
          const sistema = m.autor_tipo === 'SISTEMA';
          return (
            <div key={m.id} className={`flex ${sistema ? 'justify-center' : minha ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${sistema ? 'bg-gray-800/60 text-gray-300 text-center' : m.interno ? 'bg-amber-950/50 border border-amber-500/30 text-amber-100' : minha ? 'bg-blue-600/80 text-white' : 'bg-gray-800 text-gray-100'}`}>
                {!sistema && (
                  <div className={`text-[11px] mb-0.5 ${minha ? 'text-blue-100/80' : 'text-gray-400'}`}>
                    {m.interno && <FaLock className="inline mr-1" size={9} />}{m.autor_nome}{m.autor_tipo === 'EQUIPE' && !souEquipe ? ' · Full Vision' : ''} · {quando(m.created_at)}{m.interno ? ' · nota interna' : ''}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.texto}</div>
                {(m.anexos || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {m.anexos.map(a => (
                      String(a.tipo).startsWith('image/') && urls[a.path]
                        ? <a key={a.path} href={urls[a.path]} target="_blank" rel="noreferrer"><img src={urls[a.path]} alt={a.nome} className="h-24 w-24 object-cover rounded-lg border border-white/10" /></a>
                        : <a key={a.path} href={urls[a.path] || '#'} target="_blank" rel="noreferrer" className="text-xs underline inline-flex items-center gap-1"><FaPaperclip size={10} /> {a.nome}</a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={fim} />
      </div>

      {/* Responder / fechar */}
      <div className="p-4 sm:p-5 border-t border-gray-800 space-y-3">
        {!souEquipe && c.status === 'RESOLVIDO' && (
          <div className="flex flex-wrap items-center gap-2 text-sm bg-emerald-950/40 border border-emerald-500/30 rounded-xl px-4 py-3">
            <span className="text-emerald-200 flex-1">A equipe marcou como resolvido. Deu certo?</span>
            <button type="button" onClick={() => setFechar(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-3 py-1.5 font-semibold">Sim, fechar</button>
            <button type="button" onClick={() => acaoCliente('REABRIR')} className="border border-gray-600 text-gray-200 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5"><FaRedoAlt size={10} /> Ainda não</button>
          </div>
        )}
        {!souEquipe && c.status === 'FECHADO' && (
          <div className="text-sm text-gray-400">
            Chamado fechado{c.avaliacao ? ` · sua nota: ${'★'.repeat(c.avaliacao)}` : ''}.{' '}
            <button type="button" onClick={() => acaoCliente('REABRIR')} className="text-blue-300 hover:text-white underline">Reabrir</button>
          </div>
        )}
        {(souEquipe || c.status !== 'FECHADO') && (
          <>
            <textarea rows={3} value={texto} onChange={e => setTexto(e.target.value)} placeholder={souEquipe ? (interno ? 'Nota interna (o cliente não vê)' : 'Responder ao cliente') : 'Escreva sua mensagem'}
              className={`${inputCls} ${interno ? 'border-amber-500/50' : ''}`}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar(); }} />
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white cursor-pointer">
                <FaPaperclip /> {arquivos.length ? `${arquivos.length} arquivo(s)` : 'Anexar'}
                <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={e => setArquivos([...e.target.files])} />
              </label>
              {arquivos.length > 0 && <button type="button" onClick={() => setArquivos([])} className="text-gray-500 hover:text-white"><FaTimes size={11} /></button>}
              {souEquipe && (
                <label className="inline-flex items-center gap-2 text-sm text-amber-300/90"><input type="checkbox" checked={interno} onChange={e => setInterno(e.target.checked)} /> Nota interna</label>
              )}
              {souEquipe && aberto && c.status !== 'AGUARDANDO_CLIENTE' && (
                <button type="button" onClick={() => mudar({ status: 'AGUARDANDO_CLIENTE' })} className="text-xs text-gray-400 hover:text-white">Marcar "aguardando cliente"</button>
              )}
              {souEquipe && aberto && (
                <button type="button" onClick={() => mudar({ status: 'RESOLVIDO' })} className="text-xs text-emerald-300 hover:text-white">Marcar resolvido</button>
              )}
              <button type="button" disabled={enviando || (!texto.trim() && !arquivos.length)} onClick={enviar}
                className="ml-auto bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
                {enviando ? <FaSpinner className="animate-spin" /> : <FaPaperPlane size={12} />} Enviar
              </button>
            </div>
          </>
        )}
      </div>

      {virarOs && (
        <VirarOs chamado={c} empresa={empresa} veiculo={veiculo} veiculos={veiculos} showToast={showToast}
          onClose={() => setVirarOs(false)} onFeito={() => { setVirarOs(false); carregarMsgs(); onMudou(); }} />
      )}
      {fechar && <Avaliar onClose={() => setFechar(false)} onConfirm={(n, t) => { setFechar(false); acaoCliente('FECHAR', n, t); }} />}
    </div>
  );
}

function Avaliar({ onClose, onConfirm }) {
  const [nota, setNota] = useState(5);
  const [txt, setTxt] = useState('');
  return (
    <Modal titulo="Como foi o atendimento?" onClose={onClose}>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => setNota(n)} aria-label={`${n} estrelas`} className={n <= nota ? 'text-amber-400' : 'text-gray-600'}><FaStar size={28} /></button>
        ))}
      </div>
      <textarea rows={3} value={txt} onChange={e => setTxt(e.target.value)} placeholder="Quer deixar um comentário? (opcional)" className={inputCls} />
      <div className="flex gap-3">
        <button type="button" onClick={() => onConfirm(nota, txt)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Fechar chamado</button>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2">Voltar</button>
      </div>
    </Modal>
  );
}

function VirarOs({ chamado: c, empresa, veiculo, veiculos, showToast, onClose, onFeito }) {
  const [tecnicos, setTecnicos] = useState([]);
  const [f, setF] = useState({
    tipo: tipoOsDaCategoria(c.categoria), veiculoId: c.veiculo_id ? String(c.veiculo_id) : '', placaNova: '', telefone: '', endereco: '', dataHora: '', tecnicoId: '',
    descricao: `Chamado #${c.numero}: ${c.titulo}${c.descricao ? `\n${c.descricao}` : ''}`,
  });
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  useEffect(() => { carregarTecnicos(supabase).then(setTecnicos); }, []);
  const placas = veiculos.filter(v => String(v.empresa_id) === String(c.empresa_id));

  const salvar = async () => {
    if (f.tipo !== 'nova_instalacao' && !f.veiculoId) return showToast('Escolha a placa.', 'error');
    if (f.tipo === 'nova_instalacao' && !f.placaNova.trim()) return showToast('Informe a placa nova.', 'error');
    setSalvando(true);
    try {
      const tecnico = tecnicos.find(t => String(t.id) === f.tecnicoId) || null;
      const { os, solicitacao, erroOS } = await criarSolicitacaoComOS(supabase, {
        empresaId: c.empresa_id, tipo: f.tipo, veiculoId: f.veiculoId || null, placaNova: f.placaNova, descricao: f.descricao,
        endereco: f.endereco, telefone: f.telefone, dataHora: f.dataHora, tecnico,
      });
      if (erroOS) throw new Error(`A solicitação foi criada, mas a OS deu erro: ${erroOS}`);
      const { error } = await supabase.from('chamados').update({ os_id: os?.id || null, solicitacao_id: solicitacao?.id || null, status: 'VIROU_OS' }).eq('id', c.id);
      if (error) throw new Error(error.message);
      const quandoTxt = f.dataHora ? new Date(f.dataHora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'em data a combinar';
      await supabase.from('chamado_mensagens').insert({
        chamado_id: c.id, autor_tipo: 'SISTEMA', autor_nome: 'Sistema',
        texto: `Vamos resolver com uma visita técnica (${TIPOS_OS.find(t => t.value === f.tipo)?.label.toLowerCase()}), ${quandoTxt}${tecnico ? `, com o técnico ${tecnico.nome}` : ''}. Quando a OS for finalizada, este chamado é resolvido sozinho.`,
      });
      showToast('OS criada a partir do chamado.');
      onFeito();
    } catch (e) { showToast(e.message, 'error'); }
    setSalvando(false);
    return null;
  };

  return (
    <Modal titulo={`Virar OS: chamado #${c.numero}`} onClose={onClose}>
      <p className="text-sm text-gray-400">{empresa?.nome}{veiculo ? ` · ${veiculo.placa}` : ''}. Cria a solicitação de serviço e a pré-OS, iguais às do painel.</p>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Tipo de serviço">
          <select value={f.tipo} onChange={e => set('tipo', e.target.value)} className={inputCls}>{TIPOS_OS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        </Campo>
        {f.tipo === 'nova_instalacao' ? (
          <Campo label="Placa nova"><input value={f.placaNova} onChange={e => set('placaNova', e.target.value.toUpperCase())} className={inputCls} /></Campo>
        ) : (
          <Campo label="Placa">
            <select value={f.veiculoId} onChange={e => set('veiculoId', e.target.value)} className={inputCls}>
              <option value="">Escolha...</option>
              {placas.map(v => <option key={v.id} value={String(v.id)}>{v.placa}</option>)}
            </select>
          </Campo>
        )}
        <Campo label="Data e hora da visita"><input type="datetime-local" value={f.dataHora} onChange={e => set('dataHora', e.target.value)} className={inputCls} /></Campo>
        <Campo label="Técnico">
          <select value={f.tecnicoId} onChange={e => set('tecnicoId', e.target.value)} className={inputCls}>
            <option value="">Escolher depois</option>
            {tecnicos.map(t => <option key={t.id} value={String(t.id)}>{t.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Telefone no local"><input value={f.telefone} onChange={e => set('telefone', e.target.value)} className={inputCls} /></Campo>
        <Campo label="Endereço"><input value={f.endereco} onChange={e => set('endereco', e.target.value)} className={inputCls} /></Campo>
      </div>
      <Campo label="Descrição para o técnico"><textarea rows={4} value={f.descricao} onChange={e => set('descricao', e.target.value)} className={inputCls} /></Campo>
      <div className="flex gap-3 pt-2">
        <button type="button" disabled={salvando} onClick={salvar} className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
          {salvando ? <FaSpinner className="animate-spin" /> : <FaTools size={12} />} Criar OS
        </button>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
      </div>
    </Modal>
  );
}
