// lib/indicadores.js
// Contas do painel de indicadores (/indicadores). Tudo calculado no navegador com os dados que a tela já lê.
import { listaMeses, somaMes, mesHoje, montarDre } from './dre';

const dia = (v) => String(v || '').slice(0, 10);
const fimDoMes = (mes) => { const [a, m] = mes.split('-').map(Number); return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`; };
const hojeIso = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const media = (lista) => (lista.length ? lista.reduce((s, x) => s + x, 0) / lista.length : null);

export const mesesAte = (n) => listaMeses(somaMes(mesHoje(), -(n - 1)), mesHoje());

export const ROTULO_MES = (mes) => {
  const [a, m] = mes.split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + `/${String(a).slice(2)}`;
};

// Placa conta como ativa no fim do mês se foi instalada até lá e não foi desinstalada antes disso
function ativaNoDia(v, d) {
  if (v.data_inst && dia(v.data_inst) > d) return false;
  if (v.data_desinst && dia(v.data_desinst) <= d) return false;
  if (!v.data_desinst && v.status !== 'Ativo') return false;   // inativa sem data: não dá para saber quando saiu
  return true;
}

/** Base de clientes: placas ativas, instalações e desinstalações por mês */
export function serieBase(veiculos, meses) {
  return meses.map(mes => {
    const fim = mes === mesHoje() ? hojeIso() : fimDoMes(mes);
    const ativos = veiculos.filter(v => ativaNoDia(v, fim));
    return {
      mes,
      placas: ativos.length,
      clientes: new Set(ativos.map(v => v.empresa_id)).size,
      instalacoes: veiculos.filter(v => dia(v.data_inst).slice(0, 7) === mes).length,
      desinstalacoes: veiculos.filter(v => dia(v.data_desinst).slice(0, 7) === mes).length,
      mensalidade: ativos.reduce((s, v) => s + (Number(v.mensalidade) || 0), 0),
    };
  });
}

/** Resumo da base hoje */
export function resumoBase(veiculos) {
  const ativos = veiculos.filter(v => v.status === 'Ativo');
  const mrr = ativos.reduce((s, v) => s + (Number(v.mensalidade) || 0), 0);
  const comValor = ativos.filter(v => Number(v.mensalidade) > 0);
  return {
    placas: ativos.length,
    clientes: new Set(ativos.map(v => v.empresa_id)).size,
    mrr,
    ticket: comValor.length ? mrr / comValor.length : 0,
  };
}

/** Churn do mês: desinstalações / placas ativas no início do mês */
export function churn(serie) {
  return serie.map((x, i) => {
    const inicio = i > 0 ? serie[i - 1].placas : x.placas + x.desinstalacoes - x.instalacoes;
    return { mes: x.mes, taxa: inicio > 0 ? x.desinstalacoes / inicio : null };
  });
}

/** Financeiro por mês (reaproveita a DRE) */
export function serieFinanceira({ meses, despesas, categorias, recebimentos, veiculos, empresas }) {
  const { meses: dre } = montarDre({ meses, despesas, categorias, recebimentos, veiculos, empresas, regime: 'competencia', estimar: true });
  return dre.map(x => ({
    mes: x.mes,
    receita: x.receita,
    gastos: Math.round((x.deducoes + x.custos + x.despesas + x.ajustes) * 100) / 100,
    resultado: x.resultado,
    margem: x.margem,
    estimada: x.estimada,
  }));
}

/** Inadimplência: o que venceu e não foi pago */
export function inadimplencia(recebimentos) {
  const hoje = hojeIso();
  const validos = (recebimentos || []).filter(r => r.status !== 'CANCELADO');
  const vencidas = validos.filter(r => r.status !== 'PAGO' && r.vencimento && dia(r.vencimento) < hoje);
  const valorVencido = vencidas.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  // base: tudo que venceu nos últimos 90 dias (pago ou não)
  const limite = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const base90 = validos.filter(r => r.vencimento && dia(r.vencimento) < hoje && dia(r.vencimento) >= limite);
  const vencido90 = base90.filter(r => r.status !== 'PAGO').reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const total90 = base90.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const recebidoMes = validos.filter(r => r.status === 'PAGO' && dia(r.data_pagamento).slice(0, 7) === mesHoje())
    .reduce((s, r) => s + (Number(r.valor_pago ?? r.valor) || 0), 0);
  return {
    qtd: vencidas.length,
    clientes: new Set(vencidas.map(r => r.empresa_id)).size,
    valor: valorVencido,
    taxa90: total90 > 0 ? vencido90 / total90 : null,
    recebidoMes,
    temDados: validos.length > 0,
  };
}

/** Ordens de serviço: por mês e por técnico */
export function indicadoresOs(ordens, meses) {
  const porMes = meses.map(mes => {
    const doMes = ordens.filter(o => dia(o.data).slice(0, 7) === mes);
    return { mes, finalizadas: doMes.filter(o => o.status === 'finalizada').length, total: doMes.length };
  });
  const ini = meses[0];
  const noPeriodo = ordens.filter(o => o.status === 'finalizada' && dia(o.data).slice(0, 7) >= ini);
  const tec = {};
  noPeriodo.forEach(o => { const n = o.tecnico_nome || 'Sem técnico'; tec[n] = (tec[n] || 0) + 1; });
  const tipo = {};
  noPeriodo.forEach(o => { const n = (o.servico_realizado || 'Outro').toString().trim().toUpperCase() || 'OUTRO'; tipo[n] = (tipo[n] || 0) + 1; });
  const hoje = hojeIso();
  const abertas = ordens.filter(o => o.status !== 'finalizada');
  return {
    porMes,
    porTecnico: Object.entries(tec).map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n),
    porTipo: Object.entries(tipo).map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n),
    abertas: abertas.length,
    atrasadas: abertas.filter(o => o.data && dia(o.data) < hoje).length,
    mesAtual: porMes[porMes.length - 1]?.finalizadas || 0,
  };
}

/** Chamados de suporte */
export function indicadoresChamados(chamados, meses, rotuloCategoria) {
  const ini = meses[0];
  const doPeriodo = chamados.filter(c => dia(c.created_at).slice(0, 7) >= ini);
  const horas = (a, b) => (a && b ? (new Date(b) - new Date(a)) / 3600000 : null);
  const resp = doPeriodo.map(c => horas(c.created_at, c.primeira_resposta_em)).filter(h => h != null && h >= 0);
  const resol = doPeriodo.map(c => horas(c.created_at, c.resolvido_em)).filter(h => h != null && h >= 0);
  const notas = doPeriodo.map(c => c.avaliacao).filter(n => n != null);
  const cat = {};
  doPeriodo.forEach(c => { const n = rotuloCategoria(c.categoria); cat[n] = (cat[n] || 0) + 1; });
  return {
    abertos: chamados.filter(c => !['RESOLVIDO', 'FECHADO'].includes(c.status)).length,
    noPeriodo: doPeriodo.length,
    viraramOs: doPeriodo.filter(c => c.os_id).length,
    horasResposta: media(resp),
    horasResolucao: media(resol),
    nota: media(notas),
    avaliacoes: notas.length,
    porMes: meses.map(mes => ({ mes, n: chamados.filter(c => dia(c.created_at).slice(0, 7) === mes).length })),
    porCategoria: Object.entries(cat).map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n),
  };
}

/** Estoque: disponível e abaixo do mínimo */
export function indicadoresEstoque(produtos, rastreadores, solicitacoes) {
  const cont = {};
  (rastreadores || []).forEach(r => {
    if (r.produto_id && (r.status === 'estoque_central' || r.status === 'estoque_tecnico')) cont[r.produto_id] = (cont[r.produto_id] || 0) + 1;
  });
  const disp = (p) => (p.controle === 'QUANTIDADE' ? Number(p.saldo) || 0 : cont[p.id] || 0);
  const ativos = (produtos || []).filter(p => p.ativo !== false);
  const abaixo = ativos.filter(p => p.estoque_minimo != null && disp(p) < Number(p.estoque_minimo))
    .map(p => ({ nome: `${p.codigo || ''} ${p.nome || ''}`.trim(), n: disp(p), minimo: Number(p.estoque_minimo) }));
  return {
    rastreadoresDisponiveis: (rastreadores || []).filter(r => r.status === 'estoque_central' || r.status === 'estoque_tecnico').length,
    instalados: (rastreadores || []).filter(r => r.status === 'instalado').length,
    manutencao: (rastreadores || []).filter(r => r.status === 'aguardando_manutencao').length,
    abaixo,
    comprasAbertas: (solicitacoes || []).filter(s => s.status !== 'FINALIZADA' && s.status !== 'RECUSADA').length,
  };
}

/** Contratos: vencendo e reajustes nos próximos dias */
export function indicadoresContratos(contratos, dias = 60) {
  const hoje = hojeIso();
  const limite = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
  const ativos = (contratos || []).filter(c => c.status === 'ATIVO');
  return {
    ativos: ativos.length,
    vencendo: ativos.filter(c => c.fim && dia(c.fim) >= hoje && dia(c.fim) <= limite).length,
    reajustes: ativos.filter(c => c.proximo_reajuste && dia(c.proximo_reajuste) <= limite).length,
  };
}

export const horasTexto = (h) => {
  if (h == null) return '—';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${h.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
  return `${(h / 24).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`;
};
export const pct = (x) => (x == null ? '—' : `${(x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
