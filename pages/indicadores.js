// /indicadores — painel de indicadores da empresa
// ADM vê tudo; funcionário vê só a parte operacional (sem valores em R$).
// Números calculados em lib/indicadores.js com os dados que já existem (placas, OS, chamados, estoque, financeiro).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { FaSpinner, FaArrowLeft, FaExclamationCircle, FaSyncAlt, FaWallet, FaTools, FaHeadset, FaBoxes, FaUsers } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { StatStrip, SectionCard } from '../components/admin/ui';
import Notificacoes from '../components/Notificacoes';
import { Colunas, Linha, Barras, CORES } from '../components/indicadores/Graficos';
import { rotuloCategoria } from '../lib/chamados';
import {
  mesesAte, ROTULO_MES, serieBase, resumoBase, churn, serieFinanceira, inadimplencia, indicadoresOs,
  indicadoresChamados, indicadoresEstoque, indicadoresContratos, horasTexto, pct,
} from '../lib/indicadores';

const reais = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = (n) => Number(n || 0).toLocaleString('pt-BR');
const curtoCategoria = (v) => rotuloCategoria(v).split(/ \/| \(/)[0];
const PERIODOS = [{ n: 6, label: '6 meses' }, { n: 12, label: '12 meses' }, { n: 24, label: '24 meses' }];

function Bloco({ icone: Icone, titulo, children }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Icone className="text-gray-500" size={15} /> {titulo}</h2>
      {children}
    </section>
  );
}
function Cartao({ titulo, sub, children }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-3 min-w-0">
      <div>
        <h3 className="text-sm font-semibold text-gray-200">{titulo}</h3>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export default function Indicadores() {
  const router = useRouter();
  const [papel, setPapel] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [avisos, setAvisos] = useState([]);
  const [periodo, setPeriodo] = useState(12);
  const [d, setD] = useState({
    veiculos: [], empresas: [], ordens: [], chamados: [], produtos: [], rastreadores: [], solicitacoes: [],
    contratos: [], recebimentos: [], despesas: [], categorias: [],
  });
  const ehAdm = papel === 'admin';

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/area-cliente'); return; }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile?.role === 'tecnico') { router.replace('/tecnico'); return; }
      if (profile?.role !== 'admin' && profile?.role !== 'funcionario') { router.replace('/area-cliente'); return; }
      setPapel(profile.role);
    })();
  }, [router]);

  const carregar = useCallback(async () => {
    if (!papel) return;
    setCarregando(true);
    const adm = papel === 'admin';
    const nada = Promise.resolve({ data: [] });
    const [v, e, o, c, p, r, s, ct, rc, dp, cat] = await Promise.all([
      supabase.from('veiculos').select(adm ? 'id, empresa_id, status, data_inst, data_desinst, mensalidade, servicos, placa' : 'id, empresa_id, status, data_inst, data_desinst'),
      supabase.from('empresas').select('id, nome'),
      supabase.from('ordens_servico').select('id, data, status, tecnico_nome, servico_realizado'),
      supabase.from('chamados').select('id, status, categoria, created_at, primeira_resposta_em, resolvido_em, avaliacao, os_id'),
      supabase.from('estoque_produtos').select('*'),
      supabase.from('rastreadores').select('id, status, produto_id'),
      supabase.from('fin_solicitacoes').select('id, status'),
      adm ? supabase.from('contratos').select('id, status, fim, proximo_reajuste') : nada,
      adm ? supabase.from('fin_recebimentos').select('id, empresa_id, tipo, competencia, valor, vencimento, status, data_pagamento, valor_pago, valor_liquido') : nada,
      adm ? supabase.from('fin_despesas').select('*, fin_despesa_itens(*)') : nada,
      adm ? supabase.from('fin_categorias').select('*') : nada,
    ]);
    const av = [];
    if (c.error) av.push('Chamados: rode o SQL 20261126i_chamados.sql.');
    if (p.error) av.push('Estoque mínimo: rode o SQL 20261126h_estoque_minimo.sql.');
    if (adm && rc.error) av.push('Contas a receber: rode o SQL 20261126e_contas_receber.sql (a receita sai pela estimativa das placas).');
    if (adm && ct.error) av.push('Contratos: rode o SQL 20261126g_contratos.sql.');
    setAvisos(av);
    setD({
      veiculos: v.data || [], empresas: e.data || [], ordens: o.data || [], chamados: c.data || [], produtos: p.data || [],
      rastreadores: r.data || [], solicitacoes: s.data || [], contratos: ct.data || [], recebimentos: rc.data || [],
      despesas: dp.data || [], categorias: cat.data || [],
    });
    setCarregando(false);
  }, [papel]);
  useEffect(() => { carregar(); }, [carregar]);

  const meses = useMemo(() => mesesAte(periodo), [periodo]);
  const base = useMemo(() => serieBase(d.veiculos, meses), [d.veiculos, meses]);
  const resumo = useMemo(() => resumoBase(d.veiculos), [d.veiculos]);
  const ch = useMemo(() => churn(base), [base]);
  const os = useMemo(() => indicadoresOs(d.ordens, meses), [d.ordens, meses]);
  const cham = useMemo(() => indicadoresChamados(d.chamados, meses, curtoCategoria), [d.chamados, meses]);
  const est = useMemo(() => indicadoresEstoque(d.produtos, d.rastreadores, d.solicitacoes), [d.produtos, d.rastreadores, d.solicitacoes]);
  const contr = useMemo(() => indicadoresContratos(d.contratos), [d.contratos]);
  const fin = useMemo(() => (ehAdm ? serieFinanceira({ meses, despesas: d.despesas, categorias: d.categorias, recebimentos: d.recebimentos, veiculos: d.veiculos, empresas: d.empresas }) : []),
    [ehAdm, meses, d]);
  const inad = useMemo(() => (ehAdm ? inadimplencia(d.recebimentos) : null), [ehAdm, d.recebimentos]);

  const ultimo = base[base.length - 1] || {};
  const anterior = base[base.length - 2] || {};
  const saldoMes = (ultimo.instalacoes || 0) - (ultimo.desinstalacoes || 0);
  const churnMedio = (() => { const t = ch.map(x => x.taxa).filter(x => x != null); return t.length ? t.reduce((a, b) => a + b, 0) / t.length : null; })();
  const finMes = fin[fin.length - 1];
  const finAcum = fin.reduce((a, x) => ({ receita: a.receita + x.receita, gastos: a.gastos + x.gastos, resultado: a.resultado + x.resultado }), { receita: 0, gastos: 0, resultado: 0 });

  if (!papel) return <div className="min-h-screen bg-black flex items-center justify-center"><FaSpinner className="animate-spin text-3xl text-blue-500" /></div>;

  return (
    <>
      <Head><title>Indicadores | Full Vision</title></Head>
      <div className="min-h-screen bg-black text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Indicadores</h1>
              <p className="text-gray-400 text-sm mt-1">Como a empresa está: base de clientes{ehAdm ? ', dinheiro' : ''}, operação, suporte e estoque</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex rounded-lg border border-gray-800 overflow-hidden" role="group" aria-label="Período">
                {PERIODOS.map(x => (
                  <button key={x.n} type="button" onClick={() => setPeriodo(x.n)}
                    className={`px-3 py-2 text-sm transition-colors ${periodo === x.n ? 'bg-blue-600 text-white' : 'bg-gray-950 text-gray-300 hover:text-white'}`}>{x.label}</button>
                ))}
              </div>
              <button type="button" onClick={carregar} title="Atualizar" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-2"><FaSyncAlt size={12} className={carregando ? 'animate-spin' : ''} /></button>
              <a href="/painel-admin" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3.5 py-2"><FaArrowLeft size={12} /> Painel administrativo</a>
              <Notificacoes />
            </div>
          </div>

          {avisos.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3"><FaExclamationCircle className="mt-0.5 shrink-0" /> <span>Alguns números ainda não aparecem. {avisos.join(' ')}</span></div>
          )}

          {carregando && !d.veiculos.length ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-20 justify-center"><FaSpinner className="animate-spin" /> Carregando indicadores...</div>
          ) : (
            <>
              {/* Resumo */}
              <StatStrip colsClass={ehAdm ? 'grid-cols-2 lg:grid-cols-6' : 'grid-cols-2 lg:grid-cols-4'} items={[
                { label: 'Placas ativas', value: num(resumo.placas) },
                { label: 'Clientes ativos', value: num(resumo.clientes) },
                ...(ehAdm ? [
                  { label: 'Mensalidade ativa (MRR)', value: reais(resumo.mrr) },
                  { label: 'Média por placa', value: reais(resumo.ticket) },
                ] : []),
                { label: 'OS em aberto', value: num(os.abertas), valueClass: os.atrasadas ? 'text-amber-400' : 'text-white', href: '/painel-admin' },
                { label: 'Chamados em aberto', value: num(cham.abertos), valueClass: cham.abertos ? 'text-amber-400' : 'text-white', href: '/suporte' },
              ]} />

              {/* Base de clientes */}
              <Bloco icone={FaUsers} titulo="Base de clientes">
                <StatStrip colsClass="grid-cols-2 lg:grid-cols-4" items={[
                  { label: 'Instalações no mês', value: num(ultimo.instalacoes) },
                  { label: 'Desinstalações no mês', value: num(ultimo.desinstalacoes), valueClass: ultimo.desinstalacoes ? 'text-amber-400' : 'text-white' },
                  { label: 'Saldo do mês', value: `${saldoMes > 0 ? '+' : ''}${num(saldoMes)}`, valueClass: saldoMes < 0 ? 'text-red-400' : saldoMes > 0 ? 'text-emerald-400' : 'text-white' },
                  { label: `Cancelamento médio (${periodo} meses)`, value: pct(churnMedio) },
                ]} />
                <div className="grid lg:grid-cols-2 gap-4">
                  <Cartao titulo="Placas ativas" sub={`No fim de cada mês. Mês passado: ${num(anterior.placas)}`}>
                    <Linha nome="Placas ativas" dados={base.map(x => ({ rotulo: ROTULO_MES(x.mes), v: x.placas, extra: [{ nome: 'Clientes', valor: num(x.clientes) }] }))} comecarNoZero={false} />
                  </Cartao>
                  <Cartao titulo="Instalações e desinstalações" sub="Pela data de instalação e de retirada da placa">
                    <Colunas series={[{ nome: 'Instalações', cor: CORES[0] }, { nome: 'Desinstalações', cor: CORES[1] }]}
                      dados={base.map((x, i) => ({ rotulo: ROTULO_MES(x.mes), valores: [x.instalacoes, x.desinstalacoes], extra: [{ nome: 'Cancelamento', valor: pct(ch[i]?.taxa) }] }))} />
                  </Cartao>
                </div>
              </Bloco>

              {/* Financeiro (só ADM) */}
              {ehAdm && (
                <Bloco icone={FaWallet} titulo="Dinheiro">
                  <StatStrip colsClass="grid-cols-2 lg:grid-cols-5" items={[
                    { label: 'Recebido neste mês', value: reais(inad?.recebidoMes), href: '/financeiro?aba=receber' },
                    { label: `Resultado (${periodo} meses)`, value: reais(finAcum.resultado), valueClass: finAcum.resultado < 0 ? 'text-red-400' : 'text-emerald-400', href: '/financeiro?aba=dre' },
                    { label: 'Margem no período', value: pct(finAcum.receita > 0 ? finAcum.resultado / finAcum.receita : null) },
                    { label: 'Em atraso', value: inad?.temDados ? reais(inad.valor) : '—', valueClass: inad?.valor > 0 ? 'text-red-400' : 'text-white', href: '/financeiro?aba=receber' },
                    { label: 'Inadimplência (90 dias)', value: inad?.temDados ? pct(inad.taxa90) : '—', valueClass: inad?.taxa90 > 0.05 ? 'text-amber-400' : 'text-white' },
                  ]} />
                  <div className="grid lg:grid-cols-2 gap-4">
                    <Cartao titulo="Receita e gastos por mês" sub={fin.some(x => x.estimada) ? 'Meses sem contas lançadas usam a estimativa pelas mensalidades das placas.' : 'Pela competência, igual à DRE.'}>
                      <Colunas formato={reais} series={[{ nome: 'Receita', cor: CORES[0] }, { nome: 'Gastos', cor: CORES[1] }]}
                        dados={fin.map(x => ({ rotulo: ROTULO_MES(x.mes), valores: [x.receita, x.gastos], extra: [{ nome: 'Resultado', valor: reais(x.resultado) }, { nome: 'Margem', valor: pct(x.margem) }] }))} />
                    </Cartao>
                    <Cartao titulo="Mensalidade ativa (MRR)" sub="Soma das mensalidades das placas ativas no fim de cada mês">
                      <Linha nome="MRR" formato={reais} dados={base.map(x => ({ rotulo: ROTULO_MES(x.mes), v: x.mensalidade, extra: [{ nome: 'Placas', valor: num(x.placas) }] }))} comecarNoZero={false} />
                    </Cartao>
                  </div>
                  {finMes && (
                    <p className="text-xs text-gray-500">
                      Este mês até agora: receita {reais(finMes.receita)}, gastos {reais(finMes.gastos)}, resultado {reais(finMes.resultado)}.
                      {inad?.qtd ? ` ${inad.qtd} conta(s) vencida(s) de ${inad.clientes} cliente(s).` : ''}
                      {contr.ativos ? ` Contratos: ${contr.vencendo} vencendo e ${contr.reajustes} reajuste(s) nos próximos 60 dias.` : ''}
                    </p>
                  )}
                </Bloco>
              )}

              {/* Operação */}
              <Bloco icone={FaTools} titulo="Operação">
                <StatStrip colsClass="grid-cols-2 lg:grid-cols-4" items={[
                  { label: 'OS finalizadas no mês', value: num(os.mesAtual) },
                  { label: `OS finalizadas (${periodo} meses)`, value: num(os.porTecnico.reduce((s, x) => s + x.n, 0)) },
                  { label: 'OS em aberto', value: num(os.abertas) },
                  { label: 'Abertas com data passada', value: num(os.atrasadas), valueClass: os.atrasadas ? 'text-amber-400' : 'text-white' },
                ]} />
                <div className="grid lg:grid-cols-3 gap-4">
                  <Cartao titulo="OS finalizadas por mês">
                    <Colunas series={[{ nome: 'Finalizadas' }]} dados={os.porMes.map(x => ({ rotulo: ROTULO_MES(x.mes), valores: [x.finalizadas], extra: [{ nome: 'Total do mês', valor: num(x.total) }] }))} />
                  </Cartao>
                  <Cartao titulo="Por técnico" sub={`OS finalizadas nos últimos ${periodo} meses`}>
                    <Barras itens={os.porTecnico} />
                  </Cartao>
                  <Cartao titulo="Por tipo de serviço" sub={`OS finalizadas nos últimos ${periodo} meses`}>
                    <Barras itens={os.porTipo} />
                  </Cartao>
                </div>
              </Bloco>

              {/* Suporte */}
              <Bloco icone={FaHeadset} titulo="Suporte ao cliente">
                <StatStrip colsClass="grid-cols-2 lg:grid-cols-5" items={[
                  { label: `Chamados (${periodo} meses)`, value: num(cham.noPeriodo) },
                  { label: 'Viraram OS', value: num(cham.viraramOs) },
                  { label: 'Primeira resposta (média)', value: horasTexto(cham.horasResposta) },
                  { label: 'Tempo para resolver (média)', value: horasTexto(cham.horasResolucao) },
                  { label: 'Nota dos clientes', value: cham.nota == null ? '—' : `${cham.nota.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ★`, valueClass: cham.nota != null && cham.nota < 4 ? 'text-amber-400' : 'text-white' },
                ]} />
                <div className="grid lg:grid-cols-2 gap-4">
                  <Cartao titulo="Chamados abertos por mês">
                    <Colunas series={[{ nome: 'Chamados' }]} dados={cham.porMes.map(x => ({ rotulo: ROTULO_MES(x.mes), valores: [x.n] }))} />
                  </Cartao>
                  <Cartao titulo="Assuntos mais comuns" sub={cham.avaliacoes ? `${cham.avaliacoes} avaliação(ões) de clientes no período` : 'Ainda sem avaliações no período'}>
                    <Barras itens={cham.porCategoria} />
                  </Cartao>
                </div>
              </Bloco>

              {/* Estoque */}
              <Bloco icone={FaBoxes} titulo="Estoque">
                <StatStrip colsClass="grid-cols-2 lg:grid-cols-5" items={[
                  { label: 'Rastreadores disponíveis', value: num(est.rastreadoresDisponiveis) },
                  { label: 'Instalados', value: num(est.instalados) },
                  { label: 'Aguardando manutenção', value: num(est.manutencao), valueClass: est.manutencao ? 'text-amber-400' : 'text-white' },
                  { label: 'Abaixo do mínimo', value: num(est.abaixo.length), valueClass: est.abaixo.length ? 'text-red-400' : 'text-white', href: '/painel-admin' },
                  { label: 'Compras em andamento', value: num(est.comprasAbertas), href: '/compras' },
                ]} />
                {est.abaixo.length > 0 && (
                  <SectionCard title="Produtos abaixo do mínimo">
                    <Barras cor={CORES[1]} max={12} itens={est.abaixo.map(x => ({ nome: x.nome, n: x.n, detalhe: `Mínimo: ${num(x.minimo)}` }))} />
                  </SectionCard>
                )}
              </Bloco>
            </>
          )}
        </div>
      </div>
    </>
  );
}
