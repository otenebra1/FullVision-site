import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { BRL, StatStrip } from '../../components/admin/ui';
import {
  FaHandshake, FaPlus, FaEdit, FaTrashAlt, FaSpinner, FaArrowLeft, FaTasks, FaChartPie,
  FaExclamationCircle, FaCheckCircle, FaTimes, FaCalendarAlt, FaSearch, FaChevronLeft,
  FaChevronRight, FaUserCircle, FaWhatsapp, FaEnvelope, FaPaperPlane, FaClock, FaLongArrowAltRight,
} from 'react-icons/fa';
import { Select, DateInput, Combobox } from '../../components/ui/FormControls';

// ==========================================
// Etapas do funil (a ordem aqui é a ordem das colunas)
// ==========================================
const STAGES = [
  { key: 'primeira_conversa', label: 'Primeira conversa', color: 'border-gray-600' },
  { key: 'a_marcar_reuniao', label: 'A marcar 1ª reunião', color: 'border-sky-500/50' },
  { key: 'reuniao_1', label: '1ª reunião', color: 'border-blue-500/50' },
  { key: 'reuniao_2', label: '2ª reunião', color: 'border-indigo-500/50' },
  { key: 'proposta_enviada', label: 'Proposta enviada', color: 'border-amber-500/50' },
  { key: 'negociacao', label: 'Em negociação', color: 'border-orange-500/50' },
  { key: 'fechado', label: 'Fechado', color: 'border-emerald-500/50', done: true },
  { key: 'perdido', label: 'Perdido', color: 'border-red-500/50', done: true },
];
const stageLabel = (key) => STAGES.find(s => s.key === key)?.label || key;
const isDone = (key) => Boolean(STAGES.find(s => s.key === key)?.done);
const OPEN_VALUE_STAGES = ['proposta_enviada', 'negociacao'];
const ORIGENS = ['Indicação', 'Site', 'LinkedIn', 'Prospecção ativa', 'Evento', 'WhatsApp'];
const STALLED_DAYS = 14;

const PROSPECT_SELECT = '*, responsavel:profiles!prospects_responsavel_fkey(id, username)';

const EMPTY_FORM = {
  empresa: '', contato: '', telefone: '', email: '', origem: '', frota_estimada: '', mensalidade_estimada: '',
  etapa: 'primeira_conversa', reuniao_em: '', proxima_acao: '', proxima_acao_data: '', observacoes: '',
  motivo_perda: '', responsavel_id: '',
};

// ==========================================
// Datas e regras de "o que precisa da minha atenção"
// ==========================================
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fmtReuniao = (iso) => {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dia} ${hora}`;
};

const fmtDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');

function attentionReasons(p) {
  if (isDone(p.etapa)) return [];
  const reasons = [];
  const hoje = startOfToday();
  if (p.proxima_acao_data && new Date(`${p.proxima_acao_data}T00:00:00`) < hoje) reasons.push('Próximo passo atrasado');
  if (p.reuniao_em && new Date(p.reuniao_em) < new Date()) reasons.push('Reunião já passou: atualize a etapa');
  if (!p.reuniao_em && !p.proxima_acao_data) reasons.push('Sem próximo passo definido');
  const parado = daysSince(p.etapa_atualizada_em);
  if (parado >= STALLED_DAYS) reasons.push(`Parado há ${parado} dias`);
  return reasons;
}

function whatsappLink(telefone) {
  const digits = (telefone || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

const compareCards = (a, b) => {
  const ra = a.reuniao_em || '9999';
  const rb = b.reuniao_em || '9999';
  if (ra !== rb) return ra.localeCompare(rb);
  const pa = a.proxima_acao_data || '9999';
  const pb = b.proxima_acao_data || '9999';
  if (pa !== pb) return pa.localeCompare(pb);
  return (b.created_at || '').localeCompare(a.created_at || '');
};

const inputCls = 'w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500';

// ==========================================
// Card de um cliente dentro da coluna
// ==========================================
function ProspectCard({ p, stageIndex, onOpen, onMove, onDragStart, onDragEnd, dragging }) {
  const reasons = attentionReasons(p);
  const wa = whatsappLink(p.telefone);
  const acaoAtrasada = p.proxima_acao_data && !isDone(p.etapa) && new Date(`${p.proxima_acao_data}T00:00:00`) < startOfToday();
  const reuniaoPassou = p.reuniao_em && !isDone(p.etapa) && new Date(p.reuniao_em) < new Date();

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; onDragStart(p.id); }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(p)}
      className={`bg-gray-950 border rounded-xl p-4 space-y-3 cursor-pointer hover:border-purple-500/50 transition-all group ${dragging ? 'opacity-40' : ''} ${reasons.length > 0 ? 'border-amber-500/30' : 'border-gray-800'}`}
    >
      <div>
        <h3 className="text-sm font-semibold text-gray-100 leading-snug">{p.empresa}</h3>
        {p.contato && <p className="text-xs text-gray-500 mt-0.5">{p.contato}</p>}
      </div>

      {(p.reuniao_em || p.proxima_acao) && (
        <div className="space-y-1.5 text-xs">
          {p.reuniao_em && (
            <div className={`flex items-center gap-1.5 ${reuniaoPassou ? 'text-amber-400' : 'text-purple-300'}`}>
              <FaCalendarAlt className="shrink-0" /> <span className="tabular-nums">{fmtReuniao(p.reuniao_em)}</span>
            </div>
          )}
          {p.proxima_acao && (
            <div className={`flex items-start gap-1.5 ${acaoAtrasada ? 'text-red-400' : 'text-gray-400'}`}>
              <FaLongArrowAltRight className="shrink-0 mt-0.5" />
              <span>{p.proxima_acao}{p.proxima_acao_data ? ` (${fmtDate(p.proxima_acao_data)})` : ''}</span>
            </div>
          )}
        </div>
      )}

      {reasons.length > 0 && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-400">
          <FaExclamationCircle className="shrink-0 mt-0.5" /> <span>{reasons[0]}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-800/80">
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
          <FaUserCircle className="text-gray-600 shrink-0" /> <span className="truncate">{p.responsavel?.username || 'Sem responsável'}</span>
        </span>
        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
          {wa && <a href={wa} target="_blank" rel="noreferrer" title="Abrir WhatsApp" className="p-1.5 text-gray-500 hover:text-emerald-400"><FaWhatsapp size={13} /></a>}
          <button disabled={stageIndex === 0} onClick={() => onMove(p, STAGES[stageIndex - 1].key)} title="Mover para a etapa anterior" className="p-1.5 text-gray-500 hover:text-white disabled:opacity-20 disabled:pointer-events-none"><FaChevronLeft size={11} /></button>
          <button disabled={stageIndex === STAGES.length - 1} onClick={() => onMove(p, STAGES[stageIndex + 1].key)} title="Mover para a próxima etapa" className="p-1.5 text-gray-500 hover:text-white disabled:opacity-20 disabled:pointer-events-none"><FaChevronRight size={11} /></button>
        </div>
      </div>
    </div>
  );
}

export default function NovosClientes() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 4000); };
  const [confirmDialog, setConfirmDialog] = useState(null);
  const askConfirm = (message, onConfirm) => setConfirmDialog({ message, onConfirm });

  const [isLoading, setIsLoading] = useState(true);
  const [prospects, setProspects] = useState([]);
  const [admins, setAdmins] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterResp, setFilterResp] = useState('all');
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const [viewing, setViewing] = useState(null);
  const [notes, setNotes] = useState([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  const [draggingId, setDraggingId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  // Acesso: só admin
  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/area-cliente'); return; }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'funcionario') { router.replace('/area-cliente'); return; }
      setCurrentUser(profile);
      setIsAuthorized(true);
      setAuthChecked(true);
    };
    checkAccess();
  }, [router]);

  const fetchData = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('prospects').select(PROSPECT_SELECT).order('created_at', { ascending: false });
    if (!error && data) setProspects(data);
    else if (error) showToast('Erro ao carregar clientes: ' + error.message, 'error');
    const { data: adminsData } = await supabase.from('profiles').select('id, username').in('role', ['admin', 'funcionario']).order('username');
    if (adminsData) setAdmins(adminsData);
    setIsLoading(false);
  };
  useEffect(() => { if (isAuthorized) fetchData(); }, [isAuthorized]);

  // ------------------------------------------
  // Histórico (anotações + mudanças de etapa)
  // ------------------------------------------
  const addNote = async (prospectId, text, kind = 'nota') => {
    const { data } = await supabase
      .from('prospect_notes')
      .insert([{ prospect_id: prospectId, author: currentUser.username, kind, text }])
      .select().single();
    return data;
  };

  const openDetail = async (p) => {
    setViewing(p);
    setNotes([]);
    setIsLoadingNotes(true);
    const { data } = await supabase.from('prospect_notes').select('*').eq('prospect_id', p.id).order('created_at', { ascending: false });
    setNotes(data || []);
    setIsLoadingNotes(false);
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !viewing) return;
    setIsSubmittingNote(true);
    const note = await addNote(viewing.id, newNote.trim());
    setIsSubmittingNote(false);
    if (!note) { showToast('Erro ao salvar a anotação.', 'error'); return; }
    setNotes(prev => [note, ...prev]);
    setNewNote('');
  };

  const handleDeleteNote = async (id) => {
    const { error } = await supabase.from('prospect_notes').delete().eq('id', id);
    if (error) { showToast('Erro ao excluir a anotação.', 'error'); return; }
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  // ------------------------------------------
  // Mover de etapa (setas, arrastar ou menu)
  // ------------------------------------------
  const moveTo = async (p, etapa) => {
    if (p.etapa === etapa) return;
    const now = new Date().toISOString();
    const previous = prospects;
    setProspects(prev => prev.map(x => x.id === p.id ? { ...x, etapa, etapa_atualizada_em: now } : x));
    if (viewing?.id === p.id) setViewing(v => ({ ...v, etapa, etapa_atualizada_em: now }));

    const { data, error } = await supabase
      .from('prospects')
      .update({ etapa, etapa_atualizada_em: now, updated_at: now })
      .eq('id', p.id)
      .select(PROSPECT_SELECT)
      .single();
    if (error) {
      setProspects(previous);
      if (viewing?.id === p.id) setViewing(p);
      showToast('Erro ao mover cliente: ' + error.message, 'error');
      return;
    }
    setProspects(prev => prev.map(x => x.id === data.id ? data : x));
    const note = await addNote(p.id, `Etapa: ${stageLabel(p.etapa)} → ${stageLabel(etapa)}`, 'etapa');
    if (note && viewing?.id === p.id) setNotes(prev => [note, ...prev]);
  };

  // ------------------------------------------
  // Criar / editar / excluir
  // ------------------------------------------
  const openNew = (etapa = 'primeira_conversa') => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, etapa, responsavel_id: currentUser?.id || '' });
    setIsModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      empresa: p.empresa || '', contato: p.contato || '', telefone: p.telefone || '', email: p.email || '',
      origem: p.origem || '', frota_estimada: p.frota_estimada ?? '', mensalidade_estimada: p.mensalidade_estimada ?? '',
      etapa: p.etapa, reuniao_em: toLocalInput(p.reuniao_em), proxima_acao: p.proxima_acao || '',
      proxima_acao_data: p.proxima_acao_data || '', observacoes: p.observacoes || '', motivo_perda: p.motivo_perda || '',
      responsavel_id: p.responsavel_id || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.empresa.trim()) { showToast('Informe o nome da empresa.', 'error'); return; }
    setIsSaving(true);

    const txt = (v) => (v && String(v).trim()) || null;
    const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
    const now = new Date().toISOString();
    const payload = {
      empresa: form.empresa.trim(),
      contato: txt(form.contato), telefone: txt(form.telefone), email: txt(form.email), origem: txt(form.origem),
      frota_estimada: form.frota_estimada === '' ? null : parseInt(form.frota_estimada, 10) || null,
      mensalidade_estimada: form.mensalidade_estimada === '' ? null : num(form.mensalidade_estimada),
      etapa: form.etapa,
      reuniao_em: form.reuniao_em ? new Date(form.reuniao_em).toISOString() : null,
      proxima_acao: txt(form.proxima_acao),
      proxima_acao_data: form.proxima_acao_data || null,
      observacoes: txt(form.observacoes),
      motivo_perda: form.etapa === 'perdido' ? txt(form.motivo_perda) : null,
      responsavel_id: form.responsavel_id || null,
      updated_at: now,
    };

    if (editing) {
      const etapaMudou = editing.etapa !== form.etapa;
      const { data, error } = await supabase
        .from('prospects')
        .update(etapaMudou ? { ...payload, etapa_atualizada_em: now } : payload)
        .eq('id', editing.id)
        .select(PROSPECT_SELECT)
        .single();
      setIsSaving(false);
      if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); return; }
      setProspects(prev => prev.map(x => x.id === data.id ? data : x));
      if (viewing?.id === data.id) setViewing(data);
      if (etapaMudou) {
        const note = await addNote(data.id, `Etapa: ${stageLabel(editing.etapa)} → ${stageLabel(form.etapa)}`, 'etapa');
        if (note && viewing?.id === data.id) setNotes(prev => [note, ...prev]);
      }
      showToast('Cliente atualizado!');
    } else {
      const { data, error } = await supabase
        .from('prospects')
        .insert([{ ...payload, etapa_atualizada_em: now, created_by: currentUser.id }])
        .select(PROSPECT_SELECT)
        .single();
      setIsSaving(false);
      if (error) { showToast('Erro ao criar: ' + error.message, 'error'); return; }
      setProspects(prev => [data, ...prev]);
      showToast('Cliente adicionado ao funil!');
    }
    setIsModalOpen(false);
    setEditing(null);
  };

  const handleDelete = (p) => {
    askConfirm(`Excluir "${p.empresa}" e todo o histórico? Essa ação não pode ser desfeita.`, async () => {
      const { error } = await supabase.from('prospects').delete().eq('id', p.id);
      if (error) { showToast('Erro ao excluir: ' + error.message, 'error'); return; }
      setProspects(prev => prev.filter(x => x.id !== p.id));
      if (viewing?.id === p.id) setViewing(null);
      showToast('Cliente excluído.');
    });
  };

  // ------------------------------------------
  // Dados derivados
  // ------------------------------------------
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return prospects.filter(p => {
      if (q && ![p.empresa, p.contato, p.proxima_acao, p.observacoes, p.origem].join(' ').toLowerCase().includes(q)) return false;
      if (filterResp !== 'all' && p.responsavel_id !== filterResp) return false;
      if (onlyAttention && attentionReasons(p).length === 0) return false;
      return true;
    });
  }, [prospects, searchTerm, filterResp, onlyAttention]);

  const visibleStages = useMemo(() => STAGES.filter(s => showClosed || !s.done), [showClosed]);

  const byStage = useMemo(() => {
    const map = {};
    STAGES.forEach(s => { map[s.key] = filtered.filter(p => p.etapa === s.key).sort(compareCards); });
    return map;
  }, [filtered]);

  const resumo = useMemo(() => {
    const ativos = prospects.filter(p => !isDone(p.etapa));
    const hoje = startOfToday();
    const limite = new Date(hoje); limite.setDate(limite.getDate() + 8);
    const reunioes = ativos.filter(p => p.reuniao_em && new Date(p.reuniao_em) >= hoje && new Date(p.reuniao_em) < limite);
    const emAberto = ativos.filter(p => OPEN_VALUE_STAGES.includes(p.etapa));
    return {
      ativos: ativos.length,
      reunioes: reunioes.length,
      atencao: ativos.filter(p => attentionReasons(p).length > 0).length,
      propostas: emAberto.length,
      valor: emAberto.reduce((s, p) => s + (Number(p.mensalidade_estimada) || 0), 0),
    };
  }, [prospects]);

  // Agenda dos próximos 7 dias (respeita o filtro de responsável)
  const agenda = useMemo(() => {
    const hoje = startOfToday();
    const limite = new Date(hoje); limite.setDate(limite.getDate() + 8);
    const lista = prospects
      .filter(p => !isDone(p.etapa) && p.reuniao_em && new Date(p.reuniao_em) >= hoje && new Date(p.reuniao_em) < limite)
      .filter(p => filterResp === 'all' || p.responsavel_id === filterResp)
      .sort((a, b) => a.reuniao_em.localeCompare(b.reuniao_em));
    const dias = new Map();
    lista.forEach(p => {
      const d = new Date(p.reuniao_em);
      const k = dayKey(d);
      if (!dias.has(k)) dias.set(k, { date: d, items: [] });
      dias.get(k).items.push(p);
    });
    const hojeKey = dayKey(hoje);
    const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
    return [...dias.entries()].map(([k, v]) => ({
      key: k,
      label: k === hojeKey ? 'Hoje' : k === dayKey(amanha) ? 'Amanhã'
        : v.date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }),
      items: v.items,
    }));
  }, [prospects, filterResp]);

  if (!authChecked) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><FaSpinner className="animate-spin text-3xl text-purple-500" /></div>;
  }
  if (!isAuthorized) return null;

  const viewingWa = viewing ? whatsappLink(viewing.telefone) : null;

  return (
    <>
      <Head><title>Novos clientes | Full Vision</title></Head>

      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold ${toast.type === 'success' ? 'bg-emerald-950 border-emerald-500/40 text-emerald-400' : 'bg-red-950 border-red-500/40 text-red-400'}`}>
          {toast.type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />} {toast.message}
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaExclamationCircle className="text-red-400" /> Confirmar ação</h3>
            <p className="text-sm text-gray-400">{confirmDialog.message}</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn(); }} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Confirmar</button>
              <button onClick={() => setConfirmDialog(null)} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-black text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Cabeçalho */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3"><FaHandshake className="text-purple-400" /> Novos clientes</h1>
              <p className="text-gray-400 text-sm mt-1">Funil de prospecção: em que etapa está cada cliente e qual é o próximo passo</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <a href="/quests" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-800 rounded-xl px-4 py-2"><FaTasks /> Agenda da equipe</a>
              <a href="/painel-admin" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-800 rounded-xl px-4 py-2"><FaArrowLeft /> Painel administrativo</a>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-gray-500"><FaSpinner className="animate-spin text-2xl mr-3" /> Carregando clientes...</div>
          ) : (
            <>
              <StatStrip
                colsClass="grid-cols-2 lg:grid-cols-5"
                spanLast
                items={[
                  { label: 'Em andamento', value: resumo.ativos },
                  { label: 'Reuniões nos próximos 7 dias', value: resumo.reunioes },
                  { label: 'Precisam de atenção', value: resumo.atencao, valueClass: resumo.atencao > 0 ? 'text-amber-400' : 'text-white' },
                  { label: 'Propostas e negociações', value: resumo.propostas },
                  { label: 'Mensalidade estimada em aberto', value: BRL(resumo.valor) },
                ]}
              />

              {/* Agenda da semana */}
              <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2"><FaClock className="text-purple-400" size={14} /> Reuniões dos próximos 7 dias</h2>
                {agenda.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma reunião marcada. Ao agendar, preencha “Próxima reunião” no cadastro do cliente e ela aparece aqui.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {agenda.map(dia => (
                      <div key={dia.key} className="space-y-2">
                        <div className="text-sm text-gray-400 first-letter:uppercase">{dia.label}</div>
                        {dia.items.map(p => (
                          <button key={p.id} type="button" onClick={() => openDetail(p)} className="w-full flex items-center gap-3 text-left bg-gray-950 border border-gray-800 hover:border-purple-500/50 rounded-xl px-3 py-2.5 transition-colors">
                            <span className="text-sm font-semibold text-purple-300 tabular-nums">{new Date(p.reuniao_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="min-w-0">
                              <span className="block text-sm text-white truncate">{p.empresa}</span>
                              <span className="block text-xs text-gray-500 truncate">{stageLabel(p.etapa)}{p.contato ? `, ${p.contato}` : ''}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Filtros + novo cliente */}
              <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-gray-900/70 border border-gray-800 rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 flex-wrap">
                  <div className="relative flex-1 max-w-xs">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                    <input type="text" placeholder="Pesquisar clientes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500" />
                  </div>
                  <Select value={filterResp} onChange={(e) => setFilterResp(e.target.value)} aria-label="Responsável" className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500">
                    <option value="all">Todos os responsáveis</option>
                    {admins.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
                  </Select>
                  <button type="button" onClick={() => setOnlyAttention(v => !v)} aria-pressed={onlyAttention} className={`px-3 py-2 rounded-lg border text-xs transition-colors ${onlyAttention ? 'border-amber-500/60 bg-amber-500/10 text-amber-300' : 'border-gray-700 bg-gray-950 text-gray-300 hover:border-gray-600'}`}>Precisam de atenção</button>
                  <button type="button" onClick={() => setShowClosed(v => !v)} aria-pressed={showClosed} className={`px-3 py-2 rounded-lg border text-xs transition-colors ${showClosed ? 'border-purple-500/60 bg-purple-500/10 text-purple-200' : 'border-gray-700 bg-gray-950 text-gray-300 hover:border-gray-600'}`}>Mostrar fechados e perdidos</button>
                </div>
                <button onClick={() => openNew()} className="inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-lg transition-all whitespace-nowrap"><FaPlus /> Novo cliente</button>
              </div>

              {/* Funil */}
              <div className="flex gap-4 overflow-x-auto pb-4 items-start">
                {visibleStages.map(stage => {
                  const idx = STAGES.findIndex(s => s.key === stage.key);
                  const cards = byStage[stage.key];
                  const valor = OPEN_VALUE_STAGES.includes(stage.key) ? cards.reduce((s, p) => s + (Number(p.mensalidade_estimada) || 0), 0) : 0;
                  return (
                    <div
                      key={stage.key}
                      onDragOver={(e) => { e.preventDefault(); if (dragOverStage !== stage.key) setDragOverStage(stage.key); }}
                      onDragLeave={() => setDragOverStage(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        const p = prospects.find(x => x.id === (e.dataTransfer.getData('text/plain') || draggingId));
                        setDragOverStage(null); setDraggingId(null);
                        if (p) moveTo(p, stage.key);
                      }}
                      className={`w-[290px] shrink-0 bg-gray-900/50 border-t-4 ${stage.color} border-x border-b rounded-2xl p-4 space-y-3 min-h-[200px] transition-colors ${dragOverStage === stage.key ? 'border-x-purple-500/60 border-b-purple-500/60 bg-purple-500/5' : 'border-x-gray-800 border-b-gray-800'}`}
                      data-stage={stage.key}
                    >
                      <div className="flex items-start justify-between gap-2 px-1">
                        <div>
                          <h2 className="text-sm font-bold text-gray-300">{stage.label}</h2>
                          {valor > 0 && <div className="text-xs text-gray-500 mt-0.5 tabular-nums">{BRL(valor)} / mês</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500 bg-gray-950 border border-gray-800 rounded-full px-2 py-0.5 tabular-nums">{cards.length}</span>
                          {!stage.done && <button type="button" onClick={() => openNew(stage.key)} title={`Novo cliente em “${stage.label}”`} aria-label={`Novo cliente em ${stage.label}`} className="text-gray-500 hover:text-purple-300 p-1"><FaPlus size={11} /></button>}
                        </div>
                      </div>
                      <div className="space-y-3">
                        {cards.length === 0 ? (
                          <div className="text-center text-xs text-gray-600 py-8">Nenhum cliente aqui.</div>
                        ) : cards.map(p => (
                          <ProspectCard key={p.id} p={p} stageIndex={idx} dragging={draggingId === p.id} onOpen={openDetail} onMove={moveTo} onDragStart={setDraggingId} onDragEnd={() => { setDraggingId(null); setDragOverStage(null); }} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Modal novo/editar */}
          {isModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-gray-900 border border-purple-500/30 rounded-2xl max-w-2xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaHandshake className="text-purple-400" /> {editing ? 'Editar cliente' : 'Novo cliente'}</h3>
                  <button onClick={() => setIsModalOpen(false)} aria-label="Fechar" className="text-gray-400 hover:text-white"><FaTimes /></button>
                </div>
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2"><label className="block text-xs text-gray-400 mb-1">Empresa</label><input type="text" required value={form.empresa} onChange={(e) => setField('empresa', e.target.value)} className={inputCls} /></div>
                    <div><label className="block text-xs text-gray-400 mb-1">Contato</label><input type="text" value={form.contato} onChange={(e) => setField('contato', e.target.value)} className={inputCls} /></div>
                    <div><label className="block text-xs text-gray-400 mb-1">Telefone / WhatsApp</label><input type="text" value={form.telefone} onChange={(e) => setField('telefone', e.target.value)} placeholder="(16) 99999-9999" className={inputCls} /></div>
                    <div><label className="block text-xs text-gray-400 mb-1">E-mail</label><input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} className={inputCls} /></div>
                    <div><label className="block text-xs text-gray-400 mb-1">Como chegou até nós</label><Combobox value={form.origem} onChange={(e) => setField('origem', e.target.value)} options={ORIGENS} className={inputCls} /></div>
                    <div><label className="block text-xs text-gray-400 mb-1">Etapa</label>
                      <Select value={form.etapa} onChange={(e) => setField('etapa', e.target.value)} className={inputCls}>{STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>
                    </div>
                    <div><label className="block text-xs text-gray-400 mb-1">Responsável</label>
                      <Select value={form.responsavel_id} onChange={(e) => setField('responsavel_id', e.target.value)} className={inputCls}><option value="">Sem responsável</option>{admins.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}</Select>
                    </div>
                    <div><label className="block text-xs text-gray-400 mb-1">Próxima reunião (data e hora)</label><DateInput withTime value={form.reuniao_em} onChange={(e) => setField('reuniao_em', e.target.value)} className={inputCls} /></div>
                    <div><label className="block text-xs text-gray-400 mb-1">Tamanho da frota (veículos)</label><input type="number" min="0" value={form.frota_estimada} onChange={(e) => setField('frota_estimada', e.target.value)} className={inputCls} /></div>
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2"><label className="block text-xs text-gray-400 mb-1">Próximo passo</label><input type="text" value={form.proxima_acao} onChange={(e) => setField('proxima_acao', e.target.value)} placeholder="Ex.: enviar proposta" className={inputCls} /></div>
                      <div><label className="block text-xs text-gray-400 mb-1">Até quando</label><DateInput value={form.proxima_acao_data} onChange={(e) => setField('proxima_acao_data', e.target.value)} className={inputCls} /></div>
                    </div>
                    <div><label className="block text-xs text-gray-400 mb-1">Mensalidade estimada (R$)</label><input type="text" inputMode="decimal" value={form.mensalidade_estimada} onChange={(e) => setField('mensalidade_estimada', e.target.value)} placeholder="0,00" className={inputCls} /></div>
                    {form.etapa === 'perdido' && (
                      <div><label className="block text-xs text-gray-400 mb-1">Motivo da perda</label><input type="text" value={form.motivo_perda} onChange={(e) => setField('motivo_perda', e.target.value)} className={inputCls} /></div>
                    )}
                    <div className="sm:col-span-2"><label className="block text-xs text-gray-400 mb-1">Observações</label><textarea rows={3} value={form.observacoes} onChange={(e) => setField('observacoes', e.target.value)} className={`${inputCls} resize-none`} /></div>
                  </div>
                  <button type="submit" disabled={isSaving} className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-all">
                    {isSaving ? <><FaSpinner className="animate-spin" /> Salvando...</> : (editing ? 'Salvar alterações' : 'Adicionar cliente')}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Detalhe + histórico */}
          {viewing && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Detalhes de ${viewing.empresa}`}>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start border-b border-gray-800 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{viewing.empresa}</h3>
                    {viewing.contato && <p className="text-sm text-gray-400 mt-0.5">{viewing.contato}</p>}
                  </div>
                  <button onClick={() => setViewing(null)} aria-label="Fechar" className="text-gray-400 hover:text-white shrink-0"><FaTimes /></button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-xs text-gray-400" htmlFor="etapa-detalhe">Etapa:</label>
                  <Select id="etapa-detalhe" value={viewing.etapa} onChange={(e) => moveTo(viewing, e.target.value)} className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500">
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </Select>
                  <button onClick={() => { openEdit(viewing); }} className="ml-auto inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-400 border border-gray-800 rounded-lg px-3 py-1.5"><FaEdit /> Editar</button>
                  <button onClick={() => handleDelete(viewing)} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 border border-gray-800 rounded-lg px-3 py-1.5"><FaTrashAlt /> Excluir</button>
                </div>

                {attentionReasons(viewing).length > 0 && (
                  <ul className="space-y-1">
                    {attentionReasons(viewing).map(r => <li key={r} className="flex items-center gap-2 text-xs text-amber-400"><FaExclamationCircle /> {r}</li>)}
                  </ul>
                )}

                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  {viewing.reuniao_em && <div><dt className="text-xs text-gray-500">Próxima reunião</dt><dd className="text-white tabular-nums">{fmtReuniao(viewing.reuniao_em)}</dd></div>}
                  {viewing.proxima_acao && <div><dt className="text-xs text-gray-500">Próximo passo</dt><dd className="text-white">{viewing.proxima_acao}{viewing.proxima_acao_data ? ` (${fmtDate(viewing.proxima_acao_data)})` : ''}</dd></div>}
                  {viewing.telefone && <div><dt className="text-xs text-gray-500">Telefone</dt><dd className="text-white flex items-center gap-2">{viewing.telefone}{viewingWa && <a href={viewingWa} target="_blank" rel="noreferrer" title="Abrir WhatsApp" className="text-emerald-400 hover:text-emerald-300"><FaWhatsapp /></a>}</dd></div>}
                  {viewing.email && <div><dt className="text-xs text-gray-500">E-mail</dt><dd className="text-white flex items-center gap-2 break-all">{viewing.email}<a href={`mailto:${viewing.email}`} title="Enviar e-mail" className="text-blue-400 hover:text-blue-300"><FaEnvelope /></a></dd></div>}
                  {viewing.origem && <div><dt className="text-xs text-gray-500">Como chegou até nós</dt><dd className="text-white">{viewing.origem}</dd></div>}
                  {viewing.frota_estimada != null && <div><dt className="text-xs text-gray-500">Frota</dt><dd className="text-white tabular-nums">{viewing.frota_estimada} veículos</dd></div>}
                  {viewing.mensalidade_estimada != null && <div><dt className="text-xs text-gray-500">Mensalidade estimada</dt><dd className="text-white tabular-nums">{BRL(viewing.mensalidade_estimada)}</dd></div>}
                  <div><dt className="text-xs text-gray-500">Responsável</dt><dd className="text-white">{viewing.responsavel?.username || 'Sem responsável'}</dd></div>
                  {viewing.motivo_perda && <div className="col-span-2"><dt className="text-xs text-gray-500">Motivo da perda</dt><dd className="text-white">{viewing.motivo_perda}</dd></div>}
                </dl>

                {viewing.observacoes && <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{viewing.observacoes}</p>}

                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h4 className="text-sm font-bold text-white">Histórico</h4>
                  <form onSubmit={handleAddNote} className="flex items-center gap-2">
                    <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Anote o que foi combinado na conversa ou reunião..." className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500" />
                    <button type="submit" disabled={isSubmittingNote || !newNote.trim()} aria-label="Salvar anotação" className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white p-2.5 rounded-lg"><FaPaperPlane size={12} /></button>
                  </form>
                  {isLoadingNotes ? (
                    <div className="flex justify-center py-6 text-gray-500"><FaSpinner className="animate-spin" /></div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {notes.length === 0 && <p className="text-xs text-gray-600 text-center py-4">Nenhum registro ainda.</p>}
                      {notes.map(n => (
                        <div key={n.id} className={`rounded-lg p-3 flex items-start justify-between gap-3 ${n.kind === 'etapa' ? 'bg-gray-800/30' : 'bg-gray-950 border border-gray-800'}`}>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-purple-300">{n.author}</span>
                              <span className="text-[10px] text-gray-600">{new Date(n.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                            </div>
                            <p className={`text-xs ${n.kind === 'etapa' ? 'text-gray-500' : 'text-gray-300'}`}>{n.text}</p>
                          </div>
                          <button onClick={() => handleDeleteNote(n.id)} aria-label="Excluir registro" className="text-gray-600 hover:text-red-400 shrink-0"><FaTrashAlt size={11} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
