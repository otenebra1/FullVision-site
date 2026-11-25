// /financeiro — organização financeira da empresa (só ADM)
// Gastos (NF-e por XML, NF/romaneio/cupom/recibo anexados), fornecedores, viagens, itens e categorias.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  FaSpinner, FaArrowLeft, FaCheckCircle, FaExclamationCircle, FaEdit, FaTrashAlt, FaPaperclip, FaFileCsv, FaCheck, FaFileCode,
} from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { ehAdmin } from '../lib/perfis';
import {
  tableWrap, theadClass, tbodyClass, rowClass, Dash, StatStrip, TabBar, SectionCard, PrimaryButton, ActionButton,
  StatusDot, Th, SearchInput, FilterDropdown, DateRangeFilter, ToggleFilter, FilterSummary, Pagination, SegmentedControl,
  sortBy, nextSort, norm, summarizeSelection, chipText,
} from '../components/admin/ui';
import DespesaForm from '../components/financeiro/DespesaForm';
import { FornecedoresPanel, ViagensPanel, ItensPanel } from '../components/financeiro/Cadastros';
import SolicitacoesPanel from '../components/financeiro/SolicitacoesPanel';
import SolicitarCompra from '../components/financeiro/SolicitarCompra';
import {
  TIPOS_DOCUMENTO, FORMAS_PAGAMENTO, STATUS_PAGAMENTO, GRUPOS_CATEGORIA, rotulo, reais, reaisCurto, dataBR, mesRotulo,
  periodoPreset, estaVencida, baixarCsv, hojeIso, BUCKET_FINANCEIRO,
} from '../lib/financeiro';

const POR_PAGINA = 25;
const PRESETS = [
  { key: 'mes', label: 'Este mês' },
  { key: 'mes_passado', label: 'Mês passado' },
  { key: '3m', label: '3 meses' },
  { key: 'ano', label: 'Este ano' },
  { key: 'tudo', label: 'Tudo' },
];

export default function Financeiro() {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');

  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const askConfirm = (message, onConfirm) => setConfirmDialog({ message, onConfirm });

  // Dados
  const [despesas, setDespesas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [itens, setItens] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [viagens, setViagens] = useState([]);
  const [vinculos, setVinculos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [produtosEstoque, setProdutosEstoque] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [rastreadores, setRastreadores] = useState([]);
  const [solicitarAberto, setSolicitarAberto] = useState(false);

  const [aba, setAba] = useState('gastos');
  const [formAberto, setFormAberto] = useState(null); // { despesa?, viagemPadrao?, abrirXml?, solicitacoes? }
  // Abre direto numa aba (ex.: /financeiro?aba=solicitacoes)
  useEffect(() => { if (router.query.aba) setAba(String(router.query.aba)); }, [router.query.aba]);

  // ---------- Acesso: só ADM ----------
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/area-cliente'); return; }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile?.role === 'tecnico') { router.replace('/tecnico'); return; }
      if (!ehAdmin(profile?.role)) { router.replace(profile?.role === 'funcionario' ? '/painel-admin' : '/area-cliente'); return; }
      setAutorizado(true);
    })();
  }, [router]);

  const carregar = useCallback(async () => {
    const [d, c, i, f, v, vi, t, e, p, so, ra] = await Promise.all([
      supabase.from('fin_despesas').select('*, fin_despesa_itens(*)').order('data', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('fin_categorias').select('*').order('ordem').order('nome'),
      supabase.from('fin_itens').select('*').order('nome'),
      supabase.from('fin_fornecedores').select('*').order('nome'),
      supabase.from('fin_viagens').select('*').order('data_ida', { ascending: false }),
      supabase.from('fin_item_vinculos').select('*'),
      supabase.from('tecnicos').select('id, nome').order('nome'),
      supabase.from('empresas').select('id, nome').order('nome'),
      supabase.from('estoque_produtos').select('id, codigo, nome').order('codigo'),
      supabase.from('fin_solicitacoes').select('*').order('created_at', { ascending: false }),
      supabase.from('rastreadores').select('id, produto_id, status'),
    ]);
    if (d.error) {
      setErroCarga(d.error.message.includes('fin_despesas')
        ? 'As tabelas do financeiro ainda não existem no banco. Rode o SQL 20261125b_financeiro.sql no Supabase.'
        : d.error.message);
    } else setErroCarga('');
    setDespesas(d.data || []);
    setCategorias(c.data || []);
    setItens(i.data || []);
    setFornecedores(f.data || []);
    setViagens(v.data || []);
    setVinculos(vi.data || []);
    setTecnicos(t.data || []);
    setEmpresas(e.data || []);
    setProdutosEstoque(p.data || []);
    setSolicitacoes(so.data || []);
    setRastreadores(ra.data || []);
    setCarregando(false);
  }, []);

  useEffect(() => { if (autorizado) carregar(); }, [autorizado, carregar]);

  // ---------- Filtros ----------
  const [busca, setBusca] = useState('');
  const [periodo, setPeriodo] = useState(() => periodoPreset('ano'));
  const [preset, setPreset] = useState('ano');
  const [fCategorias, setFCategorias] = useState([]);
  const [fFornecedores, setFFornecedores] = useState([]);
  const [fViagens, setFViagens] = useState([]);
  const [fItens, setFItens] = useState([]);
  const [fStatus, setFStatus] = useState([]);
  const [fTipos, setFTipos] = useState([]);
  const [fFormas, setFFormas] = useState([]);
  const [soVencidas, setSoVencidas] = useState(false);
  const [visao, setVisao] = useState('gasto'); // 'gasto' | 'item'
  const [sort, setSort] = useState({ key: 'data', dir: 'desc' });
  const [pagina, setPagina] = useState(1);

  const limparFiltros = () => {
    setBusca(''); setFCategorias([]); setFFornecedores([]); setFViagens([]); setFItens([]);
    setFStatus([]); setFTipos([]); setFFormas([]); setSoVencidas(false);
  };
  const escolherPreset = (k) => { setPreset(k); setPeriodo(periodoPreset(k)); };

  const catPorId = useMemo(() => Object.fromEntries(categorias.map(c => [c.id, c])), [categorias]);
  const fornPorId = useMemo(() => Object.fromEntries(fornecedores.map(f => [f.id, f])), [fornecedores]);
  const viagemPorId = useMemo(() => Object.fromEntries(viagens.map(v => [v.id, v])), [viagens]);
  const itemPorId = useMemo(() => Object.fromEntries(itens.map(i => [i.id, i])), [itens]);
  const nomeForn = (id) => { const f = fornPorId[id]; return f ? (f.nome_fantasia || f.nome) : ''; };

  // Opções dos filtros (categorias agrupadas)
  const opcoesCategoria = useMemo(() => {
    const out = [];
    GRUPOS_CATEGORIA.forEach(g => {
      const cs = categorias.filter(c => (c.grupo || 'Outros') === g);
      if (!cs.length) return;
      out.push({ value: `grupo:${g}`, label: g, values: cs.map(c => c.id) });
      cs.forEach(c => out.push({ value: c.id, label: c.nome, values: [c.id], indent: true }));
    });
    categorias.filter(c => !GRUPOS_CATEGORIA.includes(c.grupo || 'Outros')).forEach(c => out.push({ value: c.id, label: c.nome, values: [c.id] }));
    return out;
  }, [categorias]);
  const opc = (lista, label) => lista.map(x => ({ value: x.id ?? x.value, label: label(x), values: [x.id ?? x.value] }));
  const opcoesFornecedor = useMemo(() => opc(fornecedores, f => f.nome_fantasia || f.nome), [fornecedores]);
  const opcoesViagem = useMemo(() => opc(viagens, v => v.titulo), [viagens]);
  const opcoesItem = useMemo(() => opc(itens, i => i.nome), [itens]);
  const opcoesStatus = opc(STATUS_PAGAMENTO, s => s.label);
  const opcoesTipo = opc(TIPOS_DOCUMENTO, s => s.label);
  const opcoesForma = opc(FORMAS_PAGAMENTO, s => s.label);

  // Filtros de linha (categoria/item) → só as linhas que batem contam no valor
  const filtraLinha = fCategorias.length > 0 || fItens.length > 0;
  const linhaPassa = useCallback((l) => (!fCategorias.length || fCategorias.includes(l.categoria_id)) && (!fItens.length || fItens.includes(l.item_id)), [fCategorias, fItens]);

  // Despesas que passam nos filtros, com o valor que conta (valorFiltrado)
  const filtradas = useMemo(() => {
    const q = norm(busca);
    return despesas.map(d => {
      if (periodo.from && d.data < periodo.from) return null;
      if (periodo.to && d.data > periodo.to) return null;
      if (fFornecedores.length && !fFornecedores.includes(d.fornecedor_id)) return null;
      if (fViagens.length && !fViagens.includes(d.viagem_id)) return null;
      if (fStatus.length && !fStatus.includes(d.status)) return null;
      if (fTipos.length && !fTipos.includes(d.tipo_documento)) return null;
      if (fFormas.length && !fFormas.includes(d.forma_pagamento)) return null;
      if (soVencidas && !estaVencida(d)) return null;
      const linhas = (d.fin_despesa_itens || []).filter(linhaPassa);
      if (filtraLinha && !linhas.length) return null;
      if (q) {
        const texto = norm([d.descricao, d.numero, d.chave_nfe, d.observacao, nomeForn(d.fornecedor_id), viagemPorId[d.viagem_id]?.titulo,
          ...(d.fin_despesa_itens || []).map(l => `${l.descricao} ${itemPorId[l.item_id]?.nome || ''} ${catPorId[l.categoria_id]?.nome || ''}`)].join(' '));
        if (!texto.includes(q)) return null;
      }
      const valorFiltrado = filtraLinha ? linhas.reduce((s, l) => s + (Number(l.valor_total) || 0), 0) : Number(d.valor_total) || 0;
      return { ...d, linhasFiltradas: filtraLinha ? linhas : (d.fin_despesa_itens || []), valorFiltrado };
    }).filter(Boolean);
  }, [despesas, periodo, fFornecedores, fViagens, fStatus, fTipos, fFormas, soVencidas, linhaPassa, filtraLinha, busca, fornPorId, viagemPorId, itemPorId, catPorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Linhas (visão "por item")
  const linhasFiltradas = useMemo(() => filtradas.flatMap(d => d.linhasFiltradas.map(l => ({ ...l, despesa: d }))), [filtradas]);

  // Resumo
  const resumo = useMemo(() => {
    let total = 0, pago = 0, aPagar = 0, vencido = 0;
    const porCat = {}; const porMes = {}; const porForn = {};
    filtradas.forEach(d => {
      const v = d.valorFiltrado;
      total += v;
      if (d.status === 'A_PAGAR') { aPagar += v; if (estaVencida(d)) vencido += v; } else pago += v;
      const mes = d.data.slice(0, 7);
      porMes[mes] = (porMes[mes] || 0) + v;
      if (d.fornecedor_id) porForn[d.fornecedor_id] = (porForn[d.fornecedor_id] || 0) + v;
      d.linhasFiltradas.forEach(l => { porCat[l.categoria_id || ''] = (porCat[l.categoria_id || ''] || 0) + (Number(l.valor_total) || 0); });
    });
    // Agrupa categorias por grupo
    const grupos = {};
    Object.entries(porCat).forEach(([cid, v]) => {
      const c = catPorId[cid];
      const g = c?.grupo || 'Sem categoria';
      (grupos[g] = grupos[g] || { total: 0, cats: [] });
      grupos[g].total += v;
      grupos[g].cats.push({ nome: c?.nome || 'Sem categoria', valor: v });
    });
    const listaGrupos = Object.entries(grupos).map(([g, x]) => ({ grupo: g, total: x.total, cats: x.cats.sort((a, b) => b.valor - a.valor) }))
      .filter(g => Math.abs(g.total) > 0.004).sort((a, b) => b.total - a.total);
    // Meses (preenche os meses vazios no intervalo)
    const chaves = Object.keys(porMes).sort();
    const meses = [];
    if (chaves.length) {
      let [a, m] = chaves[0].split('-').map(Number);
      const [af, mf] = chaves[chaves.length - 1].split('-').map(Number);
      while (a < af || (a === af && m <= mf)) {
        const k = `${a}-${String(m).padStart(2, '0')}`;
        meses.push({ mes: k, valor: porMes[k] || 0 });
        m += 1; if (m > 12) { m = 1; a += 1; }
      }
    }
    const topForn = Object.entries(porForn).map(([id, v]) => ({ id, nome: nomeForn(id), valor: v })).sort((a, b) => b.valor - a.valor).slice(0, 6);
    return { total, pago, aPagar, vencido, grupos: listaGrupos, meses: meses.slice(-18), topForn };
  }, [filtradas, catPorId, fornPorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Próximos vencimentos (independente do filtro)
  const aVencer = useMemo(() => despesas.filter(d => d.status === 'A_PAGAR').sort((a, b) => String(a.vencimento || '9').localeCompare(String(b.vencimento || '9'))).slice(0, 8), [despesas]);

  // Ordenação + paginação
  const ordenadas = useMemo(() => (visao === 'gasto'
    ? sortBy(filtradas, sort, {
      data: d => d.data, fornecedor: d => norm(nomeForn(d.fornecedor_id)), valor: d => d.valorFiltrado,
      vencimento: d => d.vencimento || '', status: d => d.status,
    })
    : sortBy(linhasFiltradas, sort, {
      data: l => l.despesa.data, fornecedor: l => norm(nomeForn(l.despesa.fornecedor_id)), valor: l => Number(l.valor_total) || 0,
      item: l => norm(itemPorId[l.item_id]?.nome || l.descricao), categoria: l => norm(catPorId[l.categoria_id]?.nome),
      qtd: l => Number(l.quantidade) || 0, unit: l => Number(l.valor_unitario) || 0,
    })), [visao, filtradas, linhasFiltradas, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = ordenadas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);
  useEffect(() => { setPagina(1); }, [busca, periodo, fCategorias, fFornecedores, fViagens, fItens, fStatus, fTipos, fFormas, soVencidas, visao]);
  const onSort = (key) => setSort(s => nextSort(s, key));

  // Chips dos filtros aplicados
  const chips = [];
  const addChip = (key, nome, opts, sel, setSel) => {
    if (!sel.length) return;
    chips.push({ key, label: chipText(nome, summarizeSelection(opts, sel)), onRemove: () => setSel([]) });
  };
  addChip('cat', 'Categoria', opcoesCategoria, fCategorias, setFCategorias);
  addChip('forn', 'Fornecedor', opcoesFornecedor, fFornecedores, setFFornecedores);
  addChip('via', 'Viagem', opcoesViagem, fViagens, setFViagens);
  addChip('item', 'Item', opcoesItem, fItens, setFItens);
  addChip('st', 'Situação', opcoesStatus, fStatus, setFStatus);
  addChip('tipo', 'Documento', opcoesTipo, fTipos, setFTipos);
  addChip('forma', 'Pagamento', opcoesForma, fFormas, setFFormas);
  if (soVencidas) chips.push({ key: 'venc', label: 'Só vencidas', onRemove: () => setSoVencidas(false) });

  // Atalhos vindos das outras abas
  const verGastos = (campo, id) => {
    limparFiltros(); escolherPreset('tudo');
    if (campo === 'fornecedor') setFFornecedores([id]);
    if (campo === 'viagem') setFViagens([id]);
    if (campo === 'item') { setFItens([id]); setVisao('item'); }
    setAba('gastos');
  };

  // ---------- Ações ----------
  const marcarPago = async (d) => {
    const { error } = await supabase.from('fin_despesas').update({ status: 'PAGO', data_pagamento: hojeIso() }).eq('id', d.id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Marcado como pago.');
    carregar();
  };
  const excluir = (d) => askConfirm(`Excluir o gasto "${d.descricao || nomeForn(d.fornecedor_id) || dataBR(d.data)}" de ${reais(d.valor_total)}? Os anexos também são apagados.`, async () => {
    if ((d.anexos || []).length) await supabase.storage.from(BUCKET_FINANCEIRO).remove(d.anexos.map(a => a.path));
    const { error } = await supabase.from('fin_despesas').delete().eq('id', d.id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Gasto excluído.');
    carregar();
  });
  const abrirAnexo = async (a) => {
    const { data, error } = await supabase.storage.from(BUCKET_FINANCEIRO).createSignedUrl(a.path, 300);
    if (error) { showToast(error.message, 'error'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const exportar = () => {
    const cab = ['Data', 'Documento', 'Número', 'Fornecedor', 'CNPJ', 'Viagem', 'Descrição do gasto', 'Categoria', 'Grupo', 'Item', 'Descrição da linha', 'Qtd', 'Un', 'Valor unit.', 'Total linha', 'Situação', 'Vencimento', 'Pago em', 'Forma pagamento'];
    const num = (n) => String(Number(n || 0).toFixed(2)).replace('.', ',');
    const linhas = filtradas.flatMap(d => d.linhasFiltradas.map(l => [
      dataBR(d.data), rotulo(TIPOS_DOCUMENTO, d.tipo_documento), d.numero || '', nomeForn(d.fornecedor_id), fornPorId[d.fornecedor_id]?.cnpj || '',
      viagemPorId[d.viagem_id]?.titulo || '', d.descricao || '', catPorId[l.categoria_id]?.nome || '', catPorId[l.categoria_id]?.grupo || '',
      itemPorId[l.item_id]?.nome || '', l.descricao || '', String(l.quantidade).replace('.', ','), l.unidade || '', num(l.valor_unitario), num(l.valor_total),
      rotulo(STATUS_PAGAMENTO, d.status), dataBR(d.vencimento), dataBR(d.data_pagamento), rotulo(FORMAS_PAGAMENTO, d.forma_pagamento),
    ]));
    baixarCsv(`gastos-${periodo.from || 'inicio'}-a-${periodo.to || 'hoje'}.csv`, cab, linhas);
  };

  // ---------- Render ----------
  if (!autorizado) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><FaSpinner className="animate-spin text-3xl text-blue-500" /></div>;
  }

  const maxMes = Math.max(1, ...resumo.meses.map(m => m.valor));
  const maxGrupo = Math.max(1, ...resumo.grupos.map(g => g.total));
  const catalogo = { categorias, itens, fornecedores, viagens, vinculos };

  return (
    <>
      <Head><title>Financeiro | Full Vision</title></Head>

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
              <button type="button" onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn(); }} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Confirmar</button>
              <button type="button" onClick={() => setConfirmDialog(null)} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-black text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Financeiro</h1>
              <p className="text-gray-400 text-sm mt-1">Compras e gastos da Full Vision: NF, romaneio, viagens e materiais</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setFormAberto({ abrirXml: true })} className="inline-flex items-center gap-2 text-sm border border-blue-500/50 bg-blue-500/10 text-blue-300 hover:text-white rounded-lg px-3.5 py-2">
                <FaFileCode size={13} /> Lançar NF-e (XML)
              </button>
              <a href="/painel-admin" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2 transition-colors">
                <FaArrowLeft size={12} /> Painel administrativo
              </a>
            </div>
          </div>

          {erroCarga && (
            <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3">
              <FaExclamationCircle className="mt-0.5 shrink-0" /> {erroCarga}
            </div>
          )}

          {carregando ? (
            <div className="flex items-center justify-center py-24 text-gray-500"><FaSpinner className="animate-spin text-2xl mr-3" /> Carregando...</div>
          ) : (
            <>
              <TabBar
                active={aba}
                onChange={setAba}
                tabs={[
                  { key: 'gastos', label: 'Gastos', count: despesas.length },
                  { key: 'solicitacoes', label: solicitacoes.some(s => s.status === 'PENDENTE') ? 'Solicitações •' : 'Solicitações', count: solicitacoes.filter(s => s.status === 'PENDENTE' || s.status === 'APROVADA').length },
                  { key: 'fornecedores', label: 'Fornecedores', count: fornecedores.length },
                  { key: 'viagens', label: 'Viagens', count: viagens.length },
                  { key: 'itens', label: 'Itens e categorias', count: itens.length },
                ]}
              />

              {aba === 'gastos' && (
                <div className="space-y-6">
                  {/* Período */}
                  <div className="flex flex-wrap items-center gap-2">
                    <SegmentedControl label="Período" value={preset} onChange={escolherPreset} options={PRESETS} />
                    <DateRangeFilter label="Datas" from={periodo.from} to={periodo.to} onChange={(p) => { setPreset(''); setPeriodo(p); }} />
                    {(periodo.from || periodo.to) && <span className="text-xs text-gray-500">{periodo.from ? dataBR(periodo.from) : 'início'} a {periodo.to ? dataBR(periodo.to) : 'hoje'}</span>}
                  </div>

                  <StatStrip
                    colsClass="grid-cols-2 lg:grid-cols-5"
                    spanLast
                    items={[
                      { label: filtraLinha ? 'Total (itens filtrados)' : 'Total gasto', value: reais(resumo.total) },
                      { label: 'Pago', value: reais(resumo.pago), valueClass: 'text-emerald-400' },
                      { label: 'A pagar', value: reais(resumo.aPagar), valueClass: resumo.aPagar ? 'text-amber-400' : 'text-white' },
                      { label: 'Vencido', value: reais(resumo.vencido), valueClass: resumo.vencido ? 'text-red-400' : 'text-white' },
                      { label: 'Lançamentos', value: filtradas.length },
                    ]}
                  />

                  {/* Gráficos */}
                  <div className="grid lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
                      <h3 className="text-sm font-semibold text-white mb-4">Gasto por mês</h3>
                      {resumo.meses.length === 0 ? <p className="text-sm text-gray-500">Sem gastos no período.</p> : (
                        <div className="flex items-end gap-1.5 h-48">
                          {resumo.meses.map(m => (
                            <div key={m.mes} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full group" title={`${mesRotulo(m.mes)}: ${reais(m.valor)}`}>
                              <span className="text-[10px] text-gray-400 tabular-nums mb-1 opacity-0 group-hover:opacity-100 whitespace-nowrap">{reaisCurto(m.valor)}</span>
                              <div className="w-full max-w-[44px] bg-blue-500/80 group-hover:bg-blue-400 rounded-t" style={{ height: `${Math.max(0, (m.valor / maxMes) * 100)}%`, minHeight: m.valor > 0 ? 2 : 0 }} />
                              <span className="text-[10px] text-gray-500 mt-1.5 whitespace-nowrap">{mesRotulo(m.mes)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
                      <h3 className="text-sm font-semibold text-white mb-3">Contas a pagar</h3>
                      {aVencer.length === 0 ? <p className="text-sm text-gray-500">Nada a pagar.</p> : (
                        <ul className="space-y-2">
                          {aVencer.map(d => (
                            <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                              <div className="min-w-0">
                                <div className="truncate text-gray-200">{nomeForn(d.fornecedor_id) || d.descricao || 'Gasto'}</div>
                                <div className={`text-xs ${estaVencida(d) ? 'text-red-400' : 'text-gray-500'}`}>{d.vencimento ? `vence ${dataBR(d.vencimento)}` : 'sem vencimento'}{estaVencida(d) ? ' · vencida' : ''}</div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="tabular-nums text-white">{reais(d.valor_total)}</span>
                                <ActionButton title="Marcar como pago" hover="hover:text-emerald-400" onClick={() => marcarPago(d)}><FaCheck size={11} /></ActionButton>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
                      <h3 className="text-sm font-semibold text-white mb-4">Por categoria</h3>
                      {resumo.grupos.length === 0 ? <p className="text-sm text-gray-500">Sem gastos no período.</p> : (
                        <div className="space-y-4">
                          {resumo.grupos.map(g => (
                            <div key={g.grupo}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-white font-medium">{g.grupo}</span>
                                <span className="tabular-nums text-white">{reais(g.total)} <span className="text-gray-500 text-xs">{resumo.total ? `${Math.round((g.total / resumo.total) * 100)}%` : ''}</span></span>
                              </div>
                              <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-1.5"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.max(0, (g.total / maxGrupo) * 100)}%` }} /></div>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400">
                                {g.cats.map(c => <span key={c.nome}>{c.nome} <span className="tabular-nums text-gray-300">{reais(c.valor)}</span></span>)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
                      <h3 className="text-sm font-semibold text-white mb-3">Maiores fornecedores</h3>
                      {resumo.topForn.length === 0 ? <p className="text-sm text-gray-500">Sem fornecedor no período.</p> : (
                        <ul className="space-y-2.5">
                          {resumo.topForn.map(f => (
                            <li key={f.id}>
                              <button type="button" onClick={() => setFFornecedores([f.id])} className="w-full text-left group">
                                <div className="flex justify-between gap-2 text-sm"><span className="truncate text-gray-200 group-hover:text-white">{f.nome}</span><span className="tabular-nums text-white">{reais(f.valor)}</span></div>
                                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1"><div className="h-full bg-blue-500/70 rounded-full" style={{ width: `${(f.valor / (resumo.topForn[0].valor || 1)) * 100}%` }} /></div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Lista */}
                  <SectionCard
                    title="Lançamentos"
                    action={(
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={exportar} className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-2"><FaFileCsv size={13} /> Exportar</button>
                        <PrimaryButton onClick={() => setFormAberto({})}>Novo gasto</PrimaryButton>
                      </div>
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por descrição, NF, item, fornecedor..." />
                      <FilterDropdown label="Categoria" options={opcoesCategoria} selected={fCategorias} onChange={setFCategorias} searchable />
                      <FilterDropdown label="Fornecedor" options={opcoesFornecedor} selected={fFornecedores} onChange={setFFornecedores} searchable />
                      <FilterDropdown label="Item" options={opcoesItem} selected={fItens} onChange={setFItens} searchable />
                      <FilterDropdown label="Viagem" options={opcoesViagem} selected={fViagens} onChange={setFViagens} searchable />
                      <FilterDropdown label="Situação" options={opcoesStatus} selected={fStatus} onChange={setFStatus} />
                      <FilterDropdown label="Documento" options={opcoesTipo} selected={fTipos} onChange={setFTipos} />
                      <FilterDropdown label="Pagamento" options={opcoesForma} selected={fFormas} onChange={setFFormas} />
                      <ToggleFilter label="Só vencidas" active={soVencidas} onClick={() => setSoVencidas(v => !v)} />
                    </div>
                    <FilterSummary
                      total={visao === 'gasto' ? filtradas.length : linhasFiltradas.length}
                      noun={visao === 'gasto' ? (filtradas.length === 1 ? 'gasto' : 'gastos') : (linhasFiltradas.length === 1 ? 'linha' : 'linhas')}
                      chips={chips}
                      onClearAll={limparFiltros}
                      extra={<>Total: <span className="text-white font-medium tabular-nums">{reais(resumo.total)}</span></>}
                    />
                    <SegmentedControl label="Ver por" value={visao} onChange={(v) => { setVisao(v); setSort({ key: 'data', dir: 'desc' }); }} options={[{ key: 'gasto', label: 'Gasto (NF / documento)' }, { key: 'item', label: 'Item comprado' }]} />

                    <div className={tableWrap}>
                      {visao === 'gasto' ? (
                        <table className="w-full text-sm">
                          <thead className={theadClass}>
                            <tr>
                              <Th sortKey="data" sort={sort} onSort={onSort}>Data</Th>
                              <Th>Descrição</Th>
                              <Th sortKey="fornecedor" sort={sort} onSort={onSort}>Fornecedor</Th>
                              <Th>Categorias</Th>
                              <Th>Documento</Th>
                              <Th sortKey="status" sort={sort} onSort={onSort}>Situação</Th>
                              <Th sortKey="valor" sort={sort} onSort={onSort} align="right">Valor</Th>
                              <Th align="right">Ações</Th>
                            </tr>
                          </thead>
                          <tbody className={tbodyClass}>
                            {visiveis.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">Nenhum gasto encontrado.</td></tr>}
                            {visiveis.map(d => {
                              const cats = [...new Set(d.linhasFiltradas.map(l => catPorId[l.categoria_id]?.nome).filter(Boolean))];
                              const venc = estaVencida(d);
                              return (
                                <tr key={d.id} className={rowClass}>
                                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{dataBR(d.data)}</td>
                                  <td className="px-4 py-3">
                                    <div className="text-white">{d.descricao || d.linhasFiltradas[0]?.descricao || <Dash />}</div>
                                    <div className="text-xs text-gray-500">
                                      {d.linhasFiltradas.length} {d.linhasFiltradas.length === 1 ? 'item' : 'itens'}
                                      {d.viagem_id && viagemPorId[d.viagem_id] ? ` · viagem: ${viagemPorId[d.viagem_id].titulo}` : ''}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-gray-300">{nomeForn(d.fornecedor_id) || <Dash />}</td>
                                  <td className="px-4 py-3 text-xs text-gray-400 max-w-[220px]">{cats.length > 2 ? `${cats.slice(0, 2).join(', ')} +${cats.length - 2}` : cats.join(', ') || <Dash />}</td>
                                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                                    {rotulo(TIPOS_DOCUMENTO, d.tipo_documento)}{d.numero ? ` ${d.numero}` : ''}
                                    {(d.anexos || []).length > 0 && (
                                      <button type="button" onClick={() => abrirAnexo(d.anexos.find(a => !a.nome.toLowerCase().endsWith('.xml')) || d.anexos[0])} title={d.anexos.map(a => a.nome).join(', ')} className="ml-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                                        <FaPaperclip size={10} />{d.anexos.length}
                                      </button>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {d.status === 'PAGO'
                                      ? <StatusDot tone="ok">Pago{d.forma_pagamento ? ` · ${rotulo(FORMAS_PAGAMENTO, d.forma_pagamento)}` : ''}</StatusDot>
                                      : <StatusDot tone={venc ? 'bad' : 'warn'}>{venc ? 'Vencida' : 'A pagar'}{d.vencimento ? ` · ${dataBR(d.vencimento)}` : ''}</StatusDot>}
                                  </td>
                                  <td className="px-4 py-3 text-right tabular-nums text-white whitespace-nowrap">
                                    {reais(d.valorFiltrado)}
                                    {filtraLinha && Math.abs(d.valorFiltrado - d.valor_total) > 0.004 && <div className="text-[11px] text-gray-500">de {reais(d.valor_total)}</div>}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex justify-end gap-1">
                                      {d.status === 'A_PAGAR' && <ActionButton title="Marcar como pago" hover="hover:text-emerald-400" onClick={() => marcarPago(d)}><FaCheck size={12} /></ActionButton>}
                                      <ActionButton title="Editar" onClick={() => setFormAberto({ despesa: d })}><FaEdit size={12} /></ActionButton>
                                      <ActionButton title="Excluir" hover="hover:text-red-400" onClick={() => excluir(d)}><FaTrashAlt size={12} /></ActionButton>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className={theadClass}>
                            <tr>
                              <Th sortKey="data" sort={sort} onSort={onSort}>Data</Th>
                              <Th sortKey="item" sort={sort} onSort={onSort}>Item</Th>
                              <Th sortKey="categoria" sort={sort} onSort={onSort}>Categoria</Th>
                              <Th sortKey="fornecedor" sort={sort} onSort={onSort}>Fornecedor</Th>
                              <Th sortKey="qtd" sort={sort} onSort={onSort} align="right">Qtd</Th>
                              <Th sortKey="unit" sort={sort} onSort={onSort} align="right">Valor unit.</Th>
                              <Th sortKey="valor" sort={sort} onSort={onSort} align="right">Total</Th>
                              <Th align="right">Gasto</Th>
                            </tr>
                          </thead>
                          <tbody className={tbodyClass}>
                            {visiveis.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">Nenhum item encontrado.</td></tr>}
                            {visiveis.map(l => (
                              <tr key={l.id} className={rowClass}>
                                <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{dataBR(l.despesa.data)}</td>
                                <td className="px-4 py-3">
                                  <div className="text-white">{itemPorId[l.item_id]?.nome || l.descricao || <Dash />}</div>
                                  {l.item_id && l.descricao && l.descricao !== itemPorId[l.item_id]?.nome && <div className="text-xs text-gray-500">{l.descricao}</div>}
                                </td>
                                <td className="px-4 py-3 text-gray-300">{catPorId[l.categoria_id]?.nome || <Dash />}</td>
                                <td className="px-4 py-3 text-gray-300">{nomeForn(l.despesa.fornecedor_id) || <Dash />}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-gray-300 whitespace-nowrap">{Number(l.quantidade).toLocaleString('pt-BR')} {l.unidade}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-gray-300 whitespace-nowrap">{reais(l.valor_unitario)}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-white whitespace-nowrap">{reais(l.valor_total)}</td>
                                <td className="px-4 py-3 text-right"><ActionButton title="Abrir o gasto" onClick={() => setFormAberto({ despesa: l.despesa })}><FaEdit size={12} /></ActionButton></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    <Pagination page={paginaAtual} totalPages={totalPaginas} total={ordenadas.length} perPage={POR_PAGINA} onPage={setPagina} />
                  </SectionCard>
                </div>
              )}

              {aba === 'solicitacoes' && (
                <SolicitacoesPanel
                  solicitacoes={solicitacoes} itens={itens} despesas={despesas} rastreadores={rastreadores}
                  recarregar={carregar} showToast={showToast}
                  onLancarCompra={(lista) => setFormAberto({ solicitacoes: lista })}
                  onAbrirGasto={(d) => setFormAberto({ despesa: d })}
                  onNovaSolicitacao={() => setSolicitarAberto(true)}
                />
              )}

              {aba === 'fornecedores' && (
                <FornecedoresPanel
                  fornecedores={fornecedores} categorias={categorias} despesas={despesas}
                  recarregar={carregar} showToast={showToast} askConfirm={askConfirm}
                  onVerGastos={(id) => verGastos('fornecedor', id)}
                />
              )}
              {aba === 'viagens' && (
                <ViagensPanel
                  viagens={viagens} despesas={despesas} tecnicos={tecnicos} empresas={empresas} categorias={categorias}
                  recarregar={carregar} showToast={showToast} askConfirm={askConfirm}
                  onVerGastos={(id) => verGastos('viagem', id)}
                  onNovoGasto={(id) => setFormAberto({ viagemPadrao: id })}
                />
              )}
              {aba === 'itens' && (
                <ItensPanel
                  itens={itens} categorias={categorias} produtosEstoque={produtosEstoque} despesas={despesas}
                  recarregar={carregar} showToast={showToast} askConfirm={askConfirm}
                  onVerGastosItem={(id) => verGastos('item', id)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {formAberto && (
        <DespesaForm
          despesa={formAberto.despesa}
          viagemPadrao={formAberto.viagemPadrao}
          abrirXml={formAberto.abrirXml}
          solicitacoes={formAberto.solicitacoes}
          catalogo={catalogo}
          showToast={showToast}
          onClose={() => setFormAberto(null)}
          onSaved={() => { setFormAberto(null); carregar(); }}
        />
      )}
      {solicitarAberto && (
        <SolicitarCompra showToast={showToast} onClose={() => { setSolicitarAberto(false); carregar(); }} />
      )}
    </>
  );
}
