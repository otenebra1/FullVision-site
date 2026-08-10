import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabase';
import { 
  FaTruck, FaCodeBranch, FaCheckCircle, FaSpinner, FaClock, 
  FaCommentDots, FaPaperPlane, FaLock, FaExternalLinkAlt,
  FaPlus, FaEdit, FaTrashAlt, FaUserShield, FaChartPie,
  FaGoogleDrive, FaUserTie, FaDatabase, FaSearch,
  FaKey, FaUsers, FaUser, FaUserCircle, FaFilter, FaExclamationCircle, FaBell, FaTimes
} from 'react-icons/fa';

export default function AreaDoCliente() {
  // ==========================================
  // ESTADOS DO SISTEMA
  // ==========================================
  const [users, setUsers] = useState([]);
  const [steps, setSteps] = useState([]);
  const [notifications, setNotifications] = useState([]); // Novo: Estado das Notificações
  const [isLoading, setIsLoading] = useState(true);

  // Autenticação
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Filtros e Modais (Roadmap)
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedClientView, setSelectedClientView] = useState('all');
  
  const [selectedStep, setSelectedStep] = useState(null);
  const [isStepModalOpen, setIsStepModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState('Em desenvolvimento');
  const [formClientOwner, setFormClientOwner] = useState('');
  const [newComment, setNewComment] = useState('');

  // Modais (Usuários, Perfil e Notificações)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false); // Novo: Controle do dropdown do sino
  const [ownNewPassword, setOwnNewPassword] = useState('');
  const [isAdminUsersModalOpen, setIsAdminUsersModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormName, setUserFormName] = useState('');
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormRole, setUserFormRole] = useState('cliente');
  const [userFormTrackingUrl, setUserFormTrackingUrl] = useState('');
  const [userFormEmpresaId, setUserFormEmpresaId] = useState('');
  const [empresas, setEmpresas] = useState([]);

  // ==========================================
  // BUSCA INICIAL DE DADOS + SESSÃO (SUPABASE AUTH)
  // ==========================================
  useEffect(() => {
  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await loadCurrentUserProfile(session.user.id);
    }
    await fetchInitialData();
    setAuthChecked(true);
  };
  init();

  // Mantém o estado sincronizado caso a sessão expire/seja revogada em outra aba
  const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      setCurrentUser(null);
      setIsLoggedIn(false);
    }
  });

  return () => authListener.subscription.unsubscribe();
}, []);

  const fetchInitialData = async () => {
    setIsLoading(true);

    const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('*');
    if (!profilesError && profilesData) setUsers(profilesData);

    const { data: empresasData, error: empresasError } = await supabase.from('empresas').select('id, nome').order('nome');
    if (!empresasError && empresasData) setEmpresas(empresasData);

    const { data: stepsData, error: stepsError } = await supabase.from('steps').select('*');
    const { data: commentsData, error: commentsError } = await supabase.from('comments').select('*');
    const { data: notifData, error: notifError } = await supabase.from('notifications').select('*'); // Busca notificações

    if (!stepsError && !commentsError && stepsData) {
      const stepsWithComments = stepsData.map(step => ({
        ...step,
        comments: commentsData ? commentsData.filter(c => c.step_id === step.id) : []
      }));
      setSteps(stepsWithComments);
    }

    if (!notifError && notifData) {
      setNotifications(notifData);
    }
    
    setIsLoading(false);
  };

  // Busca o perfil (username, role, tracking_url) do usuário autenticado
  const loadCurrentUserProfile = async (userId) => {
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!error && profile) {
      setCurrentUser(profile);
      setIsLoggedIn(true);
    }
  };

  // ==========================================
  // LÓGICA DE LOGIN E PERFIL (SUPABASE AUTH)
  // ==========================================
  const handleLogin = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput,
      password: passwordInput,
    });

    if (error || !data?.user) {
      alert('Email ou senha incorretos!');
      return;
    }

    await loadCurrentUserProfile(data.user.id);
    await fetchInitialData();
    setEmailInput('');
    setPasswordInput('');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsLoggedIn(false);
    setIsNotifOpen(false);
  };

  const handleUpdateOwnPassword = async (e) => {
    e.preventDefault();
    if (!ownNewPassword.trim()) return;

    const { error } = await supabase.auth.updateUser({ password: ownNewPassword });

    if (error) {
      alert("Erro ao alterar senha.");
      return;
    }

    setOwnNewPassword('');
    setIsProfileModalOpen(false);
    alert('Senha alterada com sucesso!');
  };

  // ==========================================
  // LÓGICA DE GESTÃO DE USUÁRIOS (SÓ ADMIN)
  // Passa a chamar API routes protegidas, que usam a service_role key
  // no servidor (criar/editar usuário em auth.users é operação privilegiada)
  // ==========================================
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const openUserForm = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserFormName(user.username);
      setUserFormEmail(''); // edição não altera e-mail nesta versão
      setUserFormPassword('');
      setUserFormRole(user.role);
      setUserFormTrackingUrl(user.tracking_url || '');
      setUserFormEmpresaId(user.empresa_id || '');
    } else {
      setEditingUser(null);
      setUserFormName('');
      setUserFormEmail('');
      setUserFormPassword('');
      setUserFormRole('cliente');
      setUserFormTrackingUrl('');
      setUserFormEmpresaId('');
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();

    if (userFormRole !== 'admin' && !userFormEmpresaId) {
      alert('Selecione a empresa vinculada a este usuário.');
      return;
    }

    const token = await getAuthToken();

    if (editingUser) {
      const res = await fetch('/api/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: editingUser.id,
          username: userFormName,
          role: userFormRole,
          trackingUrl: userFormTrackingUrl,
          empresaId: userFormRole === 'admin' ? null : userFormEmpresaId,
          newPassword: userFormPassword || undefined, // só reseta se preenchido
        }),
      });
      const result = await res.json();
      if (!res.ok) { alert(result.error || 'Erro ao editar usuário.'); return; }
      setUsers(users.map(u => u.id === editingUser.id ? result.profile : u));
    } else {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: userFormEmail,
          password: userFormPassword,
          username: userFormName,
          role: userFormRole,
          trackingUrl: userFormTrackingUrl,
          empresaId: userFormRole === 'admin' ? null : userFormEmpresaId,
        }),
      });
      const result = await res.json();
      if (!res.ok) { alert(result.error || 'Erro ao criar usuário.'); return; }
      setUsers([...users, result.profile]);
    }

    setEditingUser(null);
    setUserFormName(''); setUserFormEmail(''); setUserFormPassword(''); setUserFormTrackingUrl(''); setUserFormEmpresaId('');
  };

  const handleDeleteUser = async (userId) => {
    if (userId === currentUser.id) return alert('Você não pode excluir a si mesmo!');
    if (confirm('Tem certeza que deseja excluir este usuário?')) {
      const token = await getAuthToken();
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      });
      const result = await res.json();
      if (!res.ok) { alert(result.error || 'Erro ao excluir usuário.'); return; }
      setUsers(users.filter(u => u.id !== userId));
    }
  };

  // ==========================================
  // LÓGICA DE NOTIFICAÇÕES (Marcar como Lido)
  // ==========================================
  const handleMarkAsRead = async (notifId) => {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
    if (!error) {
      setNotifications(notifications.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    }
  };

  // ==========================================
  // LÓGICA DO ROADMAP (Tabela de Etapas)
  // ==========================================
  const openNewStepModal = () => {
    setEditingStep(null); setFormTitle(''); setFormDescription(''); setFormStatus('Em desenvolvimento'); 
    setFormClientOwner(selectedClientView !== 'all' ? selectedClientView : (clientUsers[0]?.username || ''));
    setIsStepModalOpen(true);
  };

  const openEditStepModal = (step, e) => {
    e.stopPropagation(); setEditingStep(step); setFormTitle(step.title); setFormDescription(step.description); 
    setFormStatus(step.status); setFormClientOwner(step.client_owner || '');
    setIsStepModalOpen(true);
  };

  const handleSaveStep = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingStep) {
      const { data, error } = await supabase.from('steps').update({ title: formTitle, description: formDescription, status: formStatus, client_owner: formClientOwner }).eq('id', editingStep.id).select();
      if (!error && data) {
        setSteps(steps.map((s) => s.id === editingStep.id ? { ...data[0], comments: s.comments } : s));
        
        // DISPARA NOTIFICAÇÃO (Edição)
        if (isAdmin && formClientOwner) {
          const { data: nData } = await supabase.from('notifications').insert([{ target_user: formClientOwner, message: `A etapa "${formTitle}" foi atualizada pelo Admin.`, is_read: false }]).select();
          if (nData) setNotifications([...notifications, nData[0]]);
        }
      }
    } else {
      const { data, error } = await supabase.from('steps').insert([{ title: formTitle, description: formDescription, status: formStatus, client_owner: formClientOwner }]).select();
      if (!error && data) {
        setSteps([...steps, { ...data[0], comments: [] }]);

        // DISPARA NOTIFICAÇÃO (Criação)
        if (isAdmin && formClientOwner) {
          const { data: nData } = await supabase.from('notifications').insert([{ target_user: formClientOwner, message: `Nova etapa adicionada ao seu roadmap: "${formTitle}".`, is_read: false }]).select();
          if (nData) setNotifications([...notifications, nData[0]]);
        }
      }
    }
    setIsStepModalOpen(false);
  };

  const handleDeleteStep = async (stepId, e) => {
    e.stopPropagation();
    if (confirm('Excluir esta etapa permanentemente?')) {
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

    const { data, error } = await supabase.from('comments').insert([{ step_id: selectedStep.id, author: currentUser.username, text: newComment }]).select();

    if (!error && data) {
      const commentObj = data[0];
      const updatedSteps = steps.map((s) => s.id === selectedStep.id ? { ...s, comments: [...s.comments, commentObj] } : s);
      setSteps(updatedSteps);
      setSelectedStep({ ...selectedStep, comments: [...selectedStep.comments, commentObj] });
      setNewComment('');

      // DISPARA NOTIFICAÇÃO DE COMENTÁRIO
      const targetUser = isAdmin ? selectedStep.client_owner : 'admin';
      const authorMasked = currentUser.username === 'adoro_frango' ? "Ad'oro Frango" : currentUser.username === 'adoro_racao' ? "Ad'oro Ração" : currentUser.username;
      const { data: nData } = await supabase.from('notifications').insert([{ target_user: targetUser, message: `Novo comentário de ${authorMasked} na etapa "${selectedStep.title}".`, is_read: false }]).select();
      if (nData) setNotifications([...notifications, nData[0]]);
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
  // OTIMIZAÇÃO: FILTROS E CÁLCULOS (useMemo)
  // ==========================================
  const isAdmin = currentUser?.role === 'admin';
  const clientUsers = useMemo(() => users.filter(u => u.role === 'cliente'), [users]);

  // Filtra as notificações não lidas apenas para o usuário atual
  const myUnreadNotifs = useMemo(() => {
    if (!currentUser) return [];
    return notifications.filter(n => n.target_user === currentUser.username && !n.is_read).reverse();
  }, [notifications, currentUser]);

  const userSteps = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) {
      if (selectedClientView === 'all') return steps;
      return steps.filter(s => s.client_owner === selectedClientView);
    }
    return steps.filter(s => s.client_owner === currentUser.username);
  }, [steps, currentUser, isAdmin, selectedClientView]);

  const chartData = useMemo(() => {
    const total = userSteps.length;
    const completed = userSteps.filter((s) => s.status === 'Concluído' || s.status === 'completed').length;
    const inProgress = userSteps.filter((s) => s.status === 'Em desenvolvimento' || s.status === 'in_progress').length;
    const delayed = userSteps.filter((s) => s.status === 'Pendente em atraso').length;
    const planned = userSteps.filter((s) => s.status === 'Pendente' || s.status === 'planned').length;

    const pctComp = total ? Math.round((completed / total) * 100) : 0;
    const pctInProg = total ? Math.round((inProgress / total) * 100) : 0;
    const pctDelayed = total ? Math.round((delayed / total) * 100) : 0;
    const pctPlan = total ? Math.round((planned / total) * 100) : 0;

    const degComp = (completed / (total || 1)) * 360;
    const degInProg = degComp + (inProgress / (total || 1)) * 360;
    const degDelayed = degInProg + (delayed / (total || 1)) * 360;

    const gradient = { background: `conic-gradient(#10b981 0deg ${degComp}deg, #3b82f6 ${degComp}deg ${degInProg}deg, #ef4444 ${degInProg}deg ${degDelayed}deg, #374151 ${degDelayed}deg 360deg)` };

    return { total, completed, inProgress, delayed, planned, pctComp, pctInProg, pctDelayed, pctPlan, gradient };
  }, [userSteps]);

  const filteredSteps = useMemo(() => {
    return userSteps.filter((step) => {
      const matchSearch = step.title.toLowerCase().includes(searchTerm.toLowerCase()) || (step.description && step.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchStatus = filterStatus === 'all' ? true : step.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [userSteps, searchTerm, filterStatus]);

  if (isLoading || !authChecked) {
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
              <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30"><FaLock className="text-2xl" /></div>
              <h1 className="text-2xl font-bold">Portal de Acesso</h1>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div><label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Email</label><input type="email" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" /></div>
              <div><label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Senha</label><input type="password" required value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" /></div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-all">Entrar</button>
            </form>
          </div>
        ) : (
          /* ================= PAINEL LOGADO ================= */
          <div className="space-y-10">
            {/* Header com Perfil e SINO DE NOTIFICAÇÃO */}
            <div className="relative z-40 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/60 border border-gray-800 rounded-2xl p-6 backdrop-blur-md">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <FaUserCircle className="text-blue-500" /> Olá, {currentUser.username === 'adoro_frango' ? "Ad'oro Frango" : currentUser.username === 'adoro_racao' ? "Ad'oro Ração" : currentUser.username}!
                  </h1>
                  {isAdmin ? (<span className="bg-purple-500/10 text-purple-400 text-xs px-2 py-0.5 rounded border border-purple-500/30">ADMIN</span>) : (<span className="bg-blue-500/10 text-blue-400 text-xs px-2 py-0.5 rounded border border-blue-500/30">CLIENTE</span>)}
                </div>
              </div>
              
              <div className="flex items-center gap-4 self-start md:self-auto">
                
                {/* INÍCIO DO COMPONENTE DO SINO */}
                <div className="relative">
                  <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="relative p-2 text-gray-400 hover:text-white transition-colors bg-gray-800 rounded-full border border-gray-700">
                    <FaBell size={18} />
                    {myUnreadNotifs.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold text-white shadow-lg">
                        {myUnreadNotifs.length}
                      </span>
                    )}
                  </button>

                  {isNotifOpen && (
                    <div className="absolute right-0 mt-3 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                      <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                        <span className="font-bold text-sm text-white">Notificações</span>
                        <button onClick={() => setIsNotifOpen(false)} className="text-gray-500 hover:text-white"><FaTimes /></button>
                      </div>
                      <div className="max-h-60 overflow-y-auto divide-y divide-gray-800/50">
                        {myUnreadNotifs.length === 0 ? (
                          <div className="p-4 text-center text-xs text-gray-500">Nenhum novo aviso.</div>
                        ) : (
                          myUnreadNotifs.map(n => (
                            <div key={n.id} onClick={() => handleMarkAsRead(n.id)} className="p-4 hover:bg-gray-800/50 cursor-pointer flex gap-3 items-start group">
                              <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5 group-hover:scale-125 transition-transform" title="Clique para marcar como lida" />
                              <p className="text-xs text-gray-300 leading-relaxed">{n.message}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {/* FIM DO COMPONENTE DO SINO */}

                <button onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 px-3 py-2 rounded-lg"><FaKey /> Trocar Senha</button>
                <button onClick={handleLogout} className="text-xs font-medium text-gray-400 hover:text-red-400 transition-colors border border-gray-700 px-3 py-2 rounded-lg">Sair</button>
              </div>
            </div>

            {/* SEÇÃO ADMIN (Links + Gestão de Usuários) */}
            {isAdmin && (
              <div className="bg-gradient-to-r from-purple-950/50 via-gray-900 to-gray-900 border border-purple-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><FaUserShield className="text-purple-400"/> Ferramentas Administrativas</h2>
                  <button onClick={() => setIsAdminUsersModalOpen(true)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg"><FaUsers /> Gerenciar Usuários</button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <a href="https://drive.google.com/drive/u/1/folders/1jra6a5Te3NBLsyrpNCds0JGk-t01Rs7a" className="bg-gray-950/80 hover:bg-gray-800 border border-gray-800 rounded-xl p-3 flex items-center gap-3 transition-all"><FaGoogleDrive className="text-emerald-400 text-lg" /> <span className="text-sm font-semibold">Drive</span></a>
                  <a href="https://tracker.fullvision.one/v1/home" target="_blank" rel="noreferrer" className="bg-gray-950/80 hover:bg-gray-800 border border-gray-800 rounded-xl p-3 flex items-center gap-3 transition-all"><FaTruck className="text-blue-400 text-lg" /> <span className="text-sm font-semibold">Tracker</span></a>
                  <a href="https://www.admin.fullvision.one" className="bg-gray-950/80 hover:bg-gray-800 border border-gray-800 rounded-xl p-3 flex items-center gap-3 transition-all"><FaUserTie className="text-amber-400 text-lg" /> <span className="text-sm font-semibold">Admin</span></a>
                  <a href="https://www.appsheet.com/start/0033dbd6-2755-404f-8612-c1353a4ccb6b?platform=desktop#appName=Full-ERP-359222463&vss=H4sIAAAAAAAAA62PTQrCMBCFryKzDh4gWxUUURcVN00XsZlAMG1Kkqol5FQewYuZ-IO4LS7nzXxv3gtwVngpPK9PQMvwndY4AIXAYD90yIAymJnWW6MZEAZb3rzEpXL-frOqNpPdtGAQIVbk4-LRAQ1jTOg_khBQAluvpEKbHTOfnN50Wmc2Cb8kRAJN7_lR47NCJqXSHu0cJe-1T53KKsZ0Jk3dOxSHlHR0QrdqF9eOt2JjRPoluXYYH-L1uVyWAQAA&view=Histórico%20O.S" className="bg-gray-950/80 hover:bg-gray-800 border border-gray-800 rounded-xl p-3 flex items-center gap-3 transition-all"><FaDatabase className="text-indigo-400 text-lg" /> <span className="text-sm font-semibold">ERP</span></a>
                </div>
              </div>
            )}

            {/* CAIXA DE SELEÇÃO DE CLIENTE */}
            {isAdmin && (
              <div className="bg-gradient-to-r from-gray-900 to-gray-900/80 border border-gray-800 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-5 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <div className="flex items-center gap-3 text-gray-300 min-w-max">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20"><FaFilter className="text-blue-500" /></div>
                  <span className="font-bold text-sm tracking-wide text-white uppercase">Visualizar Roadmap de:</span>
                </div>
                <div className="relative w-full md:w-72">
                  <select value={selectedClientView} onChange={(e) => setSelectedClientView(e.target.value)} className="w-full appearance-none bg-gray-950 border border-gray-700 text-white text-sm font-medium rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-blue-500 transition-all cursor-pointer shadow-inner">
                    <option value="all">Visão Geral (Todos)</option>
                    {clientUsers.map(client => (
                      <option key={client.id} value={client.username}>
                        {client.username === 'adoro_frango' ? "Ad'oro Frango" : client.username === 'adoro_racao' ? "Ad'oro Ração" : `Cliente: ${client.username}`}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-blue-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div>
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
              <a href={currentUser?.tracking_url || 'https://tracker.fullvision.one/v1/home'} target="_blank" rel="noopener noreferrer" className="w-full md:w-auto inline-flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3.5 rounded-xl shadow-lg transition-all hover:scale-105">Abrir Plataforma <FaExternalLinkAlt className="text-sm" /></a>
            </div>

            {/* GRÁFICO ROADMAP OTIMIZADO */}
            <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white"><FaChartPie className="text-blue-500" /> Resumo do Status do Roadmap</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="flex justify-center items-center">
                  <div className="relative w-48 h-48 rounded-full p-2 shadow-2xl flex items-center justify-center" style={chartData.gradient}>
                    <div className="w-32 h-32 bg-gray-950 rounded-full flex flex-col items-center justify-center border border-gray-800 shadow-inner">
                      <span className="text-2xl font-extrabold text-white">{chartData.total}</span>
                      <span className="text-[10px] uppercase font-semibold text-gray-400">Etapas Totais</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col bg-gray-950 p-4 rounded-xl border border-emerald-500/20"><div className="flex items-center gap-2 mb-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-xs font-semibold text-gray-300">Concluídas</span></div><span className="text-xl font-bold text-emerald-400">{chartData.completed} <span className="text-xs text-gray-500 font-medium">({chartData.pctComp}%)</span></span></div>
                  <div className="flex flex-col bg-gray-950 p-4 rounded-xl border border-blue-500/20"><div className="flex items-center gap-2 mb-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-xs font-semibold text-gray-300">Em Desenvolv.</span></div><span className="text-xl font-bold text-blue-400">{chartData.inProgress} <span className="text-xs text-gray-500 font-medium">({chartData.pctInProg}%)</span></span></div>
                  <div className="flex flex-col bg-gray-950 p-4 rounded-xl border border-red-500/20"><div className="flex items-center gap-2 mb-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-xs font-semibold text-gray-300">Atrasadas</span></div><span className="text-xl font-bold text-red-400">{chartData.delayed} <span className="text-xs text-gray-500 font-medium">({chartData.pctDelayed}%)</span></span></div>
                  <div className="flex flex-col bg-gray-950 p-4 rounded-xl border border-gray-700"><div className="flex items-center gap-2 mb-2"><div className="w-3 h-3 rounded-full bg-gray-600" /><span className="text-xs font-semibold text-gray-300">Pendentes</span></div><span className="text-xl font-bold text-gray-400">{chartData.planned} <span className="text-xs text-gray-500 font-medium">({chartData.pctPlan}%)</span></span></div>
                </div>
              </div>
            </div>

            {/* TABELA DE DESENVOLVIMENTO */}
            <div className="bg-gray-900/70 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 border-b border-gray-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h2 className="text-xl font-bold flex items-center gap-2"><FaCodeBranch className="text-blue-500" /> Tabela de Entregas</h2>
                  {isAdmin && (<button onClick={openNewStepModal} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-lg transition-all"><FaPlus /> Nova Etapa</button>)}
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-950/50 p-2 rounded-xl border border-gray-800">
                  <div className="flex gap-1 overflow-x-auto w-full md:w-auto">
                    {['all', 'Em desenvolvimento', 'Pendente', 'Pendente em atraso', 'Concluído'].map(status => (
                      <button key={status} onClick={() => setFilterStatus(status)} className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === status ? 'bg-gray-800 text-white border border-gray-700' : 'text-gray-400 hover:text-white'}`}>{status === 'all' ? 'Todas' : status}</button>
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
                    <tr className="bg-gray-950/80 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400"><th className="p-4 font-semibold w-40">Status</th><th className="p-4 font-semibold">Título da Etapa</th><th className="p-4 font-semibold text-center w-32">Mensagens</th>{isAdmin && <th className="p-4 font-semibold text-right w-24">Ações</th>}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {filteredSteps.length === 0 && (<tr><td colSpan="4" className="p-8 text-center text-gray-500 text-sm">Nenhuma etapa encontrada.</td></tr>)}
                    {filteredSteps.map((step) => (
                      <tr key={step.id} onClick={() => setSelectedStep(step)} className="hover:bg-gray-800/30 transition-colors cursor-pointer group">
                        <td className="p-4 align-middle">
                          {(step.status === 'Concluído' || step.status === 'completed') && <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-md border border-emerald-500/20"><FaCheckCircle /> Concluído</span>}
                          {(step.status === 'Em desenvolvimento' || step.status === 'in_progress') && <span className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-400 text-xs font-semibold px-2.5 py-1 rounded-md border border-blue-500/20"><FaSpinner className="animate-spin" /> Em Dev</span>}
                          {(step.status === 'Pendente em atraso') && <span className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-400 text-xs font-semibold px-2.5 py-1 rounded-md border border-red-500/20"><FaExclamationCircle /> Em Atraso</span>}
                          {(step.status === 'Pendente' || step.status === 'planned') && <span className="inline-flex items-center gap-1.5 bg-gray-800 text-gray-400 text-xs font-semibold px-2.5 py-1 rounded-md border border-gray-700"><FaClock /> Pendente</span>}
                        </td>
                        <td className="p-4 align-middle">
                          <h3 className="text-sm font-semibold text-gray-200 group-hover:text-blue-400">{step.title}</h3>
                          <p className="text-xs text-gray-500 truncate max-w-xs">{step.description}</p>
                        </td>
                        <td className="p-4 align-middle text-center"><span className={`inline-flex items-center gap-1.5 bg-gray-950 px-3 py-1 rounded-lg border border-gray-800 text-xs ${step.comments && step.comments.length > 0 ? "text-blue-400" : "text-gray-600"}`}><FaCommentDots /> {step.comments ? step.comments.length : 0}</span></td>
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

            {/* 1. Modal Trocar Senha */}
            {isProfileModalOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-sm w-full p-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaKey className="text-blue-400"/> Trocar Senha</h3>
                    <button onClick={() => setIsProfileModalOpen(false)} className="text-gray-400 hover:text-white"><FaTimes/></button>
                  </div>
                  <form onSubmit={handleUpdateOwnPassword} className="space-y-4">
                    <div><label className="block text-xs font-semibold text-gray-400 mb-1">Nova Senha</label><input type="password" required value={ownNewPassword} onChange={(e) => setOwnNewPassword(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500 outline-none" /></div>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">Salvar Nova Senha</button>
                  </form>
                </div>
              </div>
            )}

            {/* 2. Modal Gerenciar Usuários */}
            {isAdminUsersModalOpen && isAdmin && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-gray-900 border border-purple-500/30 rounded-2xl max-w-3xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaUsers className="text-purple-400"/> Gerenciamento de Usuários</h3>
                    <button onClick={() => setIsAdminUsersModalOpen(false)} className="text-gray-400 hover:text-white"><FaTimes/></button>
                  </div>
                  <form onSubmit={handleSaveUser} className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1 w-full"><label className="block text-xs text-gray-400 mb-1">Usuário (nome de exibição)</label><input type="text" required value={userFormName} onChange={e => setUserFormName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" /></div>
                      <div className="w-full md:w-32"><label className="block text-xs text-gray-400 mb-1">Cargo</label><select value={userFormRole} onChange={e => setUserFormRole(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500"><option value="cliente">Cliente</option><option value="admin">Admin</option></select></div>
                    </div>
                    {!editingUser && (
                      <div className="flex-1 w-full"><label className="block text-xs text-gray-400 mb-1">Email de acesso</label><input type="email" required value={userFormEmail} onChange={e => setUserFormEmail(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" /></div>
                    )}
                    {userFormRole !== 'admin' && (
                      <div className="flex-1 w-full">
                        <label className="block text-xs text-gray-400 mb-1">Empresa</label>
                        <select required value={userFormEmpresaId} onChange={e => setUserFormEmpresaId(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500">
                          <option value="">Selecione a empresa...</option>
                          {empresas.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.nome}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex-1 w-full"><label className="block text-xs text-gray-400 mb-1">{editingUser ? 'Nova senha (deixe em branco para manter)' : 'Senha inicial'}</label><input type="text" required={!editingUser} value={userFormPassword} onChange={e => setUserFormPassword(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" /></div>
                    <div className="flex-1 w-full"><label className="block text-xs text-gray-400 mb-1">Link da plataforma de rastreio</label><input type="url" value={userFormTrackingUrl} onChange={e => setUserFormTrackingUrl(e.target.value)} placeholder="https://tracker.fullvision.one/..." className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" /></div>
                    <div className="flex gap-3">
                      <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap">{editingUser ? 'Salvar Edição' : '+ Adicionar'}</button>
                      {editingUser && <button type="button" onClick={() => openUserForm(null)} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>}
                    </div>
                  </form>
                  <div className="border border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-950 text-gray-400 text-xs uppercase"><tr><th className="p-3">Usuário</th><th className="p-3">Cargo</th><th className="p-3">Empresa</th><th className="p-3">Link de Rastreio</th><th className="p-3 text-right">Ações</th></tr></thead>
                      <tbody className="divide-y divide-gray-800">
                        {users.map(u => (
                          <tr key={u.id} className="hover:bg-gray-800/50"><td className="p-3 text-white font-medium"><FaUser className="inline text-gray-500 mr-2"/>{u.username}</td><td className="p-3">{u.role === 'admin' ? <span className="text-purple-400 text-xs font-bold bg-purple-500/10 px-2 py-1 rounded">ADMIN</span> : <span className="text-blue-400 text-xs font-bold bg-blue-500/10 px-2 py-1 rounded">CLIENTE</span>}</td><td className="p-3 text-gray-400 text-xs">{empresas.find(emp => emp.id === u.empresa_id)?.nome || '—'}</td><td className="p-3 text-gray-400 text-xs truncate max-w-[160px]">{u.tracking_url || '—'}</td><td className="p-3 text-right"><button onClick={() => openUserForm(u)} className="text-gray-400 hover:text-blue-400 p-2"><FaEdit /></button><button onClick={() => handleDeleteUser(u.id)} className="text-gray-400 hover:text-red-400 p-2"><FaTrashAlt /></button></td></tr>
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
                    <div>
                      <span className={`text-xs uppercase font-semibold ${selectedStep.status === 'Pendente em atraso' ? 'text-red-400' : 'text-blue-400'}`}>
                        {selectedStep.status === 'Concluído' || selectedStep.status === 'completed' ? 'Concluído' : selectedStep.status === 'Em desenvolvimento' || selectedStep.status === 'in_progress' ? 'Em Desenvolvimento' : selectedStep.status === 'Pendente em atraso' ? 'Pendente em atraso' : 'Pendente'}
                      </span>
                      <h3 className="text-xl font-bold mt-1 text-white">{selectedStep.title}</h3>
                    </div>
                    <button onClick={() => setSelectedStep(null)} className="text-gray-400 hover:text-white"><FaTimes/></button>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">{selectedStep.description}</p>
                  
                  <div className="border-t border-gray-800 pt-4 space-y-4">
                    <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2"><FaCommentDots className="text-blue-500" /> Comentários ({selectedStep.comments?.length || 0})</h4>
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                      {selectedStep.comments && selectedStep.comments.map((c) => (
                        <div key={c.id} className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm flex justify-between items-start">
                          <div><span className="font-semibold text-blue-400 text-xs block">@{c.author === 'adoro_frango' ? "Ad'oro Frango" : c.author === 'adoro_racao' ? "Ad'oro Ração" : c.author}</span><p className="text-gray-300 text-xs mt-1">{c.text}</p></div>
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
                    <button onClick={() => setIsStepModalOpen(false)} className="text-gray-400 hover:text-white"><FaTimes/></button>
                  </div>
                  <form onSubmit={handleSaveStep} className="space-y-4">
                    <div><label className="block text-xs font-semibold text-gray-400 mb-1">Título</label><input type="text" required value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" /></div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Pertence ao Cliente:</label>
                      <select required value={formClientOwner} onChange={(e) => setFormClientOwner(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500">
                        <option value="" disabled>Selecione um cliente</option>
                        {clientUsers.map(client => (<option key={client.id} value={client.username}>{client.username === 'adoro_frango' ? "Ad'oro Frango" : client.username === 'adoro_racao' ? "Ad'oro Ração" : client.username}</option>))}
                      </select>
                    </div>
                    <div><label className="block text-xs font-semibold text-gray-400 mb-1">Descrição</label><textarea rows={3} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" /></div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Status</label>
                      <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500">
                        <option value="Pendente">Pendente</option>
                        <option value="Pendente em atraso">Pendente em atraso</option>
                        <option value="Em desenvolvimento">Em desenvolvimento</option>
                        <option value="Concluído">Concluído</option>
                      </select>
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