import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import {
  FaTruck, FaCheckCircle, FaTimesCircle, FaBuilding, FaMoneyBillWave,
  FaTools, FaSpinner, FaArrowLeft, FaChartPie, FaLayerGroup, FaExclamationCircle,
  FaDatabase, FaSearch, FaPlus, FaEdit, FaTrashAlt, FaTimes, FaChevronLeft, FaChevronRight,
  FaSatelliteDish, FaLink, FaUnlink, FaBoxes,
} from 'react-icons/fa';

// ==========================================
// Card de estatística do topo do dashboard
// ==========================================
function StatCard({ icon, label, value, colorClass }) {
  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${colorClass}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-gray-400 uppercase font-semibold">{label}</div>
      </div>
    </div>
  );
}

// ==========================================
// Linha de resumo (usada tanto pro grupo quanto pela unidade filha)
// ==========================================
function ResumoRow({ nome, isGrupo, total, ativos, inativos, mensalidade, custoTotal }) {
  return (
    <tr className={isGrupo ? 'bg-gray-800/60 font-semibold' : 'hover:bg-gray-800/40'}>
      <td className={`p-3 text-white ${isGrupo ? '' : 'pl-8 text-gray-300 font-normal'}`}>
        {isGrupo && <FaLayerGroup className="inline text-purple-400 mr-2" />}
        {nome}
      </td>
      <td className="p-3 text-gray-300">{total}</td>
      <td className="p-3 text-emerald-400">{ativos}</td>
      <td className="p-3 text-red-400">{inativos}</td>
      <td className="p-3 text-gray-300">
        {mensalidade.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </td>
      <td className="p-3 text-gray-300">
        {custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </td>
    </tr>
  );
}

export default function PainelAdmin() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [empresas, setEmpresas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Banco de Dados de Veículos
  const [searchPlaca, setSearchPlaca] = useState('');
  const [filterEmpresaId, setFilterEmpresaId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vFormEmpresaId, setVFormEmpresaId] = useState('');
  const [vFormPlaca, setVFormPlaca] = useState('');
  const [vFormStatus, setVFormStatus] = useState('Ativo');
  const [vFormOperacao, setVFormOperacao] = useState('');
  const [vFormModelo, setVFormModelo] = useState('');
  const [vFormIdInstalado, setVFormIdInstalado] = useState('');
  const [vFormDataInst, setVFormDataInst] = useState('');
  const [vFormDataDesinst, setVFormDataDesinst] = useState('');
  const [vFormMensalidade, setVFormMensalidade] = useState('');
  const [vFormCustoTotal, setVFormCustoTotal] = useState('');
  const [vFormDrePlaca, setVFormDrePlaca] = useState('');
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);

  // Rastreadores (Estoque)
  const [rastreadores, setRastreadores] = useState([]);
  const [searchRastreador, setSearchRastreador] = useState('');
  const [filterRastreadorStatus, setFilterRastreadorStatus] = useState('all');
  const [rastreadorPage, setRastreadorPage] = useState(1);
  const rastreadoresPerPage = 20;

  const [isRastreadorModalOpen, setIsRastreadorModalOpen] = useState(false);
  const [editingRastreador, setEditingRastreador] = useState(null);
  const [rFormCategoria, setRFormCategoria] = useState('');
  const [rFormModelo, setRFormModelo] = useState('');
  const [rFormSerial, setRFormSerial] = useState('');
  const [rFormSimCard, setRFormSimCard] = useState('');
  const [rFormOperadora, setRFormOperadora] = useState('');
  const [rFormDataEntrada, setRFormDataEntrada] = useState('');
  const [rFormCustoAquisicao, setRFormCustoAquisicao] = useState('');
  const [rFormCustoMensal, setRFormCustoMensal] = useState('');
  const [rFormValorMensalidade, setRFormValorMensalidade] = useState('');
  const [rFormStatus, setRFormStatus] = useState('estoque_central');
  const [rFormLocalizacao, setRFormLocalizacao] = useState('');
  const [isSavingRastreador, setIsSavingRastreador] = useState(false);

  const [installTargetRastreador, setInstallTargetRastreador] = useState(null);
  const [installVeiculoId, setInstallVeiculoId] = useState('');

  // ------------------------------------------
  // Guard de acesso: só admin passa
  // ------------------------------------------
  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace('/area-cliente');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role !== 'admin') {
        router.replace('/area-cliente');
        return;
      }

      setIsAuthorized(true);
      setAuthChecked(true);
    };
    checkAccess();
  }, [router]);

  // ------------------------------------------
  // Carrega os dados do dashboard (só depois de autorizado)
  // ------------------------------------------
  useEffect(() => {
    if (!isAuthorized) return;

    const fetchData = async () => {
      setIsLoadingData(true);

      const { data: empresasData } = await supabase
        .from('empresas')
        .select('id, nome, grupo_id')
        .order('nome');
      if (empresasData) setEmpresas(empresasData);

      const { data: veiculosData } = await supabase
        .from('veiculos')
        .select('*')
        .order('placa');
      if (veiculosData) setVeiculos(veiculosData);

      const { count } = await supabase
        .from('solicitacoes_servico')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente');
      setPendingRequestsCount(count || 0);

      const { data: rastreadoresData } = await supabase
        .from('rastreadores')
        .select('*')
        .order('serial');
      if (rastreadoresData) setRastreadores(rastreadoresData);

      setIsLoadingData(false);
    };
    fetchData();
  }, [isAuthorized]);

  // ------------------------------------------
  // Agregações
  // ------------------------------------------
  const stats = useMemo(() => {
    const ativos = veiculos.filter(v => v.status === 'Ativo').length;
    const inativos = veiculos.filter(v => v.status !== 'Ativo').length;
    const mensalidadeAtivaTotal = veiculos
      .filter(v => v.status === 'Ativo')
      .reduce((sum, v) => sum + (Number(v.mensalidade) || 0), 0);
    return { ativos, inativos, total: veiculos.length, mensalidadeAtivaTotal };
  }, [veiculos]);

  // Empresas "folha" (sem filhos) = unidades reais de cliente
  const empresaIdsComFilhos = useMemo(
    () => new Set(empresas.filter(e => e.grupo_id).map(e => e.grupo_id)),
    [empresas]
  );

  const clientesAtivos = useMemo(() => {
    const leafIds = empresas.filter(e => !empresaIdsComFilhos.has(e.id)).map(e => e.id);
    const comVeiculoAtivo = new Set(
      veiculos.filter(v => v.status === 'Ativo').map(v => v.empresa_id)
    );
    return leafIds.filter(id => comVeiculoAtivo.has(id)).length;
  }, [empresas, empresaIdsComFilhos, veiculos]);

  // Agrega veículos por empresa
  const resumoPorEmpresa = useMemo(() => {
    const map = {};
    empresas.forEach(e => {
      map[e.id] = { total: 0, ativos: 0, inativos: 0, mensalidade: 0, custoTotal: 0 };
    });
    veiculos.forEach(v => {
      const r = map[v.empresa_id];
      if (!r) return;
      r.total += 1;
      if (v.status === 'Ativo') { r.ativos += 1; r.mensalidade += Number(v.mensalidade) || 0; }
      else r.inativos += 1;
      r.custoTotal += Number(v.custo_total) || 0;
    });
    return map;
  }, [empresas, veiculos]);

  // Monta a hierarquia: grupos (com soma dos filhos) + clientes avulsos
  const hierarquia = useMemo(() => {
    const grupos = empresas.filter(e => !e.grupo_id && empresaIdsComFilhos.has(e.id));
    const avulsos = empresas.filter(e => !e.grupo_id && !empresaIdsComFilhos.has(e.id));

    const gruposComFilhos = grupos.map(g => {
      const filhos = empresas.filter(e => e.grupo_id === g.id);
      const somaGrupo = filhos.reduce((acc, f) => {
        const r = resumoPorEmpresa[f.id] || { total: 0, ativos: 0, inativos: 0, mensalidade: 0, custoTotal: 0 };
        return {
          total: acc.total + r.total,
          ativos: acc.ativos + r.ativos,
          inativos: acc.inativos + r.inativos,
          mensalidade: acc.mensalidade + r.mensalidade,
          custoTotal: acc.custoTotal + r.custoTotal,
        };
      }, { total: 0, ativos: 0, inativos: 0, mensalidade: 0, custoTotal: 0 });

      return { grupo: g, resumo: somaGrupo, filhos };
    });

    return { gruposComFilhos, avulsos };
  }, [empresas, empresaIdsComFilhos, resumoPorEmpresa]);

  // ------------------------------------------
  // Banco de Dados de Veículos: filtro, busca e paginação
  // ------------------------------------------
  const empresaNomeById = useMemo(() => {
    const map = {};
    empresas.forEach(e => { map[e.id] = e.nome; });
    return map;
  }, [empresas]);

  const filteredVeiculos = useMemo(() => {
    return veiculos.filter(v => {
      const placaOk = !searchPlaca || v.placa?.toUpperCase().includes(searchPlaca.toUpperCase());
      const empresaOk = filterEmpresaId === 'all' || v.empresa_id === filterEmpresaId;
      const statusOk = filterStatus === 'all' || v.status === filterStatus;
      return placaOk && empresaOk && statusOk;
    });
  }, [veiculos, searchPlaca, filterEmpresaId, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredVeiculos.length / itemsPerPage));
  const paginatedVeiculos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredVeiculos.slice(start, start + itemsPerPage);
  }, [filteredVeiculos, currentPage]);

  // Reseta pra página 1 sempre que o filtro muda
  useEffect(() => { setCurrentPage(1); }, [searchPlaca, filterEmpresaId, filterStatus]);

  const resetVehicleForm = () => {
    setVFormEmpresaId(''); setVFormPlaca(''); setVFormStatus('Ativo');
    setVFormOperacao(''); setVFormModelo(''); setVFormIdInstalado('');
    setVFormDataInst(''); setVFormDataDesinst('');
    setVFormMensalidade(''); setVFormCustoTotal(''); setVFormDrePlaca('');
  };

  const openVehicleForm = (v) => {
    if (v) {
      setEditingVehicle(v);
      setVFormEmpresaId(v.empresa_id || '');
      setVFormPlaca(v.placa || '');
      setVFormStatus(v.status || 'Ativo');
      setVFormOperacao(v.operacao || '');
      setVFormModelo(v.modelo || '');
      setVFormIdInstalado(v.id_instalado || '');
      setVFormDataInst(v.data_inst || '');
      setVFormDataDesinst(v.data_desinst || '');
      setVFormMensalidade(v.mensalidade ?? '');
      setVFormCustoTotal(v.custo_total ?? '');
      setVFormDrePlaca(v.dre_placa ?? '');
    } else {
      setEditingVehicle(null);
      resetVehicleForm();
    }
    setIsVehicleModalOpen(true);
  };

  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    if (!vFormPlaca.trim()) { alert('Informe a placa.'); return; }
    if (!vFormEmpresaId) { alert('Selecione a empresa.'); return; }

    setIsSavingVehicle(true);
    const payload = {
      empresa_id: vFormEmpresaId,
      placa: vFormPlaca.trim().toUpperCase(),
      status: vFormStatus,
      operacao: vFormOperacao || null,
      modelo: vFormModelo || null,
      id_instalado: vFormIdInstalado || null,
      data_inst: vFormDataInst || null,
      data_desinst: vFormDataDesinst || null,
      mensalidade: vFormMensalidade === '' ? null : Number(vFormMensalidade),
      custo_total: vFormCustoTotal === '' ? null : Number(vFormCustoTotal),
      dre_placa: vFormDrePlaca === '' ? null : Number(vFormDrePlaca),
    };

    let result;
    if (editingVehicle) {
      result = await supabase.from('veiculos').update(payload).eq('id', editingVehicle.id).select().single();
    } else {
      result = await supabase.from('veiculos').insert([payload]).select().single();
    }
    setIsSavingVehicle(false);

    if (result.error) { alert('Erro ao salvar veículo: ' + result.error.message); return; }

    if (editingVehicle) {
      setVeiculos(veiculos.map(v => v.id === result.data.id ? result.data : v));
    } else {
      setVeiculos([result.data, ...veiculos]);
    }
    setIsVehicleModalOpen(false);
    setEditingVehicle(null);
    resetVehicleForm();
  };

  const handleDeleteVehicle = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta placa? Essa ação não pode ser desfeita.')) return;
    const { error } = await supabase.from('veiculos').delete().eq('id', id);
    if (error) { alert('Erro ao excluir veículo: ' + error.message); return; }
    setVeiculos(veiculos.filter(v => v.id !== id));
  };

  // ------------------------------------------
  // Rastreadores (Estoque): filtro, paginação e CRUD
  // ------------------------------------------
  const veiculoPlacaById = useMemo(() => {
    const map = {};
    veiculos.forEach(v => { map[v.id] = v.placa; });
    return map;
  }, [veiculos]);

  const rastreadorStatusLabel = {
    estoque_central: 'Estoque Central',
    estoque_tecnico: 'Estoque c/ Técnico',
    instalado: 'Instalado',
    aguardando_manutencao: 'Aguardando Manutenção',
    baixado: 'Baixado',
  };
  const rastreadorStatusColor = {
    estoque_central: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    estoque_tecnico: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    instalado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    aguardando_manutencao: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    baixado: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  };

  const rastreadorStats = useMemo(() => {
    const disponiveis = rastreadores.filter(r => r.status === 'estoque_central' || r.status === 'estoque_tecnico').length;
    const instalados = rastreadores.filter(r => r.status === 'instalado').length;
    const manutencao = rastreadores.filter(r => r.status === 'aguardando_manutencao').length;
    return { disponiveis, instalados, manutencao, total: rastreadores.length };
  }, [rastreadores]);

  const filteredRastreadores = useMemo(() => {
    return rastreadores.filter(r => {
      const q = searchRastreador.toUpperCase();
      const searchOk = !q || r.serial?.toUpperCase().includes(q) || r.modelo?.toUpperCase().includes(q);
      const statusOk = filterRastreadorStatus === 'all' || r.status === filterRastreadorStatus;
      return searchOk && statusOk;
    });
  }, [rastreadores, searchRastreador, filterRastreadorStatus]);

  const rastreadorTotalPages = Math.max(1, Math.ceil(filteredRastreadores.length / rastreadoresPerPage));
  const paginatedRastreadores = useMemo(() => {
    const start = (rastreadorPage - 1) * rastreadoresPerPage;
    return filteredRastreadores.slice(start, start + rastreadoresPerPage);
  }, [filteredRastreadores, rastreadorPage]);

  useEffect(() => { setRastreadorPage(1); }, [searchRastreador, filterRastreadorStatus]);

  const resetRastreadorForm = () => {
    setRFormCategoria('LOCALIZADOR'); setRFormModelo(''); setRFormSerial('');
    setRFormSimCard(''); setRFormOperadora(''); setRFormDataEntrada('');
    setRFormCustoAquisicao(''); setRFormCustoMensal(''); setRFormValorMensalidade('');
    setRFormStatus('estoque_central'); setRFormLocalizacao('');
  };

  const openRastreadorForm = (r) => {
    if (r) {
      setEditingRastreador(r);
      setRFormCategoria(r.categoria || '');
      setRFormModelo(r.modelo || '');
      setRFormSerial(r.serial || '');
      setRFormSimCard(r.sim_card || '');
      setRFormOperadora(r.operadora || '');
      setRFormDataEntrada(r.data_entrada || '');
      setRFormCustoAquisicao(r.custo_aquisicao ?? '');
      setRFormCustoMensal(r.custo_mensal ?? '');
      setRFormValorMensalidade(r.valor_mensalidade ?? '');
      setRFormStatus(r.status || 'estoque_central');
      setRFormLocalizacao(r.localizacao_atual || '');
    } else {
      setEditingRastreador(null);
      resetRastreadorForm();
    }
    setIsRastreadorModalOpen(true);
  };

  const handleSaveRastreador = async (e) => {
    e.preventDefault();
    if (!rFormSerial.trim()) { alert('Informe o serial.'); return; }

    setIsSavingRastreador(true);
    const payload = {
      categoria: rFormCategoria || null,
      modelo: rFormModelo || null,
      serial: rFormSerial.trim(),
      sim_card: rFormSimCard || null,
      operadora: rFormOperadora || null,
      data_entrada: rFormDataEntrada || null,
      custo_aquisicao: rFormCustoAquisicao === '' ? null : Number(rFormCustoAquisicao),
      custo_mensal: rFormCustoMensal === '' ? null : Number(rFormCustoMensal),
      valor_mensalidade: rFormValorMensalidade === '' ? null : Number(rFormValorMensalidade),
      status: rFormStatus,
      localizacao_atual: rFormLocalizacao || null,
    };

    let result;
    if (editingRastreador) {
      result = await supabase.from('rastreadores').update(payload).eq('id', editingRastreador.id).select().single();
    } else {
      result = await supabase.from('rastreadores').insert([payload]).select().single();
    }
    setIsSavingRastreador(false);

    if (result.error) { alert('Erro ao salvar rastreador: ' + result.error.message); return; }

    if (editingRastreador) {
      setRastreadores(rastreadores.map(r => r.id === result.data.id ? result.data : r));
    } else {
      setRastreadores([result.data, ...rastreadores]);
    }
    setIsRastreadorModalOpen(false);
    setEditingRastreador(null);
    resetRastreadorForm();
  };

  const handleDeleteRastreador = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este rastreador do estoque?')) return;
    const { error } = await supabase.from('rastreadores').delete().eq('id', id);
    if (error) { alert('Erro ao excluir rastreador: ' + error.message); return; }
    setRastreadores(rastreadores.filter(r => r.id !== id));
  };

  // Instalar rastreador num veículo: atualiza os dois lados (rastreador + veiculo.id_instalado)
  const handleInstallRastreador = async () => {
    if (!installTargetRastreador || !installVeiculoId) { alert('Selecione um veículo.'); return; }

    const { data: updatedRastreador, error: errR } = await supabase
      .from('rastreadores')
      .update({ veiculo_id: installVeiculoId, status: 'instalado', placa_atual: veiculoPlacaById[installVeiculoId] || null })
      .eq('id', installTargetRastreador.id)
      .select()
      .single();
    if (errR) { alert('Erro ao instalar rastreador: ' + errR.message); return; }

    const { error: errV } = await supabase
      .from('veiculos')
      .update({ id_instalado: installTargetRastreador.serial })
      .eq('id', installVeiculoId);
    if (errV) { alert('Rastreador vinculado, mas houve erro ao atualizar o veículo: ' + errV.message); }

    setRastreadores(rastreadores.map(r => r.id === updatedRastreador.id ? updatedRastreador : r));
    setVeiculos(veiculos.map(v => v.id === installVeiculoId ? { ...v, id_instalado: installTargetRastreador.serial } : v));
    setInstallTargetRastreador(null);
    setInstallVeiculoId('');
  };

  // Retirar rastreador do veículo atual
  const handleUninstallRastreador = async (r) => {
    if (!confirm(`Retirar o rastreador ${r.serial} do veículo atual?`)) return;
    const veiculoAnteriorId = r.veiculo_id;

    const { data: updatedRastreador, error: errR } = await supabase
      .from('rastreadores')
      .update({ veiculo_id: null, status: 'estoque_central', placa_atual: null })
      .eq('id', r.id)
      .select()
      .single();
    if (errR) { alert('Erro ao retirar rastreador: ' + errR.message); return; }

    if (veiculoAnteriorId) {
      const { error: errV } = await supabase
        .from('veiculos')
        .update({ id_instalado: null })
        .eq('id', veiculoAnteriorId);
      if (errV) { alert('Rastreador desvinculado, mas houve erro ao atualizar o veículo: ' + errV.message); }
      setVeiculos(veiculos.map(v => v.id === veiculoAnteriorId ? { ...v, id_instalado: null } : v));
    }

    setRastreadores(rastreadores.map(rr => rr.id === updatedRastreador.id ? updatedRastreador : rr));
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <FaSpinner className="animate-spin text-3xl text-blue-500" />
      </div>
    );
  }

  if (!isAuthorized) return null; // já foi redirecionado

  return (
    <>
      <Head><title>Painel Administrativo | Full Vision</title></Head>
      <div className="min-h-screen bg-black text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Cabeçalho */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <FaChartPie className="text-purple-400" /> Painel Administrativo
              </h1>
              <p className="text-gray-400 text-sm mt-1">Visão geral da operação Full Vision</p>
            </div>
            <a href="/area-cliente" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-800 rounded-xl px-4 py-2">
              <FaArrowLeft /> Voltar pra Área do Cliente
            </a>
          </div>

          {isLoadingData ? (
            <div className="flex items-center justify-center py-24 text-gray-500">
              <FaSpinner className="animate-spin text-2xl mr-3" /> Carregando dados...
            </div>
          ) : (
            <>
              {/* Cards de resumo */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard icon={<FaTruck />} label="Veículos Ativos" value={stats.ativos} colorClass="bg-emerald-500/10 text-emerald-400" />
                <StatCard icon={<FaTimesCircle />} label="Veículos Inativos" value={stats.inativos} colorClass="bg-red-500/10 text-red-400" />
                <StatCard icon={<FaBuilding />} label="Clientes Ativos" value={clientesAtivos} colorClass="bg-blue-500/10 text-blue-400" />
                <StatCard
                  icon={<FaMoneyBillWave />}
                  label="Mensalidade Ativa (Total)"
                  value={stats.mensalidadeAtivaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                  colorClass="bg-amber-500/10 text-amber-400"
                />
                <a href="/area-cliente" className="block">
                  <StatCard icon={<FaTools />} label="Solicitações Pendentes" value={pendingRequestsCount} colorClass="bg-cyan-500/10 text-cyan-400" />
                </a>
              </div>

              {/* Resumo por cliente/grupo */}
              <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2"><FaBuilding className="text-blue-400" /> Resumo por Cliente</h2>
                <div className="border border-gray-800 rounded-xl overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-gray-950 text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Total</th>
                        <th className="p-3">Ativos</th>
                        <th className="p-3">Inativos</th>
                        <th className="p-3">Mensalidade Ativa</th>
                        <th className="p-3">Custo Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {hierarquia.gruposComFilhos.map(({ grupo, resumo, filhos }) => (
                        <React.Fragment key={grupo.id}>
                          <ResumoRow nome={grupo.nome} isGrupo {...resumo} />
                          {filhos.map(f => (
                            <ResumoRow key={f.id} nome={f.nome} isGrupo={false} {...(resumoPorEmpresa[f.id] || { total: 0, ativos: 0, inativos: 0, mensalidade: 0, custoTotal: 0 })} />
                          ))}
                        </React.Fragment>
                      ))}
                      {hierarquia.avulsos.map(e => (
                        <ResumoRow key={e.id} nome={e.nome} isGrupo={false} {...(resumoPorEmpresa[e.id] || { total: 0, ativos: 0, inativos: 0, mensalidade: 0, custoTotal: 0 })} />
                      ))}
                      {empresas.length === 0 && (
                        <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nenhuma empresa cadastrada.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Banco de Dados de Veículos */}
              <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-lg font-bold flex items-center gap-2"><FaDatabase className="text-emerald-400" /> Banco de Dados de Veículos</h2>
                  <button onClick={() => openVehicleForm(null)} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg self-start md:self-auto">
                    <FaPlus /> Nova Placa
                  </button>
                </div>

                {/* Filtros */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                    <input
                      type="text"
                      placeholder="Buscar por placa..."
                      value={searchPlaca}
                      onChange={e => setSearchPlaca(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                  <select value={filterEmpresaId} onChange={e => setFilterEmpresaId(e.target.value)} className="w-full md:w-56 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
                    <option value="all">Todas as empresas</option>
                    {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full md:w-40 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
                    <option value="all">Todos os status</option>
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>

                <div className="text-xs text-gray-500">{filteredVeiculos.length} veículo(s) encontrado(s)</div>

                <div className="border border-gray-800 rounded-xl overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-gray-950 text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="p-3">Placa</th>
                        <th className="p-3">Empresa</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Operação</th>
                        <th className="p-3">Modelo</th>
                        <th className="p-3">ID Instalado</th>
                        <th className="p-3">Mensalidade</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {paginatedVeiculos.length === 0 ? (
                        <tr><td colSpan={8} className="p-6 text-center text-gray-500 text-sm">Nenhum veículo encontrado.</td></tr>
                      ) : (
                        paginatedVeiculos.map(v => (
                          <tr key={v.id} className="hover:bg-gray-800/50">
                            <td className="p-3 text-white font-semibold">{v.placa}</td>
                            <td className="p-3 text-gray-300 text-xs">{empresaNomeById[v.empresa_id] || '—'}</td>
                            <td className="p-3">
                              <span className={`text-xs font-bold px-2 py-1 rounded border ${v.status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                                {v.status || '—'}
                              </span>
                            </td>
                            <td className="p-3 text-gray-400 text-xs">{v.operacao || '—'}</td>
                            <td className="p-3 text-gray-400 text-xs">{v.modelo || '—'}</td>
                            <td className="p-3 text-gray-400 text-xs">{v.id_instalado || '—'}</td>
                            <td className="p-3 text-gray-300 text-xs">{v.mensalidade != null ? Number(v.mensalidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td>
                            <td className="p-3 text-right whitespace-nowrap">
                              <button onClick={() => openVehicleForm(v)} title="Editar" className="text-gray-400 hover:text-blue-400 p-1.5"><FaEdit size={14} /></button>
                              <button onClick={() => handleDeleteVehicle(v.id)} title="Excluir" className="text-gray-400 hover:text-red-400 p-1.5"><FaTrashAlt size={14} /></button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 disabled:opacity-40 hover:text-white px-3 py-1.5"
                    >
                      <FaChevronLeft size={12} /> Anterior
                    </button>
                    <span>Página {currentPage} de {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1 disabled:opacity-40 hover:text-white px-3 py-1.5"
                    >
                      Próxima <FaChevronRight size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Rastreadores (Estoque) */}
              <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-lg font-bold flex items-center gap-2"><FaSatelliteDish className="text-cyan-400" /> Rastreadores (Estoque)</h2>
                  <button onClick={() => openRastreadorForm(null)} className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg self-start md:self-auto">
                    <FaPlus /> Novo Rastreador
                  </button>
                </div>

                {/* Mini-cards de status */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-blue-400">{rastreadorStats.disponiveis}</div>
                    <div className="text-[11px] text-gray-500 uppercase font-semibold">Disponíveis</div>
                  </div>
                  <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-emerald-400">{rastreadorStats.instalados}</div>
                    <div className="text-[11px] text-gray-500 uppercase font-semibold">Instalados</div>
                  </div>
                  <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-amber-400">{rastreadorStats.manutencao}</div>
                    <div className="text-[11px] text-gray-500 uppercase font-semibold">Aguard. Manutenção</div>
                  </div>
                </div>

                {/* Filtros */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                    <input
                      type="text"
                      placeholder="Buscar por serial ou modelo..."
                      value={searchRastreador}
                      onChange={e => setSearchRastreador(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                    />
                  </div>
                  <select value={filterRastreadorStatus} onChange={e => setFilterRastreadorStatus(e.target.value)} className="w-full md:w-56 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500">
                    <option value="all">Todos os status</option>
                    <option value="estoque_central">Estoque Central</option>
                    <option value="estoque_tecnico">Estoque c/ Técnico</option>
                    <option value="instalado">Instalado</option>
                    <option value="aguardando_manutencao">Aguardando Manutenção</option>
                    <option value="baixado">Baixado</option>
                  </select>
                </div>

                <div className="text-xs text-gray-500">{filteredRastreadores.length} rastreador(es) encontrado(s)</div>

                <div className="border border-gray-800 rounded-xl overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-gray-950 text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="p-3">Serial</th>
                        <th className="p-3">Modelo</th>
                        <th className="p-3">SIM / Operadora</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Veículo / Local</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {paginatedRastreadores.length === 0 ? (
                        <tr><td colSpan={6} className="p-6 text-center text-gray-500 text-sm">Nenhum rastreador encontrado.</td></tr>
                      ) : (
                        paginatedRastreadores.map(r => (
                          <tr key={r.id} className="hover:bg-gray-800/50">
                            <td className="p-3 text-white font-semibold">{r.serial}</td>
                            <td className="p-3 text-gray-400 text-xs">{r.categoria} {r.modelo ? `— ${r.modelo}` : ''}</td>
                            <td className="p-3 text-gray-400 text-xs">{r.sim_card || '—'} {r.operadora ? `(${r.operadora})` : ''}</td>
                            <td className="p-3">
                              <span className={`text-xs font-bold px-2 py-1 rounded border whitespace-nowrap ${rastreadorStatusColor[r.status]}`}>{rastreadorStatusLabel[r.status] || r.status}</span>
                            </td>
                            <td className="p-3 text-gray-400 text-xs">
                              {r.status === 'instalado'
                                ? (veiculoPlacaById[r.veiculo_id] || r.placa_atual || '—')
                                : (r.localizacao_atual || '—')}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              {r.status === 'instalado' ? (
                                <button onClick={() => handleUninstallRastreador(r)} title="Retirar do veículo" className="text-gray-400 hover:text-amber-400 p-1.5"><FaUnlink size={14} /></button>
                              ) : (
                                <button onClick={() => { setInstallTargetRastreador(r); setInstallVeiculoId(''); }} title="Instalar em um veículo" className="text-gray-400 hover:text-emerald-400 p-1.5"><FaLink size={14} /></button>
                              )}
                              <button onClick={() => openRastreadorForm(r)} title="Editar" className="text-gray-400 hover:text-blue-400 p-1.5"><FaEdit size={14} /></button>
                              <button onClick={() => handleDeleteRastreador(r.id)} title="Excluir" className="text-gray-400 hover:text-red-400 p-1.5"><FaTrashAlt size={14} /></button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {rastreadorTotalPages > 1 && (
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <button
                      onClick={() => setRastreadorPage(p => Math.max(1, p - 1))}
                      disabled={rastreadorPage === 1}
                      className="flex items-center gap-1 disabled:opacity-40 hover:text-white px-3 py-1.5"
                    >
                      <FaChevronLeft size={12} /> Anterior
                    </button>
                    <span>Página {rastreadorPage} de {rastreadorTotalPages}</span>
                    <button
                      onClick={() => setRastreadorPage(p => Math.min(rastreadorTotalPages, p + 1))}
                      disabled={rastreadorPage === rastreadorTotalPages}
                      className="flex items-center gap-1 disabled:opacity-40 hover:text-white px-3 py-1.5"
                    >
                      Próxima <FaChevronRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Criar/Editar Veículo */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-emerald-500/30 rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FaTruck className="text-emerald-400" /> {editingVehicle ? 'Editar Veículo' : 'Nova Placa'}
              </h3>
              <button onClick={() => setIsVehicleModalOpen(false)} className="text-gray-400 hover:text-white"><FaTimes/></button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Placa</label>
                  <input type="text" required value={vFormPlaca} onChange={e => setVFormPlaca(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 uppercase" />
                </div>
                <div className="w-36">
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select value={vFormStatus} onChange={e => setVFormStatus(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Empresa</label>
                <select required value={vFormEmpresaId} onChange={e => setVFormEmpresaId(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
                  <option value="">Selecione a empresa...</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Operação</label>
                  <input type="text" value={vFormOperacao} onChange={e => setVFormOperacao(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Modelo</label>
                  <input type="text" value={vFormModelo} onChange={e => setVFormModelo(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">ID Instalado (serial do rastreador)</label>
                <input type="text" value={vFormIdInstalado} onChange={e => setVFormIdInstalado(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Data Instalação</label>
                  <input type="date" value={vFormDataInst} onChange={e => setVFormDataInst(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Data Desinstalação</label>
                  <input type="date" value={vFormDataDesinst} onChange={e => setVFormDataDesinst(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Mensalidade (R$)</label>
                  <input type="number" step="0.01" value={vFormMensalidade} onChange={e => setVFormMensalidade(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Custo Total (R$)</label>
                  <input type="number" step="0.01" value={vFormCustoTotal} onChange={e => setVFormCustoTotal(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">DRE Placa (R$)</label>
                  <input type="number" step="0.01" value={vFormDrePlaca} onChange={e => setVFormDrePlaca(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isSavingVehicle} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                  {isSavingVehicle ? 'Salvando...' : (editingVehicle ? 'Salvar Alterações' : 'Criar Placa')}
                </button>
                <button type="button" onClick={() => setIsVehicleModalOpen(false)} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar/Editar Rastreador */}
      {isRastreadorModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-cyan-500/30 rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FaSatelliteDish className="text-cyan-400" /> {editingRastreador ? 'Editar Rastreador' : 'Novo Rastreador'}
              </h3>
              <button onClick={() => setIsRastreadorModalOpen(false)} className="text-gray-400 hover:text-white"><FaTimes/></button>
            </div>

            <form onSubmit={handleSaveRastreador} className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Categoria</label>
                  <input type="text" value={rFormCategoria} onChange={e => setRFormCategoria(e.target.value)} placeholder="LOCALIZADOR" className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Modelo</label>
                  <input type="text" value={rFormModelo} onChange={e => setRFormModelo(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Serial</label>
                <input type="text" required value={rFormSerial} onChange={e => setRFormSerial(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">SIM Card</label>
                  <input type="text" value={rFormSimCard} onChange={e => setRFormSimCard(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
                </div>
                <div className="w-32">
                  <label className="block text-xs text-gray-400 mb-1">Operadora</label>
                  <input type="text" value={rFormOperadora} onChange={e => setRFormOperadora(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Data de Entrada</label>
                  <input type="date" value={rFormDataEntrada} onChange={e => setRFormDataEntrada(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select value={rFormStatus} onChange={e => setRFormStatus(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500">
                    <option value="estoque_central">Estoque Central</option>
                    <option value="estoque_tecnico">Estoque c/ Técnico</option>
                    <option value="aguardando_manutencao">Aguardando Manutenção</option>
                    <option value="baixado">Baixado</option>
                    <option value="instalado" disabled={!editingRastreador || editingRastreador.status !== 'instalado'}>Instalado (use o botão de vincular)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Localização atual (técnico responsável, se aplicável)</label>
                <input type="text" value={rFormLocalizacao} onChange={e => setRFormLocalizacao(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Custo Aquisição (R$)</label>
                  <input type="number" step="0.01" value={rFormCustoAquisicao} onChange={e => setRFormCustoAquisicao(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Custo Mensal (R$)</label>
                  <input type="number" step="0.01" value={rFormCustoMensal} onChange={e => setRFormCustoMensal(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Valor Mensalidade (R$)</label>
                  <input type="number" step="0.01" value={rFormValorMensalidade} onChange={e => setRFormValorMensalidade(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isSavingRastreador} className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                  {isSavingRastreador ? 'Salvando...' : (editingRastreador ? 'Salvar Alterações' : 'Cadastrar Rastreador')}
                </button>
                <button type="button" onClick={() => setIsRastreadorModalOpen(false)} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Instalar Rastreador em Veículo */}
      {installTargetRastreador && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-emerald-500/30 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaLink className="text-emerald-400" /> Instalar Rastreador</h3>
              <button onClick={() => { setInstallTargetRastreador(null); setInstallVeiculoId(''); }} className="text-gray-400 hover:text-white"><FaTimes/></button>
            </div>
            <div className="text-sm text-gray-300">
              Rastreador: <span className="font-semibold text-white">{installTargetRastreador.serial}</span>
              {installTargetRastreador.modelo && <span className="text-gray-500"> ({installTargetRastreador.modelo})</span>}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Selecione o veículo</label>
              <select value={installVeiculoId} onChange={e => setInstallVeiculoId(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
                <option value="">Selecione a placa...</option>
                {veiculos.map(v => (
                  <option key={v.id} value={v.id}>{v.placa} — {empresaNomeById[v.empresa_id] || 'sem empresa'}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleInstallRastreador} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Confirmar Instalação</button>
              <button onClick={() => { setInstallTargetRastreador(null); setInstallVeiculoId(''); }} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}