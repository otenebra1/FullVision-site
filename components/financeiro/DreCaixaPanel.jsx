// components/financeiro/DreCaixaPanel.jsx
// Aba "DRE e caixa" do /financeiro (só ADM).
//   DRE            → receita, impostos, custos, despesas e resultado mês a mês (competência ou caixa)
//   Fluxo de caixa → o que entrou, saiu e o que está previsto, com o saldo projetado
// Usa os gastos do /financeiro e as contas a receber (etapa 1). Nada é gravado, só o saldo de partida.
import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { FaSpinner, FaExclamationCircle, FaFileCsv, FaChevronRight, FaChevronDown, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { comMensalidadeEfetiva } from '../../lib/veiculos';
import { StatStrip, SectionCard, inputBase } from '../admin/ui';
import { reais, reaisCurto, dataBR, mesRotulo, baixarCsv, lerNumero } from '../../lib/financeiro';
import { LINHAS_DRE, montarDre, montarFluxo, proximosMovimentos, listaMeses, somaMes, mesHoje } from '../../lib/dre';

const pct = (x) => (x == null ? '—' : `${(x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const cor = (v) => (v < -0.004 ? 'text-red-300' : v > 0.004 ? 'text-emerald-300' : 'text-gray-400');

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

function Segmento({ valor, onChange, opcoes }) {
  return (
    <div className="inline-flex gap-1 p-1 rounded-xl bg-gray-950 border border-gray-800">
      {opcoes.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-lg text-sm ${valor === o.value ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function DreCaixaPanel({ despesas, categorias, fornecedores, showToast }) {
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState('');
  const [recebimentos, setRecebimentos] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [caixa, setCaixa] = useState({ saldo_inicial: 0, saldo_data: null });
  const [aba, setAba] = useState('dre');

  const carregar = useCallback(async () => {
    const [r, v, e, c] = await Promise.all([
      supabase.from('fin_recebimentos').select('id, empresa_id, tipo, competencia, valor, vencimento, status, data_pagamento, valor_pago, valor_liquido, descricao'),
      supabase.from('veiculos').select('id, placa, empresa_id, mensalidade, servicos, status, data_inst, data_desinst'),
      supabase.from('empresas').select('id, nome').order('nome'),
      supabase.from('fin_caixa_config').select('*').eq('id', 1).maybeSingle(),
    ]);
    const avisos = [];
    if (r.error) avisos.push('Contas a receber ainda não existem (rode o SQL 20261126e_contas_receber.sql): a receita sai só pela estimativa das placas.');
    if (c.error) avisos.push('Rode o SQL 20261126f_dre_fluxo_caixa.sql para guardar o saldo de partida do caixa.');
    setAviso(avisos.join(' '));
    setRecebimentos(r.data || []);
    setVeiculos((v.data || []).map(comMensalidadeEfetiva));
    setEmpresas(e.data || []);
    setCaixa(c.data || { saldo_inicial: 0, saldo_data: null });
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  if (carregando) {
    return <div className="flex items-center justify-center py-24 text-gray-500"><FaSpinner className="animate-spin text-2xl mr-3" /> Montando DRE e caixa...</div>;
  }

  return (
    <div className="space-y-6">
      <SubAbas ativa={aba} onChange={setAba} abas={[{ key: 'dre', label: 'DRE (resultado)' }, { key: 'fluxo', label: 'Fluxo de caixa' }]} />
      {aviso && (
        <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3">
          <FaExclamationCircle className="mt-0.5 shrink-0" /> {aviso}
        </div>
      )}
      {aba === 'dre' && (
        <DrePanel despesas={despesas} categorias={categorias} recebimentos={recebimentos} veiculos={veiculos} empresas={empresas} />
      )}
      {aba === 'fluxo' && (
        <FluxoPanel despesas={despesas} recebimentos={recebimentos} veiculos={veiculos} empresas={empresas} fornecedores={fornecedores}
          caixa={caixa} onCaixa={setCaixa} showToast={showToast} />
      )}
    </div>
  );
}

// =====================================================================
// DRE
// =====================================================================
function DrePanel({ despesas, categorias, recebimentos, veiculos, empresas }) {
  const hoje = mesHoje();
  const anoAtual = Number(hoje.slice(0, 4));
  const [periodo, setPeriodo] = useState('12m');
  const [regime, setRegime] = useState('competencia');
  const [estimar, setEstimar] = useState(true);
  const [abertas, setAbertas] = useState(new Set());

  const meses = useMemo(() => {
    if (periodo === '12m') return listaMeses(somaMes(hoje, -11), hoje);
    return listaMeses(`${periodo}-01`, `${periodo}-12`);
  }, [periodo, hoje]);

  const dre = useMemo(() => montarDre({ meses, despesas, categorias, recebimentos, veiculos, empresas, regime, estimar }),
    [meses, despesas, categorias, recebimentos, veiculos, empresas, regime, estimar]);

  const alternar = (k) => setAbertas(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const t = dre.total;

  const exportar = () => {
    const cab = ['Linha', ...dre.meses.map(m => mesRotulo(m.mes)), 'Total'];
    const num = (v) => String(v ?? 0).replace('.', ',');
    const linhas = [];
    LINHAS_DRE.forEach(l => {
      linhas.push([l.label, ...dre.meses.map(m => num(m[l.key])), num(t[l.key])]);
      if (!l.total) {
        Object.keys(t.detalhe[l.key] || {}).forEach(n => linhas.push([`   ${n}`, ...dre.meses.map(m => num(m.detalhe[l.key][n] || 0)), num(t.detalhe[l.key][n])]));
      }
    });
    linhas.push(['Margem', ...dre.meses.map(m => pct(m.margem)), pct(t.margem)]);
    baixarCsv(`dre-${regime}-${meses[0]}-a-${meses[meses.length - 1]}.csv`, cab, linhas);
  };

  const anos = [anoAtual, anoAtual - 1, anoAtual - 2];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Segmento valor={periodo} onChange={setPeriodo} opcoes={[{ value: '12m', label: 'Últimos 12 meses' }, ...anos.map(a => ({ value: String(a), label: String(a) }))]} />
        <Segmento valor={regime} onChange={setRegime} opcoes={[{ value: 'competencia', label: 'Competência' }, { value: 'caixa', label: 'Caixa' }]} />
        {regime === 'competencia' && (
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={estimar} onChange={e => setEstimar(e.target.checked)} /> Estimar a receita dos meses sem conta lançada
          </label>
        )}
        <button type="button" onClick={exportar} className="ml-auto inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2">
          <FaFileCsv size={12} /> CSV
        </button>
      </div>

      <StatStrip
        colsClass="grid-cols-2 lg:grid-cols-4"
        items={[
          { label: `Receita${t.estimada ? ' (com estimativa)' : ''}`, value: reaisCurto(t.receita) },
          { label: 'Custos + despesas + impostos', value: reaisCurto(t.deducoes + t.custos + t.despesas + t.ajustes) },
          { label: 'Resultado', value: reaisCurto(t.resultado), valueClass: cor(t.resultado) },
          { label: 'Margem', value: pct(t.margem), valueClass: cor(t.resultado) },
        ]}
      />

      <SectionCard title={regime === 'competencia' ? 'DRE por competência (mês em que foi faturado / gasto)' : 'DRE por caixa (mês em que o dinheiro entrou / saiu)'}>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-400 sticky left-0 bg-gray-900 min-w-[260px]">Linha</th>
                {dre.meses.map(m => (
                  <th key={m.mes} className="px-3 py-3 text-right font-medium text-gray-400 whitespace-nowrap">
                    {mesRotulo(m.mes)}{m.estimada ? '*' : ''}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold text-white whitespace-nowrap">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/70">
              {LINHAS_DRE.map(l => {
                const detalhe = Object.keys(t.detalhe[l.key] || {}).sort((a, b) => Math.abs(t.detalhe[l.key][b]) - Math.abs(t.detalhe[l.key][a]));
                const aberta = abertas.has(l.key);
                const podeAbrir = !l.total && detalhe.length > 0;
                return (
                  <Fragment key={l.key}>
                    <tr className={l.total ? 'bg-gray-900/60' : 'hover:bg-gray-800/40'}>
                      <td className={`px-4 py-2.5 sticky left-0 ${l.total ? 'bg-gray-900 font-semibold text-white' : 'bg-black text-gray-300'}`}>
                        {podeAbrir ? (
                          <button type="button" onClick={() => alternar(l.key)} className="inline-flex items-center gap-2 hover:text-white text-left">
                            {aberta ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />} {l.label}
                          </button>
                        ) : <span className={l.total ? '' : 'pl-[18px]'}>{l.label}</span>}
                      </td>
                      {dre.meses.map(m => (
                        <td key={m.mes} className={`px-3 py-2.5 text-right tabular-nums whitespace-nowrap ${l.destaque ? cor(m[l.key]) : l.total ? 'text-white' : 'text-gray-300'}`}>
                          {m[l.key] ? reaisCurto(m[l.key]) : <span className="text-gray-700">–</span>}
                        </td>
                      ))}
                      <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap font-semibold ${l.destaque ? cor(t[l.key]) : 'text-white'}`}>{reaisCurto(t[l.key])}</td>
                    </tr>
                    {aberta && detalhe.map(n => (
                      <tr key={`${l.key}-${n}`} className="text-xs">
                        <td className="px-4 py-1.5 pl-10 text-gray-500 sticky left-0 bg-black">{n}</td>
                        {dre.meses.map(m => (
                          <td key={m.mes} className="px-3 py-1.5 text-right tabular-nums text-gray-500 whitespace-nowrap">
                            {m.detalhe[l.key][n] ? reaisCurto(m.detalhe[l.key][n]) : ''}
                          </td>
                        ))}
                        <td className="px-4 py-1.5 text-right tabular-nums text-gray-400 whitespace-nowrap">{reaisCurto(t.detalhe[l.key][n])}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
              <tr>
                <td className="px-4 py-2.5 sticky left-0 bg-black text-gray-400">Margem (resultado ÷ receita)</td>
                {dre.meses.map(m => <td key={m.mes} className={`px-3 py-2.5 text-right tabular-nums ${cor(m.resultado)}`}>{pct(m.margem)}</td>)}
                <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${cor(t.resultado)}`}>{pct(t.margem)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="text-xs text-gray-500 space-y-1">
          {t.estimada && <p>* Mês sem conta a receber lançada: a receita é a soma das mensalidades das placas ativas (estimativa).</p>}
          <p>
            Onde cada gasto entra: categorias do grupo Impostos (ou com "imposto" no nome) saem da receita; Equipamentos, Materiais, Viagens e Operacional são custo do serviço;
            Administrativo e Outros são despesas. Para mudar, troque o grupo da categoria em "Itens e categorias". Clique numa linha para ver por categoria.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

// =====================================================================
// Fluxo de caixa
// =====================================================================
function FluxoPanel({ despesas, recebimentos, veiculos, empresas, fornecedores, caixa, onCaixa, showToast }) {
  const hoje = mesHoje();
  const [antes, setAntes] = useState(5);
  const [depois, setDepois] = useState(3);
  const [estimar, setEstimar] = useState(true);
  const [saldoTxt, setSaldoTxt] = useState(String(caixa.saldo_inicial ?? 0).replace('.', ','));
  const [saldoData, setSaldoData] = useState(caixa.saldo_data || '');
  const [salvando, setSalvando] = useState(false);

  const meses = useMemo(() => listaMeses(somaMes(hoje, -antes), somaMes(hoje, depois)), [hoje, antes, depois]);
  const fluxo = useMemo(() => montarFluxo({
    meses, despesas, recebimentos, veiculos, empresas,
    saldoInicial: Number(caixa.saldo_inicial) || 0, saldoData: caixa.saldo_data, estimarFuturo: estimar,
  }), [meses, despesas, recebimentos, veiculos, empresas, caixa, estimar]);
  const prox = useMemo(() => proximosMovimentos({ despesas, recebimentos, empresas, fornecedores, dias: 30 }), [despesas, recebimentos, empresas, fornecedores]);

  const atual = fluxo.find(x => x.atual);
  const ultimo = fluxo[fluxo.length - 1];
  const menor = fluxo.filter(x => !x.passado).reduce((m, x) => (m == null || x.saldoFim < m.saldoFim ? x : m), null);
  const maxAbs = Math.max(1, ...fluxo.map(x => Math.abs(x.saldoFim)));

  const salvarSaldo = async () => {
    setSalvando(true);
    const linha = { id: 1, saldo_inicial: lerNumero(saldoTxt), saldo_data: saldoData || null, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('fin_caixa_config').upsert(linha).select('*').single();
    setSalvando(false);
    if (error) { showToast(error.message, 'error'); return; }
    onCaixa(data);
    showToast('Saldo de partida salvo.');
  };

  const exportar = () => {
    const num = (v) => String(v ?? 0).replace('.', ',');
    baixarCsv(`fluxo-caixa-${meses[0]}-a-${meses[meses.length - 1]}.csv`,
      ['Mês', 'Saldo início', 'Entradas (recebido)', 'Saídas (pago)', 'A receber (aberto)', 'Mensalidades estimadas', 'A pagar (aberto)', 'Recorrentes previstos', 'Saldo fim'],
      fluxo.map(x => [mesRotulo(x.mes), num(x.saldoInicio), num(x.entradas), num(x.saidas), num(x.entradasPrev), num(x.entradasEstim), num(x.saidasPrev), num(x.saidasRecorr), num(x.saldoFim)]));
  };

  return (
    <div className="space-y-6">
      <StatStrip
        colsClass="grid-cols-2 lg:grid-cols-4"
        items={[
          { label: 'Saldo previsto no fim deste mês', value: reaisCurto(atual?.saldoFim), valueClass: cor(atual?.saldoFim) },
          { label: `Saldo previsto em ${ultimo ? mesRotulo(ultimo.mes) : ''}`, value: reaisCurto(ultimo?.saldoFim), valueClass: cor(ultimo?.saldoFim) },
          { label: 'A receber nos próximos 30 dias', value: reaisCurto(prox.filter(p => p.tipo === 'entrada').reduce((s, p) => s + p.valor, 0)), valueClass: 'text-emerald-300' },
          { label: 'A pagar nos próximos 30 dias', value: reaisCurto(prox.filter(p => p.tipo === 'saida').reduce((s, p) => s + p.valor, 0)), valueClass: 'text-red-300' },
        ]}
      />

      {menor && menor.saldoFim < 0 && (
        <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-500/30 rounded-xl px-4 py-3">
          <FaExclamationCircle className="mt-0.5 shrink-0" /> Atenção: o caixa fica negativo em {mesRotulo(menor.mes)} ({reais(menor.saldoFim)}) se nada mudar.
        </div>
      )}

      <SectionCard
        title="Fluxo de caixa mês a mês"
        action={(
          <button type="button" onClick={exportar} className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2">
            <FaFileCsv size={12} /> CSV
          </button>
        )}
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-1.5">
            <span className="text-sm text-gray-300">Meses para trás</span>
            <select value={antes} onChange={e => setAntes(Number(e.target.value))} className={`px-3 py-2 ${inputBase}`}>
              {[2, 5, 11].map(n => <option key={n} value={n}>{n + 1} meses</option>)}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-gray-300">Meses à frente</span>
            <select value={depois} onChange={e => setDepois(Number(e.target.value))} className={`px-3 py-2 ${inputBase}`}>
              {[1, 3, 6, 12].map(n => <option key={n} value={n}>{n} {n === 1 ? 'mês' : 'meses'}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300 pb-2">
            <input type="checkbox" checked={estimar} onChange={e => setEstimar(e.target.checked)} /> Prever mensalidades futuras pelas placas
          </label>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 border-b border-gray-800">
              <tr className="text-gray-400">
                <th className="px-4 py-3 text-left font-medium">Mês</th>
                <th className="px-3 py-3 text-right font-medium">Saldo início</th>
                <th className="px-3 py-3 text-right font-medium">Entrou</th>
                <th className="px-3 py-3 text-right font-medium">Saiu</th>
                <th className="px-3 py-3 text-right font-medium">A receber</th>
                <th className="px-3 py-3 text-right font-medium">A pagar</th>
                <th className="px-3 py-3 text-right font-medium">Saldo fim</th>
                <th className="px-3 py-3 font-medium w-40 hidden md:table-cell" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/70">
              {fluxo.map(x => {
                const aReceber = x.entradasPrev + x.entradasEstim;
                const aPagar = x.saidasPrev + x.saidasRecorr;
                const larg = `${Math.round((Math.abs(x.saldoFim) / maxAbs) * 100)}%`;
                return (
                  <tr key={x.mes} className={x.atual ? 'bg-blue-950/30' : 'hover:bg-gray-800/40'}>
                    <td className="px-4 py-2.5 text-white whitespace-nowrap">
                      {mesRotulo(x.mes)} {x.atual && <span className="text-xs text-blue-300 ml-1">este mês</span>}{!x.passado && !x.atual && <span className="text-xs text-gray-500 ml-1">previsão</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-400 whitespace-nowrap">{reaisCurto(x.saldoInicio)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-300 whitespace-nowrap">{x.entradas ? reaisCurto(x.entradas) : '–'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-red-300 whitespace-nowrap">{x.saidas ? reaisCurto(x.saidas) : '–'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-200/70 whitespace-nowrap" title={x.entradasEstim ? `Inclui ${reais(x.entradasEstim)} de mensalidades estimadas` : ''}>
                      {aReceber ? reaisCurto(aReceber) : '–'}{x.entradasEstim ? '*' : ''}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-red-200/70 whitespace-nowrap" title={x.saidasRecorr ? `Inclui ${reais(x.saidasRecorr)} de gastos recorrentes previstos` : ''}>
                      {aPagar ? reaisCurto(aPagar) : '–'}{x.saidasRecorr ? '†' : ''}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap ${cor(x.saldoFim)}`}>{reaisCurto(x.saldoFim)}</td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                        <div className={`h-full rounded-full ${x.saldoFim < 0 ? 'bg-red-500/70' : 'bg-emerald-500/70'}`} style={{ width: larg }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">
          Entrou/Saiu = já pago. A receber e A pagar = em aberto (o que está atrasado aparece no mês atual).
          * inclui mensalidades previstas pelas placas sem conta lançada. † inclui gastos recorrentes que ainda vão nascer.
          Entradas pelo Asaas contam o valor líquido (sem a tarifa).
        </p>
      </SectionCard>

      <div className="grid lg:grid-cols-2 gap-6">
        <SectionCard title="Próximos 30 dias">
          {prox.length === 0 ? <p className="text-sm text-gray-500">Nada a receber ou pagar nos próximos 30 dias.</p> : (
            <ul className="divide-y divide-gray-800/70 text-sm">
              {prox.slice(0, 40).map((p, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  {p.tipo === 'entrada' ? <FaArrowDown className="text-emerald-400 shrink-0" size={11} /> : <FaArrowUp className="text-red-400 shrink-0" size={11} />}
                  <span className="text-gray-400 tabular-nums w-20 shrink-0">{dataBR(p.data)}</span>
                  <span className="flex-1 min-w-0 truncate text-gray-300" title={p.descricao}>{p.quem ? <b className="text-white font-medium">{p.quem}</b> : null}{p.quem ? ' · ' : ''}{p.descricao}</span>
                  <span className={`tabular-nums whitespace-nowrap ${p.tipo === 'entrada' ? 'text-emerald-300' : 'text-red-300'}`}>{p.tipo === 'entrada' ? '+' : '−'}{reais(p.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Saldo de partida">
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Informe quanto a empresa tinha em conta (somando todas as contas) num dia. O saldo dos meses é calculado a partir daí.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-sm text-gray-300">Saldo (R$)</span>
                <input value={saldoTxt} onChange={e => setSaldoTxt(e.target.value)} inputMode="decimal" className={`w-full px-3 py-2 ${inputBase}`} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm text-gray-300">Na data</span>
                <input type="date" value={saldoData || ''} onChange={e => setSaldoData(e.target.value)} className={`w-full px-3 py-2 ${inputBase}`} />
              </label>
            </div>
            <button type="button" disabled={salvando} onClick={salvarSaldo} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
              {salvando && <FaSpinner className="animate-spin" />} Salvar saldo
            </button>
            {!caixa.saldo_data && <p className="text-xs text-amber-300">Sem saldo de partida, a tabela mostra só a variação (começa do zero).</p>}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
