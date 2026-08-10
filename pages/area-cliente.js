import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabase';
import { 
  FaTruck, FaCodeBranch, FaCheckCircle, FaSpinner, FaClock, 
  FaCommentDots, FaPaperPlane, FaLock, FaExternalLinkAlt,
  FaPlus, FaEdit, FaTrashAlt, FaUserShield, FaChartPie,
  FaGoogleDrive, FaUserTie, FaDatabase, FaSearch,
  FaKey, FaUsers, FaUser, FaUserCircle, FaFilter, FaExclamationCircle, FaBell, FaTimes,
  FaTools, FaClipboardList, FaCar
} from 'react-icons/fa';

// Linha da tabela de "Solicitações de Serviço" no painel do admin.
// Componente separado porque cada linha precisa do próprio estado local
// pro campo de data/hora antes de enviar pro cliente.
function AdminServiceRow({ s, onUpdateStatus, onSetSchedule, onEdit, onDelete, serviceTypeLabel, serviceStatusLabel, serviceStatusColor }) {
  const [dataPrevista, setDataPrevista] = useState(
    s.data_hora_prevista ? new Date(s.data_hora_prevista).toISOString().slice(0, 16) : ''
  );

  const podeDefinirData = s.status === 'pendente' || s.status === 'recusado';
  const placaExibida = s.tipo_servico === 'nova_instalacao'
    ? `${s.placa_nova} (nova)`
    : (s.veiculos?.placa || '—');

  return (
    <tr className="hover:bg-gray-800/50 align-top">
      <td className="p-3 text-white font-medium">{s.empresas?.nome || '—'}</td>
      <td className="p-3 text-gray-300"><FaCar className="inline text-gray-500 mr-1" />{placaExibida}</td>
      <td className="p-3 text-gray-300">{serviceTypeLabel[s.tipo_servico] || s.tipo_servico}</td>
      <td className="p-3 text-gray-400 text-xs">
        {s.telefone_contato ? (
          <a href={`tel:${s.telefone_contato}`} className="text-cyan-400 hover:underline">{s.telefone_contato}</a>
        ) : '—'}
      </td>
      <td className="p-3 text-gray-400 text-xs max-w-[200px]">{s.descricao || '—'}</td>
      <td className="p-3">
        <span className={`text-xs font-bold px-2 py-1 rounded border whitespace-nowrap ${serviceStatusColor[s.status]}`}>{serviceStatusLabel[s.status] || s.status}</span>
        {s.status === 'recusado' && s.motivo_recusa && (
          <div className="text-[11px] text-red-400 mt-1 max-w-[160px]">Motivo: {s.motivo_recusa}</div>
        )}
      </td>
      <td className="p-3">
        {podeDefinirData ? (
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={dataPrevista}
              onChange={e => setDataPrevista(e.target.value)}
              className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500 w-[150px]"
            />
            <button
              onClick={() => onSetSchedule(s.id, dataPrevista)}
              title="Enviar data ao cliente"
              className="bg-cyan-600 hover:bg-cyan-500 text-white p-2 rounded-lg shrink-0"
            >
              <FaPaperPlane size={12} />
            </button>
          </div>
        ) : s.data_hora_prevista ? (
          <div className="text-xs text-gray-300 whitespace-nowrap">
            {new Date(s.data_hora_prevista).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          </div>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <select
            value={s.status}
            onChange={e => onUpdateStatus(s.id, e.target.value)}
            className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500"
          >
            <option value="pendente">Pendente</option>
            <option value="aguardando_confirmacao">Aguardando Confirmação</option>
            <option value="confirmado">Confirmado</option>
            <option value="recusado">Recusado</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <button onClick={() => onEdit(s)} title="Editar" className="text-gray-400 hover:text-blue-400 p-1.5"><FaEdit size={14} /></button>
          <button onClick={() => onDelete(s.id)} title="Excluir" className="text-gray-400 hover:text-red-400 p-1.5"><FaTrashAlt size={14} /></button>
        </div>
      </td>
    </tr>
  );
}

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
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
  const [formEmpresaId, setFormEmpresaId] = useState('');
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

  // Solicitações de Serviço (Admin)
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [isAdminServiceModalOpen, setIsAdminServiceModalOpen] = useState(false);
  const [filterServiceStatus, setFilterServiceStatus] = useState('all');
  const [filterServiceEmpresa, setFilterServiceEmpresa] = useState('all');

  // Solicitações de Serviço (Cliente) + veículos da empresa logada
  const [veiculos, setVeiculos] = useState([]);
  const [newServiceVeiculoId, setNewServiceVeiculoId] = useState('');
  const [newServiceTipo, setNewServiceTipo] = useState('manutencao');
  const [newServiceDescricao, setNewServiceDescricao] = useState('');
  const [newServiceEndereco, setNewServiceEndereco] = useState('');
  const [newServiceTelefone, setNewServiceTelefone] = useState('');
  const [newServicePlacaNova, setNewServicePlacaNova] = useState('');
  const [isSubmittingService, setIsSubmittingService] = useState(false);

  // Edição de solicitação (Admin)
  const [editingSolicitacao, setEditingSolicitacao] = useState(null);
  const [editServiceTipo, setEditServiceTipo] = useState('manutencao');
  const [editServiceVeiculoId, setEditServiceVeiculoId] = useState('');
  const [editServicePlacaNova, setEditServicePlacaNova] = useState('');
  const [editServiceTelefone, setEditServiceTelefone] = useState('');
  const [editServiceEndereco, setEditServiceEndereco] = useState('');
  const [editServiceDescricao, setEditServiceDescricao] = useState('');
  const [isSavingServiceEdit, setIsSavingServiceEdit] = useState(false);

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

    const { data: solicitacoesData, error: solicitacoesError } = await supabase
      .from('solicitacoes_servico')
      .select('*, empresas(nome), veiculos(placa, modelo)')
      .order('created_at', { ascending: false });
    if (!solicitacoesError && solicitacoesData) setSolicitacoes(solicitacoesData);

    const { data: veiculosData, error: veiculosError } = await supabase
      .from('veiculos')
      .select('id, empresa_id, placa, modelo, status')
      .order('placa');
    if (!veiculosError && veiculosData) setVeiculos(veiculosData);

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
    setLoginError('');
    setIsLoggingIn(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput,
      password: passwordInput,
    });

    if (error || !data?.user) {
      setLoginError('Email ou senha incorretos. Confira os dados e tente novamente.');
      setIsLoggingIn(false);
      return;
    }

    await loadCurrentUserProfile(data.user.id);
    await fetchInitialData();
    setEmailInput('');
    setPasswordInput('');
    setIsLoggingIn(false);
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
  // LÓGICA DE SOLICITAÇÕES DE SERVIÇO (Admin)
  // ==========================================
  const handleUpdateServiceStatus = async (id, newStatus) => {
    const { data, error } = await supabase
      .from('solicitacoes_servico')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, empresas(nome), veiculos(placa, modelo)')
      .single();

    if (error) { alert('Erro ao atualizar status da solicitação.'); return; }
    setSolicitacoes(solicitacoes.map(s => s.id === id ? data : s));
  };

  // Admin propõe (ou re-propõe) data/hora e envia pra confirmação do cliente
  const handleSetSchedule = async (id, dataHoraLocal) => {
    if (!dataHoraLocal) { alert('Escolha uma data e horário.'); return; }
    const { data, error } = await supabase
      .from('solicitacoes_servico')
      .update({
        data_hora_prevista: new Date(dataHoraLocal).toISOString(),
        status: 'aguardando_confirmacao',
        motivo_recusa: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, empresas(nome), veiculos(placa, modelo)')
      .single();

    if (error) { alert('Erro ao enviar data ao cliente.'); return; }
    setSolicitacoes(solicitacoes.map(s => s.id === id ? data : s));
  };

  // Admin edita os dados de uma solicitação
  const openEditSolicitacao = (s) => {
    setEditingSolicitacao(s);
    setEditServiceTipo(s.tipo_servico);
    setEditServiceVeiculoId(s.veiculo_id || '');
    setEditServicePlacaNova(s.placa_nova || '');
    setEditServiceTelefone(s.telefone_contato || '');
    setEditServiceEndereco(s.endereco || '');
    setEditServiceDescricao(s.descricao || '');
  };

  const handleSaveSolicitacaoEdit = async (e) => {
    e.preventDefault();
    if (!editingSolicitacao) return;

    const isNovaInstalacao = editServiceTipo === 'nova_instalacao';
    if (isNovaInstalacao && !editServicePlacaNova.trim()) { alert('Informe a placa a ser instalada.'); return; }
    if (!isNovaInstalacao && !editServiceVeiculoId) { alert('Selecione a placa do veículo.'); return; }

    setIsSavingServiceEdit(true);
    const { data, error } = await supabase
      .from('solicitacoes_servico')
      .update({
        tipo_servico: editServiceTipo,
        veiculo_id: isNovaInstalacao ? null : editServiceVeiculoId,
        placa_nova: isNovaInstalacao ? editServicePlacaNova.trim().toUpperCase() : null,
        telefone_contato: editServiceTelefone || null,
        endereco: editServiceEndereco || null,
        descricao: editServiceDescricao || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingSolicitacao.id)
      .select('*, empresas(nome), veiculos(placa, modelo)')
      .single();
    setIsSavingServiceEdit(false);

    if (error) { alert('Erro ao salvar edição.'); return; }
    setSolicitacoes(solicitacoes.map(s => s.id === data.id ? data : s));
    setEditingSolicitacao(null);
  };

  const handleDeleteSolicitacao = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta solicitação? Essa ação não pode ser desfeita.')) return;
    const { error } = await supabase.from('solicitacoes_servico').delete().eq('id', id);
    if (error) { alert('Erro ao excluir solicitação.'); return; }
    setSolicitacoes(solicitacoes.filter(s => s.id !== id));
  };

  const handleCreateServiceRequest = async (e) => {
    e.preventDefault();

    const isNovaInstalacao = newServiceTipo === 'nova_instalacao';

    if (isNovaInstalacao && !newServicePlacaNova.trim()) { alert('Informe a placa a ser instalada.'); return; }
    if (!isNovaInstalacao && !newServiceVeiculoId) { alert('Selecione a placa do veículo.'); return; }
    if (!newServiceTelefone.trim()) { alert('Informe um telefone para contato.'); return; }
    if (!currentUser?.empresa_id) { alert('Sua conta não está vinculada a uma empresa. Fale com o suporte.'); return; }

    setIsSubmittingService(true);
    const { data, error } = await supabase
      .from('solicitacoes_servico')
      .insert([{
        empresa_id: currentUser.empresa_id,
        veiculo_id: isNovaInstalacao ? null : newServiceVeiculoId,
        placa_nova: isNovaInstalacao ? newServicePlacaNova.trim().toUpperCase() : null,
        tipo_servico: newServiceTipo,
        descricao: newServiceDescricao || null,
        endereco: newServiceEndereco || null,
        telefone_contato: newServiceTelefone.trim(),
      }])
      .select('*, empresas(nome), veiculos(placa, modelo)')
      .single();
    setIsSubmittingService(false);

    if (error) { alert('Erro ao enviar solicitação. Tente novamente.'); return; }

    setSolicitacoes([data, ...solicitacoes]);
    setNewServiceVeiculoId('');
    setNewServiceTipo('manutencao');
    setNewServiceDescricao('');
    setNewServiceEndereco('');
    setNewServiceTelefone('');
    setNewServicePlacaNova('');
    alert('Solicitação enviada com sucesso!');
  };

  // Cliente aceita ou recusa a data/hora proposta pelo admin
  const handleClientRespondDate = async (id, decision) => {
    let motivo = null;
    if (decision === 'recusado') {
      motivo = prompt('Opcional: por que essa data não funciona pra você?') || null;
    }
    const { data, error } = await supabase
      .from('solicitacoes_servico')
      .update({
        status: decision, // 'confirmado' ou 'recusado'
        motivo_recusa: motivo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, empresas(nome), veiculos(placa, modelo)')
      .single();

    if (error) { alert('Erro ao responder a data proposta.'); return; }
    setSolicitacoes(solicitacoes.map(s => s.id === id ? data : s));
  };

  const myServiceRequests = useMemo(() => {
    if (!currentUser) return [];
    return solicitacoes.filter(s => s.empresa_id === currentUser.empresa_id);
  }, [solicitacoes, currentUser]);

  const filteredSolicitacoes = useMemo(() => {
    return solicitacoes.filter(s => {
      const statusOk = filterServiceStatus === 'all' || s.status === filterServiceStatus;
      const empresaOk = filterServiceEmpresa === 'all' || s.empresa_id === filterServiceEmpresa;
      return statusOk && empresaOk;
    });
  }, [solicitacoes, filterServiceStatus, filterServiceEmpresa]);

  const pendingServiceCount = useMemo(
    () => solicitacoes.filter(s => s.status === 'pendente').length,
    [solicitacoes]
  );

  const serviceTypeLabel = { manutencao: 'Manutenção', troca: 'Troca', desinstalacao: 'Desinstalação', nova_instalacao: 'Nova Instalação' };
  const serviceStatusLabel = {
    pendente: 'Pendente (aguardando triagem)',
    aguardando_confirmacao: 'Aguardando sua confirmação',
    confirmado: 'Confirmado',
    recusado: 'Data recusada',
    em_andamento: 'Em Andamento',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
  };
  const serviceStatusColor = {
    pendente: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    aguardando_confirmacao: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    confirmado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    recusado: 'bg-red-500/10 text-red-400 border-red-500/30',
    em_andamento: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    concluido: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    cancelado: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
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
    setFormEmpresaId(selectedClientView !== 'all' ? selectedClientView : (empresasComLogin[0]?.id || ''));
    setIsStepModalOpen(true);
  };

  const openEditStepModal = (step, e) => {
    e.stopPropagation(); setEditingStep(step); setFormTitle(step.title); setFormDescription(step.description); 
    setFormStatus(step.status); setFormEmpresaId(step.empresa_id || '');
    setIsStepModalOpen(true);
  };

  const handleSaveStep = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const notifyUsername = usernameByEmpresaId[formEmpresaId];

    if (editingStep) {
      const { data, error } = await supabase.from('steps').update({ title: formTitle, description: formDescription, status: formStatus, empresa_id: formEmpresaId }).eq('id', editingStep.id).select();
      if (!error && data) {
        setSteps(steps.map((s) => s.id === editingStep.id ? { ...data[0], comments: s.comments } : s));
        
        // DISPARA NOTIFICAÇÃO (Edição)
        if (isAdmin && notifyUsername) {
          const { data: nData } = await supabase.from('notifications').insert([{ target_user: notifyUsername, message: `A etapa "${formTitle}" foi atualizada pelo Admin.`, is_read: false }]).select();
          if (nData) setNotifications([...notifications, nData[0]]);
        }
      }
    } else {
      const { data, error } = await supabase.from('steps').insert([{ title: formTitle, description: formDescription, status: formStatus, empresa_id: formEmpresaId }]).select();
      if (!error && data) {
        setSteps([...steps, { ...data[0], comments: [] }]);

        // DISPARA NOTIFICAÇÃO (Criação)
        if (isAdmin && notifyUsername) {
          const { data: nData } = await supabase.from('notifications').insert([{ target_user: notifyUsername, message: `Nova etapa adicionada ao seu roadmap: "${formTitle}".`, is_read: false }]).select();
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
      const targetUser = isAdmin ? usernameByEmpresaId[selectedStep.empresa_id] : 'admin';
      if (targetUser) {
        const authorMasked = currentUser.username;
        const { data: nData } = await supabase.from('notifications').insert([{ target_user: targetUser, message: `Novo comentário de ${authorMasked} na etapa "${selectedStep.title}".`, is_read: false }]).select();
        if (nData) setNotifications([...notifications, nData[0]]);
      }
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

  // Mapa empresa_id -> username do login vinculado (usado só pra manter as notificações funcionando)
  const usernameByEmpresaId = useMemo(() => {
    const map = {};
    clientUsers.forEach(u => { if (u.empresa_id) map[u.empresa_id] = u.username; });
    return map;
  }, [clientUsers]);

  // Empresas "folha" (sem filhos) — são as que de fato têm login e roadmap próprio.
  // Grupos consolidadores (ex: "ADORO") ficam de fora do seletor do Roadmap.
  const empresaIdsComFilhos = useMemo(
    () => new Set(empresas.filter(e => e.grupo_id).map(e => e.grupo_id)),
    [empresas]
  );
  const empresasComLogin = useMemo(
    () => empresas.filter(e => !empresaIdsComFilhos.has(e.id)),
    [empresas, empresaIdsComFilhos]
  );

  // Filtra as notificações não lidas apenas para o usuário atual
  const myUnreadNotifs = useMemo(() => {
    if (!currentUser) return [];
    return notifications.filter(n => n.target_user === currentUser.username && !n.is_read).reverse();
  }, [notifications, currentUser]);

  const userSteps = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) {
      if (selectedClientView === 'all') return steps;
      return steps.filter(s => s.empresa_id === selectedClientView);
    }
    return steps.filter(s => s.empresa_id === currentUser.empresa_id);
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
              {loginError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
                  <FaExclamationCircle className="mt-0.5 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}
              <div><label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Email</label><input type="email" required value={emailInput} onChange={(e) => { setEmailInput(e.target.value); setLoginError(''); }} className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" /></div>
              <div><label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Senha</label><input type="password" required value={passwordInput} onChange={(e) => { setPasswordInput(e.target.value); setLoginError(''); }} className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" /></div>
              <button type="submit" disabled={isLoggingIn} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-all">
                {isLoggingIn ? <><FaSpinner className="animate-spin" /> Entrando...</> : 'Entrar'}
              </button>
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
                  <div className="flex items-center gap-3 flex-wrap">
                    <a href="/painel-admin" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg">
                      <FaChartPie /> Painel Administrativo
                    </a>
                    <button onClick={() => setIsAdminServiceModalOpen(true)} className="relative flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg">
                      <FaTools /> Solicitações de Serviço
                      {pendingServiceCount > 0 && (
                        <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold text-white shadow-lg">{pendingServiceCount}</span>
                      )}
                    </button>
                    <button onClick={() => setIsAdminUsersModalOpen(true)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg"><FaUsers /> Gerenciar Usuários</button>
                  </div>
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
                    {empresasComLogin.map(empresa => (
                      <option key={empresa.id} value={empresa.id}>
                        Cliente: {empresa.nome}
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

            {/* SEÇÃO SOLICITAÇÃO DE SERVIÇO (Cliente) */}
            {!isAdmin && (
              <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white"><FaTools className="text-amber-400" /> Solicitar Serviço</h2>

                <form onSubmit={handleCreateServiceRequest} className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-56">
                      <label className="block text-xs text-gray-400 mb-1">Tipo de serviço</label>
                      <select value={newServiceTipo} onChange={e => setNewServiceTipo(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500">
                        <option value="manutencao">Manutenção</option>
                        <option value="troca">Troca</option>
                        <option value="desinstalacao">Desinstalação</option>
                        <option value="nova_instalacao">Nova Instalação</option>
                      </select>
                    </div>

                    {newServiceTipo === 'nova_instalacao' ? (
                      <div className="flex-1 w-full">
                        <label className="block text-xs text-gray-400 mb-1">Placa a ser instalada</label>
                        <input type="text" required value={newServicePlacaNova} onChange={e => setNewServicePlacaNova(e.target.value)} placeholder="Ex: ABC1D23" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500 uppercase" />
                      </div>
                    ) : (
                      <div className="flex-1 w-full">
                        <label className="block text-xs text-gray-400 mb-1">Placa do veículo</label>
                        <select required value={newServiceVeiculoId} onChange={e => setNewServiceVeiculoId(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500">
                          <option value="">Selecione a placa...</option>
                          {veiculos.map(v => (
                            <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 w-full">
                      <label className="block text-xs text-gray-400 mb-1">Telefone para contato</label>
                      <input type="tel" required value={newServiceTelefone} onChange={e => setNewServiceTelefone(e.target.value)} placeholder="(11) 99999-9999" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500" />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="block text-xs text-gray-400 mb-1">Endereço para o serviço</label>
                      <input type="text" value={newServiceEndereco} onChange={e => setNewServiceEndereco(e.target.value)} placeholder="Rua, número, cidade..." className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500" />
                    </div>
                  </div>

                  <div className="flex-1 w-full">
                    <label className="block text-xs text-gray-400 mb-1">Descrição (opcional)</label>
                    <textarea value={newServiceDescricao} onChange={e => setNewServiceDescricao(e.target.value)} rows={3} placeholder="Detalhe o problema ou pedido..." className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500 resize-none" />
                  </div>
                  <button type="submit" disabled={isSubmittingService} className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-lg transition-all">
                    {isSubmittingService ? <FaSpinner className="animate-spin" /> : <FaPaperPlane />} Enviar Solicitação
                  </button>
                </form>

                {/* Histórico das próprias solicitações */}
                <div className="border border-gray-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-950 text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="p-3">Placa</th>
                        <th className="p-3">Serviço</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Data Prevista</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {myServiceRequests.length === 0 ? (
                        <tr><td colSpan={5} className="p-6 text-center text-gray-500 text-sm">Você ainda não enviou nenhuma solicitação.</td></tr>
                      ) : (
                        myServiceRequests.map(s => (
                          <tr key={s.id} className="hover:bg-gray-800/50 align-top">
                            <td className="p-3 text-white font-medium">
                              <FaCar className="inline text-gray-500 mr-1" />
                              {s.tipo_servico === 'nova_instalacao' ? `${s.placa_nova} (nova)` : (s.veiculos?.placa || '—')}
                            </td>
                            <td className="p-3 text-gray-300">{serviceTypeLabel[s.tipo_servico] || s.tipo_servico}</td>
                            <td className="p-3"><span className={`text-xs font-bold px-2 py-1 rounded border ${serviceStatusColor[s.status]}`}>{serviceStatusLabel[s.status] || s.status}</span></td>
                            <td className="p-3 text-gray-400 text-xs whitespace-nowrap">{s.data_hora_prevista ? new Date(s.data_hora_prevista).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                            <td className="p-3 text-right">
                              {s.status === 'aguardando_confirmacao' ? (
                                <div className="flex gap-2 justify-end">
                                  <button onClick={() => handleClientRespondDate(s.id, 'confirmado')} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Confirmar</button>
                                  <button onClick={() => handleClientRespondDate(s.id, 'recusado')} className="bg-red-600/80 hover:bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Recusar</button>
                                </div>
                              ) : (
                                <span className="text-gray-600 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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

            {/* 2.1 Modal Solicitações de Serviço */}
            {isAdminServiceModalOpen && isAdmin && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-gray-900 border border-amber-500/30 rounded-2xl max-w-6xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaTools className="text-amber-400"/> Solicitações de Serviço</h3>
                    <button onClick={() => setIsAdminServiceModalOpen(false)} className="text-gray-400 hover:text-white"><FaTimes/></button>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-400 mb-1">Status</label>
                      <select value={filterServiceStatus} onChange={e => setFilterServiceStatus(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500">
                        <option value="all">Todos</option>
                        <option value="pendente">Pendente</option>
                        <option value="aguardando_confirmacao">Aguardando Confirmação</option>
                        <option value="confirmado">Confirmado</option>
                        <option value="recusado">Recusado</option>
                        <option value="em_andamento">Em Andamento</option>
                        <option value="concluido">Concluído</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-400 mb-1">Empresa</label>
                      <select value={filterServiceEmpresa} onChange={e => setFilterServiceEmpresa(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500">
                        <option value="all">Todas</option>
                        {empresas.map(emp => (<option key={emp.id} value={emp.id}>{emp.nome}</option>))}
                      </select>
                    </div>
                  </div>

                  <div className="border border-gray-800 rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[1000px] text-left text-sm">
                      <thead className="bg-gray-950 text-gray-400 text-xs uppercase">
                        <tr>
                          <th className="p-3">Empresa</th>
                          <th className="p-3">Placa</th>
                          <th className="p-3">Serviço</th>
                          <th className="p-3">Telefone</th>
                          <th className="p-3">Descrição</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Agendamento</th>
                          <th className="p-3">Gerenciar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {filteredSolicitacoes.length === 0 ? (
                          <tr><td colSpan={8} className="p-6 text-center text-gray-500 text-sm">Nenhuma solicitação encontrada.</td></tr>
                        ) : (
                          filteredSolicitacoes.map(s => (
                            <AdminServiceRow
                              key={s.id}
                              s={s}
                              onUpdateStatus={handleUpdateServiceStatus}
                              onSetSchedule={handleSetSchedule}
                              onEdit={openEditSolicitacao}
                              onDelete={handleDeleteSolicitacao}
                              serviceTypeLabel={serviceTypeLabel}
                              serviceStatusLabel={serviceStatusLabel}
                              serviceStatusColor={serviceStatusColor}
                            />
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2.2 Modal Editar Solicitação */}
            {editingSolicitacao && isAdmin && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-gray-900 border border-blue-500/30 rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaEdit className="text-blue-400"/> Editar Solicitação</h3>
                    <button onClick={() => setEditingSolicitacao(null)} className="text-gray-400 hover:text-white"><FaTimes/></button>
                  </div>
                  <div className="text-xs text-gray-400">Empresa: <span className="text-white font-semibold">{editingSolicitacao.empresas?.nome}</span></div>

                  <form onSubmit={handleSaveSolicitacaoEdit} className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Tipo de serviço</label>
                      <select value={editServiceTipo} onChange={e => setEditServiceTipo(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                        <option value="manutencao">Manutenção</option>
                        <option value="troca">Troca</option>
                        <option value="desinstalacao">Desinstalação</option>
                        <option value="nova_instalacao">Nova Instalação</option>
                      </select>
                    </div>

                    {editServiceTipo === 'nova_instalacao' ? (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Placa a ser instalada</label>
                        <input type="text" required value={editServicePlacaNova} onChange={e => setEditServicePlacaNova(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 uppercase" />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Placa do veículo</label>
                        <select required value={editServiceVeiculoId} onChange={e => setEditServiceVeiculoId(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                          <option value="">Selecione a placa...</option>
                          {veiculos.filter(v => v.empresa_id === editingSolicitacao.empresa_id).map(v => (
                            <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Telefone para contato</label>
                      <input type="tel" value={editServiceTelefone} onChange={e => setEditServiceTelefone(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Endereço</label>
                      <input type="text" value={editServiceEndereco} onChange={e => setEditServiceEndereco(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Descrição</label>
                      <textarea value={editServiceDescricao} onChange={e => setEditServiceDescricao(e.target.value)} rows={3} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 resize-none" />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button type="submit" disabled={isSavingServiceEdit} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                        {isSavingServiceEdit ? 'Salvando...' : 'Salvar Alterações'}
                      </button>
                      <button type="button" onClick={() => setEditingSolicitacao(null)} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
                    </div>
                  </form>
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
                      <select required value={formEmpresaId} onChange={(e) => setFormEmpresaId(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500">
                        <option value="" disabled>Selecione um cliente</option>
                        {empresasComLogin.map(empresa => (<option key={empresa.id} value={empresa.id}>{empresa.nome}</option>))}
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