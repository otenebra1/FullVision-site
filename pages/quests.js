import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import {
  FaTasks, FaPlus, FaEdit, FaTrashAlt, FaSpinner, FaArrowLeft, FaChartPie,
  FaExclamationCircle, FaCheckCircle, FaTimes, FaCommentDots, FaPaperPlane,
  FaUserCircle, FaCalendarAlt, FaFlag, FaSearch, FaChevronLeft, FaChevronRight,
  FaUser,
} from 'react-icons/fa';

// ==========================================
// Configuração das colunas do board
// ==========================================
const COLUMNS = [
  { key: 'a_fazer', label: 'A Fazer', color: 'border-gray-700' },
  { key: 'em_andamento', label: 'Em Andamento', color: 'border-blue-500/40' },
  { key: 'concluido', label: 'Concluído', color: 'border-emerald-500/40' },
];

const PRIORITY_LABEL = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' };
const PRIORITY_COLOR = {
  baixa: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  media: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  alta: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  urgente: 'bg-red-500/10 text-red-400 border-red-500/30',
};
const PRIORITY_ORDER = { urgente: 0, alta: 1, media: 2, baixa: 3 };

function isOverdue(quest) {
  if (!quest.due_date || quest.status === 'concluido') return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(quest.due_date + 'T00:00:00') < today;
}

// ==========================================
// Card de tarefa dentro de uma coluna
// ==========================================
function QuestCard({ quest, onOpen, onMove, onDelete, columnIndex }) {
  const commentCount = quest.comments?.[0]?.count || 0;
  const overdue = isOverdue(quest);

  return (
    <div
      onClick={() => onOpen(quest)}
      className={`bg-gray-950 border rounded-xl p-4 space-y-3 cursor-pointer hover:border-blue-500/50 transition-all group ${overdue ? 'border-red-500/40' : 'border-gray-800'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-100 leading-snug">{quest.title}</h3>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${PRIORITY_COLOR[quest.priority]}`}>
          {PRIORITY_LABEL[quest.priority]}
        </span>
      </div>

      {quest.description && (
        <p className="text-xs text-gray-500 line-clamp-2">{quest.description}</p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <FaUserCircle className="text-gray-600" />
          <span>{quest.assigned?.username || 'Sem responsável'}</span>
        </div>
        {quest.due_date && (
          <div className={`flex items-center gap-1.5 ${overdue ? 'text-red-400 font-semibold' : ''}`}>
            {overdue && <FaExclamationCircle />}
            <FaCalendarAlt />
            <span>{new Date(quest.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-800/80">
        <span className={`inline-flex items-center gap-1.5 text-xs ${commentCount > 0 ? 'text-blue-400' : 'text-gray-600'}`}>
          <FaCommentDots /> {commentCount}
        </span>

        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
          <button
            disabled={columnIndex === 0}
            onClick={() => onMove(quest, COLUMNS[columnIndex - 1].key)}
            title="Mover para trás"
            className="p-1.5 text-gray-500 hover:text-white disabled:opacity-20 disabled:pointer-events-none"
          ><FaChevronLeft size={11} /></button>
          <button
            disabled={columnIndex === COLUMNS.length - 1}
            onClick={() => onMove(quest, COLUMNS[columnIndex + 1].key)}
            title="Mover para frente"
            className="p-1.5 text-gray-500 hover:text-white disabled:opacity-20 disabled:pointer-events-none"
          ><FaChevronRight size={11} /></button>
          <button onClick={() => onDelete(quest.id)} title="Excluir" className="p-1.5 text-gray-500 hover:text-red-400"><FaTrashAlt size={11} /></button>
        </div>
      </div>
    </div>
  );
}

export default function Quests() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 4000); };
  const [confirmDialog, setConfirmDialog] = useState(null);
  const askConfirm = (message, onConfirm) => setConfirmDialog({ message, onConfirm });

  const [isLoading, setIsLoading] = useState(true);
  const [quests, setQuests] = useState([]);
  const [admins, setAdmins] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssigned, setFilterAssigned] = useState('all');

  // Modal criar/editar
  const [isQuestModalOpen, setIsQuestModalOpen] = useState(false);
  const [editingQuest, setEditingQuest] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState('media');
  const [formDueDate, setFormDueDate] = useState('');
  const [formAssignedTo, setFormAssignedTo] = useState('');
  const [isSavingQuest, setIsSavingQuest] = useState(false);

  // Modal de detalhes / comentários
  const [viewingQuest, setViewingQuest] = useState(null);
  const [questComments, setQuestComments] = useState([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // ------------------------------------------
  // Guard de acesso: só admin passa
  // ------------------------------------------
  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/area-cliente'); return; }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (profile?.role !== 'admin') { router.replace('/area-cliente'); return; }

      setCurrentUser(profile);
      setIsAuthorized(true);
      setAuthChecked(true);
    };
    checkAccess();
  }, [router]);

  // ------------------------------------------
  // Carrega dados
  // ------------------------------------------
  const fetchData = async () => {
    setIsLoading(true);

    const { data: questsData, error } = await supabase
      .from('quests')
      .select('*, assigned:profiles!quests_assigned_to_fkey(id, username), creator:profiles!quests_created_by_fkey(id, username), comments:quest_comments(count)')
      .order('created_at', { ascending: false });
    if (!error && questsData) setQuests(questsData);
    else if (error) console.error('Erro ao buscar quests:', error);

    const { data: adminsData } = await supabase.from('profiles').select('id, username').eq('role', 'admin').order('username');
    if (adminsData) setAdmins(adminsData);

    setIsLoading(false);
  };

  useEffect(() => { if (isAuthorized) fetchData(); }, [isAuthorized]);

  // ------------------------------------------
  // CRUD de tarefas
  // ------------------------------------------
  const resetForm = () => {
    setFormTitle(''); setFormDescription(''); setFormPriority('media');
    setFormDueDate(''); setFormAssignedTo('');
  };

  const openNewQuestModal = () => { setEditingQuest(null); resetForm(); setIsQuestModalOpen(true); };

  const openEditQuestModal = (quest) => {
    setEditingQuest(quest);
    setFormTitle(quest.title);
    setFormDescription(quest.description || '');
    setFormPriority(quest.priority);
    setFormDueDate(quest.due_date || '');
    setFormAssignedTo(quest.assigned_to || '');
    setIsQuestModalOpen(true);
  };

  const notifyAssigned = async (assignedId, message) => {
    if (!assignedId || assignedId === currentUser.id) return;
    const assignedUser = admins.find(a => a.id === assignedId);
    if (!assignedUser) return;
    const { error } = await supabase.from('notifications').insert([{ target_user: assignedUser.username, message, is_read: false }]);
    if (error) console.error('Erro ao notificar responsável pela tarefa:', error);
  };

  const handleSaveQuest = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) { showToast('Informe um título para a tarefa.', 'error'); return; }

    setIsSavingQuest(true);
    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      priority: formPriority,
      due_date: formDueDate || null,
      assigned_to: formAssignedTo || null,
    };

    if (editingQuest) {
      const { data, error } = await supabase
        .from('quests')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingQuest.id)
        .select('*, assigned:profiles!quests_assigned_to_fkey(id, username), creator:profiles!quests_created_by_fkey(id, username), comments:quest_comments(count)')
        .single();
      setIsSavingQuest(false);
      if (error) { showToast('Erro ao salvar tarefa: ' + error.message, 'error'); return; }
      setQuests(quests.map(q => q.id === data.id ? data : q));
      if (formAssignedTo && formAssignedTo !== editingQuest.assigned_to) {
        await notifyAssigned(formAssignedTo, `Você foi definido como responsável pela tarefa "${data.title}".`);
      }
      showToast('Tarefa atualizada com sucesso!');
    } else {
      const { data, error } = await supabase
        .from('quests')
        .insert([{ ...payload, status: 'a_fazer', created_by: currentUser.id }])
        .select('*, assigned:profiles!quests_assigned_to_fkey(id, username), creator:profiles!quests_created_by_fkey(id, username), comments:quest_comments(count)')
        .single();
      setIsSavingQuest(false);
      if (error) { showToast('Erro ao criar tarefa: ' + error.message, 'error'); return; }
      setQuests([data, ...quests]);
      await notifyAssigned(formAssignedTo, `Nova tarefa atribuída a você: "${data.title}".`);
      showToast('Tarefa criada com sucesso!');
    }

    setIsQuestModalOpen(false);
    setEditingQuest(null);
    resetForm();
  };

  const handleDeleteQuest = (id) => {
    askConfirm('Excluir esta tarefa e todos os comentários? Essa ação não pode ser desfeita.', async () => {
      await supabase.from('quest_comments').delete().eq('quest_id', id);
      const { error } = await supabase.from('quests').delete().eq('id', id);
      if (error) { showToast('Erro ao excluir tarefa: ' + error.message, 'error'); return; }
      setQuests(quests.filter(q => q.id !== id));
      if (viewingQuest?.id === id) setViewingQuest(null);
      showToast('Tarefa excluída com sucesso!');
    });
  };

  const handleMoveQuest = async (quest, newStatus) => {
    const { data, error } = await supabase
      .from('quests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', quest.id)
      .select('*, assigned:profiles!quests_assigned_to_fkey(id, username), creator:profiles!quests_created_by_fkey(id, username), comments:quest_comments(count)')
      .single();
    if (error) { showToast('Erro ao mover tarefa: ' + error.message, 'error'); return; }
    setQuests(quests.map(q => q.id === data.id ? data : q));
    if (viewingQuest?.id === data.id) setViewingQuest(data);
  };

  // ------------------------------------------
  // Comentários
  // ------------------------------------------
  const openQuestDetail = async (quest) => {
    setViewingQuest(quest);
    setIsLoadingComments(true);
    const { data, error } = await supabase.from('quest_comments').select('*').eq('quest_id', quest.id).order('created_at');
    if (!error && data) setQuestComments(data);
    setIsLoadingComments(false);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !viewingQuest) return;

    setIsSubmittingComment(true);
    const { data, error } = await supabase
      .from('quest_comments')
      .insert([{ quest_id: viewingQuest.id, author: currentUser.username, text: newComment.trim() }])
      .select()
      .single();
    setIsSubmittingComment(false);

    if (error) { showToast('Erro ao enviar comentário.', 'error'); return; }
    setQuestComments([...questComments, data]);
    setNewComment('');

    // Notifica o responsável (ou o criador, se quem comentou for o responsável) sobre o novo comentário
    const targetId = viewingQuest.assigned_to === currentUser.id ? viewingQuest.created_by : viewingQuest.assigned_to;
    if (targetId) await notifyAssigned(targetId, `Novo comentário de ${currentUser.username} na tarefa "${viewingQuest.title}".`);

    setQuests(quests.map(q => q.id === viewingQuest.id
      ? { ...q, comments: [{ count: (q.comments?.[0]?.count || 0) + 1 }] }
      : q));
  };

  const handleDeleteComment = async (commentId) => {
    const { error } = await supabase.from('quest_comments').delete().eq('id', commentId);
    if (error) { showToast('Erro ao excluir comentário.', 'error'); return; }
    setQuestComments(questComments.filter(c => c.id !== commentId));
    setQuests(quests.map(q => q.id === viewingQuest.id
      ? { ...q, comments: [{ count: Math.max((q.comments?.[0]?.count || 1) - 1, 0) }] }
      : q));
  };

  // ------------------------------------------
  // Filtros
  // ------------------------------------------
  const filteredQuests = useMemo(() => {
    return quests.filter(q => {
      const searchOk = !searchTerm || q.title.toLowerCase().includes(searchTerm.toLowerCase()) || (q.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      const priorityOk = filterPriority === 'all' || q.priority === filterPriority;
      const assignedOk = filterAssigned === 'all' || q.assigned_to === filterAssigned;
      return searchOk && priorityOk && assignedOk;
    });
  }, [quests, searchTerm, filterPriority, filterAssigned]);

  const questsByColumn = useMemo(() => {
    const map = {};
    COLUMNS.forEach(col => {
      map[col.key] = filteredQuests
        .filter(q => q.status === col.key)
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (a.due_date || '9999').localeCompare(b.due_date || '9999'));
    });
    return map;
  }, [filteredQuests]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <FaSpinner className="animate-spin text-3xl text-blue-500" />
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <>
      <Head><title>Quest Tracker | Full Vision</title></Head>

      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold ${
          toast.type === 'success' ? 'bg-emerald-950 border-emerald-500/40 text-emerald-400' : 'bg-red-950 border-red-500/40 text-red-400'
        }`}>
          {toast.type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />}
          {toast.message}
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaExclamationCircle className="text-red-400" /> Confirmar Ação</h3>
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
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <FaTasks className="text-purple-400" /> Quest Tracker
              </h1>
              <p className="text-gray-400 text-sm mt-1">Quadro de tarefas internas da equipe Full Vision</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <a href="/painel-admin" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-800 rounded-xl px-4 py-2"><FaChartPie /> Painel Admin</a>
              <a href="/area-cliente" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-800 rounded-xl px-4 py-2"><FaArrowLeft /> Área do Cliente</a>
            </div>
          </div>

          {/* Filtros + Nova tarefa */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-gray-900/70 border border-gray-800 rounded-2xl p-4">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1 max-w-xs">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                <input type="text" placeholder="Pesquisar tarefas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500" />
              </div>
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500">
                <option value="all">Todas as prioridades</option>
                {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)} className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500">
                <option value="all">Todos os responsáveis</option>
                {admins.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
              </select>
            </div>
            <button onClick={openNewQuestModal} className="inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-lg transition-all whitespace-nowrap"><FaPlus /> Nova Tarefa</button>
          </div>

          {/* Board */}
          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-gray-500">
              <FaSpinner className="animate-spin text-2xl mr-3" /> Carregando tarefas...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {COLUMNS.map((col, colIndex) => (
                <div key={col.key} className={`bg-gray-900/50 border-t-4 ${col.color} border-x border-b border-gray-800 rounded-2xl p-4 space-y-3 min-h-[200px]`}>
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-gray-300">{col.label}</h2>
                    <span className="text-xs font-semibold text-gray-500 bg-gray-950 border border-gray-800 rounded-full px-2 py-0.5">{questsByColumn[col.key].length}</span>
                  </div>

                  <div className="space-y-3">
                    {questsByColumn[col.key].length === 0 ? (
                      <div className="text-center text-xs text-gray-600 py-8">Nenhuma tarefa aqui.</div>
                    ) : (
                      questsByColumn[col.key].map(quest => (
                        <QuestCard key={quest.id} quest={quest} columnIndex={colIndex} onOpen={openQuestDetail} onMove={handleMoveQuest} onDelete={handleDeleteQuest} />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal Nova/Editar Tarefa */}
          {isQuestModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-gray-900 border border-purple-500/30 rounded-2xl max-w-lg w-full p-6 space-y-5">
                <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaTasks className="text-purple-400" /> {editingQuest ? 'Editar Tarefa' : 'Nova Tarefa'}</h3>
                  <button onClick={() => setIsQuestModalOpen(false)} className="text-gray-400 hover:text-white"><FaTimes /></button>
                </div>
                <form onSubmit={handleSaveQuest} className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Título</label>
                    <input type="text" required value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Descrição</label>
                    <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500 resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Prioridade</label>
                      <select value={formPriority} onChange={(e) => setFormPriority(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500">
                        {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Prazo</label>
                      <input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Responsável</label>
                    <select value={formAssignedTo} onChange={(e) => setFormAssignedTo(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500">
                      <option value="">Sem responsável</option>
                      {admins.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
                    </select>
                  </div>
                  <button type="submit" disabled={isSavingQuest} className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-all">
                    {isSavingQuest ? <><FaSpinner className="animate-spin" /> Salvando...</> : (editingQuest ? 'Salvar Alterações' : 'Criar Tarefa')}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Modal Detalhes da Tarefa + Comentários */}
          {viewingQuest && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start border-b border-gray-800 pb-4">
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white">{viewingQuest.title}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${PRIORITY_COLOR[viewingQuest.priority]}`}>{PRIORITY_LABEL[viewingQuest.priority]}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-gray-700 text-gray-400 flex items-center gap-1"><FaUser size={9} /> {viewingQuest.assigned?.username || 'Sem responsável'}</span>
                      {viewingQuest.due_date && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${isOverdue(viewingQuest) ? 'border-red-500/40 text-red-400' : 'border-gray-700 text-gray-400'}`}>
                          <FaCalendarAlt size={9} /> {new Date(viewingQuest.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setViewingQuest(null)} className="text-gray-400 hover:text-white shrink-0"><FaTimes /></button>
                </div>

                {viewingQuest.description && <p className="text-sm text-gray-300 leading-relaxed">{viewingQuest.description}</p>}

                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-xs text-gray-400">Status:</label>
                  <select
                    value={viewingQuest.status}
                    onChange={(e) => handleMoveQuest(viewingQuest, e.target.value)}
                    className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                  >
                    {COLUMNS.map(col => <option key={col.key} value={col.key}>{col.label}</option>)}
                  </select>
                  <button onClick={() => { openEditQuestModal(viewingQuest); }} className="ml-auto inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-400 border border-gray-800 rounded-lg px-3 py-1.5"><FaEdit /> Editar</button>
                  <button onClick={() => handleDeleteQuest(viewingQuest.id)} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 border border-gray-800 rounded-lg px-3 py-1.5"><FaTrashAlt /> Excluir</button>
                </div>

                {/* Comentários */}
                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2"><FaCommentDots className="text-blue-400" /> Comentários</h4>

                  {isLoadingComments ? (
                    <div className="flex justify-center py-6 text-gray-500"><FaSpinner className="animate-spin" /></div>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {questComments.length === 0 ? (
                        <p className="text-xs text-gray-600 text-center py-4">Nenhum comentário ainda.</p>
                      ) : (
                        questComments.map(c => (
                          <div key={c.id} className="bg-gray-950 border border-gray-800 rounded-lg p-3 flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-blue-400">{c.author}</span>
                                <span className="text-[10px] text-gray-600">{new Date(c.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                              </div>
                              <p className="text-xs text-gray-300">{c.text}</p>
                            </div>
                            <button onClick={() => handleDeleteComment(c.id)} className="text-gray-600 hover:text-red-400 shrink-0"><FaTrashAlt size={11} /></button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-2">
                    <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Escreva um comentário..." className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500" />
                    <button type="submit" disabled={isSubmittingComment || !newComment.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white p-2.5 rounded-lg"><FaPaperPlane size={12} /></button>
                  </form>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
