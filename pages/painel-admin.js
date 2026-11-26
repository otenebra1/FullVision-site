import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import {
  FaTruck, FaCheckCircle, FaSpinner, FaArrowLeft, FaExclamationCircle,
  FaEdit, FaTrashAlt, FaTimes, FaSatelliteDish, FaLink, FaUnlink, FaClipboardList, FaExpandAlt, FaCamera, FaWallet, FaShoppingCart,
  FaFileSignature,
  FaHeadset,
} from 'react-icons/fa';
import OsHistory from '../components/os/OsHistory';
import OsWizard from '../components/os/OsWizard';
import OsDetalhe from '../components/os/OsDetalhe';
import VeiculosAgrupados from '../components/admin/VeiculosAgrupados';
import PrecosPanel from '../components/admin/PrecosPanel';
import ClientesPanel from '../components/admin/ClientesPanel';
import ClienteForm from '../components/admin/ClienteForm';
import ClienteFicha from '../components/admin/ClienteFicha';
import EstoqueCatalogo from '../components/admin/EstoqueCatalogo';
import EstoqueNiveis from '../components/admin/EstoqueNiveis';
import SolicitarCompra from '../components/financeiro/SolicitarCompra';
import Notificacoes from '../components/Notificacoes';
import VeiculoDetalhe from '../components/admin/VeiculoDetalhe';
import { reduzirImagem } from '../lib/osSalvar';
import { ehAdmin, ehEquipe, podeCompras } from '../lib/perfis';
import { ehDaCategoria, itemInstaladoNaPlaca, categoriaDoItem, CAT_LOCALIZADOR, CAT_ATUADOR } from '../lib/osConstants';
import { SERVICOS_VEICULO, calcularDrePlaca, calcularMensalidade, comMensalidadeEfetiva, ordensPorVeiculo, rastreadorPorVeiculo } from '../lib/veiculos';
import {
  BRL, setOcultarValores,
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
  SegmentedControl,
} from '../components/admin/ui';
import { Select, DateInput } from '../components/ui/FormControls';


const BUCKET_FOTOS_VEICULOS = 'veiculos-fotos';
// Itens do estoque: categoria e, para localizadores, os modelos
const CATEGORIAS_ESTOQUE = ['LOCALIZADOR', 'SENSOR', 'ATUADOR'];
const MODELOS_LOCALIZADOR = ['FT4G', 'NEO', 'VOLT', 'CARGO', 'FROTA', 'DUO', 'TRIO'];
const RESUMO_VAZIO = { total: 0, ativos: 0, inativos: 0, mensalidade: 0, faturamento: 0, custoTotal: 0 };

export default function PainelAdmin() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  // ADM vê tudo; funcionário vê o painel sem preços, valores em R$ e exclusões
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [acessoCompras, setAcessoCompras] = useState(false); // ADM ou permissão "Área de compras"

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
  const [vGroupBy, setVGroupBy] = useState('cliente'); // 'cliente' | 'lista'
  const [vSubGroupBy, setVSubGroupBy] = useState(['operacao']); // dentro do cliente: 'associado' e/ou 'operacao' (dá para ligar os dois)
  const [viewingVehicle, setViewingVehicle] = useState(null);
  const [clienteModal, setClienteModal] = useState(null); // { empresa | null } aberto para criar/editar cliente
  const [clienteFichaId, setClienteFichaId] = useState(null); // ficha (só leitura) do cliente aberta
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
  const [vFormCustoAcessorios, setVFormCustoAcessorios] = useState('');
  const [vFormServicos, setVFormServicos] = useState([]);
  const [vFormObservacao, setVFormObservacao] = useState('');
  // Valores mensais por serviço: padrão (financeiro_config) e por cliente (mensalidade_cliente)
  const [configFinanceiro, setConfigFinanceiro] = useState(null);
  const [mensalidadePorCliente, setMensalidadePorCliente] = useState({});
  const [vFormFotoFile, setVFormFotoFile] = useState(null);
  const [vFormFotoUrl, setVFormFotoUrl] = useState('');
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
  const [rFormCategoriaId, setRFormCategoriaId] = useState('');
  const [rFormProdutoId, setRFormProdutoId] = useState('');
  // Catálogo do estoque (categorias e produtos com código). ok=false enquanto as tabelas não existem.
  const [catalogo, setCatalogo] = useState({ ok: false, categorias: [], produtos: [] });
  const [isCatalogoOpen, setIsCatalogoOpen] = useState(false);
  // Solicitação de compra (cai no /financeiro)
  const [isSolicitarOpen, setIsSolicitarOpen] = useState(false);
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
  const [osAberta, setOsAberta] = useState(null); // OS aberta (de solicitação) sendo finalizada
  const [osDaPlaca, setOsDaPlaca] = useState(null); // OS aberta a partir do histórico da ficha do veículo


  // ------------------------------------------
  // Guard de acesso: ADM e funcionário passam; técnico vai para o app dele
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
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile?.role === 'tecnico') {
        router.replace('/tecnico');
        return;
      }
      if (!ehEquipe(profile?.role)) {
        router.replace('/area-cliente');
        return;
      }

      const adm = ehAdmin(profile.role);
      setOcultarValores(!adm);
      setIsSuperAdmin(adm);
      setAcessoCompras(podeCompras(profile));
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
      // Avisos de contrato vencendo / reajuste (só faz algo para o ADM; ignora se o SQL ainda não rodou)
      try { await supabase.rpc('fv_contratos_alertas'); } catch (e) { /* ignora */ }

      const { data: empresasData } = await supabase
        .from('empresas')
        .select('*')
        .order('nome');
      if (empresasData) setEmpresas(empresasData);

      const { data: veiculosData } = await supabase
        .from('veiculos')
        .select('*')
        .order('placa');
      // Placa sem serviço ligado não cobra mensalidade, mesmo que tenha um valor antigo gravado
      if (veiculosData) setVeiculos(veiculosData.map(comMensalidadeEfetiva));

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

      await carregarCatalogo();

      // Só o ADM lê os valores; para os outros perfis a conta fica a cargo do banco
      await recarregarMensalidades();

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

  // DRE de cada placa (faturado − serviços − equipamento)
  const drePorVeiculo = useMemo(() => {
    const osMap = ordensPorVeiculo(ordensServico);
    const rMap = rastreadorPorVeiculo(veiculos, rastreadores);
    const map = {};
    veiculos.forEach(v => { map[v.id] = calcularDrePlaca(v, osMap[v.id] || [], rMap[v.id]); });
    return map;
  }, [veiculos, ordensServico, rastreadores]);

  // Agrega veículos por empresa
  const resumoPorEmpresa = useMemo(() => {
    const map = {};
    empresas.forEach(e => {
      map[e.id] = { total: 0, ativos: 0, inativos: 0, mensalidade: 0, faturamento: 0, custoTotal: 0 };
    });
    veiculos.forEach(v => {
      const r = map[v.empresa_id];
      if (!r) return;
      r.total += 1;
      if (v.status === 'Ativo') { r.ativos += 1; r.mensalidade += Number(v.mensalidade) || 0; }
      else r.inativos += 1;
      r.faturamento += drePorVeiculo[v.id]?.faturado || 0;
      r.custoTotal += Number(v.custo_total) || 0;
    });
    return map;
  }, [empresas, veiculos, drePorVeiculo]);

  // Monta a hierarquia: grupos (com soma dos filhos) + clientes avulsos
  const hierarquia = useMemo(() => {
    const grupos = empresas.filter(e => !e.grupo_id && empresaIdsComFilhos.has(e.id));
    const avulsos = empresas.filter(e => !e.grupo_id && !empresaIdsComFilhos.has(e.id));

    const gruposComFilhos = grupos.map(g => {
      const filhos = empresas.filter(e => e.grupo_id === g.id);
      const somaGrupo = filhos.reduce((acc, f) => {
        const r = resumoPorEmpresa[f.id] || RESUMO_VAZIO;
        return {
          total: acc.total + r.total,
          ativos: acc.ativos + r.ativos,
          inativos: acc.inativos + r.inativos,
          mensalidade: acc.mensalidade + r.mensalidade,
          faturamento: acc.faturamento + r.faturamento,
          custoTotal: acc.custoTotal + r.custoTotal,
        };
      }, RESUMO_VAZIO);

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

  // Cliente principal de cada empresa: o grupo dela, ou ela mesma se for avulsa
  const clienteNomeById = useMemo(() => {
    const map = {};
    empresas.forEach(e => { map[e.id] = (e.grupo_id && empresaNomeById[e.grupo_id]) || e.nome; });
    return map;
  }, [empresas, empresaNomeById]);

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
    setVFormMensalidade(''); setVFormCustoTotal('');
    setVFormCustoAcessorios(''); setVFormServicos([]); setVFormObservacao(''); setVFormFotoFile(null); setVFormFotoUrl('');
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
      setVFormCustoAcessorios(v.custo_acessorios ?? '');
      setVFormServicos(v.servicos || []);
      setVFormObservacao(v.observacao || '');
      setVFormFotoFile(null);
      setVFormFotoUrl(v.foto_placa_url || '');
    } else {
      setEditingVehicle(null);
      resetVehicleForm();
    }
    setViewingVehicle(null);
    setIsVehicleModalOpen(true);
  };

  // Mensalidade automática: soma dos serviços ligados (null = regra ainda não configurada em Preços)
  const vFormMensalidadeAuto = useMemo(() => {
    const empresa = empresas.find(e => String(e.id) === String(vFormEmpresaId)) || null;
    const doCliente = empresa ? mensalidadePorCliente[empresa.id] || null : null;
    const doGrupo = empresa?.grupo_id ? mensalidadePorCliente[empresa.grupo_id] || null : null;
    return calcularMensalidade(vFormServicos, configFinanceiro, doCliente, doGrupo);
  }, [vFormServicos, vFormEmpresaId, empresas, configFinanceiro, mensalidadePorCliente]);
  const vFormMensalidadeFinal = vFormMensalidadeAuto != null ? vFormMensalidadeAuto : vFormMensalidade;

  // Prévia do DRE no formulário, com os valores que estão sendo digitados
  const vFormDre = useMemo(() => {
    const base = editingVehicle || {};
    const rastreador = rastreadorPorVeiculo([{ id: base.id, id_instalado: vFormIdInstalado }], rastreadores)[base.id] || null;
    const ordens = base.id ? ordensServico.filter(o => o.veiculo_id === base.id) : [];
    return calcularDrePlaca({
      mensalidade: vFormMensalidadeFinal, data_inst: vFormDataInst, data_desinst: vFormDataDesinst, custo_acessorios: vFormCustoAcessorios,
    }, ordens, rastreador);
  }, [editingVehicle, vFormIdInstalado, vFormMensalidadeFinal, vFormDataInst, vFormDataDesinst, vFormCustoAcessorios, rastreadores, ordensServico]);

  // Prévia da foto: arquivo recém-escolhido ou a URL já salva
  const [vFormFotoPreview, setVFormFotoPreview] = useState('');
  useEffect(() => {
    if (!vFormFotoFile) { setVFormFotoPreview(vFormFotoUrl); return undefined; }
    const url = URL.createObjectURL(vFormFotoFile);
    setVFormFotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [vFormFotoFile, vFormFotoUrl]);

  const toggleServico = (key) => setVFormServicos(cur => (cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key]));

  // Sobe a foto da placa para o bucket próprio do cadastro de veículos e devolve a URL pública
  const uploadFotoPlaca = async (file, placa) => {
    const reduzida = await reduzirImagem(file);
    const ext = (reduzida.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${placa.replace(/[^A-Z0-9]/gi, '') || 'sem-placa'}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET_FOTOS_VEICULOS).upload(path, reduzida);
    if (error) throw new Error(error.message);
    return supabase.storage.from(BUCKET_FOTOS_VEICULOS).getPublicUrl(path).data.publicUrl;
  };

  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    if (!vFormPlaca.trim()) { showToast('Informe a placa.', 'error'); return; }
    if (!vFormEmpresaId) { showToast('Selecione a empresa.', 'error'); return; }

    setIsSavingVehicle(true);
    let fotoUrl = vFormFotoUrl || null;
    if (vFormFotoFile) {
      try {
        fotoUrl = await uploadFotoPlaca(vFormFotoFile, vFormPlaca.trim().toUpperCase());
      } catch (err) {
        setIsSavingVehicle(false);
        showToast('Erro ao enviar a foto da placa: ' + err.message, 'error');
        return;
      }
    }
    const payload = {
      empresa_id: vFormEmpresaId,
      placa: vFormPlaca.trim().toUpperCase(),
      status: vFormStatus,
      operacao: vFormOperacao || null,
      modelo: vFormModelo || null,
      id_instalado: vFormIdInstalado || null,
      data_inst: vFormDataInst || null,
      data_desinst: vFormDataDesinst || null,
      mensalidade: vFormMensalidadeFinal === '' || vFormMensalidadeFinal == null ? null : Number(vFormMensalidadeFinal),
      custo_total: vFormCustoTotal === '' ? null : Number(vFormCustoTotal),
      custo_acessorios: vFormCustoAcessorios === '' ? null : Number(vFormCustoAcessorios),
      servicos: vFormServicos,
      observacao: vFormObservacao.trim() || null,
      foto_placa_url: fotoUrl,
    };
    payload.dre_placa = vFormDre.dre; // guarda a última foto do DRE calculado
    // Funcionário não vê nem altera valores em R$
    if (!isSuperAdmin) ['mensalidade', 'custo_total', 'custo_acessorios', 'dre_placa'].forEach(k => { delete payload[k]; });

    let result;
    if (editingVehicle) {
      result = await supabase.from('veiculos').update(payload).eq('id', editingVehicle.id).select().single();
    } else {
      result = await supabase.from('veiculos').insert([payload]).select().single();
    }
    setIsSavingVehicle(false);

    if (result.error) { showToast('Erro ao salvar veículo: ' + result.error.message, 'error'); return; }

    if (editingVehicle) {
      setVeiculos(veiculos.map(v => v.id === result.data.id ? comMensalidadeEfetiva(result.data) : v));
    } else {
      setVeiculos([comMensalidadeEfetiva(result.data), ...veiculos]);
    }
    setIsVehicleModalOpen(false);
    setEditingVehicle(null);
    resetVehicleForm();
  };

  const handleDeleteVehicle = (id) => {
    if (!isSuperAdmin) { showToast('Só o ADM pode excluir.', 'error'); return; }
    askConfirm('Tem certeza que deseja excluir esta placa? Essa ação não pode ser desfeita.', async () => {
      const { error } = await supabase.from('veiculos').delete().eq('id', id);
      if (error) { showToast('Erro ao excluir veículo: ' + error.message, 'error'); return; }
      setVeiculos(veiculos.filter(v => v.id !== id));
      setViewingVehicle(null);
      showToast('Veículo excluído com sucesso!');
    });
  };

  const openCliente = (empresa) => {
    setClienteFichaId(null);
    setClienteModal({ empresa });
  };

  // Depois de salvar no ClienteForm: atualiza a lista e volta para a ficha do cliente
  const onClienteSalvo = (salvo, editando) => {
    setEmpresas(prev => (editando
      ? prev.map(x => (x.id === salvo.id ? salvo : x))
      : [...prev, salvo].sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'))));
    setClienteModal(null);
    setClienteFichaId(salvo.id);
    showToast(editando ? 'Cliente atualizado!' : 'Cliente criado!');
  };

  const clienteFicha = clienteFichaId != null ? empresas.find(x => x.id === clienteFichaId) : null;

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

  // Valores de mensalidade por serviço (padrão e de cada cliente); recarrega depois de mudar em Preços
  async function recarregarMensalidades() {
    const [{ data: cfgData }, { data: porCliente }] = await Promise.all([
      supabase.from('financeiro_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('mensalidade_cliente').select('*'),
    ]);
    setConfigFinanceiro(cfgData || null);
    setMensalidadePorCliente(Object.fromEntries((porCliente || []).map(m => [m.empresa_id, m])));
  }

  async function carregarCatalogo() {
    const [cats, prods] = await Promise.all([
      supabase.from('estoque_categorias').select('*').order('ordem').order('nome'),
      supabase.from('estoque_produtos').select('*').order('ordem').order('nome'),
    ]);
    if (cats.error || prods.error) { setCatalogo({ ok: false, categorias: [], produtos: [] }); return; }
    setCatalogo({ ok: true, categorias: cats.data || [], produtos: prods.data || [] });
  }

  const produtoById = useMemo(() => Object.fromEntries(catalogo.produtos.map(p => [p.id, p])), [catalogo.produtos]);
  const categoriaById = useMemo(() => Object.fromEntries(catalogo.categorias.map(c => [c.id, c])), [catalogo.categorias]);

  // Produto do catálogo de um item: pelo vínculo, ou pelo nome do modelo
  const produtoDoItem = (r) => (r.produto_id && produtoById[r.produto_id])
    || catalogo.produtos.find(p => p.nome === (r.modelo || '').trim().toUpperCase()) || null;

  const resetRastreadorForm = () => {
    const loc = catalogo.categorias.find(c => c.codigo === 'LOC');
    setRFormCategoriaId(loc ? loc.id : ''); setRFormProdutoId('');
    setRFormCategoria('LOCALIZADOR'); setRFormModelo(''); setRFormSerial('');
    setRFormSimCard(''); setRFormOperadora(''); setRFormDataEntrada('');
    setRFormCustoAquisicao(''); setRFormCustoMensal(''); setRFormValorMensalidade('');
    setRFormStatus('estoque_central'); setRFormLocalizacao('');
  };

  const openRastreadorForm = (r) => {
    if (r) {
      setEditingRastreador(r);
      const cat = (r.categoria || '').trim();
      const mod = (r.modelo || '').trim();
      setRFormCategoria(CATEGORIAS_ESTOQUE.includes(cat.toUpperCase()) ? cat.toUpperCase() : cat);
      setRFormModelo(MODELOS_LOCALIZADOR.includes(mod.toUpperCase()) ? mod.toUpperCase() : mod);
      const prod = produtoDoItem(r);
      setRFormProdutoId(prod ? prod.id : '');
      setRFormCategoriaId(prod ? prod.categoria_id : (catalogo.categorias.find(c => c.nome.toUpperCase() === cat.toUpperCase())?.id || ''));
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
    const catSel = categoriaById[rFormCategoriaId];
    const prodSel = produtoById[rFormProdutoId];
    if (catalogo.ok && !prodSel) { setIsSavingRastreador(false); showToast('Escolha o produto.', 'error'); return; }
    const payload = {
      ...(catalogo.ok
        ? { categoria: catSel ? catSel.nome.toUpperCase() : null, modelo: prodSel.nome, produto_id: prodSel.id }
        : { categoria: rFormCategoria || null, modelo: rFormModelo || null }),
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
    if (!isSuperAdmin) ['custo_aquisicao', 'custo_mensal', 'valor_mensalidade'].forEach(k => { delete payload[k]; });

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
    if (!isSuperAdmin) { showToast('Só o ADM pode excluir.', 'error'); return; }
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
    // Regra: no máximo 1 rastreador e 1 atuador por veículo
    const cat = categoriaDoItem(installTargetRastreador);
    const ehLocalizador = cat === CAT_LOCALIZADOR;
    if (ehLocalizador || cat === CAT_ATUADOR) {
      const jaTem = itemInstaladoNaPlaca(rastreadores, installVeiculoId, cat);
      if (jaTem && jaTem.id !== installTargetRastreador.id) {
        showToast(`Esta placa já tem ${ehLocalizador ? 'o rastreador' : 'o atuador'} ${jaTem.serial}. Retire antes de instalar outro.`, 'error');
        return;
      }
    }

    const { data: updatedRastreador, error: errR } = await supabase
      .from('rastreadores')
      .update({ veiculo_id: installVeiculoId, status: 'instalado', placa_atual: veiculoPlacaById[installVeiculoId] || null })
      .eq('id', installTargetRastreador.id)
      .select()
      .single();
    if (errR) { showToast('Erro ao instalar rastreador: ' + errR.message, 'error'); return; }

    // O "ID instalado" da placa é só do rastreador; atuador e sensor ficam ligados pelo estoque
    if (ehLocalizador) {
      const { error: errV } = await supabase
        .from('veiculos')
        .update({ id_instalado: installTargetRastreador.serial })
        .eq('id', installVeiculoId);
      if (errV) { showToast('Rastreador vinculado, mas houve erro ao atualizar o veículo: ' + errV.message, 'error'); }
      setVeiculos(veiculos.map(v => v.id === installVeiculoId ? { ...v, id_instalado: installTargetRastreador.serial } : v));
    }

    setRastreadores(rastreadores.map(r => r.id === updatedRastreador.id ? updatedRastreador : r));
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

      if (veiculoAnteriorId && ehDaCategoria(r, CAT_LOCALIZADOR)) {
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
    if (!isSuperAdmin) { showToast('Só o ADM pode excluir.', 'error'); return; }
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
              {acessoCompras && (
                <a href="/compras" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2 transition-colors">
                  <FaShoppingCart size={13} /> Compras
                </a>
              )}
              {isSuperAdmin && (
                <a href="/financeiro" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2 transition-colors">
                  <FaWallet size={13} /> Financeiro
                </a>
              )}
              {isSuperAdmin && (
                <a href="/contratos" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2 transition-colors">
                  <FaFileSignature size={13} /> Contratos
                </a>
              )}
              <a href="/suporte" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2 transition-colors">
                <FaHeadset size={13} /> Chamados
              </a>
              <button type="button" onClick={() => setIsSolicitarOpen(true)} className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2 transition-colors">
                <FaShoppingCart size={13} /> Solicitar compra
              </button>
              <a href="/quests" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2 transition-colors">
                <FaClipboardList size={13} /> Agenda da equipe
              </a>
              <a href="/area-cliente" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2 transition-colors">
                <FaArrowLeft size={12} /> Voltar para a área do cliente
              </a>
              <Notificacoes />
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
                  { label: 'Mensalidade ativa', value: isSuperAdmin ? stats.mensalidadeAtivaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : BRL(0) },
                  { label: 'Solicitações pendentes', value: pendingRequestsCount, href: '/area-cliente', valueClass: pendingRequestsCount > 0 ? 'text-amber-400' : 'text-white' },
                ]}
              />

              {/* Abas: mostra só uma seção por vez */}
              <TabBar
                active={activeSection}
                onChange={setActiveSection}
                tabs={[
                  { key: 'resumo', label: 'Cliente', count: empresas.length },
                  { key: 'veiculos', label: 'Placas', count: veiculos.length },
                  { key: 'rastreadores', label: 'Estoque', count: rastreadores.length },
                  { key: 'niveis', label: 'Estoque mínimo' },
                  { key: 'ordens', label: 'Ordens de serviço', count: ordensServico.length },
                  ...(isSuperAdmin ? [
                    { key: 'precos-cliente', label: 'Tabela de preço cliente' },
                    { key: 'precos-tecnico', label: 'Tabela de preço técnico' },
                  ] : []),
                ]}
              />

              {/* Clientes */}
              {activeSection === 'resumo' && (
                <ClientesPanel
                  hierarquia={hierarquia}
                  resumoPorEmpresa={resumoPorEmpresa}
                  onNovo={() => openCliente(null)}
                  onEditar={openCliente}
                  onVer={(e) => setClienteFichaId(e.id)}
                />
              )}

              {/* Placas (banco de veículos) */}
              {activeSection === 'veiculos' && (
                <SectionCard title="Placas" action={<PrimaryButton onClick={() => openVehicleForm(null)}>Nova placa</PrimaryButton>}>
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

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <SegmentedControl
                      label="Ver por"
                      value={vGroupBy}
                      onChange={setVGroupBy}
                      options={[{ key: 'cliente', label: 'Cliente' }, { key: 'lista', label: 'Lista' }]}
                    />
                    {vGroupBy === 'cliente' && (
                      <SegmentedControl
                        label="Agrupar dentro do cliente por"
                        multiple
                        value={vSubGroupBy}
                        onChange={setVSubGroupBy}
                        options={[{ key: 'associado', label: 'Cliente associado' }, { key: 'operacao', label: 'Operação' }]}
                      />
                    )}
                  </div>

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
                              <Th align="right"><span className="sr-only">Detalhes</span></Th>
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
                                <tr key={v.id} className={`${rowClass} cursor-pointer`} onClick={() => setViewingVehicle(v)}>
                                  <td className="px-4 py-3 text-white font-semibold tracking-wide whitespace-nowrap">{v.placa}</td>
                                  <td className="px-4 py-3 text-gray-300">{empresaNomeById[v.empresa_id] || <Dash />}</td>
                                  <td className="px-4 py-3 text-gray-300"><StatusDot tone={v.status === 'Ativo' ? 'ok' : 'bad'}>{v.status || '—'}</StatusDot></td>
                                  <td className="px-4 py-3 text-gray-300">{v.operacao || <Dash />}</td>
                                  <td className="px-4 py-3 text-gray-400">{v.modelo || <Dash />}</td>
                                  <td className="px-4 py-3 text-gray-400 tabular-nums">{v.id_instalado || <Dash />}</td>
                                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-gray-200">{v.mensalidade != null ? BRL(v.mensalidade) : <Dash />}</td>
                                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                                    <ActionButton title="Ver detalhes" hover="hover:text-blue-400" onClick={(e) => { e.stopPropagation(); setViewingVehicle(v); }}><FaExpandAlt size={13} /></ActionButton>
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
                      clienteNomeById={clienteNomeById}
                      subGroupBy={vSubGroupBy}
                      sort={vSort}
                      onSort={k => setVSort(cur => nextSort(cur, k))}
                      onOpen={setViewingVehicle}
                    />
                  )}
                </SectionCard>
              )}

              {/* Rastreadores (estoque) */}
              {activeSection === 'niveis' && (
                <EstoqueNiveis isAdmin={isSuperAdmin} showToast={showToast} onSolicitar={() => setIsSolicitarOpen(true)} />
              )}

              {activeSection === 'rastreadores' && (
                <SectionCard title="Estoque" action={(
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setIsSolicitarOpen(true)} className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2 transition-colors"><FaShoppingCart size={12} /> Solicitar compra</button>
                    <button type="button" onClick={() => setIsCatalogoOpen(true)} className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2 transition-colors">Categorias e produtos</button>
                    <PrimaryButton onClick={() => openRastreadorForm(null)}>Novo item</PrimaryButton>
                  </div>
                )}>
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
                              <td className="px-4 py-3 text-gray-300">{r.categoria}{r.modelo ? ` — ${r.modelo}` : ''}{produtoDoItem(r) && <span className="ml-2 text-xs font-mono text-gray-500">{produtoDoItem(r).codigo}</span>}</td>
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
                                {isSuperAdmin && <ActionButton title="Excluir" hover="hover:text-red-400" onClick={() => handleDeleteRastreador(r.id)}><FaTrashAlt size={14} /></ActionButton>}
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
              {isSuperAdmin && activeSection === 'precos-cliente' && <PrecosPanel modo="cliente" empresas={empresas} showToast={showToast} onMensalidadeChanged={recarregarMensalidades} />}
              {isSuperAdmin && activeSection === 'precos-tecnico' && <PrecosPanel modo="tecnico" empresas={empresas} showToast={showToast} />}

              {/* Ordens de serviço */}
              {activeSection === 'ordens' && (
                <OsHistory
                  ordens={ordensServico}
                  empresaOptions={empresaOptions}
                  rastreadores={rastreadores}
                  onNew={() => { setOsAberta(null); setIsOsModalOpen(true); }}
                  onFinalizar={(os) => { setOsAberta(os); setIsOsModalOpen(true); }}
                  onUpdated={(os) => setOrdensServico(prev => prev.map(o => (o.id === os.id ? os : o)))}
                  onDelete={isSuperAdmin ? handleDeleteOs : undefined}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Detalhes do veículo (editar e excluir ficam aqui dentro) */}
      {viewingVehicle && (
        <VeiculoDetalhe
          veiculo={viewingVehicle}
          empresaNome={empresaNomeById[viewingVehicle.empresa_id]}
          clienteNome={clienteNomeById[viewingVehicle.empresa_id]}
          dre={drePorVeiculo[viewingVehicle.id]}
          ordens={ordensServico.filter(o => o.veiculo_id === viewingVehicle.id)}
          onClose={() => setViewingVehicle(null)}
          onEdit={openVehicleForm}
          onDelete={isSuperAdmin ? handleDeleteVehicle : undefined}
          onOpenOs={(os) => setOsDaPlaca(os)}
        />
      )}

      {/* OS aberta pelo histórico da ficha do veículo (fica por cima da ficha) */}
      {osDaPlaca && (
        <OsDetalhe
          os={osDaPlaca}
          rastreadores={rastreadores}
          onClose={() => setOsDaPlaca(null)}
          onDelete={isSuperAdmin ? (id) => { setOsDaPlaca(null); handleDeleteOs(id); } : undefined}
          onFinalizar={(os) => { setOsDaPlaca(null); setViewingVehicle(null); setOsAberta(os); setIsOsModalOpen(true); }}
          onUpdated={(os) => { setOrdensServico(prev => prev.map(o => (o.id === os.id ? os : o))); setOsDaPlaca(os); }}
        />
      )}

      {/* Catálogo do estoque */}
      {isSolicitarOpen && (
        <SolicitarCompra showToast={showToast} onClose={() => setIsSolicitarOpen(false)} />
      )}

      {isCatalogoOpen && (
        catalogo.ok ? (
          <EstoqueCatalogo
            categorias={catalogo.categorias}
            produtos={catalogo.produtos}
            onClose={() => setIsCatalogoOpen(false)}
            onChanged={carregarCatalogo}
            showToast={showToast}
          />
        ) : (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setIsCatalogoOpen(false)}>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-3" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white">Categorias e produtos</h3>
              <p className="text-sm text-gray-400">As tabelas do catálogo ainda não existem no banco. Rode o arquivo <span className="font-mono text-gray-200">migracao-estoque-catalogo.sql</span> no SQL Editor do Supabase e recarregue a página.</p>
              <button type="button" onClick={() => setIsCatalogoOpen(false)} className="text-sm text-blue-400 hover:text-blue-300">Fechar</button>
            </div>
          </div>
        )
      )}

      {/* Ficha do cliente */}
      {clienteFicha && !clienteModal && (
        <ClienteFicha
          empresa={clienteFicha}
          grupoNome={clienteFicha.grupo_id ? empresas.find(x => x.id === clienteFicha.grupo_id)?.nome : null}
          associados={empresas.filter(x => x.grupo_id === clienteFicha.id)}
          resumo={hierarquia.gruposComFilhos.find(g => g.grupo.id === clienteFicha.id)?.resumo || resumoPorEmpresa[clienteFicha.id] || RESUMO_VAZIO}
          onEditar={() => openCliente(clienteFicha)}
          onClose={() => setClienteFichaId(null)}
        />
      )}

      {/* Criar/editar cliente (cadastro completo) */}
      {clienteModal && (
        <ClienteForm
          empresa={clienteModal.empresa}
          empresas={empresas}
          showToast={showToast}
          onClose={() => setClienteModal(null)}
          onSaved={onClienteSalvo}
        />
      )}

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
                  <Select value={vFormStatus} onChange={e => setVFormStatus(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Empresa</label>
                <Select required value={vFormEmpresaId} onChange={e => setVFormEmpresaId(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                  <option value="">Selecione a empresa...</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </Select>
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
                  <DateInput value={vFormDataInst} onChange={e => setVFormDataInst(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Data Desinstalação</label>
                  <DateInput value={vFormDataDesinst} onChange={e => setVFormDataDesinst(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
              </div>

              {isSuperAdmin && (<>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Mensalidade (R$)</label>
                  {vFormMensalidadeAuto != null ? (
                    <div className="w-full bg-gray-950/50 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 tabular-nums" title="Calculada pelos serviços ligados abaixo (valores em Preços do cliente)">
                      {BRL(vFormMensalidadeAuto)}
                    </div>
                  ) : (
                    <input type="number" step="0.01" value={vFormMensalidade} onChange={e => setVFormMensalidade(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Custo Total (R$)</label>
                  <input type="number" step="0.01" value={vFormCustoTotal} onChange={e => setVFormCustoTotal(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">DRE Placa (R$)</label>
                  <div className={`w-full bg-gray-950/50 border border-gray-800 rounded-lg px-3 py-2 text-sm tabular-nums ${vFormDre.dre < 0 ? 'text-red-400' : 'text-emerald-400'}`} title="Calculado: valor faturado − serviços realizados − equipamento e acessórios">
                    {BRL(vFormDre.dre)}
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Custo acessórios (R$)</label>
                  <input type="number" step="0.01" value={vFormCustoAcessorios} onChange={e => setVFormCustoAcessorios(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Custo do rastreador (estoque)</label>
                  <div className="w-full bg-gray-950/50 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 tabular-nums" title={vFormDre.rastreadorSerial ? `Rastreador ${vFormDre.rastreadorSerial}` : 'Nenhum rastreador do estoque ligado a esta placa'}>
                    {vFormDre.rastreadorSerial ? BRL(vFormDre.custoRastreador) : <span className="text-gray-600">Sem rastreador</span>}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 -mt-2">
                {vFormMensalidadeAuto != null
                  ? 'Mensalidade automática: soma dos serviços ligados abaixo, com o preço deste cliente (Preços do cliente). '
                  : 'Mensalidade manual: preencha os valores por serviço em Preços do cliente para ela ser calculada sozinha. '}
                DRE = faturado {BRL(vFormDre.faturado)} ({vFormDre.meses} {vFormDre.meses === 1 ? 'mês' : 'meses'}{vFormDre.faturadoOs ? ' + OS' : ''}) − serviços {BRL(vFormDre.servicos)} − equipamento e acessórios {BRL(vFormDre.equipamento)}
              </p>
              </>)}

              <div>
                <label className="block text-xs text-gray-400 mb-2">Serviços</label>
                <div className="space-y-2">
                  {SERVICOS_VEICULO.map(s => {
                    const on = vFormServicos.includes(s.key);
                    return (
                      <button
                        key={s.key}
                        type="button"
                        role="switch"
                        aria-checked={on}
                        onClick={() => toggleServico(s.key)}
                        className="w-full flex items-center justify-between bg-gray-950 border border-gray-700 hover:border-gray-600 rounded-lg px-3 py-2 text-sm text-white transition-colors"
                      >
                        <span>{s.label}</span>
                        <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-gray-700'}`}>
                          <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Observação</label>
                <textarea rows={3} value={vFormObservacao} onChange={e => setVFormObservacao(e.target.value)} placeholder="Anotações sobre este veículo" className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 resize-y" />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-2">Foto da placa</label>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-16 rounded-lg border border-gray-700 bg-gray-950 overflow-hidden flex items-center justify-center shrink-0">
                    {vFormFotoPreview
                      ? <img src={vFormFotoPreview} alt="Foto da placa" className="w-full h-full object-cover" />
                      : <FaCamera className="text-gray-600" />}
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <label className="cursor-pointer text-sm text-blue-400 hover:text-blue-300">
                      {vFormFotoPreview ? 'Trocar foto' : 'Adicionar foto'}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setVFormFotoFile(e.target.files?.[0] || null)} />
                    </label>
                    {vFormFotoPreview && (
                      <button type="button" onClick={() => { setVFormFotoFile(null); setVFormFotoUrl(''); }} className="text-xs text-gray-500 hover:text-red-400">Remover foto</button>
                    )}
                  </div>
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
                <FaSatelliteDish className="text-cyan-400" /> {editingRastreador ? 'Editar item' : 'Novo item'}
              </h3>
              <button onClick={() => setIsRastreadorModalOpen(false)} className="text-gray-400 hover:text-white"><FaTimes/></button>
            </div>

            <form onSubmit={handleSaveRastreador} className="space-y-4">
              {catalogo.ok ? (
                <div className="flex gap-4">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs text-gray-400 mb-1">Categoria</label>
                    <Select value={rFormCategoriaId} onChange={e => { setRFormCategoriaId(e.target.value); setRFormProdutoId(''); }} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                      <option value="">Selecione...</option>
                      {catalogo.categorias.filter(c => c.ativo || c.id === rFormCategoriaId).map(c => <option key={c.id} value={c.id}>{`${c.codigo} · ${c.nome}`}</option>)}
                    </Select>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs text-gray-400 mb-1">Produto</label>
                    <Select value={rFormProdutoId} required disabled={!rFormCategoriaId} placeholder={rFormCategoriaId ? 'Selecione...' : 'Escolha a categoria'} onChange={e => setRFormProdutoId(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                      {catalogo.produtos.filter(p => p.categoria_id === rFormCategoriaId && (p.ativo || p.id === rFormProdutoId)).map(p => <option key={p.id} value={p.id}>{`${p.codigo} · ${p.nome}`}</option>)}
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">Categoria</label>
                    <Select value={rFormCategoria} onChange={e => { const c = e.target.value; setRFormCategoria(c); if (c !== 'LOCALIZADOR' && MODELOS_LOCALIZADOR.includes(rFormModelo)) setRFormModelo(''); }} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                      <option value="">Selecione...</option>
                      {CATEGORIAS_ESTOQUE.map(c => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
                      {rFormCategoria && !CATEGORIAS_ESTOQUE.includes(rFormCategoria) && <option value={rFormCategoria}>{rFormCategoria}</option>}
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">Modelo</label>
                    {rFormCategoria === 'LOCALIZADOR' ? (
                      <Select value={rFormModelo} onChange={e => setRFormModelo(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                        <option value="">Selecione...</option>
                        {MODELOS_LOCALIZADOR.map(m => <option key={m} value={m}>{m}</option>)}
                        {rFormModelo && !MODELOS_LOCALIZADOR.includes(rFormModelo) && <option value={rFormModelo}>{rFormModelo}</option>}
                      </Select>
                    ) : (
                      <input type="text" value={rFormModelo} onChange={e => setRFormModelo(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                    )}
                  </div>
                </div>
              )}
              <div className="-mt-2 text-right">
                <button type="button" onClick={() => setIsCatalogoOpen(true)} className="text-xs text-blue-400 hover:text-blue-300">Cadastrar categorias e produtos</button>
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
                  <DateInput value={rFormDataEntrada} onChange={e => setRFormDataEntrada(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <Select value={rFormStatus} onChange={e => setRFormStatus(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                    <option value="estoque_central">Estoque Central</option>
                    <option value="estoque_tecnico">Estoque c/ Técnico</option>
                    <option value="aguardando_manutencao">Aguardando Manutenção</option>
                    <option value="baixado">Baixado</option>
                    <option value="instalado" disabled={!editingRastreador || editingRastreador.status !== 'instalado'}>Instalado (use o botão de vincular)</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Localização atual (técnico responsável, se aplicável)</label>
                <input type="text" value={rFormLocalizacao} onChange={e => setRFormLocalizacao(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
              </div>

              {isSuperAdmin && (
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
              )}

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
              <Select value={installVeiculoId} onChange={e => setInstallVeiculoId(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                <option value="">Selecione a placa...</option>
                {veiculos.map(v => (
                  <option key={v.id} value={v.id}>{v.placa} — {empresaNomeById[v.empresa_id] || 'sem empresa'}</option>
                ))}
              </Select>
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
          mostrarValores={isSuperAdmin}
          empresas={empresas}
          veiculos={veiculos}
          rastreadores={rastreadores}
          showToast={showToast}
          osAberta={osAberta}
          onClose={() => { setIsOsModalOpen(false); setOsAberta(null); }}
          onSaved={({ os, rastreadores: rAtualizados, veiculos: vAtualizados }) => {
            setOrdensServico(prev => (prev.some(o => o.id === os.id) ? prev.map(o => (o.id === os.id ? os : o)) : [os, ...prev]));
            if (rAtualizados.length) setRastreadores(prev => prev.map(r => rAtualizados.find(x => x.id === r.id) || r));
            if (vAtualizados.length) setVeiculos(prev => prev.map(v => { const u = vAtualizados.find(x => x.id === v.id); return u ? { ...v, id_instalado: u.id_instalado } : v; }));
          }}
        />
      )}

    </>
  );
}
