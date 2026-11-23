import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import {
  FaTruck, FaCheckCircle, FaSpinner, FaArrowLeft, FaExclamationCircle,
  FaEdit, FaTrashAlt, FaTimes, FaSatelliteDish, FaLink, FaUnlink, FaClipboardList,
} from 'react-icons/fa';
import OsHistory from '../components/os/OsHistory';
import OsWizard from '../components/os/OsWizard';
import VeiculosAgrupados from '../components/admin/VeiculosAgrupados';
import PrecosPanel from '../components/admin/PrecosPanel';
import {
  BRL,
  norm,
  mkOptions,
  uniqueSorted,
  sortBy,
  nextSort,
  summarizeSelection,
  chipText,
  tableWrap,
  theadClass,
  tbodyClass,
  rowClass,
  Dash,
  StatStrip,
  TabBar,
  SectionCard,
  PrimaryButton,
  ActionButton,
  StatusDot,
  Th,
  SearchInput,
  FilterDropdown,
  ToggleFilter,
  FilterSummary,
  Pagination,
  ResumoRow,
  SegmentedControl,
} from '../components/admin/ui';


export default function PainelAdmin() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Toast (sucesso/erro) e modal de confirmação genérico — substituem alert()/confirm() nativos
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }
  const askConfirm = (message, onConfirm) => setConfirmDialog({ message, onConfirm });
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [empresas, setEmpresas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Banco de Dados de Veículos
  const [searchPlaca, setSearchPlaca] = useState('');
  const [filterEmpresas, setFilterEmpresas] = useState([]);
  const [filterStatuses, setFilterStatuses] = useState([]);
  const [filterOperacoes, setFilterOperacoes] = useState([]);
  const [filterSemEquip, setFilterSemEquip] = useState(false);
  const [vSort, setVSort] = useState({ key: 'placa', dir: 'asc' });
  const [vGroupBy, setVGroupBy] = useState('empresa'); // 'empresa' | 'operacao' | 'lista'
  const [currentPage, setCurrentPage] = useState(1);
  const [activeSection, setActiveSection] = useState('resumo'); // 'resumo' | 'veiculos' | 'rastreadores' | 'ordens'
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
  const [filterRastreadorStatuses, setFilterRastreadorStatuses] = useState([]);
  const [filterRastreadorOperadoras, setFilterRastreadorOperadoras] = useState([]);
  const [filterRastreadorCategorias, setFilterRastreadorCategorias] = useState([]);
  const [rSort, setRSort] = useState({ key: 'serial', dir: 'asc' });
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

  // Ordens de Serviço
  const [ordensServico, setOrdensServico] = useState([]);

  const [isOsModalOpen, setIsOsModalOpen] = useState(false);


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

      const { data: ordensData } = await supabase
        .from('ordens_servico')
        .select('*, empresas(nome), veiculos(placa)')
        .order('data', { ascending: false });
      if (ordensData) setOrdensServico(ordensData);

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

  const empresaOptions = useMemo(() => {
    const blocks = [];
    hierarquia.gruposComFilhos.forEach(({ grupo, filhos }) => {
      blocks.push({
        sortName: grupo.nome,
        items: [
          { value: grupo.id, label: grupo.nome, hint: 'Grupo', values: [grupo.id, ...filhos.map(f => f.id)] },
          ...filhos.map(f => ({ value: f.id, label: f.nome, indent: true, values: [f.id] })),
        ],
      });
    });
    hierarquia.avulsos.forEach(e => {
      blocks.push({ sortName: e.nome, items: [{ value: e.id, label: e.nome, values: [e.id] }] });
    });
    blocks.sort((a, b) => a.sortName.localeCompare(b.sortName, 'pt-BR'));
    return blocks.flatMap(b => b.items);
  }, [hierarquia]);

  const statusOptions = useMemo(() => mkOptions(uniqueSorted(veiculos.map(v => v.status))), [veiculos]);
  const operacaoOptions = useMemo(() => [
    ...mkOptions(uniqueSorted(veiculos.map(v => v.operacao))),
    { value: '__none__', label: 'Sem operação', values: ['__none__'] },
  ], [veiculos]);

  const filteredVeiculos = useMemo(() => {
    const q = norm(searchPlaca.trim());
    const list = veiculos.filter(v => {
      if (q) {
        const texto = norm([v.placa, v.id_instalado, v.modelo, v.operacao, empresaNomeById[v.empresa_id]].join(' '));
        if (!texto.includes(q)) return false;
      }
      if (filterEmpresas.length && !filterEmpresas.includes(v.empresa_id)) return false;
      if (filterStatuses.length && !filterStatuses.includes(v.status)) return false;
      if (filterOperacoes.length && !filterOperacoes.includes(v.operacao || '__none__')) return false;
      if (filterSemEquip && v.id_instalado) return false;
      return true;
    });
    return sortBy(list, vSort, {
      placa: v => v.placa || '',
      empresa: v => empresaNomeById[v.empresa_id] || '',
      status: v => v.status || '',
      operacao: v => v.operacao || '',
      modelo: v => v.modelo || '',
      id_instalado: v => String(v.id_instalado || ''),
      mensalidade: v => Number(v.mensalidade) || 0,
    });
  }, [veiculos, empresaNomeById, searchPlaca, filterEmpresas, filterStatuses, filterOperacoes, filterSemEquip, vSort]);

  const vehicleSummary = useMemo(() => {
    const ativos = filteredVeiculos.filter(v => v.status === 'Ativo');
    return { mensalidadeAtiva: ativos.reduce((sum, v) => sum + (Number(v.mensalidade) || 0), 0) };
  }, [filteredVeiculos]);

  const clearVehicleFilters = () => {
    setSearchPlaca(''); setFilterEmpresas([]); setFilterStatuses([]); setFilterOperacoes([]); setFilterSemEquip(false);
  };

  const vehicleChips = useMemo(() => {
    const chips = [];
    if (searchPlaca.trim()) chips.push({ key: 'q', label: `Busca: ${searchPlaca.trim()}`, onRemove: () => setSearchPlaca('') });
    const emp = summarizeSelection(empresaOptions, filterEmpresas);
    if (emp.length) chips.push({ key: 'emp', label: chipText('Empresa', emp, 'selecionadas'), onRemove: () => setFilterEmpresas([]) });
    const sts = summarizeSelection(statusOptions, filterStatuses);
    if (sts.length) chips.push({ key: 'st', label: chipText('Status', sts), onRemove: () => setFilterStatuses([]) });
    const ops = summarizeSelection(operacaoOptions, filterOperacoes);
    if (ops.length) chips.push({ key: 'op', label: chipText('Operação', ops, 'selecionadas'), onRemove: () => setFilterOperacoes([]) });
    if (filterSemEquip) chips.push({ key: 'eq', label: 'Sem ID instalado', onRemove: () => setFilterSemEquip(false) });
    return chips;
  }, [searchPlaca, empresaOptions, statusOptions, operacaoOptions, filterEmpresas, filterStatuses, filterOperacoes, filterSemEquip]);

  const totalPages = Math.max(1, Math.ceil(filteredVeiculos.length / itemsPerPage));
  const paginatedVeiculos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredVeiculos.slice(start, start + itemsPerPage);
  }, [filteredVeiculos, currentPage]);

  // Volta pra página 1 sempre que o filtro ou a ordenação muda
  useEffect(() => { setCurrentPage(1); }, [searchPlaca, filterEmpresas, filterStatuses, filterOperacoes, filterSemEquip, vSort]);

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
    if (!vFormPlaca.trim()) { showToast('Informe a placa.', 'error'); return; }
    if (!vFormEmpresaId) { showToast('Selecione a empresa.', 'error'); return; }

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

    if (result.error) { showToast('Erro ao salvar veículo: ' + result.error.message, 'error'); return; }

    if (editingVehicle) {
      setVeiculos(veiculos.map(v => v.id === result.data.id ? result.data : v));
    } else {
      setVeiculos([result.data, ...veiculos]);
    }
    setIsVehicleModalOpen(false);
    setEditingVehicle(null);
    resetVehicleForm();
  };

  const handleDeleteVehicle = (id) => {
    askConfirm('Tem certeza que deseja excluir esta placa? Essa ação não pode ser desfeita.', async () => {
      const { error } = await supabase.from('veiculos').delete().eq('id', id);
      if (error) { showToast('Erro ao excluir veículo: ' + error.message, 'error'); return; }
      setVeiculos(veiculos.filter(v => v.id !== id));
      showToast('Veículo excluído com sucesso!');
    });
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
  const rastreadorTone = {
    estoque_central: 'info',
    estoque_tecnico: 'info',
    instalado: 'ok',
    aguardando_manutencao: 'warn',
    baixado: 'muted',
  };

  const rastreadorStats = useMemo(() => {
    const disponiveis = rastreadores.filter(r => r.status === 'estoque_central' || r.status === 'estoque_tecnico').length;
    const instalados = rastreadores.filter(r => r.status === 'instalado').length;
    const manutencao = rastreadores.filter(r => r.status === 'aguardando_manutencao').length;
    return { disponiveis, instalados, manutencao, total: rastreadores.length };
  }, [rastreadores]);

  const rastreadorStatusOptions = Object.entries(rastreadorStatusLabel).map(([value, label]) => ({ value, label, values: [value] }));
  const operadoraOptions = useMemo(() => mkOptions(uniqueSorted(rastreadores.map(r => r.operadora))), [rastreadores]);
  const categoriaOptions = useMemo(() => mkOptions(uniqueSorted(rastreadores.map(r => r.categoria))), [rastreadores]);

  const filteredRastreadores = useMemo(() => {
    const q = norm(searchRastreador.trim());
    const list = rastreadores.filter(r => {
      if (q && !norm([r.serial, r.modelo, r.categoria, r.sim_card].join(' ')).includes(q)) return false;
      if (filterRastreadorStatuses.length && !filterRastreadorStatuses.includes(r.status)) return false;
      if (filterRastreadorOperadoras.length && !filterRastreadorOperadoras.includes(r.operadora)) return false;
      if (filterRastreadorCategorias.length && !filterRastreadorCategorias.includes(r.categoria)) return false;
      return true;
    });
    return sortBy(list, rSort, {
      serial: r => r.serial || '',
      modelo: r => `${r.categoria || ''} ${r.modelo || ''}`,
      status: r => rastreadorStatusLabel[r.status] || r.status || '',
    });
  }, [rastreadores, searchRastreador, filterRastreadorStatuses, filterRastreadorOperadoras, filterRastreadorCategorias, rSort]);

  const clearRastreadorFilters = () => {
    setSearchRastreador(''); setFilterRastreadorStatuses([]); setFilterRastreadorOperadoras([]); setFilterRastreadorCategorias([]);
  };

  const rastreadorChips = useMemo(() => {
    const chips = [];
    if (searchRastreador.trim()) chips.push({ key: 'q', label: `Busca: ${searchRastreador.trim()}`, onRemove: () => setSearchRastreador('') });
    const sts = summarizeSelection(rastreadorStatusOptions, filterRastreadorStatuses);
    if (sts.length) chips.push({ key: 'st', label: chipText('Status', sts), onRemove: () => setFilterRastreadorStatuses([]) });
    const ops = summarizeSelection(operadoraOptions, filterRastreadorOperadoras);
    if (ops.length) chips.push({ key: 'op', label: chipText('Operadora', ops, 'selecionadas'), onRemove: () => setFilterRastreadorOperadoras([]) });
    const cats = summarizeSelection(categoriaOptions, filterRastreadorCategorias);
    if (cats.length) chips.push({ key: 'cat', label: chipText('Categoria', cats, 'selecionadas'), onRemove: () => setFilterRastreadorCategorias([]) });
    return chips;
  }, [searchRastreador, operadoraOptions, categoriaOptions, filterRastreadorStatuses, filterRastreadorOperadoras, filterRastreadorCategorias]);

  const rastreadorTotalPages = Math.max(1, Math.ceil(filteredRastreadores.length / rastreadoresPerPage));
  const paginatedRastreadores = useMemo(() => {
    const start = (rastreadorPage - 1) * rastreadoresPerPage;
    return filteredRastreadores.slice(start, start + rastreadoresPerPage);
  }, [filteredRastreadores, rastreadorPage]);

  useEffect(() => { setRastreadorPage(1); }, [searchRastreador, filterRastreadorStatuses, filterRastreadorOperadoras, filterRastreadorCategorias, rSort]);

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
    if (!rFormSerial.trim()) { showToast('Informe o serial.', 'error'); return; }

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

    if (result.error) { showToast('Erro ao salvar rastreador: ' + result.error.message, 'error'); return; }

    if (editingRastreador) {
      setRastreadores(rastreadores.map(r => r.id === result.data.id ? result.data : r));
    } else {
      setRastreadores([result.data, ...rastreadores]);
    }
    setIsRastreadorModalOpen(false);
    setEditingRastreador(null);
    resetRastreadorForm();
  };

  const handleDeleteRastreador = (id) => {
    askConfirm('Tem certeza que deseja excluir este rastreador do estoque?', async () => {
      const { error } = await supabase.from('rastreadores').delete().eq('id', id);
      if (error) { showToast('Erro ao excluir rastreador: ' + error.message, 'error'); return; }
      setRastreadores(rastreadores.filter(r => r.id !== id));
      showToast('Rastreador excluído com sucesso!');
    });
  };

  // Instalar rastreador num veículo: atualiza os dois lados (rastreador + veiculo.id_instalado)
  const handleInstallRastreador = async () => {
    if (!installTargetRastreador || !installVeiculoId) { showToast('Selecione um veículo.', 'error'); return; }

    const { data: updatedRastreador, error: errR } = await supabase
      .from('rastreadores')
      .update({ veiculo_id: installVeiculoId, status: 'instalado', placa_atual: veiculoPlacaById[installVeiculoId] || null })
      .eq('id', installTargetRastreador.id)
      .select()
      .single();
    if (errR) { showToast('Erro ao instalar rastreador: ' + errR.message, 'error'); return; }

    const { error: errV } = await supabase
      .from('veiculos')
      .update({ id_instalado: installTargetRastreador.serial })
      .eq('id', installVeiculoId);
    if (errV) { showToast('Rastreador vinculado, mas houve erro ao atualizar o veículo: ' + errV.message, 'error'); }

    setRastreadores(rastreadores.map(r => r.id === updatedRastreador.id ? updatedRastreador : r));
    setVeiculos(veiculos.map(v => v.id === installVeiculoId ? { ...v, id_instalado: installTargetRastreador.serial } : v));
    setInstallTargetRastreador(null);
    setInstallVeiculoId('');
  };

  // Retirar rastreador do veículo atual
  const handleUninstallRastreador = (r) => {
    askConfirm(`Retirar o rastreador ${r.serial} do veículo atual?`, async () => {
      const veiculoAnteriorId = r.veiculo_id;

      const { data: updatedRastreador, error: errR } = await supabase
        .from('rastreadores')
        .update({ veiculo_id: null, status: 'estoque_central', placa_atual: null })
        .eq('id', r.id)
        .select()
        .single();
      if (errR) { showToast('Erro ao retirar rastreador: ' + errR.message, 'error'); return; }

      if (veiculoAnteriorId) {
        const { error: errV } = await supabase
          .from('veiculos')
          .update({ id_instalado: null })
          .eq('id', veiculoAnteriorId);
        if (errV) { showToast('Rastreador desvinculado, mas houve erro ao atualizar o veículo: ' + errV.message, 'error'); }
        setVeiculos(veiculos.map(v => v.id === veiculoAnteriorId ? { ...v, id_instalado: null } : v));
      }

      setRastreadores(rastreadores.map(rr => rr.id === updatedRastreador.id ? updatedRastreador : rr));
      showToast('Rastreador retirado com sucesso!');
    });
  };

  // ------------------------------------------
  // Ordens de Serviço: filtro, paginação, CRUD e fotos
  // ------------------------------------------
  const handleDeleteOs = (id) => {
    askConfirm('Excluir esta Ordem de Serviço e todas as fotos anexadas? Essa ação não pode ser desfeita.', async () => {
      const { data: fotos } = await supabase.from('ordens_servico_fotos').select('storage_path').eq('ordem_servico_id', id);
      if (fotos && fotos.length > 0) {
        await supabase.storage.from('os-fotos').remove(fotos.map(f => f.storage_path));
      }

      const { error } = await supabase.from('ordens_servico').delete().eq('id', id);
      if (error) { showToast('Erro ao excluir a Ordem de Serviço: ' + error.message, 'error'); return; }
      setOrdensServico(ordensServico.filter(o => o.id !== id));
      showToast('Ordem de Serviço excluída com sucesso!');
    });
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

      {/* Toast flutuante (sucesso/erro) */}
      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold ${
          toast.type === 'success'
            ? 'bg-emerald-950 border-emerald-500/40 text-emerald-400'
            : 'bg-red-950 border-red-500/40 text-red-400'
        }`}>
          {toast.type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />}
          {toast.message}
        </div>
      )}

      {/* Modal de confirmação genérico (substitui window.confirm) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaExclamationCircle className="text-red-400" /> Confirmar Ação</h3>
            <p className="text-sm text-gray-400">{confirmDialog.message}</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn(); }}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Confirmar
              </button>
              <button onClick={() => setConfirmDialog(null)} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-black text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Cabeçalho */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Painel administrativo</h1>
              <p className="text-gray-400 text-sm mt-1">Visão geral da operação Full Vision</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <a href="/quests" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2 transition-colors">
                <FaClipboardList size={13} /> Quest Tracker
              </a>
              <a href="/area-cliente" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2 transition-colors">
                <FaArrowLeft size={12} /> Voltar para a área do cliente
              </a>
            </div>
          </div>

          {isLoadingData ? (
            <div className="flex items-center justify-center py-24 text-gray-500">
              <FaSpinner className="animate-spin text-2xl mr-3" /> Carregando dados...
            </div>
          ) : (
            <>
              {/* Números gerais */}
              <StatStrip
                colsClass="grid-cols-2 lg:grid-cols-5"
                spanLast
                items={[
                  { label: 'Veículos ativos', value: stats.ativos },
                  { label: 'Veículos inativos', value: stats.inativos },
                  { label: 'Clientes ativos', value: clientesAtivos },
                  { label: 'Mensalidade ativa', value: stats.mensalidadeAtivaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) },
                  { label: 'Solicitações pendentes', value: pendingRequestsCount, href: '/area-cliente', valueClass: pendingRequestsCount > 0 ? 'text-amber-400' : 'text-white' },
                ]}
              />

              {/* Abas: mostra só uma seção por vez */}
              <TabBar
                active={activeSection}
                onChange={setActiveSection}
                tabs={[
                  { key: 'resumo', label: 'Resumo por cliente' },
                  { key: 'veiculos', label: 'Banco de veículos', count: veiculos.length },
                  { key: 'rastreadores', label: 'Rastreadores', count: rastreadores.length },
                  { key: 'ordens', label: 'Ordens de serviço', count: ordensServico.length },
                  { key: 'precos', label: 'Preços' },
                ]}
              />

              {/* Resumo por cliente/grupo */}
              {activeSection === 'resumo' && (
                <SectionCard title="Resumo por cliente">
                  <div className={tableWrap}>
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className={theadClass}>
                        <tr>
                          <Th>Cliente</Th>
                          <Th align="right">Total</Th>
                          <Th align="right">Ativos</Th>
                          <Th align="right">Inativos</Th>
                          <Th align="right">Mensalidade ativa</Th>
                          <Th align="right">Custo total</Th>
                        </tr>
                      </thead>
                      <tbody className={tbodyClass}>
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
                          <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Nenhuma empresa cadastrada.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              )}

              {/* Banco de veículos */}
              {activeSection === 'veiculos' && (
                <SectionCard title="Banco de veículos" action={<PrimaryButton onClick={() => openVehicleForm(null)}>Nova placa</PrimaryButton>}>
                  <div className="flex flex-wrap items-center gap-2">
                    <SearchInput value={searchPlaca} onChange={setSearchPlaca} placeholder="Buscar por placa, ID, modelo ou empresa" />
                    <FilterDropdown label="Empresa" options={empresaOptions} selected={filterEmpresas} onChange={setFilterEmpresas} searchable />
                    <FilterDropdown label="Status" options={statusOptions} selected={filterStatuses} onChange={setFilterStatuses} />
                    <FilterDropdown label="Operação" options={operacaoOptions} selected={filterOperacoes} onChange={setFilterOperacoes} searchable />
                    <ToggleFilter label="Sem ID instalado" active={filterSemEquip} onClick={() => setFilterSemEquip(v => !v)} />
                  </div>

                  <FilterSummary
                    total={filteredVeiculos.length}
                    noun={filteredVeiculos.length === 1 ? 'veículo' : 'veículos'}
                    chips={vehicleChips}
                    onClearAll={clearVehicleFilters}
                    extra={<>Mensalidade ativa nesta lista: <span className="text-white font-medium tabular-nums">{BRL(vehicleSummary.mensalidadeAtiva)}</span></>}
                  />

                  <SegmentedControl
                    label="Agrupar por"
                    value={vGroupBy}
                    onChange={setVGroupBy}
                    options={[{ key: 'empresa', label: 'Cliente' }, { key: 'operacao', label: 'Operação' }, { key: 'lista', label: 'Lista' }]}
                  />

                  {vGroupBy === 'lista' ? (
                    <>
                      <div className={tableWrap}>
                        <table className="w-full min-w-[900px] text-sm">
                          <thead className={theadClass}>
                            <tr>
                              <Th sortKey="placa" sort={vSort} onSort={k => setVSort(s => nextSort(s, k))}>Placa</Th>
                              <Th sortKey="empresa" sort={vSort} onSort={k => setVSort(s => nextSort(s, k))}>Empresa</Th>
                              <Th sortKey="status" sort={vSort} onSort={k => setVSort(s => nextSort(s, k))}>Status</Th>
                              <Th sortKey="operacao" sort={vSort} onSort={k => setVSort(s => nextSort(s, k))}>Operação</Th>
                              <Th sortKey="modelo" sort={vSort} onSort={k => setVSort(s => nextSort(s, k))}>Modelo</Th>
                              <Th sortKey="id_instalado" sort={vSort} onSort={k => setVSort(s => nextSort(s, k))}>ID instalado</Th>
                              <Th sortKey="mensalidade" sort={vSort} onSort={k => setVSort(s => nextSort(s, k))} align="right">Mensalidade</Th>
                              <Th align="right">Ações</Th>
                            </tr>
                          </thead>
                          <tbody className={tbodyClass}>
                            {paginatedVeiculos.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                                  Nenhum veículo encontrado{vehicleChips.length > 0 ? ' com esses filtros.' : '.'}
                                  {vehicleChips.length > 0 && (
                                    <button type="button" onClick={clearVehicleFilters} className="block mx-auto mt-2 text-sm text-blue-400 hover:text-blue-300">Limpar filtros</button>
                                  )}
                                </td>
                              </tr>
                            ) : (
                              paginatedVeiculos.map(v => (
                                <tr key={v.id} className={rowClass}>
                                  <td className="px-4 py-3 text-white font-semibold tracking-wide whitespace-nowrap">{v.placa}</td>
                                  <td className="px-4 py-3 text-gray-300">{empresaNomeById[v.empresa_id] || <Dash />}</td>
                                  <td className="px-4 py-3 text-gray-300"><StatusDot tone={v.status === 'Ativo' ? 'ok' : 'bad'}>{v.status || '—'}</StatusDot></td>
                                  <td className="px-4 py-3 text-gray-300">{v.operacao || <Dash />}</td>
                                  <td className="px-4 py-3 text-gray-400">{v.modelo || <Dash />}</td>
                                  <td className="px-4 py-3 text-gray-400 tabular-nums">{v.id_instalado || <Dash />}</td>
                                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-gray-200">{v.mensalidade != null ? BRL(v.mensalidade) : <Dash />}</td>
                                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                                    <ActionButton title="Editar" hover="hover:text-blue-400" onClick={() => openVehicleForm(v)}><FaEdit size={14} /></ActionButton>
                                    <ActionButton title="Excluir" hover="hover:text-red-400" onClick={() => handleDeleteVehicle(v.id)}><FaTrashAlt size={14} /></ActionButton>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      <Pagination page={currentPage} totalPages={totalPages} total={filteredVeiculos.length} perPage={itemsPerPage} onPage={setCurrentPage} />
                    </>
                  ) : filteredVeiculos.length === 0 ? (
                    <div className="rounded-xl border border-gray-800 px-4 py-12 text-center text-gray-500">
                      Nenhum veículo encontrado{vehicleChips.length > 0 ? ' com esses filtros.' : '.'}
                      {vehicleChips.length > 0 && (
                        <button type="button" onClick={clearVehicleFilters} className="block mx-auto mt-2 text-sm text-blue-400 hover:text-blue-300">Limpar filtros</button>
                      )}
                    </div>
                  ) : (
                    <VeiculosAgrupados
                      veiculos={filteredVeiculos}
                      empresaNomeById={empresaNomeById}
                      groupBy={vGroupBy}
                      sort={vSort}
                      onSort={k => setVSort(cur => nextSort(cur, k))}
                      onEdit={openVehicleForm}
                      onDelete={handleDeleteVehicle}
                    />
                  )}
                </SectionCard>
              )}

              {/* Rastreadores (estoque) */}
              {activeSection === 'rastreadores' && (
                <SectionCard title="Rastreadores" action={<PrimaryButton onClick={() => openRastreadorForm(null)}>Novo rastreador</PrimaryButton>}>
                  <StatStrip
                    colsClass="grid-cols-1 sm:grid-cols-3"
                    items={[
                      { label: 'Disponíveis', value: rastreadorStats.disponiveis },
                      { label: 'Instalados', value: rastreadorStats.instalados },
                      { label: 'Aguardando manutenção', value: rastreadorStats.manutencao, valueClass: rastreadorStats.manutencao > 0 ? 'text-amber-400' : 'text-white' },
                    ]}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <SearchInput value={searchRastreador} onChange={setSearchRastreador} placeholder="Buscar por serial, modelo ou SIM" />
                    <FilterDropdown label="Status" options={rastreadorStatusOptions} selected={filterRastreadorStatuses} onChange={setFilterRastreadorStatuses} />
                    <FilterDropdown label="Operadora" options={operadoraOptions} selected={filterRastreadorOperadoras} onChange={setFilterRastreadorOperadoras} />
                    <FilterDropdown label="Categoria" options={categoriaOptions} selected={filterRastreadorCategorias} onChange={setFilterRastreadorCategorias} />
                  </div>

                  <FilterSummary
                    total={filteredRastreadores.length}
                    noun={filteredRastreadores.length === 1 ? 'rastreador' : 'rastreadores'}
                    chips={rastreadorChips}
                    onClearAll={clearRastreadorFilters}
                  />

                  <div className={tableWrap}>
                    <table className="w-full min-w-[900px] text-sm">
                      <thead className={theadClass}>
                        <tr>
                          <Th sortKey="serial" sort={rSort} onSort={k => setRSort(s => nextSort(s, k))}>Serial</Th>
                          <Th sortKey="modelo" sort={rSort} onSort={k => setRSort(s => nextSort(s, k))}>Modelo</Th>
                          <Th>SIM / operadora</Th>
                          <Th sortKey="status" sort={rSort} onSort={k => setRSort(s => nextSort(s, k))}>Status</Th>
                          <Th>Veículo / local</Th>
                          <Th align="right">Ações</Th>
                        </tr>
                      </thead>
                      <tbody className={tbodyClass}>
                        {paginatedRastreadores.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                              Nenhum rastreador encontrado{rastreadorChips.length > 0 ? ' com esses filtros.' : '.'}
                              {rastreadorChips.length > 0 && (
                                <button type="button" onClick={clearRastreadorFilters} className="block mx-auto mt-2 text-sm text-blue-400 hover:text-blue-300">Limpar filtros</button>
                              )}
                            </td>
                          </tr>
                        ) : (
                          paginatedRastreadores.map(r => (
                            <tr key={r.id} className={rowClass}>
                              <td className="px-4 py-3 text-white font-semibold tabular-nums whitespace-nowrap">{r.serial}</td>
                              <td className="px-4 py-3 text-gray-300">{r.categoria}{r.modelo ? ` — ${r.modelo}` : ''}</td>
                              <td className="px-4 py-3 text-gray-400">
                                {r.sim_card || <Dash />}
                                {r.operadora && <span className="text-gray-500"> ({r.operadora})</span>}
                              </td>
                              <td className="px-4 py-3 text-gray-300">
                                <StatusDot tone={rastreadorTone[r.status] || 'muted'}>{rastreadorStatusLabel[r.status] || r.status}</StatusDot>
                              </td>
                              <td className="px-4 py-3 text-gray-300">
                                {r.status === 'instalado'
                                  ? (veiculoPlacaById[r.veiculo_id] || r.placa_atual || <Dash />)
                                  : (r.localizacao_atual || <Dash />)}
                              </td>
                              <td className="px-3 py-1.5 text-right whitespace-nowrap">
                                {r.status === 'instalado' ? (
                                  <ActionButton title="Retirar do veículo" hover="hover:text-amber-400" onClick={() => handleUninstallRastreador(r)}><FaUnlink size={14} /></ActionButton>
                                ) : (
                                  <ActionButton title="Instalar em um veículo" hover="hover:text-emerald-400" onClick={() => { setInstallTargetRastreador(r); setInstallVeiculoId(''); }}><FaLink size={14} /></ActionButton>
                                )}
                                <ActionButton title="Editar" hover="hover:text-blue-400" onClick={() => openRastreadorForm(r)}><FaEdit size={14} /></ActionButton>
                                <ActionButton title="Excluir" hover="hover:text-red-400" onClick={() => handleDeleteRastreador(r.id)}><FaTrashAlt size={14} /></ActionButton>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <Pagination page={rastreadorPage} totalPages={rastreadorTotalPages} total={filteredRastreadores.length} perPage={rastreadoresPerPage} onPage={setRastreadorPage} />
                </SectionCard>
              )}

              {/* Preços (técnicos, clientes e regras do financeiro automático) */}
              {activeSection === 'precos' && <PrecosPanel empresas={empresas} showToast={showToast} />}

              {/* Ordens de serviço */}
              {activeSection === 'ordens' && (
                <OsHistory
                  ordens={ordensServico}
                  empresaOptions={empresaOptions}
                  rastreadores={rastreadores}
                  onNew={() => setIsOsModalOpen(true)}
                  onDelete={handleDeleteOs}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal Criar/Editar Veículo */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
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
                  <input type="text" required value={vFormPlaca} onChange={e => setVFormPlaca(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 uppercase" />
                </div>
                <div className="w-36">
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select value={vFormStatus} onChange={e => setVFormStatus(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Empresa</label>
                <select required value={vFormEmpresaId} onChange={e => setVFormEmpresaId(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                  <option value="">Selecione a empresa...</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Operação</label>
                  <input type="text" value={vFormOperacao} onChange={e => setVFormOperacao(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Modelo</label>
                  <input type="text" value={vFormModelo} onChange={e => setVFormModelo(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">ID Instalado (serial do rastreador)</label>
                <input type="text" value={vFormIdInstalado} onChange={e => setVFormIdInstalado(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Data Instalação</label>
                  <input type="date" value={vFormDataInst} onChange={e => setVFormDataInst(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Data Desinstalação</label>
                  <input type="date" value={vFormDataDesinst} onChange={e => setVFormDataDesinst(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Mensalidade (R$)</label>
                  <input type="number" step="0.01" value={vFormMensalidade} onChange={e => setVFormMensalidade(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Custo Total (R$)</label>
                  <input type="number" step="0.01" value={vFormCustoTotal} onChange={e => setVFormCustoTotal(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">DRE Placa (R$)</label>
                  <input type="number" step="0.01" value={vFormDrePlaca} onChange={e => setVFormDrePlaca(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isSavingVehicle} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold">
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
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
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
                  <input type="text" value={rFormCategoria} onChange={e => setRFormCategoria(e.target.value)} placeholder="LOCALIZADOR" className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Modelo</label>
                  <input type="text" value={rFormModelo} onChange={e => setRFormModelo(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Serial</label>
                <input type="text" required value={rFormSerial} onChange={e => setRFormSerial(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">SIM Card</label>
                  <input type="text" value={rFormSimCard} onChange={e => setRFormSimCard(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div className="w-32">
                  <label className="block text-xs text-gray-400 mb-1">Operadora</label>
                  <input type="text" value={rFormOperadora} onChange={e => setRFormOperadora(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Data de Entrada</label>
                  <input type="date" value={rFormDataEntrada} onChange={e => setRFormDataEntrada(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select value={rFormStatus} onChange={e => setRFormStatus(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
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
                <input type="text" value={rFormLocalizacao} onChange={e => setRFormLocalizacao(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Custo Aquisição (R$)</label>
                  <input type="number" step="0.01" value={rFormCustoAquisicao} onChange={e => setRFormCustoAquisicao(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Custo Mensal (R$)</label>
                  <input type="number" step="0.01" value={rFormCustoMensal} onChange={e => setRFormCustoMensal(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Valor Mensalidade (R$)</label>
                  <input type="number" step="0.01" value={rFormValorMensalidade} onChange={e => setRFormValorMensalidade(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isSavingRastreador} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold">
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
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaLink className="text-blue-400" /> Instalar Rastreador</h3>
              <button onClick={() => { setInstallTargetRastreador(null); setInstallVeiculoId(''); }} className="text-gray-400 hover:text-white"><FaTimes/></button>
            </div>
            <div className="text-sm text-gray-300">
              Rastreador: <span className="font-semibold text-white">{installTargetRastreador.serial}</span>
              {installTargetRastreador.modelo && <span className="text-gray-500"> ({installTargetRastreador.modelo})</span>}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Selecione o veículo</label>
              <select value={installVeiculoId} onChange={e => setInstallVeiculoId(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                <option value="">Selecione a placa...</option>
                {veiculos.map(v => (
                  <option key={v.id} value={v.id}>{v.placa} — {empresaNomeById[v.empresa_id] || 'sem empresa'}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleInstallRastreador} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Confirmar Instalação</button>
              <button onClick={() => { setInstallTargetRastreador(null); setInstallVeiculoId(''); }} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Nova OS em etapas */}
      {isOsModalOpen && (
        <OsWizard
          mode="escritorio"
          empresas={empresas}
          veiculos={veiculos}
          rastreadores={rastreadores}
          showToast={showToast}
          onClose={() => setIsOsModalOpen(false)}
          onSaved={({ os, rastreadores: rAtualizados, veiculos: vAtualizados }) => {
            setOrdensServico(prev => [os, ...prev]);
            if (rAtualizados.length) setRastreadores(prev => prev.map(r => rAtualizados.find(x => x.id === r.id) || r));
            if (vAtualizados.length) setVeiculos(prev => prev.map(v => { const u = vAtualizados.find(x => x.id === v.id); return u ? { ...v, id_instalado: u.id_instalado } : v; }));
          }}
        />
      )}

    </>
  );
}