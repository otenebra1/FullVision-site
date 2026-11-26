// components/financeiro/ReceberPanel.jsx
// Aba "A receber" do /financeiro (só ADM): contas a receber dos clientes e cobrança por boleto/PIX (Asaas).
//   Contas        → tudo que os clientes devem: em aberto, vencido, pago. Gera boleto/PIX, copia o PIX, dá baixa.
//   Gerar do mês  → cria as contas das mensalidades do mês (puxa a NF emitida, se tiver).
//   Configuração  → ambiente do Asaas (teste/produção), multa, juros, desconto, dia padrão.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FaSpinner, FaCheckCircle, FaExclamationCircle, FaBarcode, FaCopy, FaSyncAlt, FaBan, FaExternalLinkAlt,
  FaPlus, FaEdit, FaHandHoldingUsd, FaFileCsv,
} from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { comMensalidadeEfetiva } from '../../lib/veiculos';
import { tableWrap, theadClass, tbodyClass, rowClass, Dash, StatStrip, SectionCard, Th, SearchInput, inputBase, norm } from '../admin/ui';
import { montarLinhaMes, mesAtual, competenciaCurta, competenciaIso, CONFIG_PADRAO as NF_CONFIG_PADRAO } from '../../lib/notasFiscais';
import {
  STATUS_RECEB, FORMAS_RECEB, FORMAS_ASAAS, TIPOS_RECEB, AMBIENTES_ASAAS, CONFIG_COBRANCA_PADRAO,
  situacao, infoSituacao, vencimentoSugerido, hojeIsoLocal, ROTULO_ASAAS, problemasCliente,
} from '../../lib/cobranca';
import { reais, dataBR, rotulo, baixarCsv } from '../../lib/financeiro';

async function api(corpo) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch('/api/cobranca/acao', {
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
const lerValor = (s) => Number(String(s ?? '').replace(/\./g, '').replace(',', '.')) || 0;

function SubAbas({ abas, ativa, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-gray-900 border border-gray-800">
      {abas.map(a => (
        <button key={a.key} type="button" onClick={() => onChange(a.key)}
          className={`px-3.5 py-1.5 rounded-lg text-sm transition-colors ${ativa === a.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
          {a.label}
        </button>
      ))}
    </div>
  );
}

function Badge({ r }) {
  const s = infoSituacao(situacao(r));
  return <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${s.badge}`}>{s.label}</span>;
}

function Modal({ titulo, children, onClose, largura = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-gray-900 border border-gray-700 rounded-2xl ${largura} w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white">{titulo}</h3>
        {children}
      </div>
    </div>
  );
}

export default function ReceberPanel({ showToast }) {
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');
  const [config, setConfig] = useState(CONFIG_COBRANCA_PADRAO);
  const [nfConfig, setNfConfig] = useState(NF_CONFIG_PADRAO);
  const [contas, setContas] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [notas, setNotas] = useState([]);
  const [chaves, setChaves] = useState(null);
  const [aba, setAba] = useState('contas');

  const carregar = useCallback(async () => {
    const [c, r, e, v, n, nc] = await Promise.all([
      supabase.from('fin_cobranca_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('fin_recebimentos').select('*').order('vencimento', { ascending: false }),
      supabase.from('empresas').select('*').order('nome'),
      supabase.from('veiculos').select('id, placa, empresa_id, mensalidade, servicos, status, data_inst, data_desinst').order('placa'),
      supabase.from('nf_notas').select('id, empresa_id, competencia, status, ambiente, numero, valor, avulsa, url_pdf, created_at'),
      supabase.from('nf_config').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (c.error || r.error) {
      const msg = (c.error || r.error).message;
      setErroCarga(/fin_cobranca_config|fin_recebimentos/.test(msg) ? 'As tabelas de contas a receber ainda não existem. Rode o SQL 20261126e_contas_receber.sql no Supabase.' : msg);
    } else setErroCarga('');
    setConfig({ ...CONFIG_COBRANCA_PADRAO, ...(c.data || {}) });
    setContas(r.data || []);
    setEmpresas(e.data || []);
    setVeiculos((v.data || []).map(comMensalidadeEfetiva));
    setNotas(n.data || []);
    setNfConfig({ ...NF_CONFIG_PADRAO, ...(nc.data || {}) });
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
    api({ acao: 'situacao' }).then(setChaves).catch(() => setChaves(null));
  }, [carregar]);

  const juntar = useCallback((novas) => {
    setContas(atual => {
      const map = new Map(atual.map(x => [x.id, x]));
      (novas || []).filter(Boolean).forEach(x => { if (x.id) map.set(x.id, { ...map.get(x.id), ...x }); });
      return [...map.values()].sort((a, b) => String(b.vencimento).localeCompare(String(a.vencimento)));
    });
  }, []);

  const empresaPorId = useMemo(() => Object.fromEntries(empresas.map(e => [String(e.id), e])), [empresas]);
  const producao = config.ambiente === 'producao';
  const semChave = chaves && !chaves[config.ambiente];

  if (carregando) {
    return <div className="flex items-center justify-center py-24 text-gray-500"><FaSpinner className="animate-spin text-2xl mr-3" /> Carregando contas a receber...</div>;
  }

  const vencidas = contas.filter(r => situacao(r) === 'VENCIDO').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SubAbas
          ativa={aba} onChange={setAba}
          abas={[
            { key: 'contas', label: `Contas${vencidas ? ' •' : ''}` },
            { key: 'gerar', label: 'Gerar do mês' },
            { key: 'config', label: `Configuração${semChave ? ' •' : ''}` },
          ]}
        />
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${producao ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
          ASAAS {producao ? 'PRODUÇÃO' : 'SANDBOX (teste)'}
        </span>
      </div>

      {erroCarga && (
        <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3">
          <FaExclamationCircle className="mt-0.5 shrink-0" /> {erroCarga}
        </div>
      )}
      {!erroCarga && semChave && aba !== 'config' && (
        <button type="button" onClick={() => setAba('config')} className="w-full text-left flex items-start gap-2 text-sm text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3 hover:border-amber-400/50">
          <FaExclamationCircle className="mt-0.5 shrink-0" />
          Falta a chave do Asaas ({producao ? 'ASAAS_TOKEN_PRODUCAO' : 'ASAAS_TOKEN_SANDBOX'}) na Vercel. Dá para lançar e dar baixa à mão, mas não gerar boleto/PIX. Clique para ver como.
        </button>
      )}

      {aba === 'contas' && (
        <ContasPanel contas={contas} empresas={empresas} empresaPorId={empresaPorId} config={config} podeAsaas={!semChave}
          showToast={showToast} juntar={juntar} />
      )}
      {aba === 'gerar' && (
        <GerarMesPanel empresas={empresas} veiculos={veiculos} notas={notas} nfConfig={nfConfig} contas={contas} config={config}
          podeAsaas={!semChave} showToast={showToast} juntar={juntar} irContas={() => setAba('contas')} />
      )}
      {aba === 'config' && (
        <ConfigCobranca config={config} chaves={chaves} showToast={showToast} onSaved={(c) => setConfig({ ...CONFIG_COBRANCA_PADRAO, ...c })} />
      )}
    </div>
  );
}

// =====================================================================
// Contas
// =====================================================================
const FILTROS = [
  { key: 'abertas', label: 'Em aberto', teste: (s) => s === 'ABERTO' || s === 'VENCIDO' },
  { key: 'vencidas', label: 'Vencidas', teste: (s) => s === 'VENCIDO' },
  { key: 'pagas', label: 'Pagas', teste: (s) => s === 'PAGO' },
  { key: 'canceladas', label: 'Canceladas', teste: (s) => s === 'CANCELADO' },
  { key: 'todas', label: 'Todas', teste: () => true },
];

function ContasPanel({ contas, empresas, empresaPorId, config, podeAsaas, showToast, juntar }) {
  const [filtro, setFiltro] = useState('abertas');
  const [busca, setBusca] = useState('');
  const [ocupado, setOcupado] = useState(null); // id da conta em ação
  const [editar, setEditar] = useState(null);
  const [baixar, setBaixar] = useState(null);
  const [cancelar, setCancelar] = useState(null);
  const [mostrarPix, setMostrarPix] = useState(null);

  const hoje = hojeIsoLocal();
  const mesHoje = hoje.slice(0, 7);
  const em30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();

  const resumo = useMemo(() => {
    const ab = contas.filter(r => r.status === 'ABERTO');
    return {
      aberto: ab.reduce((s, r) => s + Number(r.valor), 0),
      vencido: ab.filter(r => r.vencimento < hoje).reduce((s, r) => s + Number(r.valor), 0),
      qtdVencido: ab.filter(r => r.vencimento < hoje).length,
      prox30: ab.filter(r => r.vencimento >= hoje && r.vencimento <= em30).reduce((s, r) => s + Number(r.valor), 0),
      recebidoMes: contas.filter(r => r.status === 'PAGO' && String(r.data_pagamento || '').slice(0, 7) === mesHoje)
        .reduce((s, r) => s + Number(r.valor_pago ?? r.valor), 0),
    };
  }, [contas, hoje, em30, mesHoje]);

  const teste = FILTROS.find(f => f.key === filtro)?.teste || (() => true);
  const lista = contas
    .filter(r => teste(situacao(r)))
    .filter(r => !busca || norm(`${empresaPorId[String(r.empresa_id)]?.nome || ''} ${r.descricao} ${r.linha_digitavel || ''}`).includes(norm(busca)))
    .sort((a, b) => (filtro === 'pagas' || filtro === 'todas'
      ? String(b.vencimento).localeCompare(String(a.vencimento))
      : String(a.vencimento).localeCompare(String(b.vencimento))));

  const acao = async (r, corpo, msgOk) => {
    setOcupado(r.id);
    try {
      const j = await api({ ...corpo, ids: [r.id] });
      if (j.resultados) {
        const x = j.resultados[0];
        juntar([x.recebimento]);
        if (!x.ok) throw new Error(x.erro);
      } else juntar(j.recebimentos);
      if (msgOk) showToast(msgOk);
    } catch (e) { showToast(e.message, 'error'); }
    setOcupado(null);
  };

  const atualizarTodas = async () => {
    const ids = contas.filter(r => r.status === 'ABERTO' && r.asaas_id).map(r => r.id);
    if (!ids.length) { showToast('Nenhum boleto em aberto para conferir.'); return; }
    setOcupado('todas');
    try {
      for (let i = 0; i < ids.length; i += 20) {
        const j = await api({ acao: 'atualizar', ids: ids.slice(i, i + 20) });
        juntar(j.recebimentos);
      }
      showToast('Situação dos boletos atualizada.');
    } catch (e) { showToast(e.message, 'error'); }
    setOcupado(null);
  };

  const copiar = async (texto, o) => {
    try { await navigator.clipboard.writeText(texto); showToast(`${o} copiado.`); } catch { showToast('Não consegui copiar.', 'error'); }
  };

  const exportar = () => {
    baixarCsv('contas-a-receber.csv',
      ['Cliente', 'Descrição', 'Tipo', 'Vencimento', 'Valor', 'Situação', 'Pago em', 'Valor pago', 'Forma'],
      lista.map(r => [
        empresaPorId[String(r.empresa_id)]?.nome || '', r.descricao, rotulo(TIPOS_RECEB, r.tipo), dataBR(r.vencimento),
        String(r.valor).replace('.', ','), infoSituacao(situacao(r)).label, dataBR(r.data_pagamento),
        r.valor_pago != null ? String(r.valor_pago).replace('.', ',') : '', rotulo(FORMAS_RECEB, r.forma),
      ]));
  };

  return (
    <div className="space-y-6">
      <StatStrip
        colsClass="grid-cols-2 lg:grid-cols-4"
        items={[
          { label: 'Em aberto (total)', value: reais(resumo.aberto) },
          { label: `Vencido (${resumo.qtdVencido})`, value: reais(resumo.vencido), valueClass: resumo.vencido > 0 ? 'text-red-300' : 'text-white' },
          { label: 'Vence nos próximos 30 dias', value: reais(resumo.prox30) },
          { label: 'Recebido este mês', value: reais(resumo.recebidoMes), valueClass: 'text-emerald-300' },
        ]}
      />

      <SectionCard
        title="Contas a receber"
        action={(
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={atualizarTodas} disabled={ocupado === 'todas' || !podeAsaas}
              className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2 disabled:opacity-40">
              {ocupado === 'todas' ? <FaSpinner className="animate-spin" /> : <FaSyncAlt size={11} />} Conferir pagamentos
            </button>
            <button type="button" onClick={exportar} className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2">
              <FaFileCsv size={12} /> CSV
            </button>
            <button type="button" onClick={() => setEditar({})} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-lg text-sm font-semibold">
              <FaPlus size={11} /> Nova conta
            </button>
          </div>
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-gray-950 border border-gray-800">
            {FILTROS.map(f => (
              <button key={f.key} type="button" onClick={() => setFiltro(f.key)}
                className={`px-3 py-1.5 rounded-lg text-sm ${filtro === f.key ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar cliente ou descrição" />
        </div>

        <div className={tableWrap}>
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <Th>Cliente</Th>
                <Th>Descrição</Th>
                <Th>Vencimento</Th>
                <Th align="right">Valor</Th>
                <Th>Situação</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {lista.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">Nenhuma conta aqui. Use "Gerar do mês" ou "Nova conta".</td></tr>
              )}
              {lista.map(r => {
                const emp = empresaPorId[String(r.empresa_id)];
                const st = situacao(r);
                const aberta = r.status === 'ABERTO';
                const carregandoEsta = ocupado === r.id;
                return (
                  <tr key={r.id} className={rowClass}>
                    <td className="px-4 py-3">
                      <div className="text-white">{emp?.nome || <Dash />}</div>
                      <div className="text-xs text-gray-500">{rotulo(TIPOS_RECEB, r.tipo)}{r.competencia ? ` · ${competenciaCurta(r.competencia)}` : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-300 max-w-xs">
                      <div className="truncate" title={r.descricao}>{r.descricao}</div>
                      {r.mensagem && aberta && !r.asaas_id && <div className="text-xs text-red-300">{r.mensagem}</div>}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap tabular-nums ${st === 'VENCIDO' ? 'text-red-300' : 'text-gray-300'}`}>{dataBR(r.vencimento)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-white whitespace-nowrap">
                      {reais(r.valor)}
                      {r.status === 'PAGO' && r.valor_pago != null && Number(r.valor_pago) !== Number(r.valor) && (
                        <div className="text-xs text-emerald-300">pago {reais(r.valor_pago)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Badge r={r} />
                        {r.status === 'PAGO' && r.data_pagamento && <span className="text-xs text-gray-500">em {dataBR(r.data_pagamento)}</span>}
                        {r.asaas_id && aberta && <span className="text-xs text-gray-500">{ROTULO_ASAAS[r.asaas_status] || r.asaas_status}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {carregandoEsta ? <FaSpinner className="animate-spin inline text-gray-400" /> : (
                        <div className="inline-flex items-center gap-0.5">
                          {aberta && !r.asaas_id && podeAsaas && (
                            <button type="button" onClick={() => acao(r, { acao: 'gerar' }, 'Boleto/PIX gerado.')}
                              className="text-sm text-blue-300 hover:text-white border border-blue-500/40 rounded-lg px-2.5 py-1 mr-1 inline-flex items-center gap-1.5" title="Gerar boleto/PIX no Asaas">
                              <FaBarcode size={12} /> Gerar
                            </button>
                          )}
                          {r.link_fatura && (
                            <a href={r.link_fatura} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-800" title="Abrir a fatura (boleto e PIX) para mandar ao cliente">
                              <FaExternalLinkAlt size={12} />
                            </a>
                          )}
                          {aberta && (r.pix_copia_cola || r.linha_digitavel || r.link_fatura) && (
                            <button type="button" onClick={() => setMostrarPix(r)} className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-800" title="Copiar PIX / linha digitável / link">
                              <FaCopy size={12} />
                            </button>
                          )}
                          {aberta && r.asaas_id && (
                            <button type="button" onClick={() => acao(r, { acao: 'atualizar' }, 'Conferido no Asaas.')} className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-800" title="Conferir se pagou">
                              <FaSyncAlt size={12} />
                            </button>
                          )}
                          {aberta && !r.asaas_id && (
                            <button type="button" onClick={() => setEditar(r)} className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-800" title="Editar">
                              <FaEdit size={12} />
                            </button>
                          )}
                          {aberta && (
                            <button type="button" onClick={() => setBaixar(r)} className="text-gray-400 hover:text-emerald-300 p-2 rounded-md hover:bg-gray-800" title="Dar baixa (recebido)">
                              <FaHandHoldingUsd size={13} />
                            </button>
                          )}
                          {aberta && (
                            <button type="button" onClick={() => setCancelar(r)} className="text-gray-400 hover:text-red-300 p-2 rounded-md hover:bg-gray-800" title="Cancelar">
                              <FaBan size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">
          Com o webhook do Asaas ligado, o pagamento cai aqui sozinho. Sem ele, use "Conferir pagamentos".
          Multa {Number(config.multa_percentual)}% e juros {Number(config.juros_mensal)}% ao mês valem para os boletos novos.
        </p>
      </SectionCard>

      {editar && (
        <EditarConta inicial={editar} empresas={empresas} config={config} podeAsaas={podeAsaas}
          onClose={() => setEditar(null)}
          onSaved={async (salva, gerarAgora) => {
            setEditar(null);
            juntar([salva]);
            if (gerarAgora) await acao(salva, { acao: 'gerar' }, 'Conta salva e boleto/PIX gerado.');
            else showToast('Conta salva.');
          }}
          showToast={showToast} />
      )}
      {baixar && (
        <BaixarConta conta={baixar} onClose={() => setBaixar(null)}
          onConfirm={async (d) => { const r = baixar; setBaixar(null); await acao(r, { acao: 'baixar', ...d }, 'Baixa registrada.'); }} />
      )}
      {cancelar && (
        <Modal titulo="Cancelar esta conta?" onClose={() => setCancelar(null)} largura="max-w-sm">
          <p className="text-sm text-gray-300">{cancelar.descricao} · {reais(cancelar.valor)}</p>
          {cancelar.asaas_id && <p className="text-sm text-amber-300">O boleto/PIX também será cancelado no Asaas.</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={async () => { const r = cancelar; setCancelar(null); await acao(r, { acao: 'cancelar' }, 'Conta cancelada.'); }}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Cancelar conta</button>
            <button type="button" onClick={() => setCancelar(null)} className="text-gray-400 hover:text-white text-sm px-2">Voltar</button>
          </div>
        </Modal>
      )}
      {mostrarPix && (
        <Modal titulo="Mandar para o cliente" onClose={() => setMostrarPix(null)}>
          <p className="text-sm text-gray-400">{empresaPorId[String(mostrarPix.empresa_id)]?.nome} · {reais(mostrarPix.valor)} · vence {dataBR(mostrarPix.vencimento)}</p>
          {mostrarPix.link_fatura && (
            <div className="space-y-1.5">
              <div className="text-sm text-gray-300">Link da fatura (boleto + PIX)</div>
              <div className="flex gap-2"><input readOnly value={mostrarPix.link_fatura} className={inputCls} /><button type="button" onClick={() => copiar(mostrarPix.link_fatura, 'Link')} className="shrink-0 border border-gray-700 rounded-lg px-3 text-sm text-gray-300 hover:text-white">Copiar</button></div>
            </div>
          )}
          {mostrarPix.pix_copia_cola && (
            <div className="space-y-1.5">
              <div className="text-sm text-gray-300">PIX copia e cola</div>
              <div className="flex gap-2"><textarea readOnly rows={3} value={mostrarPix.pix_copia_cola} className={inputCls} /><button type="button" onClick={() => copiar(mostrarPix.pix_copia_cola, 'PIX')} className="shrink-0 border border-gray-700 rounded-lg px-3 text-sm text-gray-300 hover:text-white">Copiar</button></div>
            </div>
          )}
          {mostrarPix.linha_digitavel && (
            <div className="space-y-1.5">
              <div className="text-sm text-gray-300">Linha digitável do boleto</div>
              <div className="flex gap-2"><input readOnly value={mostrarPix.linha_digitavel} className={inputCls} /><button type="button" onClick={() => copiar(mostrarPix.linha_digitavel, 'Linha digitável')} className="shrink-0 border border-gray-700 rounded-lg px-3 text-sm text-gray-300 hover:text-white">Copiar</button></div>
            </div>
          )}
          {mostrarPix.link_boleto && <a href={mostrarPix.link_boleto} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-white"><FaExternalLinkAlt size={11} /> Abrir o PDF do boleto</a>}
          <div className="pt-2"><button type="button" onClick={() => setMostrarPix(null)} className="text-gray-400 hover:text-white text-sm">Fechar</button></div>
        </Modal>
      )}
    </div>
  );
}

function EditarConta({ inicial, empresas, config, podeAsaas, onClose, onSaved, showToast }) {
  const novo = !inicial.id;
  const [f, setF] = useState({
    empresa_id: inicial.empresa_id ? String(inicial.empresa_id) : '',
    tipo: inicial.tipo || 'AVULSA',
    descricao: inicial.descricao || '',
    valor: inicial.valor ? String(inicial.valor).replace('.', ',') : '',
    vencimento: inicial.vencimento || vencimentoSugerido(null, config.dia_vencimento),
    forma: inicial.forma || config.forma_padrao,
    observacao: inicial.observacao || '',
  });
  const [gerarAgora, setGerarAgora] = useState(novo && podeAsaas);
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const emp = empresas.find(e => String(e.id) === f.empresa_id);
  const asaasForma = FORMAS_ASAAS.includes(f.forma);

  useEffect(() => {
    if (novo && emp) set('vencimento', vencimentoSugerido(emp.dia_vencimento_boleto, config.dia_vencimento));
  }, [f.empresa_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async () => {
    const valor = lerValor(f.valor);
    if (!f.empresa_id) return showToast('Escolha o cliente.', 'error');
    if (!f.descricao.trim()) return showToast('Escreva a descrição.', 'error');
    if (!(valor > 0)) return showToast('Valor inválido.', 'error');
    if (!f.vencimento) return showToast('Informe o vencimento.', 'error');
    if (gerarAgora && asaasForma && emp && problemasCliente(emp).length) return showToast(`Cadastro do cliente sem ${problemasCliente(emp).join(', ')}.`, 'error');
    setSalvando(true);
    const linha = {
      empresa_id: emp.id, tipo: f.tipo, descricao: f.descricao.trim(), valor, vencimento: f.vencimento,
      forma: f.forma, observacao: f.observacao || null,
    };
    const q = novo ? supabase.from('fin_recebimentos').insert(linha) : supabase.from('fin_recebimentos').update(linha).eq('id', inicial.id);
    const { data, error } = await q.select('*').single();
    setSalvando(false);
    if (error) return showToast(error.message, 'error');
    onSaved(data, gerarAgora && asaasForma);
    return null;
  };

  return (
    <Modal titulo={novo ? 'Nova conta a receber' : 'Editar conta'} onClose={onClose}>
      <Campo label="Cliente">
        <select value={f.empresa_id} onChange={e => set('empresa_id', e.target.value)} className={inputCls}>
          <option value="">Escolha...</option>
          {empresas.map(e => <option key={e.id} value={String(e.id)}>{e.nome}</option>)}
        </select>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Tipo">
          <select value={f.tipo} onChange={e => set('tipo', e.target.value)} className={inputCls}>
            {TIPOS_RECEB.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Campo>
        <Campo label="Valor (R$)">
          <input value={f.valor} onChange={e => set('valor', e.target.value)} inputMode="decimal" placeholder="0,00" className={inputCls} />
        </Campo>
      </div>
      <Campo label="Descrição (aparece no boleto)">
        <input value={f.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Ex.: Instalação de 3 rastreadores" className={inputCls} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Vencimento" ajuda={emp?.dia_vencimento_boleto ? `Dia do boleto do cliente: ${emp.dia_vencimento_boleto}` : undefined}>
          <input type="date" value={f.vencimento} onChange={e => set('vencimento', e.target.value)} className={inputCls} />
        </Campo>
        <Campo label="Forma">
          <select value={f.forma} onChange={e => set('forma', e.target.value)} className={inputCls}>
            {FORMAS_RECEB.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Campo>
      </div>
      <Campo label="Observação (só aqui dentro)">
        <input value={f.observacao} onChange={e => set('observacao', e.target.value)} className={inputCls} />
      </Campo>
      {novo && asaasForma && podeAsaas && (
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={gerarAgora} onChange={e => setGerarAgora(e.target.checked)} /> Já gerar o boleto/PIX no Asaas
        </label>
      )}
      <div className="flex gap-3 pt-2">
        <button type="button" disabled={salvando} onClick={salvar} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
          {salvando && <FaSpinner className="animate-spin" />} Salvar
        </button>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
      </div>
    </Modal>
  );
}

function BaixarConta({ conta, onClose, onConfirm }) {
  const [dataPag, setDataPag] = useState(hojeIsoLocal());
  const [valor, setValor] = useState(String(conta.valor).replace('.', ','));
  const [forma, setForma] = useState(FORMAS_ASAAS.includes(conta.forma) ? 'TRANSFERENCIA' : (conta.forma || 'TRANSFERENCIA'));
  return (
    <Modal titulo="Dar baixa: cliente pagou" onClose={onClose} largura="max-w-sm">
      <p className="text-sm text-gray-400">{conta.descricao}</p>
      <Campo label="Data do pagamento"><input type="date" value={dataPag} onChange={e => setDataPag(e.target.value)} className={inputCls} /></Campo>
      <Campo label="Valor recebido (R$)"><input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" className={inputCls} /></Campo>
      <Campo label="Como pagou">
        <select value={forma} onChange={e => setForma(e.target.value)} className={inputCls}>
          {FORMAS_RECEB.filter(x => !['UNDEFINED'].includes(x.value)).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </Campo>
      {conta.asaas_id && <p className="text-xs text-amber-300">O boleto no Asaas será marcado como "recebido em dinheiro" para o cliente não ser cobrado de novo.</p>}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => onConfirm({ data_pagamento: dataPag, valor: lerValor(valor), forma })}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Confirmar baixa</button>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
      </div>
    </Modal>
  );
}

// =====================================================================
// Gerar do mês: mensalidades (puxa a NF do mês, se já foi emitida)
// =====================================================================
function GerarMesPanel({ empresas, veiculos, notas, nfConfig, contas, config, podeAsaas, showToast, juntar, irContas }) {
  const [mes, setMes] = useState(mesAtual());
  const [busca, setBusca] = useState('');
  const [marcadas, setMarcadas] = useState(new Set());
  const [gerarBoleto, setGerarBoleto] = useState(podeAsaas);
  const [rodando, setRodando] = useState(null);
  const [resultado, setResultado] = useState(null);

  useEffect(() => { setMarcadas(new Set()); setResultado(null); }, [mes]);
  useEffect(() => { setGerarBoleto(podeAsaas); }, [podeAsaas]);

  const competencia = competenciaIso(mes);
  const linhas = useMemo(() => empresas
    .map(empresa => {
      const l = montarLinhaMes({ empresa, veiculos, mes, config: nfConfig, notas });
      const conta = contas.find(c => String(c.empresa_id) === String(empresa.id) && c.tipo === 'MENSALIDADE'
        && String(c.competencia || '').slice(0, 10) === competencia && c.status !== 'CANCELADO');
      const notaOk = l.nota && l.nota.status === 'AUTORIZADA' ? l.nota : null;
      const valor = notaOk ? Number(notaOk.valor) : l.valor;
      return { ...l, conta, notaOk, valor, vencimento: vencimentoSugerido(empresa.dia_vencimento_boleto, config.dia_vencimento) };
    })
    .filter(l => l.placas.length > 0 || l.nota || l.conta)
    .filter(l => !busca || norm(`${l.empresa.nome} ${l.empresa.razao_social || ''}`).includes(norm(busca))),
  [empresas, veiculos, mes, nfConfig, notas, contas, competencia, config.dia_vencimento, busca]);

  const prontas = linhas.filter(l => !l.conta && l.valor > 0);
  const escolhidas = prontas.filter(l => marcadas.has(String(l.empresa.id)));
  const alternar = (id) => setMarcadas(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const todas = () => setMarcadas(escolhidas.length === prontas.length ? new Set() : new Set(prontas.map(l => String(l.empresa.id))));

  const criar = async () => {
    if (!escolhidas.length) return;
    setResultado(null);
    setRodando({ feitas: 0, total: escolhidas.length });
    const linhasNovas = escolhidas.map(l => ({
      empresa_id: l.empresa.id,
      tipo: 'MENSALIDADE',
      competencia,
      descricao: `Mensalidade de rastreamento ${competenciaCurta(mes)} · ${l.placas.length} placa(s)${l.notaOk?.numero ? ` · NFS-e nº ${l.notaOk.numero}` : ''}`,
      valor: Math.round(l.valor * 100) / 100,
      vencimento: l.vencimento,
      forma: config.forma_padrao,
      nota_id: l.notaOk?.id || null,
    }));
    const { data: criadas, error } = await supabase.from('fin_recebimentos').insert(linhasNovas).select('*');
    if (error) { setRodando(null); showToast(error.message, 'error'); return; }
    juntar(criadas);
    const res = criadas.map(c => ({ id: c.id, nome: empresas.find(e => String(e.id) === String(c.empresa_id))?.nome, ok: true, msg: 'conta criada' }));
    if (gerarBoleto) {
      for (let i = 0; i < criadas.length; i += 5) {
        const lote = criadas.slice(i, i + 5);
        try {
          const { resultados } = await api({ acao: 'gerar', ids: lote.map(c => c.id) });
          juntar(resultados.map(x => x.recebimento));
          resultados.forEach(x => {
            const item = res.find(y => y.id === x.id);
            if (item) { item.ok = x.ok; item.msg = x.ok ? 'conta criada e boleto/PIX gerado' : `conta criada, boleto com erro: ${x.erro}`; }
          });
        } catch (e) {
          lote.forEach(c => { const item = res.find(y => y.id === c.id); if (item) { item.ok = false; item.msg = `conta criada, boleto com erro: ${e.message}`; } });
        }
        setRodando({ feitas: Math.min(i + 5, criadas.length), total: criadas.length });
      }
    }
    setRodando(null);
    setMarcadas(new Set());
    setResultado(res);
    const ok = res.filter(x => x.ok).length;
    showToast(ok === res.length ? `${ok} conta(s) criada(s).` : `${ok} de ${res.length} sem erro. Veja abaixo.`, ok === res.length ? 'success' : 'error');
  };

  return (
    <div className="space-y-6">
      <SectionCard title={`Mensalidades de ${competenciaCurta(mes)}`}>
        <div className="flex flex-wrap items-end gap-3">
          <Campo label="Mês (competência)">
            <input type="month" value={mes} onChange={e => e.target.value && setMes(e.target.value)} className={`px-3 py-2 ${inputBase}`} />
          </Campo>
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar cliente" />
          {podeAsaas && (
            <label className="flex items-center gap-2 text-sm text-gray-300 pb-2">
              <input type="checkbox" checked={gerarBoleto} onChange={e => setGerarBoleto(e.target.checked)} /> Já gerar boleto/PIX no Asaas
            </label>
          )}
          <button type="button" disabled={!escolhidas.length || Boolean(rodando)} onClick={criar}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            {rodando ? <FaSpinner className="animate-spin" /> : <FaBarcode />}
            {rodando ? `Gerando ${rodando.feitas}/${rodando.total}...` : `Criar cobranças (${escolhidas.length}) · ${reais(escolhidas.reduce((s, l) => s + l.valor, 0))}`}
          </button>
        </div>

        {resultado && (
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between"><b>Resultado</b><button type="button" onClick={irContas} className="text-blue-300 hover:text-white text-sm">Ver em Contas</button></div>
            {resultado.map(x => (
              <div key={x.id} className={`flex gap-2 ${x.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                {x.ok ? <FaCheckCircle className="mt-0.5 shrink-0" /> : <FaExclamationCircle className="mt-0.5 shrink-0" />}
                <span><b>{x.nome}</b>: {x.msg}</span>
              </div>
            ))}
          </div>
        )}

        <div className={tableWrap}>
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th className="px-4 py-3 w-10"><input type="checkbox" aria-label="Marcar todas" checked={prontas.length > 0 && escolhidas.length === prontas.length} onChange={todas} disabled={!prontas.length} /></th>
                <Th>Cliente</Th>
                <Th>Placas</Th>
                <Th align="right">Valor</Th>
                <Th>Nota fiscal</Th>
                <Th>Vencimento</Th>
                <Th>Cobrança</Th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {linhas.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">Nenhum cliente com mensalidade neste mês.</td></tr>}
              {linhas.map(l => {
                const id = String(l.empresa.id);
                const pronta = !l.conta && l.valor > 0;
                return (
                  <tr key={id} className={rowClass}>
                    <td className="px-4 py-3"><input type="checkbox" disabled={!pronta} checked={pronta && marcadas.has(id)} onChange={() => alternar(id)} aria-label={`Marcar ${l.empresa.nome}`} /></td>
                    <td className="px-4 py-3">
                      <div className="text-white">{l.empresa.nome}</div>
                      {problemasCliente(l.empresa).length > 0 && <div className="text-xs text-amber-300">Sem {problemasCliente(l.empresa).join(', ')} (o Asaas pede)</div>}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-300">{l.placas.length}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-white whitespace-nowrap">{reais(l.conta ? l.conta.valor : l.valor)}</td>
                    <td className="px-4 py-3 text-xs">
                      {l.notaOk ? <span className="text-emerald-300">Emitida{l.notaOk.numero ? ` nº ${l.notaOk.numero}` : ''}</span>
                        : l.nota ? <span className="text-amber-300">Processando</span>
                          : <span className="text-gray-500">Não emitida</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-300 whitespace-nowrap">{dataBR(l.conta ? l.conta.vencimento : l.vencimento)}</td>
                    <td className="px-4 py-3">{l.conta ? <Badge r={l.conta} /> : <span className="text-xs text-gray-400">Ainda não criada</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">
          O valor é o da nota fiscal emitida no mês; sem nota, é a soma das mensalidades das placas. O vencimento é o próximo "dia do boleto" do cliente
          (cadastro do cliente) que esteja pelo menos 3 dias à frente; sem dia no cadastro, usa o dia {config.dia_vencimento}. Dá para mudar depois em Contas.
          Dica: emita as NFs antes, na aba Emitir NF, para o número da nota sair no boleto.
        </p>
      </SectionCard>
    </div>
  );
}

// =====================================================================
// Configuração
// =====================================================================
function ConfigCobranca({ config, chaves, showToast, onSaved }) {
  const [f, setF] = useState({ ...config });
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const salvar = async () => {
    setSalvando(true);
    const linha = {
      id: 1, ambiente: f.ambiente, forma_padrao: f.forma_padrao,
      dia_vencimento: Math.min(31, Math.max(1, Number(f.dia_vencimento) || 10)),
      multa_percentual: lerValor(f.multa_percentual), juros_mensal: lerValor(f.juros_mensal),
      desconto_valor: lerValor(f.desconto_valor), avisar_cliente: Boolean(f.avisar_cliente), updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('fin_cobranca_config').upsert(linha).select('*').single();
    setSalvando(false);
    if (error) return showToast(error.message, 'error');
    onSaved(data);
    showToast('Configuração salva.');
    return null;
  };

  const ok = (b) => (b ? <span className="text-emerald-300">configurada</span> : <span className="text-red-300">falta</span>);
  const site = typeof window !== 'undefined' ? window.location.origin : 'https://SEU-SITE';

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <SectionCard title="Cobrança">
        <div className="space-y-4">
          <Campo label="Ambiente do Asaas">
            <select value={f.ambiente} onChange={e => set('ambiente', e.target.value)} className={inputCls}>
              {AMBIENTES_ASAAS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Campo>
          <Campo label="Forma padrão" ajuda="O boleto do Asaas já vem com QR Code PIX junto.">
            <select value={f.forma_padrao} onChange={e => set('forma_padrao', e.target.value)} className={inputCls}>
              {FORMAS_RECEB.filter(x => FORMAS_ASAAS.includes(x.value)).map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Dia de vencimento padrão" ajuda="Para cliente sem dia no cadastro">
              <input type="number" min={1} max={31} value={f.dia_vencimento} onChange={e => set('dia_vencimento', e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Desconto até o vencimento (R$)">
              <input value={String(f.desconto_valor ?? '').replace('.', ',')} onChange={e => set('desconto_valor', e.target.value)} inputMode="decimal" className={inputCls} />
            </Campo>
            <Campo label="Multa por atraso (%)">
              <input value={String(f.multa_percentual ?? '').replace('.', ',')} onChange={e => set('multa_percentual', e.target.value)} inputMode="decimal" className={inputCls} />
            </Campo>
            <Campo label="Juros ao mês (%)">
              <input value={String(f.juros_mensal ?? '').replace('.', ',')} onChange={e => set('juros_mensal', e.target.value)} inputMode="decimal" className={inputCls} />
            </Campo>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={Boolean(f.avisar_cliente)} onChange={e => set('avisar_cliente', e.target.checked)} />
            O Asaas manda o boleto e os lembretes por e-mail/SMS ao cliente (vale para clientes novos no Asaas)
          </label>
          <button type="button" disabled={salvando} onClick={salvar} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
            {salvando && <FaSpinner className="animate-spin" />} Salvar configuração
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Ligar o Asaas (uma vez só)">
        <div className="space-y-3 text-sm text-gray-300">
          <p>Chaves na Vercel: teste {chaves ? ok(chaves.sandbox) : '…'} · produção {chaves ? ok(chaves.producao) : '…'} · webhook {chaves ? ok(chaves.webhook) : '…'}</p>
          <ol className="list-decimal pl-5 space-y-1.5 text-gray-400">
            <li>Crie a conta de teste em <b>sandbox.asaas.com</b> (e depois a de verdade em <b>asaas.com</b>).</li>
            <li>No Asaas: <b>Integrações &gt; Chave de API</b> &gt; gerar chave. Copie.</li>
            <li>Na Vercel: <b>Settings &gt; Environment Variables</b>, crie <code className="text-gray-200">ASAAS_TOKEN_SANDBOX</code> (e depois <code className="text-gray-200">ASAAS_TOKEN_PRODUCAO</code>) com a chave.</li>
            <li>Invente uma senha e crie também <code className="text-gray-200">ASAAS_WEBHOOK_TOKEN</code> com ela.</li>
            <li>No Asaas: <b>Integrações &gt; Webhooks</b> &gt; novo webhook com a URL <code className="text-gray-200 break-all">{site}/api/cobranca/webhook</code>, o mesmo token, eventos de <b>Cobranças</b>.</li>
            <li>Na Vercel, faça <b>Redeploy</b> para as variáveis valerem.</li>
          </ol>
          <p className="text-xs text-gray-500">No sandbox nenhum dinheiro é movimentado: dá para "pagar" o boleto de mentira no painel do Asaas e ver a baixa chegar aqui.</p>
        </div>
      </SectionCard>
    </div>
  );
}
