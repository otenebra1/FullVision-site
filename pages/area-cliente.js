import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabase'; // Importando a nossa conexão!
import { 
  FaTruck, FaCodeBranch, FaCheckCircle, FaSpinner, FaClock, 
  FaCommentDots, FaPaperPlane, FaLock, FaExternalLinkAlt,
  FaPlus, FaEdit, FaTrashAlt, FaUserShield, FaChartPie,
  FaGoogleDrive, FaUserTie, FaDatabase, FaSearch,
  FaUserCog, FaKey, FaUsers, FaUser, FaUserCircle
} from 'react-icons/fa';

export default function AreaDoCliente() {
  // ==========================================
  // ESTADOS DO SISTEMA
  // ==========================================
  const [users, setUsers] = useState([]);
  const [steps, setSteps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Autenticação
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Filtros e Modais (Roadmap)
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedStep, setSelectedStep] = useState(null);
  const [isStepModalOpen, setIsStepModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState('in_progress');
  const [formProgress, setFormProgress] = useState(50);
  const [newComment, setNewComment] = useState('');

  // Modais (Usuários e Perfil)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [ownNewPassword, setOwnNewPassword] = useState('');
  const [isAdminUsersModalOpen, setIsAdminUsersModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormName, setUserFormName] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormRole, setUserFormRole] = useState('cliente');

  // ==========================================
  // BUSCA INICIAL DE DADOS (SUPABASE)
  // ==========================================
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    
    // 1. Busca Usuários
    const { data: usersData, error: usersError } = await supabase.from('users').select('*');
    if (!usersError && usersData) setUsers(usersData);

    // 2. Busca Etapas e seus comentários atrelados
    const { data: stepsData, error: stepsError } = await supabase.from('steps').select('*');
    const { data: commentsData, error: commentsError } = await supabase.from('comments').select('*');

    if (!stepsError && !commentsError && stepsData) {
      // Mesclamos os comentários para dentro de cada etapa correspondente
      const stepsWithComments = stepsData.map(step => ({
        ...step,
        comments: commentsData ? commentsData.filter(c => c.step_id === step.id) : []
      }));
      setSteps(stepsWithComments);
    }
    
    setIsLoading(false);
  };

  // ==========================================
  // LÓGICA DE LOGIN E PERFIL
  // ==========================================
  const handleLogin = (e) => {
    e.preventDefault();
    // Verifica contra a lista de usuários puxada do Supabase
    const userFound = users.find(u => u.username === usernameInput && u.password === passwordInput);
    
    if (userFound) {
      setCurrentUser(userFound);
      setIsLoggedIn(true);
      setUsernameInput('');
      setPasswordInput('');
    } else {
      // Dica de fallback para primeiro uso (antes de criar usuários no banco)
      if (usernameInput === 'admin' && passwordInput === '123' && users.length === 0) {
         setCurrentUser({ id: 999, username: 'admin', role: 'admin' });
         setIsLoggedIn(true);
         alert("Modo de Emergência Admin Ativado. Crie seu primeiro usuário no banco!");
      } else {
         alert('Usuário ou senha incorretos!');
      }
    }
  };

  const handleUpdateOwnPassword = async (e) => {
    e.preventDefault();
    if (!ownNewPassword.trim()) return;

    // Atualiza no Supabase
    const { error } = await supabase.from('users').update({ password: ownNewPassword }).eq('id', currentUser.id);
    
    if (error) {
      alert("Erro ao alterar senha.");
      return;
    }

    // Atualiza na tela
    setUsers(users.map(u => u.id === currentUser.id ? { ...u, password: ownNewPassword } : u));
    setCurrentUser({ ...currentUser, password: ownNewPassword });
    setOwnNewPassword('');
    setIsProfileModalOpen(false);
    alert('Senha alterada com sucesso!');
  };

  // ==========================================
  // LÓGICA DE GESTÃO DE USUÁRIOS (SÓ ADMIN)
  // ==========================================
  const openUserForm = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserFormName(user.username);
      setUserFormPassword(user.password);
      setUserFormRole(user.role);
    } else {
      setEditingUser(null);
      setUserFormName('');
      setUserFormPassword('');
      setUserFormRole('cliente');
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (editingUser) {
      // Editar
      const { data, error } = await supabase.from('users')
        .update({ username: userFormName, password: userFormPassword, role: userFormRole })
        .eq('id', editingUser.id)
        .select();
      
      if (!error && data) {
        setUsers(users.map(u => u.id === editingUser.id ? data[0] : u));
      }
    } else {
      // Criar Novo
      const { data, error } = await supabase.from('users')
        .insert([{ username: userFormName, password: userFormPassword, role: userFormRole }])
        .select();

      if (!error && data) {
        setUsers([...users, data[0]]);
      }
    }
    setEditingUser(null);
    setUserFormName('');
    setUserFormPassword('');
  };

  const handleDeleteUser = async (userId) => {
    if (userId === currentUser.id) return alert('Você não pode excluir a si mesmo!');
    if (confirm('Tem certeza que deseja excluir este usuário?')) {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (!error) {
        setUsers(users.filter(u => u.id !== userId));
      }
    }
  };

  // ==========================================
  // LÓGICA DO ROADMAP (Tabela de Etapas)
  // ==========================================
  const openNewStepModal = () => {
    setEditingStep(null); setFormTitle(''); setFormDescription(''); setFormStatus('in_progress'); setFormProgress(50); setIsStepModalOpen(true);
  };

  const openEditStepModal = (step, e) => {
    e.stopPropagation(); setEditingStep(step); setFormTitle(step.title); setFormDescription(step.description); setFormStatus(step.status); setFormProgress(step.progress); setIsStepModalOpen(true);
  };

  const handleSaveStep = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingStep) {
      // Editar
      const { data, error } = await supabase.from('steps')
        .update({ title: formTitle, description: formDescription, status: formStatus, progress: Number(formProgress) })
        .eq('id', editingStep.id)
        .select();

      if (!error && data) {
        setSteps(steps.map((s) => s.id === editingStep.id ? { ...data[0], comments: s.comments } : s));
      }
    } else {
      // Criar Nova Etapa
      const { data, error } = await supabase.from('steps')
        .insert([{ title: formTitle, description: formDescription, status: formStatus, progress: Number(formProgress) }])
        .select();

      if (!error && data) {
        setSteps([...steps, { ...data[0], comments: [] }]);
      }
    }
    setIsStepModalOpen(false);
  };

  const handleDeleteStep = async (stepId, e) => {
    e.stopPropagation();
    if (confirm('Excluir esta etapa permanentemente? Isso apagará os comentários nela também.')) {
      // Ao deletar a etapa, os comentários atrelados ficam órfãos. É bom apagá-arlos também.
      await supabase.from('comments').delete().eq('step_id', stepId);
      const { error } = await supabase.from('steps').delete().eq('id', stepId);
      
      if (!error) {
        setSteps(steps.filter((s) => s.id !== stepId));
        if (selectedStep?.id === stepId) setSelectedStep(null);
      }
    }
  };

  // ==========================================
  // LÓGICA DE COMENTÁRIOS
  // ==========================================
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedStep) return;

    const { data, error } = await supabase.from('comments')
      .insert([{ step_id: selectedStep.id, author: currentUser.username, text: newComment }])
      .select();

    if (!error && data) {
      const commentObj = data[0];
      const updatedSteps = steps.map((s) => s.id === selectedStep.id ? { ...s, comments: [...s.comments, commentObj] } : s);
      setSteps(updatedSteps);
      setSelectedStep({ ...selectedStep, comments: [...selectedStep.comments, commentObj] });
      setNewComment('');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (confirm('Deseja excluir este comentário?')) {
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      
      if (!error) {
        const updatedSteps = steps.map((s) => s.id === selectedStep.id ? { ...s, comments: s.comments.filter((c) => c.id !== commentId) } : s);
        setSteps(updatedSteps);
        setSelectedStep({ ...selectedStep, comments: selectedStep.comments.filter((c) => c.id !== commentId) });
      }
    }
  };

  // ==========================================
  // CÁLCULOS DO GRÁFICO E RENDERIZAÇÃO
  // ==========================================
  const totalSteps = steps.length;
  const countCompleted = steps.filter((s) => s.status === 'completed').length;
  const countInProgress = steps.filter((s) => s.status === 'in_progress').length;
  const countPlanned = steps.filter((s) => s.status === 'planned').length;
  const pieGradient = { background: `conic-gradient(#10b981 0deg ${(countCompleted / (totalSteps || 1)) * 360}deg, #3b82f6 ${(countCompleted / (totalSteps || 1)) * 360}deg ${((countCompleted + countInProgress) / (totalSteps || 1)) * 360}deg, #374151 ${((countCompleted + countInProgress) / (totalSteps || 1)) * 360}deg 360deg)` };

  const filteredSteps = steps.filter((step) => {
    const matchSearch = step.title.toLowerCase().includes(searchTerm.toLowerCase()) || step.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'all' ? true : step.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const isAdmin = currentUser?.role === 'admin';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white">
        <FaSpinner className="animate-spin text-4xl text-blue-500 mb-4" />
        <p className="text-gray-400">Conectando ao Banco de Dados...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <Head><title>Área do Cliente | Full Vision</title></Head>

      <div className="max-w-6xl mx-auto">
        {!isLoggedIn ? (
          /* ================= TELA DE LOGIN ================= */
          <div className="max-w-md mx-auto bg-gray-900/80 border border-gray-800 rounded-2xl p-8 backdrop-blur-md shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                <FaLock className="text-2xl" />
              </div>
              <h1 className="text-2xl font-bold">Portal de Acesso</h1>
              <p className="text-gray-400 text-sm mt-1">Acesse sua área exclusiva.</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Usuário</label>
                <input type="text" required value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} placeholder="Seu usuário" className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Senha</label>
                <input type="password" required value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="••••••••" className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" />
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 text-white font-semibold py-3 rounded-lg shadow-lg transition-all">
                Entrar
              </button>
            </form>
          </div>
        ) : (
          /* ================= PAINEL LOGADO ================= */
          <div className="space-y-10">
            {/* Header com Perfil */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/60 border border-gray-800 rounded-2xl p-6 backdrop-blur-md">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <FaUserCircle className="text-blue-500" /> Olá, {currentUser.username}!
                  </h1>
                  {isAdmin ? (
                    <span className="inline-flex items-center gap-1 bg-purple-500/10 text-purple-400 text-xs font-semibold px-2 py-0.5 rounded border border-purple-500/30">ADMIN</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 text-xs font-semibold px-2 py-0.5 rounded border border-blue-500/30">CLIENTE</span>
                  )}
                </div>
                <p className="text-gray-400 text-sm mt-1">Acompanhe suas operações de rastreamento e o roadmap.</p>
              </div>
              
              <div className="flex items-center gap-2 self-start md:self-auto">
                <button onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 px-3 py-2 rounded-lg">
                  <FaKey /> Trocar Senha
                </button>
                <button onClick={() => { setIsLoggedIn(false); setCurrentUser(null); }} className="text-xs font-medium text-gray-400 hover:text-red-400 transition-colors border border-gray-700 hover:border-red-500/50 px-3 py-2 rounded-lg">
                  Sair
                </button>
              </div>
            </div>

            {/* SEÇÃO ADMIN (Links + Gestão de Usuários) */}
            {isAdmin && (
              <div className="bg-gradient-to-r from-purple-950/50 via-gray-900 to-gray-900 border border-purple-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><FaUserShield className="text-purple-400"/> Ferramentas Administrativas</h2>
                  <button onClick={() => setIsAdminUsersModalOpen(true)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg">
                    <FaUsers /> Gerenciar Usuários
                  </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <a href="#" className="bg-gray-950/80 hover:bg-gray-800 border border-gray-800 hover:border-purple-500/50 rounded-xl p-3 flex items-center gap-3 transition-all"><FaGoogleDrive className="text-emerald-400 text-lg" /> <span className="text-sm font-semibold">Drive</span></a>
                  <a href="https://tracker.fullvision.one/v1/home" target="_blank" className="bg-gray-950/80 hover:bg-gray-800 border border-gray-800 hover:border-purple-500/50 rounded-xl p-3 flex items-center gap-3 transition-all"><FaTruck className="text-blue-400 text-lg" /> <span className="text-sm font-semibold">Tracker</span></a>
                  <a href="#" className="bg-gray-950/80 hover:bg-gray-800 border border-gray-800 hover:border-purple-500/50 rounded-xl p-3 flex items-center gap-3 transition-all"><FaUserTie className="text-amber-400 text-lg" /> <span className="text-sm font-semibold">Admin</span></a>
                  <a href="#" className="bg-gray-950/80 hover:bg-gray-800 border border-gray-800 hover:border-purple-500/50 rounded-xl p-3 flex items-center gap-3 transition-all"><FaDatabase className="text-indigo-400 text-lg" /> <span className="text-sm font-semibold">ERP</span></a>
                </div>
              </div>
            )}

            {/* SEÇÃO RASTREAMENTO */}
            <div className="bg-gradient-to-r from-blue-900/40 via-gray-900 to-gray-900 border border-blue-500/30 rounded-2xl p-6 md:p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
              <div className="space-y-2 max-w-xl">
                <span className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 text-xs font-semibold px-3 py-1 rounded-full border border-blue-500/20"><FaTruck /> Plataforma de Rastreamento 24h</span>
                <h2 className="text-2xl font-bold">Acessar Sistema de Monitoramento</h2>
                <p className="text-gray-300 text-sm">Visualize sua frota em tempo real e relatórios de telemetria diretamente no portal oficial.</p>
              </div>
              <a href="https://tracker.fullvision.one/v1/home" target="_blank" rel="noopener noreferrer" className="w-full md:w-auto inline-flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3.5 rounded-xl shadow-lg transition-all hover:scale-105">
                Abrir Plataforma <FaExternalLinkAlt className="text-sm" />
              </a>
            </div>

            {/* GRÁFICO ROADMAP */}
            <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white"><FaChartPie className="text-blue-500" /> Resumo do Status do Roadmap</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="flex justify-center items-center">
                  <div className="relative w-48 h-48 rounded-full p-2 shadow-2xl flex items-center justify-center" style={pieGradient}>
                    <div className="w-32 h-32 bg-gray-950 rounded-full flex flex-col items-center justify-center border border-gray-800 shadow-inner">
                      <span className="text-2xl font-extrabold text-white">{totalSteps}</span>
                      <span className="text-[10px] uppercase font-semibold text-gray-400">Etapas Totais</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between bg-gray-950 p-3.5 rounded-xl border border-emerald-500/20"><div className="flex items-center gap-3"><div className="w-3.5 h-3.5 rounded-full bg-emerald-500" /><span className="text-sm font-semibold">Concluídas</span></div><span className="text-sm font-bold text-emerald-400">{countCompleted} <span className="text-xs text-gray-500">({Math.round((countCompleted/totalSteps)*100 || 0)}%)</span></span></div>
                  <div className="flex justify-between bg-gray-950 p-3.5 rounded-xl border border-blue-500/20"><div className="flex items-center gap-3"><div className="w-3.5 h-3.5 rounded-full bg-blue-500" /><span className="text-sm font-semibold">Em Desenvolvimento</span></div><span className="text-sm font-bold text-blue-400">{countInProgress} <span className="text-xs text-gray-500">({Math.round((countInProgress/totalSteps)*100 || 0)}%)</span></span></div>
                  <div className="flex justify-between bg-gray-950 p-3.5 rounded-xl border border-gray-700"><div className="flex items-center gap-3"><div className="w-3.5 h-3.5 rounded-full bg-gray-600" /><span className="text-sm font-semibold">Planejadas</span></div><span className="text-sm font-bold text-gray-400">{countPlanned} <span className="text-xs text-gray-500">({Math.round((countPlanned/totalSteps)*100 || 0)}%)</span></span></div>
                </div>
              </div>
            </div>

            {/* TABELA DE DESENVOLVIMENTO */}
            <div className="bg-gray-900/70 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 border-b border-gray-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2"><FaCodeBranch className="text-blue-500" /> Tabela de Entregas</h2>
                  </div>
                  {isAdmin && (
                    <button onClick={openNewStepModal} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-lg transition-all">
                      <FaPlus /> Nova Etapa
                    </button>
                  )}
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-950/50 p-2 rounded-xl border border-gray-800">
                  <div className="flex gap-1 overflow-x-auto w-full md:w-auto">
                    {['all', 'in_progress', 'planned', 'completed'].map(status => (
                      <button key={status} onClick={() => setFilterStatus(status)} className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === status ? 'bg-gray-800 text-white border border-gray-700' : 'text-gray-400 hover:text-white'}`}>
                        {status === 'all' ? 'Todas' : status === 'in_progress' ? 'Em Dev' : status === 'planned' ? 'Planejado' : 'Concluído'}
                      </button>
                    ))}
                  </div>
                  <div className="relative w-full md:w-64">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                    <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-950/80 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold min-w-[250px]">Título da Etapa</th>
                      <th className="p-4 font-semibold hidden md:table-cell">Progresso</th>
                      <th className="p-4 font-semibold text-center">Mensagens</th>
                      {isAdmin && <th className="p-4 font-semibold text-right">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {filteredSteps.length === 0 && (
                      <tr><td colSpan="5" className="p-8 text-center text-gray-500 text-sm">Nenhuma etapa encontrada.</td></tr>
                    )}
                    {filteredSteps.map((step) => (
                      <tr key={step.id} onClick={() => setSelectedStep(step)} className="hover:bg-gray-800/30 transition-colors cursor-pointer group">
                        <td className="p-4 align-middle">
                          {step.status === 'completed' && <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-md border border-emerald-500/20"><FaCheckCircle /> Feito</span>}
                          {step.status === 'in_progress' && <span className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-400 text-xs font-semibold px-2.5 py-1 rounded-md border border-blue-500/20"><FaSpinner className="animate-spin" /> Em Dev</span>}
                          {step.status === 'planned' && <span className="inline-flex items-center gap-1.5 bg-gray-800 text-gray-400 text-xs font-semibold px-2.5 py-1 rounded-md border border-gray-700"><FaClock /> Backlog</span>}
                        </td>
                        <td className="p-4 align-middle">
                          <h3 className="text-sm font-semibold text-gray-200 group-hover:text-blue-400">{step.title}</h3>
                          <p className="text-xs text-gray-500 truncate max-w-xs">{step.description}</p>
                        </td>
                        <td className="p-4 align-middle hidden md:table-cell w-48">
                          <div className="flex items-center gap-3">
                            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden"><div className={`h-full rounded-full ${step.status === 'completed' ? 'bg-emerald-500' : step.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-600'}`} style={{ width: `${step.progress}%` }} /></div>
                            <span className="text-xs font-medium text-gray-400">{step.progress}%</span>
                          </div>
                        </td>
                        <td className="p-4 align-middle text-center">
                          <span className={`inline-flex items-center gap-1.5 bg-gray-950 px-3 py-1 rounded-lg border border-gray-800 text-xs ${step.comments && step.comments.length > 0 ? "text-blue-400" : "text-gray-600"}`}><FaCommentDots /> {step.comments ? step.comments.length : 0}</span>
                        </td>
                        {isAdmin && (
                          <td className="p-4 align-middle text-right">
                            <div className="flex justify-end gap-2 opacity-50 group-hover:opacity-100">
                              <button onClick={(e) => openEditStepModal(step, e)} className="p-2 bg-gray-900 border border-gray-700 hover:border-blue-500 hover:text-blue-400 rounded text-gray-400"><FaEdit size={12} /></button>
                              <button onClick={(e) => handleDeleteStep(step.id, e)} className="p-2 bg-gray-900 border border-gray-700 hover:border-red-500 hover:text-red-400 rounded text-gray-400"><FaTrashAlt size={12} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ======================================================== */}
            {/* MODAIS DO SISTEMA                                        */}
            {/* ======================================================== */}

            {/* 1. Modal Trocar Senha (Meu Perfil) */}
            {isProfileModalOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-sm w-full p-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaKey className="text-blue-400"/> Trocar Senha</h3>
                    <button onClick={() => setIsProfileModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
                  </div>
                  <form onSubmit={handleUpdateOwnPassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Nova Senha</label>
                      <input type="password" required value={ownNewPassword} onChange={(e) => setOwnNewPassword(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500 outline-none" />
                    </div>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">Salvar Nova Senha</button>
                  </form>
                </div>
              </div>
            )}

            {/* 2. Modal Gerenciar Usuários (Apenas Admin) */}
            {isAdminUsersModalOpen && isAdmin && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-gray-900 border border-purple-500/30 rounded-2xl max-w-3xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaUsers className="text-purple-400"/> Gerenciamento de Usuários</h3>
                    <button onClick={() => setIsAdminUsersModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
                  </div>
                  
                  <form onSubmit={handleSaveUser} className="bg-gray-950 p-4 rounded-xl border border-gray-800 flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full"><label className="block text-xs text-gray-400 mb-1">Usuário</label><input type="text" required value={userFormName} onChange={e => setUserFormName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" /></div>
                    <div className="flex-1 w-full"><label className="block text-xs text-gray-400 mb-1">Senha</label><input type="text" required value={userFormPassword} onChange={e => setUserFormPassword(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" /></div>
                    <div className="w-full md:w-32"><label className="block text-xs text-gray-400 mb-1">Cargo</label><select value={userFormRole} onChange={e => setUserFormRole(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500"><option value="cliente">Cliente</option><option value="admin">Admin</option></select></div>
                    <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap">{editingUser ? 'Salvar Edição' : '+ Adicionar'}</button>
                    {editingUser && <button type="button" onClick={() => openUserForm(null)} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>}
                  </form>

                  <div className="border border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-950 text-gray-400 text-xs uppercase"><tr><th className="p-3">Usuário</th><th className="p-3">Senha</th><th className="p-3">Cargo</th><th className="p-3 text-right">Ações</th></tr></thead>
                      <tbody className="divide-y divide-gray-800">
                        {users.map(u => (
                          <tr key={u.id} className="hover:bg-gray-800/50">
                            <td className="p-3 text-white font-medium"><FaUser className="inline text-gray-500 mr-2"/>{u.username}</td>
                            <td className="p-3 text-gray-400 font-mono">{u.password}</td>
                            <td className="p-3">{u.role === 'admin' ? <span className="text-purple-400 text-xs font-bold bg-purple-500/10 px-2 py-1 rounded">ADMIN</span> : <span className="text-blue-400 text-xs font-bold bg-blue-500/10 px-2 py-1 rounded">CLIENTE</span>}</td>
                            <td className="p-3 text-right">
                              <button onClick={() => openUserForm(u)} className="text-gray-400 hover:text-blue-400 p-2"><FaEdit /></button>
                              <button onClick={() => handleDeleteUser(u.id)} className="text-gray-400 hover:text-red-400 p-2"><FaTrashAlt /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Modal Detalhes e Comentários do Roadmap */}
            {selectedStep && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-start border-b border-gray-800 pb-4">
                    <div><span className="text-xs uppercase font-semibold text-blue-400">Detalhes da Etapa</span><h3 className="text-xl font-bold mt-1 text-white">{selectedStep.title}</h3></div>
                    <button onClick={() => setSelectedStep(null)} className="text-gray-400 hover:text-white">✕</button>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">{selectedStep.description}</p>
                  
                  <div className="border-t border-gray-800 pt-4 space-y-4">
                    <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2"><FaCommentDots className="text-blue-500" /> Comentários ({selectedStep.comments?.length || 0})</h4>
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                      {selectedStep.comments && selectedStep.comments.map((c) => (
                        <div key={c.id} className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm flex justify-between items-start">
                          <div><span className="font-semibold text-blue-400 text-xs block">@{c.author}</span><p className="text-gray-300 text-xs mt-1">{c.text}</p></div>
                          {isAdmin && <button onClick={() => handleDeleteComment(c.id)} className="text-gray-500 hover:text-red-400 p-1"><FaTrashAlt size={12} /></button>}
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleAddComment} className="flex gap-2">
                      <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Comentar..." className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
                      <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold"><FaPaperPlane /></button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Modal Criar/Editar Etapa do Roadmap (Admin) */}
            {isStepModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
                  <div className="flex justify-between border-b border-gray-800 pb-4">
                    <h3 className="text-lg font-bold text-white"><FaUserShield className="inline text-purple-400 mr-2" /> {editingStep ? 'Editar Etapa' : 'Nova Etapa'}</h3>
                    <button onClick={() => setIsStepModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
                  </div>
                  <form onSubmit={handleSaveStep} className="space-y-4">
                    <div><label className="block text-xs font-semibold text-gray-400 mb-1">Título</label><input type="text" required value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" /></div>
                    <div><label className="block text-xs font-semibold text-gray-400 mb-1">Descrição</label><textarea rows={3} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-semibold text-gray-400 mb-1">Status</label><select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"><option value="planned">Planejado</option><option value="in_progress">Em Dev</option><option value="completed">Concluído</option></select></div>
                      <div><label className="block text-xs font-semibold text-gray-400 mb-1">Progresso ({formProgress}%)</label><input type="range" min="0" max="100" value={formProgress} onChange={(e) => setFormProgress(e.target.value)} className="w-full mt-3" /></div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                      <button type="button" onClick={() => setIsStepModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-400 hover:text-white border border-gray-800">Cancelar</button>
                      <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-semibold">{editingStep ? 'Salvar' : 'Criar'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
}