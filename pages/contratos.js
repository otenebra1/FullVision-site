// /contratos — contratos dos clientes (só ADM)
// Contrato com vigência e renovação automática, texto gerado pelo modelo (PDF pelo navegador),
// PDF assinado guardado, aviso de renovação/reajuste no sino e reajuste anual por índice.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  FaSpinner, FaArrowLeft, FaCheckCircle, FaExclamationCircle, FaPlus, FaEdit, FaFilePdf, FaUpload, FaPercent,
  FaWallet, FaBan, FaTrashAlt, FaFileSignature, FaExternalLinkAlt,
} from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { ehAdmin } from '../lib/perfis';
import { valorServicoMensal, SERVICOS_VEICULO } from '../lib/veiculos';
import {
  tableWrap, theadClass, tbodyClass, rowClass, Dash, StatStrip, TabBar, SectionCard, SearchInput, Th, inputBase, norm,
} from '../components/admin/ui';
import Notificacoes from '../components/Notificacoes';
import {
  STATUS_CONTRATO, infoStatusContrato, INDICES, rotuloIndice, MODELO_PADRAO, CAMPOS_MODELO, preencherContrato,
  abrirParaImprimir, alertasContrato, calcularFim, hojeIso, diasAte,
} from '../lib/contratos';

const BUCKET = 'contratos';
const reais = (n) => (n == null || n === '' ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const dataBR = (iso) => (iso ? new Date(String(iso).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : '');
const lerNum = (s) => { const t = String(s ?? '').trim(); if (!t) return null; const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); return Number.isFinite(n) ? n : null; };
const numTxt = (n) => (n == null ? '' : String(n).replace('.', ','));
const inputCls = `w-full px-3 py-2 ${inputBase}`;
const TOM = { bad: 'text-red-300', warn: 'text-amber-300', muted: 'text-gray-500' };

const Campo = ({ label, ajuda, children, className = '' }) => (
  <label className={`block space-y-1.5 ${className}`}>
    <span className="text-sm text-gray-300">{label}</span>
    {children}
    {ajuda && <span className="block text-xs text-gray-500">{ajuda}</span>}
  </label>
);

function Modal({ titulo, children, onClose, largura = 'max-w-2xl' }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className={`bg-gray-900 border border-gray-700 rounded-2xl ${largura} w-full p-6 space-y-4 my-8`} onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white">{titulo}</h3>
        {children}
      </div>
    </div>
  );
}

export default function Contratos() {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 4000); }, []);

  const [contratos, setContratos] = useState([]);
  const [reajustes, setReajustes] = useState([]);
  const [modelo, setModelo] = useState({ texto: '', prestador_cidade: '' });
  const [empresas, setEmpresas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [mensCliente, setMensCliente] = useState({});
  const [prestador, setPrestador] = useState({});

  const [aba, setAba] = useState('contratos');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('ATIVO');
  const [editar, setEditar] = useState(null);
  const [reajustar, setReajustar] = useState(null);
  const [encerrar, setEncerrar] = useState(null);

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
    try { await supabase.rpc('fv_contratos_alertas'); } catch { /* ignora */ }
    const [c, r, m, e, v, f, mc, nf] = await Promise.all([
      supabase.from('contratos').select('*').order('fim', { ascending: true }),
      supabase.from('contrato_reajustes').select('*').order('data', { ascending: false }),
      supabase.from('contrato_modelo').select('*').eq('id', 1).maybeSingle(),
      supabase.from('empresas').select('*').order('nome'),
      supabase.from('veiculos').select('id, empresa_id, status, mensalidade, servicos'),
      supabase.from('financeiro_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('mensalidade_cliente').select('*'),
      supabase.from('nf_config').select('razao_social, cnpj_prestador').eq('id', 1).maybeSingle(),
    ]);
    if (c.error) setErroCarga(/contratos/.test(c.error.message) ? 'As tabelas de contratos ainda não existem. Rode o SQL 20261126g_contratos.sql no Supabase.' : c.error.message);
    else setErroCarga('');
    setContratos(c.data || []);
    setReajustes(r.data || []);
    setModelo({ texto: m.data?.texto || '', prestador_cidade: m.data?.prestador_cidade || '' });
    setEmpresas(e.data || []);
    setVeiculos(v.data || []);
    setCfg(f.data || {});
    setMensCliente(Object.fromEntries((mc.data || []).map(x => [String(x.empresa_id), x])));
    setPrestador(nf.data || {});
    setCarregando(false);
  }, []);
  useEffect(() => { if (autorizado) carregar(); }, [autorizado, carregar]);

  const empresaPorId = useMemo(() => Object.fromEntries(empresas.map(x => [String(x.id), x])), [empresas]);
  const placasAtivas = useCallback((empId) => veiculos.filter(v => String(v.empresa_id) === String(empId) && v.status === 'Ativo'), [veiculos]);
  const mensalidadesDe = useCallback((empId) => {
    const emp = empresaPorId[String(empId)];
    const proprio = mensCliente[String(empId)] || null;
    const grupo = emp?.grupo_id ? mensCliente[String(emp.grupo_id)] || null : null;
    const algum = SERVICOS_VEICULO.some(s => [proprio, grupo, cfg].some(o => o && o[s.coluna] != null));
    if (!algum) return null;
    return {
      rastreamento: valorServicoMensal('mensalidade_rastreamento', cfg, proprio, grupo),
      monitoramento: valorServicoMensal('mensalidade_monitoramento', cfg, proprio, grupo),
      full_route: valorServicoMensal('mensalidade_full_route', cfg, proprio, grupo),
    };
  }, [empresaPorId, mensCliente, cfg]);

  const textoModelo = modelo.texto || MODELO_PADRAO;
  const prestadorCompleto = { ...prestador, cidade: modelo.prestador_cidade };

  const gerarPdf = (c) => {
    const texto = preencherContrato(c.texto || textoModelo, {
      contrato: c, empresa: empresaPorId[String(c.empresa_id)], prestador: prestadorCompleto, mensalidades: mensalidadesDe(c.empresa_id),
    });
    if (!abrirParaImprimir(`Contrato ${c.numero || ''}`, texto)) showToast('O navegador bloqueou a janela. Libere pop-ups para este site.', 'error');
  };

  const anexar = async (c, file) => {
    if (!file) return;
    const nome = file.name.replace(/[^\w.-]+/g, '_');
    const path = `${c.id}/${Date.now()}-${nome}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || 'application/pdf' });
    if (up.error) { showToast(up.error.message, 'error'); return; }
    if (c.arquivo_path) await supabase.storage.from(BUCKET).remove([c.arquivo_path]);
    const { error } = await supabase.from('contratos').update({ arquivo_path: path, arquivo_nome: file.name, assinado_em: c.assinado_em || hojeIso() }).eq('id', c.id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Contrato assinado anexado.');
    carregar();
  };
  const verArquivo = async (c) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(c.arquivo_path, 300);
    if (error) { showToast(error.message, 'error'); return; }
    window.open(data.signedUrl, '_blank');
  };
  const excluir = async (c) => {
    if (!window.confirm(`Excluir o rascunho ${c.numero}?`)) return;
    const { error } = await supabase.from('contratos').delete().eq('id', c.id);
    if (error) showToast(error.message, 'error'); else { showToast('Rascunho excluído.'); carregar(); }
  };

  // ---------- Listas ----------
  const ativos = contratos.filter(c => c.status === 'ATIVO');
  const vencendo = ativos.filter(c => { const d = diasAte(c.fim); return d != null && d <= (c.aviso_dias ?? 60); });
  const reajustePendente = ativos.filter(c => c.indice_reajuste !== 'NENHUM' && diasAte(c.proximo_reajuste) != null && diasAte(c.proximo_reajuste) <= 15);
  const comContrato = new Set(contratos.filter(c => c.status === 'ATIVO' || c.status === 'RASCUNHO').map(c => String(c.empresa_id)));
  const semContrato = empresas.filter(e => !comContrato.has(String(e.id)) && placasAtivas(e.id).length > 0);

  const lista = contratos
    .filter(c => filtro === 'TODOS' || (filtro === 'ALERTA' ? (vencendo.includes(c) || reajustePendente.includes(c)) : c.status === filtro))
    .filter(c => !busca || norm(`${c.numero} ${empresaPorId[String(c.empresa_id)]?.nome || ''} ${empresaPorId[String(c.empresa_id)]?.razao_social || ''}`).includes(norm(busca)));

  if (!autorizado) return <div className="min-h-screen bg-black flex items-center justify-center"><FaSpinner className="animate-spin text-3xl text-blue-500" /></div>;

  return (
    <>
      <Head><title>Contratos | Full Vision</title></Head>
      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold ${toast.type === 'success' ? 'bg-emerald-950 border-emerald-500/40 text-emerald-400' : 'bg-red-950 border-red-500/40 text-red-400'}`}>
          {toast.type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />} {toast.message}
        </div>
      )}

      <div className="min-h-screen bg-black text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Contratos</h1>
              <p className="text-gray-400 text-sm mt-1">Vigência, renovação, reajuste anual e o contrato assinado de cada cliente</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setEditar({})} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-lg text-sm font-semibold">
                <FaPlus size={11} /> Novo contrato
              </button>
              <a href="/financeiro" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2"><FaWallet size={12} /> Financeiro</a>
              <a href="/painel-admin" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2"><FaArrowLeft size={12} /> Painel administrativo</a>
              <Notificacoes />
            </div>
          </div>

          {erroCarga && (
            <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3"><FaExclamationCircle className="mt-0.5 shrink-0" /> {erroCarga}</div>
          )}

          {carregando ? (
            <div className="flex items-center justify-center py-24 text-gray-500"><FaSpinner className="animate-spin text-2xl mr-3" /> Carregando...</div>
          ) : (
            <>
              <StatStrip
                colsClass="grid-cols-2 lg:grid-cols-4"
                items={[
                  { label: 'Contratos ativos', value: ativos.length },
                  { label: 'Vencendo / renovando', value: vencendo.length, valueClass: vencendo.length ? 'text-amber-300' : 'text-white' },
                  { label: 'Reajuste nos próximos 15 dias', value: reajustePendente.length, valueClass: reajustePendente.length ? 'text-amber-300' : 'text-white' },
                  { label: 'Clientes com placa e sem contrato', value: semContrato.length, valueClass: semContrato.length ? 'text-red-300' : 'text-white' },
                ]}
              />

              <TabBar
                active={aba} onChange={setAba}
                tabs={[
                  { key: 'contratos', label: 'Contratos', count: contratos.length },
                  { key: 'sem', label: 'Clientes sem contrato', count: semContrato.length },
                  { key: 'modelo', label: 'Modelo do contrato' },
                ]}
              />

              {aba === 'contratos' && (
                <SectionCard title="Contratos">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-gray-950 border border-gray-800">
                      {[{ v: 'ATIVO', l: 'Ativos' }, { v: 'ALERTA', l: 'Com aviso' }, { v: 'RASCUNHO', l: 'Rascunhos' }, { v: 'ENCERRADO', l: 'Encerrados' }, { v: 'CANCELADO', l: 'Cancelados' }, { v: 'TODOS', l: 'Todos' }].map(o => (
                        <button key={o.v} type="button" onClick={() => setFiltro(o.v)} className={`px-3 py-1.5 rounded-lg text-sm ${filtro === o.v ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}>{o.l}</button>
                      ))}
                    </div>
                    <SearchInput value={busca} onChange={setBusca} placeholder="Buscar número ou cliente" />
                  </div>
                  <div className={tableWrap}>
                    <table className="w-full text-sm">
                      <thead className={theadClass}>
                        <tr><Th>Contrato</Th><Th>Cliente</Th><Th>Vigência</Th><Th>Reajuste</Th><Th>Situação</Th><Th align="right">Ações</Th></tr>
                      </thead>
                      <tbody className={tbodyClass}>
                        {lista.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">Nenhum contrato aqui.</td></tr>}
                        {lista.map(c => {
                          const emp = empresaPorId[String(c.empresa_id)];
                          const st = infoStatusContrato(c.status);
                          const avisos = alertasContrato(c);
                          return (
                            <tr key={c.id} className={rowClass}>
                              <td className="px-4 py-3">
                                <div className="text-white font-medium">{c.numero}</div>
                                <div className="text-xs text-gray-500">{c.duracao_meses} meses{c.renovacao_automatica ? ' · renova sozinho' : ''}{c.renovacoes ? ` · ${c.renovacoes}ª renovação` : ''}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-white">{emp?.nome || <Dash />}</div>
                                <div className="text-xs text-gray-500">{placasAtivas(c.empresa_id).length} placa(s) ativa(s)</div>
                              </td>
                              <td className="px-4 py-3 text-gray-300 whitespace-nowrap tabular-nums">{dataBR(c.inicio)} a {dataBR(c.fim)}</td>
                              <td className="px-4 py-3 text-gray-300">
                                <div>{rotuloIndice(c.indice_reajuste)}{c.indice_reajuste === 'FIXO' && c.percentual_fixo != null ? ` ${numTxt(c.percentual_fixo)}%` : ''}</div>
                                {c.indice_reajuste !== 'NENHUM' && <div className="text-xs text-gray-500">próximo {dataBR(c.proximo_reajuste)}</div>}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${st.badge}`}>{st.label}</span>
                                {avisos.map((a, i) => <div key={i} className={`text-xs mt-1 ${TOM[a.tom]}`}>{a.texto}</div>)}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-0.5">
                                  <button type="button" title="Editar" onClick={() => setEditar(c)} className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-800"><FaEdit size={12} /></button>
                                  <button type="button" title="Gerar PDF para assinar" onClick={() => gerarPdf(c)} className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-800"><FaFilePdf size={13} /></button>
                                  <label title={c.arquivo_path ? 'Trocar o PDF assinado' : 'Anexar o PDF assinado'} className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-800 cursor-pointer">
                                    <FaUpload size={12} />
                                    <input type="file" accept="application/pdf,image/*" className="hidden" onChange={e => { anexar(c, e.target.files?.[0]); e.target.value = ''; }} />
                                  </label>
                                  {c.arquivo_path && <button type="button" title="Ver o contrato assinado" onClick={() => verArquivo(c)} className="text-emerald-400 hover:text-white p-2 rounded-md hover:bg-gray-800"><FaFileSignature size={13} /></button>}
                                  {c.status === 'ATIVO' && c.indice_reajuste !== 'NENHUM' && (
                                    <button type="button" title="Aplicar reajuste" onClick={() => setReajustar(c)} className="text-gray-400 hover:text-amber-300 p-2 rounded-md hover:bg-gray-800"><FaPercent size={11} /></button>
                                  )}
                                  {c.status === 'ATIVO' && <button type="button" title="Encerrar" onClick={() => setEncerrar(c)} className="text-gray-400 hover:text-red-300 p-2 rounded-md hover:bg-gray-800"><FaBan size={12} /></button>}
                                  {c.status === 'RASCUNHO' && <button type="button" title="Excluir rascunho" onClick={() => excluir(c)} className="text-gray-400 hover:text-red-300 p-2 rounded-md hover:bg-gray-800"><FaTrashAlt size={12} /></button>}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-500">
                    O sino avisa quando um contrato entra no prazo de aviso antes do fim e 15 dias antes do reajuste. Contrato com renovação automática que passa do fim ganha mais um período sozinho.
                    O contrato ativo atualiza o início, o fim e o dia do boleto no cadastro do cliente.
                  </p>
                </SectionCard>
              )}

              {aba === 'sem' && (
                <SectionCard title="Clientes com placa ativa e sem contrato ativo">
                  <div className={tableWrap}>
                    <table className="w-full text-sm">
                      <thead className={theadClass}><tr><Th>Cliente</Th><Th>Placas ativas</Th><Th>Contrato no cadastro</Th><Th align="right">Ação</Th></tr></thead>
                      <tbody className={tbodyClass}>
                        {semContrato.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-500">Todos os clientes com placa têm contrato.</td></tr>}
                        {semContrato.map(e => (
                          <tr key={e.id} className={rowClass}>
                            <td className="px-4 py-3 text-white">{e.nome}</td>
                            <td className="px-4 py-3 tabular-nums text-gray-300">{placasAtivas(e.id).length}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">{e.contrato_inicio || e.contrato_fim ? `${dataBR(e.contrato_inicio) || '?'} a ${dataBR(e.contrato_fim) || '?'}` : 'Sem datas'}</td>
                            <td className="px-4 py-3 text-right">
                              <button type="button" onClick={() => setEditar({
                                empresa_id: e.id, inicio: e.contrato_inicio || hojeIso(), duracao_meses: e.contrato_duracao_meses || 12, dia_vencimento: e.dia_vencimento_boleto,
                              })} className="text-sm text-blue-300 hover:text-white border border-blue-500/40 rounded-lg px-3 py-1.5">Criar contrato</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-500">Se o cliente já tem datas no cadastro, o contrato novo começa com elas.</p>
                </SectionCard>
              )}

              {aba === 'modelo' && <ModeloPanel modelo={modelo} showToast={showToast} onSaved={setModelo} />}
            </>
          )}
        </div>
      </div>

      {editar && (
        <ContratoForm
          inicial={editar} empresas={empresas} textoModelo={textoModelo} placasAtivas={placasAtivas} mensalidadesDe={mensalidadesDe}
          showToast={showToast} onClose={() => setEditar(null)}
          onSaved={(c, imprimir) => { setEditar(null); carregar(); if (imprimir) gerarPdf(c); }}
          onPdf={gerarPdf}
        />
      )}
      {reajustar && (
        <ReajusteModal
          contrato={reajustar} empresa={empresaPorId[String(reajustar.empresa_id)]} mensalidades={mensalidadesDe(reajustar.empresa_id)}
          placas={placasAtivas(reajustar.empresa_id)} historico={reajustes.filter(r => r.contrato_id === reajustar.id)}
          showToast={showToast} onClose={() => setReajustar(null)} onDone={() => { setReajustar(null); carregar(); }}
        />
      )}
      {encerrar && (
        <EncerrarModal contrato={encerrar} showToast={showToast} onClose={() => setEncerrar(null)} onDone={() => { setEncerrar(null); carregar(); }} />
      )}
    </>
  );
}

// =====================================================================
// Formulário do contrato
// =====================================================================
function ContratoForm({ inicial, empresas, textoModelo, placasAtivas, mensalidadesDe, showToast, onClose, onSaved, onPdf }) {
  const novo = !inicial.id;
  const [f, setF] = useState(() => ({
    empresa_id: inicial.empresa_id != null ? String(inicial.empresa_id) : '',
    status: inicial.status || 'ATIVO',
    inicio: inicial.inicio || hojeIso(),
    duracao_meses: inicial.duracao_meses || 12,
    renovacao_automatica: inicial.renovacao_automatica ?? true,
    aviso_dias: inicial.aviso_dias ?? 60,
    indice_reajuste: inicial.indice_reajuste || 'IPCA',
    percentual_fixo: numTxt(inicial.percentual_fixo),
    proximo_reajuste: inicial.proximo_reajuste || '',
    valor_mensal_ref: numTxt(inicial.valor_mensal_ref),
    qtd_placas_ref: inicial.qtd_placas_ref ?? '',
    dia_vencimento: inicial.dia_vencimento ?? '',
    fidelidade_meses: inicial.fidelidade_meses ?? '',
    multa_rescisao: inicial.multa_rescisao || '',
    objeto: inicial.objeto || 'rastreamento e monitoramento veicular 24 horas',
    observacoes: inicial.observacoes || '',
    texto: inicial.texto || '',
    assinado_em: inicial.assinado_em || '',
  }));
  const [salvando, setSalvando] = useState(false);
  const [verTexto, setVerTexto] = useState(Boolean(inicial.texto));
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const emp = empresas.find(e => String(e.id) === f.empresa_id);

  // Ao escolher o cliente num contrato novo, puxa placas, dia do boleto e valor por placa
  useEffect(() => {
    if (!novo || !emp) return;
    const placas = placasAtivas(emp.id);
    const ms = mensalidadesDe(emp.id);
    setF(x => ({
      ...x,
      qtd_placas_ref: x.qtd_placas_ref === '' ? placas.length : x.qtd_placas_ref,
      dia_vencimento: x.dia_vencimento === '' || x.dia_vencimento == null ? (emp.dia_vencimento_boleto ?? '') : x.dia_vencimento,
      valor_mensal_ref: x.valor_mensal_ref || (ms?.rastreamento ? numTxt(ms.rastreamento) : (placas.length ? numTxt(Math.round(placas.reduce((s, v) => s + Number(v.mensalidade || 0), 0) / placas.length * 100) / 100) : '')),
    }));
  }, [f.empresa_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const linha = () => ({
    empresa_id: emp?.id,
    status: f.status,
    inicio: f.inicio,
    duracao_meses: Number(f.duracao_meses) || 12,
    renovacao_automatica: Boolean(f.renovacao_automatica),
    aviso_dias: Number(f.aviso_dias) || 60,
    indice_reajuste: f.indice_reajuste,
    percentual_fixo: f.indice_reajuste === 'FIXO' ? lerNum(f.percentual_fixo) : null,
    proximo_reajuste: f.indice_reajuste === 'NENHUM' ? null : (f.proximo_reajuste || null),
    valor_mensal_ref: lerNum(f.valor_mensal_ref),
    qtd_placas_ref: f.qtd_placas_ref === '' ? null : Number(f.qtd_placas_ref),
    dia_vencimento: f.dia_vencimento === '' || f.dia_vencimento == null ? null : Number(f.dia_vencimento),
    fidelidade_meses: f.fidelidade_meses === '' ? null : Number(f.fidelidade_meses),
    multa_rescisao: f.multa_rescisao || null,
    objeto: f.objeto || null,
    observacoes: f.observacoes || null,
    texto: f.texto || null,
    assinado_em: f.assinado_em || null,
  });

  const salvar = async (imprimir) => {
    if (!emp) return showToast('Escolha o cliente.', 'error');
    if (!f.inicio) return showToast('Informe o início.', 'error');
    if (f.indice_reajuste === 'FIXO' && lerNum(f.percentual_fixo) == null) return showToast('Informe o % fixo do reajuste.', 'error');
    setSalvando(true);
    const q = novo ? supabase.from('contratos').insert(linha()) : supabase.from('contratos').update(linha()).eq('id', inicial.id);
    const { data, error } = await q.select('*').single();
    setSalvando(false);
    if (error) return showToast(error.message, 'error');
    showToast(novo ? `Contrato ${data.numero} criado.` : 'Contrato salvo.');
    onSaved(data, imprimir);
    return null;
  };

  const fimPrevisto = calcularFim(f.inicio, f.duracao_meses, inicial.renovacoes || 0);

  return (
    <Modal titulo={novo ? 'Novo contrato' : `Contrato ${inicial.numero}`} onClose={onClose}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Campo label="Cliente" className="sm:col-span-2">
          <select value={f.empresa_id} onChange={e => set('empresa_id', e.target.value)} className={inputCls} disabled={!novo}>
            <option value="">Escolha...</option>
            {empresas.map(e => <option key={e.id} value={String(e.id)}>{e.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Situação">
          <select value={f.status} onChange={e => set('status', e.target.value)} className={inputCls}>
            {STATUS_CONTRATO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Campo>
        <Campo label="Assinado em" ajuda="Preenchido sozinho ao anexar o PDF">
          <input type="date" value={f.assinado_em} onChange={e => set('assinado_em', e.target.value)} className={inputCls} />
        </Campo>
        <Campo label="Início">
          <input type="date" value={f.inicio} onChange={e => set('inicio', e.target.value)} className={inputCls} />
        </Campo>
        <Campo label="Duração (meses)" ajuda={fimPrevisto ? `Termina em ${dataBR(fimPrevisto)}` : undefined}>
          <input type="number" min={1} value={f.duracao_meses} onChange={e => set('duracao_meses', e.target.value)} className={inputCls} />
        </Campo>
        <Campo label="Avisar quantos dias antes do fim">
          <input type="number" min={0} value={f.aviso_dias} onChange={e => set('aviso_dias', e.target.value)} className={inputCls} />
        </Campo>
        <label className="flex items-center gap-2 text-sm text-gray-300 sm:pt-7">
          <input type="checkbox" checked={f.renovacao_automatica} onChange={e => set('renovacao_automatica', e.target.checked)} /> Renova sozinho por igual período
        </label>
        <Campo label="Índice de reajuste anual">
          <select value={f.indice_reajuste} onChange={e => set('indice_reajuste', e.target.value)} className={inputCls}>
            {INDICES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </Campo>
        {f.indice_reajuste === 'FIXO' ? (
          <Campo label="% fixo ao ano"><input value={f.percentual_fixo} onChange={e => set('percentual_fixo', e.target.value)} inputMode="decimal" className={inputCls} /></Campo>
        ) : f.indice_reajuste !== 'NENHUM' ? (
          <Campo label="Próximo reajuste" ajuda="Vazio = 12 meses depois do início"><input type="date" value={f.proximo_reajuste} onChange={e => set('proximo_reajuste', e.target.value)} className={inputCls} /></Campo>
        ) : <div />}
        {f.indice_reajuste === 'FIXO' && (
          <Campo label="Próximo reajuste" ajuda="Vazio = 12 meses depois do início"><input type="date" value={f.proximo_reajuste} onChange={e => set('proximo_reajuste', e.target.value)} className={inputCls} /></Campo>
        )}
        <Campo label="Valor por placa no contrato (R$)" ajuda="Só referência no texto; a cobrança usa a tabela de preço">
          <input value={f.valor_mensal_ref} onChange={e => set('valor_mensal_ref', e.target.value)} inputMode="decimal" className={inputCls} />
        </Campo>
        <Campo label="Quantidade de placas">
          <input type="number" min={0} value={f.qtd_placas_ref} onChange={e => set('qtd_placas_ref', e.target.value)} className={inputCls} />
        </Campo>
        <Campo label="Dia do vencimento do boleto">
          <input type="number" min={1} max={31} value={f.dia_vencimento ?? ''} onChange={e => set('dia_vencimento', e.target.value)} className={inputCls} />
        </Campo>
        <Campo label="Fidelidade (meses)">
          <input type="number" min={0} value={f.fidelidade_meses} onChange={e => set('fidelidade_meses', e.target.value)} className={inputCls} />
        </Campo>
        <Campo label="Multa por rescisão antecipada" className="sm:col-span-2" ajuda='Ex.: "50% das mensalidades que faltam". Vazio = sem multa.'>
          <input value={f.multa_rescisao} onChange={e => set('multa_rescisao', e.target.value)} className={inputCls} />
        </Campo>
        <Campo label="Objeto (o que foi contratado)" className="sm:col-span-2">
          <input value={f.objeto} onChange={e => set('objeto', e.target.value)} className={inputCls} />
        </Campo>
        <Campo label="Observações internas" className="sm:col-span-2">
          <textarea rows={2} value={f.observacoes} onChange={e => set('observacoes', e.target.value)} className={inputCls} />
        </Campo>
      </div>

      <div className="rounded-xl border border-gray-800 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-gray-300">Texto do contrato: {f.texto ? 'personalizado para este cliente' : 'usa o modelo padrão'}</span>
          <div className="flex gap-2">
            {!verTexto && <button type="button" onClick={() => { setVerTexto(true); if (!f.texto) set('texto', textoModelo); }} className="text-sm text-blue-300 hover:text-white">Personalizar o texto</button>}
            {verTexto && f.texto && <button type="button" onClick={() => { set('texto', ''); setVerTexto(false); }} className="text-sm text-gray-400 hover:text-white">Voltar ao modelo padrão</button>}
          </div>
        </div>
        {verTexto && (
          <textarea rows={14} value={f.texto} onChange={e => set('texto', e.target.value)} className={`${inputCls} font-mono text-xs`} />
        )}
        {verTexto && <p className="text-xs text-gray-500">Os campos entre chaves (ex.: {'{cliente_razao}'}) são preenchidos na hora de gerar o PDF.</p>}
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <button type="button" disabled={salvando} onClick={() => salvar(false)} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
          {salvando && <FaSpinner className="animate-spin" />} Salvar
        </button>
        <button type="button" disabled={salvando} onClick={() => salvar(true)} className="border border-gray-700 hover:border-gray-500 text-gray-200 px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2">
          <FaFilePdf /> Salvar e gerar PDF
        </button>
        {!novo && <button type="button" onClick={() => onPdf({ ...inicial, ...linha() })} className="text-sm text-gray-400 hover:text-white px-2">Só ver o PDF</button>}
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
      </div>
    </Modal>
  );
}

// =====================================================================
// Reajuste
// =====================================================================
function ReajusteModal({ contrato, empresa, mensalidades, placas, historico, showToast, onClose, onDone }) {
  const [pct, setPct] = useState(contrato.indice_reajuste === 'FIXO' ? numTxt(contrato.percentual_fixo) : '');
  const [referencia, setReferencia] = useState(contrato.indice_reajuste === 'FIXO' ? `% fixo do contrato` : '');
  const [buscando, setBuscando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [incluirServicos, setIncluirServicos] = useState(true);
  const [meses, setMeses] = useState(null);
  const temIndice = ['IPCA', 'IGPM', 'INPC'].includes(contrato.indice_reajuste);

  const buscar = async () => {
    setBuscando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const ref = contrato.proximo_reajuste ? String(contrato.proximo_reajuste).slice(0, 7) : '';
      // até o mês anterior ao aniversário
      let ate = '';
      if (ref) { const [a, m] = ref.split('-').map(Number); const d = new Date(a, m - 2, 1); ate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
      const r = await fetch('/api/contratos/indice', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ indice: contrato.indice_reajuste, ate: ate && ate <= hojeIso().slice(0, 7) ? ate : '' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Erro');
      const valor = Math.max(0, j.acumulado);
      setPct(numTxt(valor));
      setReferencia(j.referencia + (j.acumulado < 0 ? ` (deu ${numTxt(j.acumulado)}%, negativo: mantém o preço)` : ''));
      setMeses(j.meses);
    } catch (e) { showToast(e.message, 'error'); }
    setBuscando(false);
  };

  const p = lerNum(pct);
  const fator = p == null ? null : 1 + p / 100;
  const soma = placas.reduce((s, v) => s + Number(v.mensalidade || 0), 0);
  const novo = (v) => (fator == null || v == null ? null : Math.round(v * fator * 100) / 100);

  const aplicar = async () => {
    if (p == null) return showToast('Informe o percentual.', 'error');
    if (p === 0) return showToast('Reajuste de 0%: nada a aplicar.', 'error');
    setAplicando(true);
    const { error } = await supabase.rpc('fv_contrato_reajustar', {
      p_contrato: contrato.id, p_percentual: p, p_indice: contrato.indice_reajuste, p_referencia: referencia || null, p_incluir_servicos: incluirServicos,
    });
    setAplicando(false);
    if (error) return showToast(error.message, 'error');
    showToast(`Reajuste de ${numTxt(p)}% aplicado.`);
    onDone();
    return null;
  };

  return (
    <Modal titulo={`Reajuste: ${empresa?.nome || ''} (${contrato.numero})`} onClose={onClose}>
      <p className="text-sm text-gray-400">Índice do contrato: <b className="text-gray-200">{rotuloIndice(contrato.indice_reajuste)}</b> · aniversário {dataBR(contrato.proximo_reajuste)}</p>
      <div className="flex flex-wrap items-end gap-3">
        <Campo label="Reajuste (%)"><input value={pct} onChange={e => setPct(e.target.value)} inputMode="decimal" className={`${inputCls} w-32`} /></Campo>
        {temIndice && (
          <button type="button" onClick={buscar} disabled={buscando} className="border border-blue-500/40 text-blue-300 hover:text-white rounded-lg px-3 py-2 text-sm inline-flex items-center gap-2">
            {buscando ? <FaSpinner className="animate-spin" /> : <FaExternalLinkAlt size={11} />} Buscar no Banco Central
          </button>
        )}
      </div>
      <Campo label="Referência (vai para o histórico)"><input value={referencia} onChange={e => setReferencia(e.target.value)} className={inputCls} placeholder="Ex.: IPCA acumulado 11/2025 a 10/2026" /></Campo>
      {meses && (
        <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
          {meses.map(m => <span key={m.data}>{m.data.slice(3)}: {numTxt(m.valor)}%</span>)}
        </div>
      )}

      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className={theadClass}><tr><Th>O que muda</Th><Th align="right">Hoje</Th><Th align="right">Depois</Th></tr></thead>
          <tbody className={tbodyClass}>
            {mensalidades ? (
              [['Rastreamento', mensalidades.rastreamento], ['Monitoramento', mensalidades.monitoramento], ['Full Route', mensalidades.full_route]]
                .filter(([, v]) => v).map(([n, v]) => (
                  <tr key={n}><td className="px-4 py-2 text-gray-300">Mensalidade {n}</td><td className="px-4 py-2 text-right tabular-nums">{reais(v)}</td><td className="px-4 py-2 text-right tabular-nums text-amber-200">{reais(novo(v))}</td></tr>
                ))
            ) : (
              <tr><td colSpan={3} className="px-4 py-2 text-xs text-gray-500">Cliente sem tabela de mensalidade: o % vai direto no valor de cada placa.</td></tr>
            )}
            <tr><td className="px-4 py-2 text-gray-300">Soma das {placas.length} placa(s) ativa(s)</td><td className="px-4 py-2 text-right tabular-nums">{reais(soma)}</td><td className="px-4 py-2 text-right tabular-nums text-amber-200">{reais(novo(soma))}</td></tr>
            {contrato.valor_mensal_ref != null && (
              <tr><td className="px-4 py-2 text-gray-300">Valor por placa no contrato</td><td className="px-4 py-2 text-right tabular-nums">{reais(contrato.valor_mensal_ref)}</td><td className="px-4 py-2 text-right tabular-nums text-amber-200">{reais(novo(Number(contrato.valor_mensal_ref)))}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input type="checkbox" checked={incluirServicos} onChange={e => setIncluirServicos(e.target.checked)} /> Reajustar também os serviços avulsos do cliente (instalação, manutenção etc.)
      </label>
      <p className="text-xs text-gray-500">O valor novo fica gravado na tabela de preço deste cliente e as placas são recalculadas na hora. O próximo reajuste passa para daqui a 12 meses.</p>

      <div className="flex gap-3 pt-1">
        <button type="button" disabled={aplicando || p == null} onClick={aplicar} className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
          {aplicando ? <FaSpinner className="animate-spin" /> : <FaPercent size={11} />} Aplicar reajuste
        </button>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
      </div>

      {historico.length > 0 && (
        <div className="space-y-1 pt-2">
          <div className="text-sm text-gray-300">Reajustes anteriores</div>
          {historico.map(h => (
            <div key={h.id} className="text-xs text-gray-400">
              {dataBR(h.data)} · {numTxt(Number(h.percentual))}% · {h.referencia || h.indice}
              {h.antes?.soma_mensalidades != null && ` · placas ${reais(h.antes.soma_mensalidades)} → ${reais(h.depois?.soma_mensalidades)}`}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function EncerrarModal({ contrato, showToast, onClose, onDone }) {
  const [status, setStatus] = useState('ENCERRADO');
  const [data, setData] = useState(hojeIso());
  const [motivo, setMotivo] = useState('');
  const salvar = async () => {
    const { error } = await supabase.from('contratos').update({ status, encerrado_em: data, motivo_encerramento: motivo || null, renovacao_automatica: false }).eq('id', contrato.id);
    if (error) return showToast(error.message, 'error');
    showToast('Contrato encerrado.');
    onDone();
    return null;
  };
  return (
    <Modal titulo={`Encerrar ${contrato.numero}`} onClose={onClose} largura="max-w-md">
      <Campo label="Como terminou">
        <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
          <option value="ENCERRADO">Encerrado (fim normal)</option>
          <option value="CANCELADO">Cancelado (rescisão)</option>
        </select>
      </Campo>
      <Campo label="Data"><input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} /></Campo>
      <Campo label="Motivo"><input value={motivo} onChange={e => setMotivo(e.target.value)} className={inputCls} /></Campo>
      <p className="text-xs text-gray-500">As placas do cliente não são mexidas. Desinstale ou desative as placas pelo painel, se for o caso.</p>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={salvar} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Encerrar</button>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2">Voltar</button>
      </div>
    </Modal>
  );
}

// =====================================================================
// Modelo
// =====================================================================
function ModeloPanel({ modelo, showToast, onSaved }) {
  const [texto, setTexto] = useState(modelo.texto || MODELO_PADRAO);
  const [cidade, setCidade] = useState(modelo.prestador_cidade || '');
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    setSalvando(true);
    const { data, error } = await supabase.from('contrato_modelo').upsert({ id: 1, texto, prestador_cidade: cidade || null, updated_at: new Date().toISOString() }).select('*').single();
    setSalvando(false);
    if (error) return showToast(error.message, 'error');
    onSaved({ texto: data.texto || '', prestador_cidade: data.prestador_cidade || '' });
    showToast('Modelo salvo.');
    return null;
  };
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <SectionCard title="Texto padrão do contrato">
          <textarea rows={28} value={texto} onChange={e => setTexto(e.target.value)} className={`${inputCls} font-mono text-xs`} />
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={salvando} onClick={salvar} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
              {salvando && <FaSpinner className="animate-spin" />} Salvar modelo
            </button>
            <button type="button" onClick={() => setTexto(MODELO_PADRAO)} className="text-sm text-gray-400 hover:text-white">Voltar ao texto original</button>
          </div>
          <p className="text-xs text-amber-300/80">É um modelo simples, de ponto de partida. Vale passar por um advogado antes de usar com clientes.</p>
        </SectionCard>
      </div>
      <SectionCard title="Dados e campos">
        <Campo label="Cidade da Full Vision (foro e assinatura)">
          <input value={cidade} onChange={e => setCidade(e.target.value)} className={inputCls} placeholder="Ex.: Goiânia/GO" />
        </Campo>
        <p className="text-xs text-gray-500">Razão social e CNPJ da Full Vision vêm da Configuração fiscal (aba Emitir NF do Financeiro). Os dados do cliente vêm do cadastro dele.</p>
        <div className="text-xs text-gray-400 space-y-1">
          <div className="text-gray-300 text-sm">Campos que se preenchem sozinhos:</div>
          {CAMPOS_MODELO.map(c => <div key={c}><code>{c}</code></div>)}
        </div>
      </SectionCard>
    </div>
  );
}
