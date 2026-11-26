// components/financeiro/NotasFiscaisPanel.jsx
// Aba "Emitir NF" do /financeiro (só ADM): NFS-e das mensalidades dos clientes.
// Emitir: mensalidade do mês por cliente (soma das placas), uma por uma ou o mês inteiro.
// Notas emitidas: histórico com PDF/XML, status, atualizar e cancelar.
// Configuração fiscal: dados da Full Vision, código do serviço, ISS e regime.
// A emissão passa pelo emissor Focus NFe (lib/focusNfe.js), com o token na Vercel.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FaSpinner, FaCheckCircle, FaExclamationCircle, FaFilePdf, FaFileCode, FaSyncAlt, FaBan,
  FaExternalLinkAlt, FaRedoAlt, FaFileInvoiceDollar, FaEdit, FaPlus, FaTimes,
} from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { comMensalidadeEfetiva } from '../../lib/veiculos';
import {
  tableWrap, theadClass, tbodyClass, rowClass, Dash, StatStrip, SectionCard, Th, SearchInput, inputBase, norm,
} from '../admin/ui';
import {
  STATUS_NOTA, statusNota, AMBIENTES, PADROES, OPCOES_SIMPLES, REGIMES_ESPECIAIS, CONFIG_PADRAO, MODELO_DISCRIMINACAO_PADRAO,
  mesAtual, competenciaTexto, competenciaCurta, montarLinhaMes, problemasConfig, problemasTomador, soDigitos,
} from '../../lib/notasFiscais';

const reais = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const LOTE = 3; // notas por chamada (a Vercel corta a chamada depois de 60 s)

async function api(caminho, corpo) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`/api/nfse/${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
    body: JSON.stringify(corpo || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
  return j;
}

const Campo = ({ label, ajuda, children, className = '' }) => (
  <label className={`block space-y-1.5 ${className}`}>
    <span className="text-sm text-gray-300">{label}</span>
    {children}
    {ajuda && <span className="block text-xs text-gray-500">{ajuda}</span>}
  </label>
);
const inputCls = `w-full px-3 py-2 ${inputBase}`;

function Badge({ status }) {
  const s = statusNota(status);
  return <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${s.badge}`}>{s.label}</span>;
}


// Sub-abas dentro da aba Notas fiscais
function SubAbas({ abas, ativa, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-gray-900 border border-gray-800">
      {abas.map(a => (
        <button
          key={a.key} type="button" onClick={() => onChange(a.key)}
          className={`px-3.5 py-1.5 rounded-lg text-sm transition-colors ${ativa === a.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

export default function NotasFiscaisPanel({ showToast }) {
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');
  const [config, setConfig] = useState(null);
  const [notas, setNotas] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [tokens, setTokens] = useState(null);
  const [aba, setAba] = useState('emitir');

  const carregar = useCallback(async () => {
    const [c, n, e, v] = await Promise.all([
      supabase.from('nf_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('nf_notas').select('*').order('created_at', { ascending: false }),
      supabase.from('empresas').select('*').order('nome'),
      supabase.from('veiculos').select('id, placa, empresa_id, mensalidade, servicos, status, data_inst, data_desinst').order('placa'),
    ]);
    if (c.error || n.error) {
      const msg = (c.error || n.error).message;
      setErroCarga(/nf_config|nf_notas/.test(msg) ? 'As tabelas das notas fiscais ainda não existem. Rode o SQL 20261126c_notas_fiscais.sql no Supabase.' : msg);
    } else setErroCarga('');
    setConfig({ ...CONFIG_PADRAO, ...(c.data || {}) });
    setNotas(n.data || []);
    setEmpresas(e.data || []);
    setVeiculos((v.data || []).map(comMensalidadeEfetiva));
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
    api('situacao').then(setTokens).catch(() => setTokens(null));
  }, [carregar]);

  const empresaPorId = useMemo(() => Object.fromEntries(empresas.map(e => [String(e.id), e])), [empresas]);
  const juntarNotas = useCallback((novas) => {
    setNotas(atual => {
      const map = new Map(atual.map(n => [n.id, n]));
      novas.filter(Boolean).forEach(n => { if (n.id) map.set(n.id, { ...map.get(n.id), ...n }); });
      return [...map.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    });
  }, []);

  // Acompanha as notas que estão processando até a prefeitura responder
  const processando = notas.filter(n => n.status === 'PROCESSANDO').map(n => n.id);
  const tentativas = useRef(0);
  const chaveProc = processando.join(',');
  useEffect(() => {
    if (!chaveProc) { tentativas.current = 0; return undefined; }
    if (tentativas.current > 30) return undefined;
    const t = setTimeout(async () => {
      tentativas.current += 1;
      try { const { notas: at } = await api('atualizar', { ids: chaveProc.split(',') }); juntarNotas(at); } catch { /* tenta de novo */ }
    }, tentativas.current < 5 ? 4000 : 15000);
    return () => clearTimeout(t);
  }, [chaveProc, juntarNotas, notas]);

  const ambienteProducao = config?.ambiente === 'producao';
  const faltaConfig = config ? problemasConfig(config) : [];

  if (carregando) {
    return <div className="flex items-center justify-center py-24 text-gray-500"><FaSpinner className="animate-spin text-2xl mr-3" /> Carregando notas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SubAbas
          ativa={aba}
          onChange={setAba}
          abas={[
            { key: 'emitir', label: 'Emitir' },
            { key: 'historico', label: `Notas emitidas${processando.length ? ' •' : ''} (${notas.filter(n => n.ambiente === config?.ambiente).length})` },
            { key: 'config', label: `Configuração fiscal${faltaConfig.length ? ' •' : ''}` },
          ]}
        />
        {config && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ambienteProducao ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
            {ambienteProducao ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO (teste)'}
          </span>
        )}
      </div>

      {erroCarga && (
        <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3">
          <FaExclamationCircle className="mt-0.5 shrink-0" /> {erroCarga}
        </div>
      )}
      {!erroCarga && faltaConfig.length > 0 && aba !== 'config' && (
        <button type="button" onClick={() => setAba('config')} className="w-full text-left flex items-start gap-2 text-sm text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3 hover:border-amber-400/50">
          <FaExclamationCircle className="mt-0.5 shrink-0" /> Antes de emitir, complete a Configuração fiscal: falta {faltaConfig.join(', ')}. Clique aqui.
        </button>
      )}

      {aba === 'emitir' && (
        <EmitirPanel
          config={config} empresas={empresas} veiculos={veiculos} notas={notas} faltaConfig={faltaConfig}
          showToast={showToast} juntarNotas={juntarNotas} irHistorico={() => setAba('historico')}
        />
      )}
      {aba === 'historico' && (
        <HistoricoPanel config={config} notas={notas} empresaPorId={empresaPorId} showToast={showToast} juntarNotas={juntarNotas} />
      )}
      {aba === 'config' && (
        <ConfigPanel config={config} tokens={tokens} showToast={showToast} onSaved={(c) => setConfig({ ...CONFIG_PADRAO, ...c })} />
      )}
    </div>
  );
}

// =====================================================================
// Emitir
// =====================================================================
function EmitirPanel({ config, empresas, veiculos, notas, faltaConfig, showToast, juntarNotas, irHistorico }) {
  const [mes, setMes] = useState(mesAtual());
  const [busca, setBusca] = useState('');
  const [marcadas, setMarcadas] = useState(new Set());
  const [emitindo, setEmitindo] = useState(null); // { feitas, total }
  const [resultado, setResultado] = useState(null);
  const [editar, setEditar] = useState(null); // { empresa_id, valor, discriminacao, avulsa }
  const [confirmar, setConfirmar] = useState(null); // lista de pedidos

  const linhas = useMemo(() => empresas
    .map(empresa => montarLinhaMes({ empresa, veiculos, mes, config, notas }))
    .filter(l => l.placas.length > 0 || l.nota)
    .filter(l => !busca || norm(`${l.empresa.nome} ${l.empresa.razao_social || ''} ${l.empresa.cnpj || ''}`).includes(norm(busca))),
  [empresas, veiculos, mes, config, notas, busca]);

  useEffect(() => { setMarcadas(new Set()); setResultado(null); }, [mes, config?.ambiente]);

  const prontas = linhas.filter(l => !l.nota && !l.problemas.length && l.valor > 0);
  const totalMarcado = prontas.filter(l => marcadas.has(String(l.empresa.id))).reduce((s, l) => s + l.valor, 0);
  const qtdMarcadas = prontas.filter(l => marcadas.has(String(l.empresa.id))).length;
  const emitidas = linhas.filter(l => l.nota);

  const alternar = (id) => setMarcadas(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const todas = () => setMarcadas(qtdMarcadas === prontas.length ? new Set() : new Set(prontas.map(l => String(l.empresa.id))));

  const emitir = async (pedidos) => {
    setConfirmar(null);
    setResultado(null);
    setEmitindo({ feitas: 0, total: pedidos.length });
    const todos = [];
    for (let i = 0; i < pedidos.length; i += LOTE) {
      try {
        const { resultados } = await api('emitir', { notas: pedidos.slice(i, i + LOTE) });
        todos.push(...resultados);
        juntarNotas(resultados.map(r => r.nota));
      } catch (e) {
        pedidos.slice(i, i + LOTE).forEach(p => todos.push({ empresa_id: p.empresa_id, nome: p.nome, ok: false, erro: e.message }));
      }
      setEmitindo({ feitas: Math.min(i + LOTE, pedidos.length), total: pedidos.length });
    }
    setEmitindo(null);
    setMarcadas(new Set());
    setResultado(todos);
    const ok = todos.filter(r => r.ok).length;
    showToast(ok === todos.length ? `${ok} nota(s) enviada(s) para a prefeitura.` : `${ok} de ${todos.length} enviada(s). Veja os erros abaixo.`, ok === todos.length ? 'success' : 'error');
  };

  const pedirMarcadas = () => setConfirmar(prontas.filter(l => marcadas.has(String(l.empresa.id)))
    .map(l => ({ empresa_id: l.empresa.id, competencia: mes, nome: l.empresa.nome, valor: l.valor })));

  const bloqueado = faltaConfig.length > 0 || Boolean(emitindo);

  return (
    <div className="space-y-6">
      <StatStrip
        colsClass="grid-cols-2 lg:grid-cols-4"
        items={[
          { label: `Clientes a faturar em ${competenciaCurta(mes)}`, value: linhas.length },
          { label: 'Prontas para emitir', value: prontas.length },
          { label: 'Já emitidas / processando', value: emitidas.length, valueClass: 'text-emerald-300' },
          { label: 'Total do mês', value: reais(linhas.reduce((s, l) => s + (l.nota ? Number(l.nota.valor) : l.valor), 0)) },
        ]}
      />

      <SectionCard
        title={`Mensalidades de ${competenciaTexto(mes)}`}
        action={(
          <button type="button" disabled={bloqueado} onClick={() => setEditar({ empresa_id: '', valor: '', discriminacao: '', avulsa: true })}
            className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2 disabled:opacity-40">
            <FaPlus size={11} /> Nota avulsa
          </button>
        )}
      >
        <div className="flex flex-wrap items-end gap-3">
          <Campo label="Mês (competência)">
            <input type="month" value={mes} onChange={e => e.target.value && setMes(e.target.value)} className={`px-3 py-2 ${inputBase}`} />
          </Campo>
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar cliente, razão social ou CNPJ" />
          <button
            type="button" disabled={bloqueado || !qtdMarcadas} onClick={pedirMarcadas}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            {emitindo ? <FaSpinner className="animate-spin" /> : <FaFileInvoiceDollar />}
            {emitindo ? `Emitindo ${emitindo.feitas}/${emitindo.total}...` : `Emitir selecionadas (${qtdMarcadas}) · ${reais(totalMarcado)}`}
          </button>
        </div>

        {resultado && (
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <b>Resultado do envio</b>
              <button type="button" onClick={irHistorico} className="text-blue-300 hover:text-white text-sm">Ver em Notas emitidas</button>
            </div>
            {resultado.map((r, i) => (
              <div key={i} className={`flex gap-2 ${r.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                {r.ok ? <FaCheckCircle className="mt-0.5 shrink-0" /> : <FaExclamationCircle className="mt-0.5 shrink-0" />}
                <span><b>{r.nome}</b>: {r.ok ? `enviada (${statusNota(r.nota?.status).label.toLowerCase()})` : (r.erro || r.nota?.mensagem || 'erro')}</span>
              </div>
            ))}
          </div>
        )}

        <div className={tableWrap}>
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" aria-label="Marcar todas" checked={prontas.length > 0 && qtdMarcadas === prontas.length} onChange={todas} disabled={!prontas.length} />
                </th>
                <Th>Cliente</Th>
                <Th>Placas</Th>
                <Th align="right">Valor</Th>
                <Th>Situação</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {linhas.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">Nenhum cliente com placa cobrando mensalidade neste mês.</td></tr>
              )}
              {linhas.map(l => {
                const id = String(l.empresa.id);
                const pronta = !l.nota && !l.problemas.length && l.valor > 0;
                return (
                  <tr key={id} className={rowClass}>
                    <td className="px-4 py-3">
                      <input type="checkbox" aria-label={`Marcar ${l.empresa.nome}`} disabled={!pronta || bloqueado} checked={pronta && marcadas.has(id)} onChange={() => alternar(id)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white">{l.empresa.nome}</div>
                      <div className="text-xs text-gray-500">{l.empresa.razao_social || ''}{l.empresa.cnpj ? ` · ${l.empresa.cnpj}` : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      <span className="tabular-nums">{l.placas.length}</span>
                      <span className="text-xs text-gray-500 ml-2 hidden lg:inline">{l.placas.slice(0, 4).map(p => p.placa).join(', ')}{l.placas.length > 4 ? '…' : ''}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-white whitespace-nowrap">{reais(l.nota ? l.nota.valor : l.valor)}</td>
                    <td className="px-4 py-3">
                      {l.nota ? (
                        <span className="flex items-center gap-2"><Badge status={l.nota.status} />{l.nota.numero ? <span className="text-xs text-gray-400">nº {l.nota.numero}</span> : null}</span>
                      ) : l.problemas.length ? (
                        <span className="text-xs text-amber-300">Cadastro: {l.problemas.join(', ')}</span>
                      ) : l.notaErro ? (
                        <span className="text-xs text-red-300" title={l.notaErro.mensagem || ''}>Última tentativa com erro</span>
                      ) : (
                        <span className="text-xs text-gray-400">Pronta</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {pronta && (
                        <>
                          <button type="button" disabled={bloqueado} onClick={() => setEditar({ empresa_id: id, valor: l.valor, discriminacao: l.discriminacao, avulsa: false })}
                            className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-800 disabled:opacity-40" title="Conferir e emitir"><FaEdit /></button>
                          <button type="button" disabled={bloqueado} onClick={() => setConfirmar([{ empresa_id: l.empresa.id, competencia: mes, nome: l.empresa.nome, valor: l.valor }])}
                            className="ml-1 text-sm text-blue-300 hover:text-white border border-blue-500/40 rounded-lg px-3 py-1.5 disabled:opacity-40">Emitir</button>
                        </>
                      )}
                      {!pronta && l.problemas.length > 0 && !l.nota && (
                        <a href="/painel-admin" className="text-xs text-gray-400 hover:text-white underline">Completar cadastro</a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">
          O valor é a soma da mensalidade das placas com serviço ligado e ativas no mês (inclui as desinstaladas dentro do mês).
          Para mudar o valor ou o texto de uma nota, use o lápis antes de emitir.
        </p>
      </SectionCard>

      {editar && (
        <EditarNota
          inicial={editar} empresas={empresas} mes={mes} config={config}
          onClose={() => setEditar(null)}
          onEmitir={(p) => { setEditar(null); setConfirmar([p]); }}
        />
      )}
      {confirmar && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`bg-gray-900 border rounded-2xl max-w-md w-full p-6 space-y-4 ${config?.ambiente === 'producao' ? 'border-emerald-500/40' : 'border-amber-500/40'}`}>
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaFileInvoiceDollar /> Emitir {confirmar.length} nota(s)?</h3>
            <p className="text-sm text-gray-300">
              Total {reais(confirmar.reduce((s, p) => s + Number(p.valor || 0), 0))}, competência {competenciaCurta(mes)}.
            </p>
            {config?.ambiente === 'producao' ? (
              <p className="text-sm text-emerald-300">Ambiente de PRODUÇÃO: são notas de verdade, enviadas à prefeitura{config.enviar_email_tomador ? ' e por e-mail ao financeiro de cada cliente' : ''}.</p>
            ) : (
              <p className="text-sm text-amber-300">Ambiente de HOMOLOGAÇÃO: é só um teste, a nota não vale como documento fiscal.</p>
            )}
            <ul className="max-h-40 overflow-y-auto text-xs text-gray-400 space-y-0.5">
              {confirmar.map(p => <li key={p.empresa_id}>{p.nome || empresas.find(e => String(e.id) === String(p.empresa_id))?.nome} · {reais(p.valor)}</li>)}
            </ul>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => emitir(confirmar)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Emitir</button>
              <button type="button" onClick={() => setConfirmar(null)} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditarNota({ inicial, empresas, mes, config, onClose, onEmitir }) {
  const [empresaId, setEmpresaId] = useState(inicial.empresa_id);
  const [valor, setValor] = useState(inicial.valor === '' ? '' : String(inicial.valor).replace('.', ','));
  const [texto, setTexto] = useState(inicial.discriminacao || '');
  const [erro, setErro] = useState('');
  const empresa = empresas.find(e => String(e.id) === String(empresaId));
  const prob = empresa ? problemasTomador(empresa) : [];

  const confirmar = () => {
    const v = Number(String(valor).replace(/\./g, '').replace(',', '.'));
    if (!empresa) return setErro('Escolha o cliente.');
    if (prob.length) return setErro(`Cadastro do cliente incompleto: ${prob.join(', ')}.`);
    if (!(v > 0)) return setErro('Informe o valor.');
    if (texto.trim().length < 5) return setErro('Escreva a descrição do serviço.');
    onEmitir({ empresa_id: empresa.id, competencia: mes, nome: empresa.nome, valor: v, discriminacao: texto.trim(), avulsa: inicial.avulsa });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-xl w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{inicial.avulsa ? 'Nota avulsa' : 'Conferir nota'} · {competenciaCurta(mes)}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white p-1" aria-label="Fechar"><FaTimes /></button>
        </div>
        {inicial.avulsa ? (
          <Campo label="Cliente">
            <select value={empresaId} onChange={e => setEmpresaId(e.target.value)} className={inputCls}>
              <option value="">Escolha...</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </Campo>
        ) : (
          <div className="text-sm"><span className="text-gray-400">Cliente:</span> <b>{empresa?.nome}</b> <span className="text-gray-500">{empresa?.razao_social}</span></div>
        )}
        {empresa && prob.length > 0 && <p className="text-xs text-amber-300">Cadastro incompleto: {prob.join(', ')}.</p>}
        {empresa && (
          <p className="text-xs text-gray-500">
            E-mail da nota: {config?.enviar_email_tomador ? (empresa.contato_financeiro_email || empresa.contato_comercial_email || 'nenhum cadastrado') : 'envio desligado na configuração'}
          </p>
        )}
        <Campo label="Valor (R$)">
          <input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" className={inputCls} placeholder="0,00" />
        </Campo>
        <Campo label="Descrição do serviço (vai na nota)" ajuda={inicial.avulsa ? 'Nota avulsa não trava o mês: dá para emitir mais de uma.' : null}>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={5} className={inputCls} />
        </Campo>
        {erro && <p className="text-sm text-red-300">{erro}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={confirmar} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Continuar</button>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Notas emitidas
// =====================================================================
function HistoricoPanel({ config, notas, empresaPorId, showToast, juntarNotas }) {
  const [ambiente, setAmbiente] = useState(config?.ambiente || 'homologacao');
  const [mes, setMes] = useState('');
  const [status, setStatus] = useState('');
  const [busca, setBusca] = useState('');
  const [ocupado, setOcupado] = useState(null);
  const [cancelar, setCancelar] = useState(null); // { nota, motivo }
  const [detalhe, setDetalhe] = useState(null);

  const nomeDe = (n) => empresaPorId[String(n.empresa_id)]?.nome || n.tomador?.razao_social || '—';
  const lista = notas.filter(n => n.ambiente === ambiente
    && (!mes || String(n.competencia).slice(0, 7) === mes)
    && (!status || n.status === status)
    && (!busca || norm(`${nomeDe(n)} ${n.tomador?.razao_social || ''} ${n.numero || ''} ${n.tomador?.cnpj || ''}`).includes(norm(busca))));
  const totalEmitido = lista.filter(n => n.status === 'AUTORIZADA').reduce((s, n) => s + Number(n.valor || 0), 0);

  const abrir = async (n, tipo) => {
    setOcupado(`${n.id}-${tipo}`);
    try { const { url } = await api('arquivo', { id: n.id, tipo }); window.open(url, '_blank', 'noopener'); } catch (e) { showToast(e.message, 'error'); }
    setOcupado(null);
  };
  const atualizar = async (n) => {
    setOcupado(`${n.id}-sync`);
    try {
      const { notas: at } = await api('atualizar', { ids: [n.id] });
      juntarNotas(at);
      if (at[0]?.aviso) showToast(at[0].aviso, 'error'); else showToast('Status atualizado.');
    } catch (e) { showToast(e.message, 'error'); }
    setOcupado(null);
  };
  const tentarDeNovo = async (n) => {
    setOcupado(`${n.id}-redo`);
    try {
      const { resultados } = await api('emitir', { notas: [{ empresa_id: n.empresa_id, competencia: String(n.competencia).slice(0, 7), valor: Number(n.valor), discriminacao: n.discriminacao, avulsa: n.avulsa }] });
      juntarNotas(resultados.map(r => r.nota));
      const r = resultados[0];
      showToast(r.ok ? 'Nota reenviada.' : (r.erro || r.nota?.mensagem || 'Erro ao reenviar.'), r.ok ? 'success' : 'error');
    } catch (e) { showToast(e.message, 'error'); }
    setOcupado(null);
  };
  const confirmarCancelamento = async () => {
    const motivo = cancelar.motivo.trim();
    if (motivo.length < 15) { showToast('Escreva o motivo com pelo menos 15 letras.', 'error'); return; }
    setOcupado(`${cancelar.nota.id}-cancel`);
    try {
      const { nota } = await api('cancelar', { id: cancelar.nota.id, justificativa: motivo });
      juntarNotas([nota]);
      setCancelar(null);
      showToast(nota.status === 'CANCELADA' ? 'Nota cancelada.' : (nota.mensagem || 'Cancelamento pedido.'), nota.status === 'CANCELADA' ? 'success' : 'error');
    } catch (e) { showToast(e.message, 'error'); }
    setOcupado(null);
  };

  const mesesDisponiveis = [...new Set(notas.map(n => String(n.competencia).slice(0, 7)))].sort().reverse();
  const btn = 'text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-800 disabled:opacity-40';

  return (
    <div className="space-y-6">
      <SectionCard title="Notas emitidas" action={<span className="text-sm text-gray-400">Emitido: <b className="text-white tabular-nums">{reais(totalEmitido)}</b></span>}>
        <div className="flex flex-wrap gap-3">
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar cliente, número ou CNPJ" />
          <select value={mes} onChange={e => setMes(e.target.value)} className={`px-3 py-2 ${inputBase}`}>
            <option value="">Todos os meses</option>
            {mesesDisponiveis.map(m => <option key={m} value={m}>{competenciaCurta(m)}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className={`px-3 py-2 ${inputBase}`}>
            <option value="">Todos os status</option>
            {STATUS_NOTA.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={ambiente} onChange={e => setAmbiente(e.target.value)} className={`px-3 py-2 ${inputBase}`}>
            <option value="producao">Produção</option>
            <option value="homologacao">Homologação (teste)</option>
          </select>
        </div>

        <div className={tableWrap}>
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr><Th>Mês</Th><Th>Cliente</Th><Th>Número</Th><Th align="right">Valor</Th><Th>Status</Th><Th>Emitida em</Th><Th align="right">Ações</Th></tr>
            </thead>
            <tbody className={tbodyClass}>
              {lista.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">Nenhuma nota com esses filtros.</td></tr>}
              {lista.map(n => (
                <tr key={n.id} className={rowClass}>
                  <td className="px-4 py-3 tabular-nums text-gray-300">{competenciaCurta(n.competencia)}{n.avulsa ? <span className="ml-1 text-[10px] text-gray-500">avulsa</span> : null}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setDetalhe(n)} className="text-left text-white hover:text-blue-300">{nomeDe(n)}</button>
                    {n.mensagem && <div className={`text-xs mt-0.5 max-w-md ${n.status === 'ERRO' ? 'text-red-300' : 'text-amber-300'}`}>{n.mensagem}</div>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{n.numero || <Dash />}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-white whitespace-nowrap">{reais(n.valor)}</td>
                  <td className="px-4 py-3"><Badge status={n.status} /></td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{dataHora(n.data_emissao || n.created_at)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {(n.status === 'AUTORIZADA' || n.status === 'CANCELADA') && (
                      <>
                        <button type="button" title="PDF da nota" className={btn} disabled={ocupado === `${n.id}-pdf`} onClick={() => abrir(n, 'pdf')}>
                          {ocupado === `${n.id}-pdf` ? <FaSpinner className="animate-spin" /> : <FaFilePdf />}
                        </button>
                        <button type="button" title="XML da nota" className={btn} disabled={ocupado === `${n.id}-xml`} onClick={() => abrir(n, 'xml')}>
                          {ocupado === `${n.id}-xml` ? <FaSpinner className="animate-spin" /> : <FaFileCode />}
                        </button>
                      </>
                    )}
                    {n.url_prefeitura && (
                      <a href={n.url_prefeitura} target="_blank" rel="noopener noreferrer" title="Ver no site da prefeitura" className={`${btn} inline-block`}><FaExternalLinkAlt /></a>
                    )}
                    {(n.status === 'PROCESSANDO' || n.status === 'AUTORIZADA') && (
                      <button type="button" title="Atualizar status" className={btn} disabled={ocupado === `${n.id}-sync`} onClick={() => atualizar(n)}>
                        <FaSyncAlt className={ocupado === `${n.id}-sync` ? 'animate-spin' : ''} />
                      </button>
                    )}
                    {n.status === 'ERRO' && (
                      <button type="button" title="Tentar de novo" className={btn} disabled={ocupado === `${n.id}-redo`} onClick={() => tentarDeNovo(n)}>
                        {ocupado === `${n.id}-redo` ? <FaSpinner className="animate-spin" /> : <FaRedoAlt />}
                      </button>
                    )}
                    {n.status === 'AUTORIZADA' && (
                      <button type="button" title="Cancelar nota" className={`${btn} hover:text-red-400`} onClick={() => setCancelar({ nota: n, motivo: '' })}><FaBan /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">Uma cópia do PDF e do XML fica guardada no Supabase quando a nota é emitida. Se a nota deu erro, corrija o cadastro ou a configuração e use “Tentar de novo”.</p>
      </SectionCard>

      {cancelar && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaBan className="text-red-400" /> Cancelar nota {cancelar.nota.numero ? `nº ${cancelar.nota.numero}` : ''}</h3>
            <p className="text-sm text-gray-400">{nomeDe(cancelar.nota)} · {reais(cancelar.nota.valor)}. O cancelamento vai para a prefeitura e não dá para desfazer.</p>
            <Campo label="Motivo (15 a 255 letras)">
              <textarea rows={3} value={cancelar.motivo} maxLength={255} onChange={e => setCancelar(c => ({ ...c, motivo: e.target.value }))} className={inputCls} placeholder="Ex.: Nota emitida com valor errado, será substituída." />
            </Campo>
            <div className="flex gap-3 pt-2">
              <button type="button" disabled={ocupado === `${cancelar.nota.id}-cancel`} onClick={confirmarCancelamento} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
                {ocupado === `${cancelar.nota.id}-cancel` && <FaSpinner className="animate-spin" />} Cancelar nota
              </button>
              <button type="button" onClick={() => setCancelar(null)} className="text-gray-400 hover:text-white text-sm px-2">Voltar</button>
            </div>
          </div>
        </div>
      )}

      {detalhe && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setDetalhe(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full p-6 space-y-3 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{nomeDe(detalhe)} · {competenciaCurta(detalhe.competencia)}</h3>
              <button type="button" onClick={() => setDetalhe(null)} className="text-gray-400 hover:text-white p-1" aria-label="Fechar"><FaTimes /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div><span className="text-gray-500">Status:</span> <Badge status={detalhe.status} /></div>
              <div><span className="text-gray-500">Valor:</span> {reais(detalhe.valor)}</div>
              <div><span className="text-gray-500">Número:</span> {detalhe.numero || '—'}</div>
              <div><span className="text-gray-500">Código de verificação:</span> {detalhe.codigo_verificacao || '—'}</div>
              <div><span className="text-gray-500">Tomador:</span> {detalhe.tomador?.razao_social} ({detalhe.tomador?.cnpj})</div>
              <div><span className="text-gray-500">E-mail:</span> {detalhe.tomador?.email || '—'}</div>
              <div><span className="text-gray-500">Referência:</span> <span className="text-xs">{detalhe.referencia}</span></div>
              {detalhe.cancelada_em && <div><span className="text-gray-500">Cancelada em:</span> {dataHora(detalhe.cancelada_em)}</div>}
            </div>
            {detalhe.justificativa_cancelamento && <p className="text-sm"><span className="text-gray-500">Motivo do cancelamento:</span> {detalhe.justificativa_cancelamento}</p>}
            <div>
              <div className="text-sm text-gray-500 mb-1">Descrição</div>
              <pre className="whitespace-pre-wrap text-sm bg-gray-950 border border-gray-800 rounded-lg p-3">{detalhe.discriminacao}</pre>
            </div>
            {(detalhe.placas || []).length > 0 && (
              <div className="text-sm">
                <div className="text-gray-500 mb-1">Placas cobradas</div>
                <div className="flex flex-wrap gap-1.5">
                  {detalhe.placas.map(p => <span key={p.placa} className="text-xs bg-gray-800 rounded px-2 py-0.5">{p.placa} · {reais(p.mensalidade)}</span>)}
                </div>
              </div>
            )}
            {detalhe.mensagem && <p className="text-sm text-red-300">{detalhe.mensagem}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Configuração fiscal
// =====================================================================
function ConfigPanel({ config, tokens, showToast, onSaved }) {
  const [f, setF] = useState(() => ({
    ...config,
    modelo_discriminacao: config.modelo_discriminacao || MODELO_DISCRIMINACAO_PADRAO,
    campos_extras_txt: config.campos_extras ? JSON.stringify(config.campos_extras, null, 2) : '',
  }));
  const [salvando, setSalvando] = useState(false);
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const nacional = f.padrao === 'nacional';
  const falta = problemasConfig(f);
  const tokenOk = tokens ? tokens[f.ambiente] : null;

  const salvar = async () => {
    let extras = null;
    if (f.campos_extras_txt.trim()) {
      try { extras = JSON.parse(f.campos_extras_txt); } catch { showToast('Campos extras: o texto não é um JSON válido.', 'error'); return; }
    }
    if (f.ambiente === 'producao' && config.ambiente !== 'producao'
      && !window.confirm('Mudar para PRODUÇÃO? A partir daqui as notas emitidas valem de verdade.')) return;
    const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
    const linha = {
      id: 1,
      ambiente: f.ambiente,
      padrao: f.padrao,
      cnpj_prestador: soDigitos(f.cnpj_prestador),
      razao_social: f.razao_social || null,
      inscricao_municipal: (f.inscricao_municipal || '').trim() || null,
      codigo_municipio: soDigitos(f.codigo_municipio) || null,
      codigo_opcao_simples_nacional: Number(f.codigo_opcao_simples_nacional) || 1,
      regime_especial_tributacao: Number(f.regime_especial_tributacao) || 0,
      codigo_tributacao_nacional_iss: soDigitos(f.codigo_tributacao_nacional_iss) || null,
      codigo_tributacao_municipal_iss: (f.codigo_tributacao_municipal_iss || '').trim() || null,
      item_lista_servico: (f.item_lista_servico || '').trim() || null,
      codigo_cnae: soDigitos(f.codigo_cnae) || null,
      codigo_nbs: soDigitos(f.codigo_nbs) || null,
      aliquota_iss: num(f.aliquota_iss),
      iss_retido: Boolean(f.iss_retido),
      natureza_operacao: Number(f.natureza_operacao) || 1,
      percentual_tributos: num(f.percentual_tributos),
      modelo_discriminacao: f.modelo_discriminacao,
      enviar_email_tomador: Boolean(f.enviar_email_tomador),
      campos_extras: extras,
      updated_at: new Date().toISOString(),
    };
    setSalvando(true);
    const { data, error } = await supabase.from('nf_config').upsert(linha).select().single();
    setSalvando(false);
    if (error) { showToast(error.message, 'error'); return; }
    onSaved(data);
    showToast('Configuração fiscal salva.');
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Ambiente e emissor">
        <div className="grid md:grid-cols-2 gap-4">
          <Campo label="Ambiente" ajuda="Comece em homologação para testar. Troque para produção só depois que a nota de teste sair certa.">
            <select value={f.ambiente} onChange={set('ambiente')} className={inputCls}>
              {AMBIENTES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Campo>
          <Campo label="Onde a nota é emitida" ajuda="A Focus NFe informa qual vale para a sua cidade (a maioria já usa a NFS-e Nacional).">
            <select value={f.padrao} onChange={set('padrao')} className={inputCls}>
              {PADROES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Campo>
        </div>
        <div className={`text-sm rounded-lg px-3 py-2 border ${tokenOk ? 'border-emerald-500/30 text-emerald-300 bg-emerald-950/30' : 'border-amber-500/30 text-amber-300 bg-amber-950/30'}`}>
          {tokens == null ? 'Não consegui verificar o token do emissor.'
            : tokenOk ? `Token da Focus NFe de ${f.ambiente === 'producao' ? 'produção' : 'homologação'} configurado na Vercel.`
              : `Falta o token de ${f.ambiente === 'producao' ? 'produção' : 'homologação'}: na Vercel, crie a variável ${f.ambiente === 'producao' ? 'FOCUS_NFE_TOKEN_PRODUCAO' : 'FOCUS_NFE_TOKEN_HOMOLOGACAO'} e faça um novo deploy.`}
        </div>
      </SectionCard>

      <SectionCard title="Dados da Full Vision (prestador)">
        <div className="grid md:grid-cols-3 gap-4">
          <Campo label="CNPJ"><input value={f.cnpj_prestador || ''} onChange={set('cnpj_prestador')} className={inputCls} placeholder="00.000.000/0000-00" /></Campo>
          <Campo label="Razão social"><input value={f.razao_social || ''} onChange={set('razao_social')} className={inputCls} /></Campo>
          <Campo label="Inscrição municipal" ajuda={nacional ? 'Na NFS-e Nacional, deixe vazio se a prefeitura não pedir.' : null}>
            <input value={f.inscricao_municipal || ''} onChange={set('inscricao_municipal')} className={inputCls} />
          </Campo>
          <Campo label="Código IBGE da cidade" ajuda="7 dígitos. Ex.: São Paulo 3550308. Procure “código IBGE” + nome da cidade.">
            <input value={f.codigo_municipio || ''} onChange={set('codigo_municipio')} className={inputCls} inputMode="numeric" />
          </Campo>
          <Campo label="Simples Nacional">
            <select value={f.codigo_opcao_simples_nacional} onChange={set('codigo_opcao_simples_nacional')} className={inputCls}>
              {OPCOES_SIMPLES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Campo>
          <Campo label="Regime especial de tributação">
            <select value={f.regime_especial_tributacao} onChange={set('regime_especial_tributacao')} className={inputCls}>
              {REGIMES_ESPECIAIS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Campo>
        </div>
      </SectionCard>

      <SectionCard title="Serviço e impostos (peça ao contador)">
        <div className="grid md:grid-cols-3 gap-4">
          {nacional ? (
            <Campo label="Código de tributação nacional" ajuda="6 dígitos, ex.: 010701. O contador informa.">
              <input value={f.codigo_tributacao_nacional_iss || ''} onChange={set('codigo_tributacao_nacional_iss')} className={inputCls} inputMode="numeric" />
            </Campo>
          ) : (
            <Campo label="Item da lista de serviço (LC 116)" ajuda="Ex.: 01.07 ou 0107, como a prefeitura pede.">
              <input value={f.item_lista_servico || ''} onChange={set('item_lista_servico')} className={inputCls} />
            </Campo>
          )}
          <Campo label="Código de tributação municipal" ajuda="Só se a prefeitura pedir.">
            <input value={f.codigo_tributacao_municipal_iss || ''} onChange={set('codigo_tributacao_municipal_iss')} className={inputCls} />
          </Campo>
          <Campo label="CNAE" ajuda="Opcional na maioria das cidades.">
            <input value={f.codigo_cnae || ''} onChange={set('codigo_cnae')} className={inputCls} inputMode="numeric" />
          </Campo>
          {nacional && (
            <Campo label="Código NBS" ajuda="Opcional; o contador informa se precisar.">
              <input value={f.codigo_nbs || ''} onChange={set('codigo_nbs')} className={inputCls} inputMode="numeric" />
            </Campo>
          )}
          <Campo label="Alíquota do ISS (%)" ajuda={nacional ? 'No Simples Nacional pode ficar vazio.' : 'Ex.: 2 ou 5.'}>
            <input value={f.aliquota_iss ?? ''} onChange={set('aliquota_iss')} className={inputCls} inputMode="decimal" />
          </Campo>
          <Campo label="Tributos aproximados (%)" ajuda="Opcional (Lei da Transparência).">
            <input value={f.percentual_tributos ?? ''} onChange={set('percentual_tributos')} className={inputCls} inputMode="decimal" />
          </Campo>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(f.iss_retido)} onChange={set('iss_retido')} /> ISS retido pelo cliente</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(f.enviar_email_tomador)} onChange={set('enviar_email_tomador')} /> Mandar a nota por e-mail para o financeiro do cliente</label>
        </div>
      </SectionCard>

      <SectionCard title="Texto da nota">
        <Campo label="Modelo da descrição" ajuda="Pode usar: {competencia} (novembro de 2026), {mes} (11/2026), {qtd_placas}, {placas}, {valor}, {cliente}.">
          <textarea rows={4} value={f.modelo_discriminacao} onChange={set('modelo_discriminacao')} className={inputCls} />
        </Campo>
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-400 hover:text-white">Avançado: campos extras exigidos pela prefeitura</summary>
          <div className="mt-3">
            <Campo label="Campos extras (JSON)" ajuda='Só se a Focus ou o contador pedir um campo a mais. Ex.: {"codigo_tributacao_municipal_iss": "123"}. Entra por cima do que o site monta.'>
              <textarea rows={4} value={f.campos_extras_txt} onChange={set('campos_extras_txt')} className={`${inputCls} font-mono text-xs`} />
            </Campo>
          </div>
        </details>
      </SectionCard>

      <div className="flex items-center gap-4">
        <button type="button" disabled={salvando} onClick={salvar} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-semibold">
          {salvando && <FaSpinner className="animate-spin" />} Salvar configuração
        </button>
        {falta.length > 0 && <span className="text-sm text-amber-300">Ainda falta: {falta.join(', ')}.</span>}
      </div>
    </div>
  );
}
