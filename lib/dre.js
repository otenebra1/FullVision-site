// lib/dre.js
// DRE (resultado) e fluxo de caixa da Full Vision, montados a partir do que já existe:
//   receitas  → contas a receber (fin_recebimentos) e, nos meses sem conta lançada, a soma das mensalidades das placas (estimativa)
//   despesas  → gastos do /financeiro (fin_despesas + linhas com categoria)
// Tudo calculado na tela; nada fica gravado.
import { placasDoMes } from './notasFiscais';

const arred = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');
export const mesDe = (iso) => String(iso || '').slice(0, 7);
export const somaMes = (mes, n) => {
  let [a, m] = mes.split('-').map(Number);
  m += n;
  while (m > 12) { m -= 12; a += 1; }
  while (m < 1) { m += 12; a -= 1; }
  return `${a}-${pad(m)}`;
};
export const mesHoje = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const listaMeses = (de, ate) => { const out = []; let m = de; while (m <= ate && out.length < 120) { out.push(m); m = somaMes(m, 1); } return out; };

// ---------- Linhas da DRE ----------
// Em qual linha cai cada grupo de categoria do /financeiro
export const LINHAS_DRE = [
  { key: 'receita', label: 'Receita bruta (mensalidades e serviços)', sinal: 1 },
  { key: 'deducoes', label: '(−) Impostos e tarifas de cobrança', sinal: -1 },
  { key: 'receita_liquida', label: '= Receita líquida', total: true },
  { key: 'custos', label: '(−) Custo do serviço (equipamentos, materiais, viagens, operação)', sinal: -1 },
  { key: 'lucro_bruto', label: '= Lucro bruto', total: true },
  { key: 'despesas', label: '(−) Despesas administrativas', sinal: -1 },
  { key: 'ajustes', label: '(±) Ajustes e descontos', sinal: -1 },
  { key: 'resultado', label: '= Resultado do mês (lucro ou prejuízo)', total: true, destaque: true },
];

const GRUPO_PARA_LINHA = {
  Equipamentos: 'custos', Materiais: 'custos', Viagens: 'custos', Operacional: 'custos',
  Administrativo: 'despesas', Outros: 'despesas', Ajustes: 'ajustes', Impostos: 'deducoes',
};
export function linhaDaCategoria(cat) {
  if (!cat) return 'despesas';
  if (/impost|tribut|\bdas\b|\biss\b/i.test(cat.nome || '') || cat.grupo === 'Impostos') return 'deducoes';
  return GRUPO_PARA_LINHA[cat.grupo] || 'despesas';
}

// Mês em que a despesa conta: competência = data do gasto; caixa = data em que foi paga
const mesDespesa = (d, regime) => {
  if (regime === 'caixa') return d.status === 'PAGO' ? mesDe(d.data_pagamento || d.data) : null;
  return mesDe(d.competencia || d.data);
};
// Mês em que a receita conta: competência = mês cobrado (ou do vencimento); caixa = data do pagamento
const mesReceita = (r, regime) => {
  if (r.status === 'CANCELADO') return null;
  if (regime === 'caixa') return r.status === 'PAGO' ? mesDe(r.data_pagamento) : null;
  return mesDe(r.competencia || r.vencimento);
};
const valorReceita = (r, regime) => Number(regime === 'caixa' ? (r.valor_pago ?? r.valor) : r.valor) || 0;

/**
 * Monta a DRE mês a mês.
 * @returns { meses: [{ mes, receita, deducoes, ..., estimada, detalhe: { linha: { nomeCategoria: valor } } }], total }
 */
export function montarDre({ meses, despesas, categorias, recebimentos, veiculos, empresas, regime = 'competencia', estimar = true }) {
  const catPorId = Object.fromEntries((categorias || []).map(c => [c.id, c]));
  const base = Object.fromEntries(meses.map(m => [m, {
    mes: m, receita: 0, deducoes: 0, custos: 0, despesas: 0, ajustes: 0, estimada: false, temReceita: false,
    detalhe: { receita: {}, deducoes: {}, custos: {}, despesas: {}, ajustes: {} },
  }]));
  const add = (mes, linha, nome, v) => {
    const x = base[mes];
    if (!x || !v) return;
    x[linha] += v;
    x.detalhe[linha][nome] = (x.detalhe[linha][nome] || 0) + v;
  };

  // Receitas lançadas
  (recebimentos || []).forEach(r => {
    const m = mesReceita(r, regime);
    if (!m || !base[m]) return;
    base[m].temReceita = true;
    add(m, 'receita', r.tipo === 'MENSALIDADE' ? 'Mensalidades' : 'Serviços e avulsos', valorReceita(r, regime));
    // Tarifa do Asaas (diferença entre o pago e o que caiu na conta)
    if (r.status === 'PAGO' && r.valor_liquido != null && r.valor_pago != null) {
      const tarifa = Number(r.valor_pago) - Number(r.valor_liquido);
      if (tarifa > 0.004) add(m, 'deducoes', 'Tarifas de boleto/PIX', tarifa);
    }
  });

  // Meses sem nenhuma conta lançada: estima pelas mensalidades das placas (só no regime de competência)
  if (estimar && regime === 'competencia') {
    meses.forEach(m => {
      if (base[m].temReceita || m > mesHoje()) return;
      const total = (empresas || []).reduce((s, e) => s + placasDoMes(veiculos, e.id, m).reduce((t, v) => t + (Number(v.mensalidade) || 0), 0), 0);
      if (total > 0) { add(m, 'receita', 'Mensalidades (estimativa pelas placas)', total); base[m].estimada = true; }
    });
  }

  // Despesas (linha a linha, pela categoria)
  (despesas || []).forEach(d => {
    const m = mesDespesa(d, regime);
    if (!m || !base[m]) return;
    const linhas = d.fin_despesa_itens || [];
    if (!linhas.length) { add(m, 'despesas', 'Sem categoria', Number(d.valor_total) || 0); return; }
    linhas.forEach(l => {
      const cat = catPorId[l.categoria_id];
      const linha = linhaDaCategoria(cat);
      const v = Number(l.valor_total) || 0;
      // Ajustes negativos (desconto) diminuem a despesa: guardamos com sinal
      add(m, linha, cat?.nome || 'Sem categoria', v);
    });
  });

  const lista = meses.map(m => {
    const x = base[m];
    Object.keys(x.detalhe).forEach(k => { Object.keys(x.detalhe[k]).forEach(n => { x.detalhe[k][n] = arred(x.detalhe[k][n]); }); });
    x.receita = arred(x.receita); x.deducoes = arred(x.deducoes); x.custos = arred(x.custos); x.despesas = arred(x.despesas); x.ajustes = arred(x.ajustes);
    x.receita_liquida = arred(x.receita - x.deducoes);
    x.lucro_bruto = arred(x.receita_liquida - x.custos);
    x.resultado = arred(x.lucro_bruto - x.despesas - x.ajustes);
    x.margem = x.receita > 0 ? x.resultado / x.receita : null;
    return x;
  });

  const total = { mes: 'total', detalhe: { receita: {}, deducoes: {}, custos: {}, despesas: {}, ajustes: {} } };
  ['receita', 'deducoes', 'receita_liquida', 'custos', 'lucro_bruto', 'despesas', 'ajustes', 'resultado'].forEach(k => {
    total[k] = arred(lista.reduce((s, x) => s + x[k], 0));
  });
  lista.forEach(x => Object.entries(x.detalhe).forEach(([k, o]) => Object.entries(o).forEach(([n, v]) => {
    total.detalhe[k][n] = arred((total.detalhe[k][n] || 0) + v);
  })));
  total.margem = total.receita > 0 ? total.resultado / total.receita : null;
  total.estimada = lista.some(x => x.estimada);
  return { meses: lista, total };
}

// ---------- Fluxo de caixa ----------
/**
 * Entradas e saídas por mês: realizadas (já pagas) e previstas (em aberto, recorrentes e mensalidades futuras).
 * Saldo começa em saldo_inicial na data saldo_data (configuração).
 */
export function montarFluxo({ meses, despesas, recebimentos, veiculos, empresas, saldoInicial = 0, saldoData = null, estimarFuturo = true }) {
  const atual = mesHoje();
  const base = Object.fromEntries(meses.map(m => [m, { mes: m, entradas: 0, saidas: 0, entradasPrev: 0, saidasPrev: 0, entradasEstim: 0, saidasRecorr: 0, foraSaldo: 0 }]));
  const inicioSaldo = saldoData ? String(saldoData).slice(0, 10) : null;
  let antes = 0; // movimento realizado entre a data do saldo e o primeiro mês da tabela

  const primeiro = meses[0];
  const contaAntes = (dataIso, v) => {
    if (!inicioSaldo || !dataIso) return;
    if (dataIso >= inicioSaldo && mesDe(dataIso) < primeiro) antes += v;
  };
  // Movimento anterior à data do saldo aparece na tabela, mas não mexe no saldo
  const foraDoSaldo = (dataIso) => Boolean(inicioSaldo && dataIso && dataIso < inicioSaldo);

  (recebimentos || []).forEach(r => {
    if (r.status === 'CANCELADO') return;
    if (r.status === 'PAGO') {
      const d = String(r.data_pagamento || r.vencimento).slice(0, 10);
      const v = Number(r.valor_liquido ?? r.valor_pago ?? r.valor) || 0;
      contaAntes(d, v);
      if (base[mesDe(d)]) { base[mesDe(d)].entradas += v; if (foraDoSaldo(d)) base[mesDe(d)].foraSaldo += v; }
    } else {
      // Em aberto: entra no mês do vencimento; vencidas entram no mês atual
      const m = mesDe(r.vencimento) < atual ? atual : mesDe(r.vencimento);
      if (base[m]) base[m].entradasPrev += Number(r.valor) || 0;
    }
  });

  (despesas || []).forEach(d => {
    const v = Number(d.valor_total) || 0;
    if (d.status === 'PAGO') {
      const dt = String(d.data_pagamento || d.data).slice(0, 10);
      contaAntes(dt, -v);
      if (base[mesDe(dt)]) { base[mesDe(dt)].saidas += v; if (foraDoSaldo(dt)) base[mesDe(dt)].foraSaldo -= v; }
    } else {
      const m0 = mesDe(d.vencimento || d.data);
      const m = m0 < atual ? atual : m0;
      if (base[m]) base[m].saidasPrev += v;
    }
  });

  // Meses futuros: gastos recorrentes que ainda não nasceram e mensalidades sem conta lançada
  const futuros = meses.filter(m => m > atual);
  if (futuros.length) {
    const ultimos = {};
    (despesas || []).forEach(d => {
      if (!d.recorrencia_serie) return;
      const u = ultimos[d.recorrencia_serie];
      if (!u || String(d.competencia || d.data) > String(u.competencia || u.data)) ultimos[d.recorrencia_serie] = d;
    });
    Object.values(ultimos).forEach(d => {
      if (d.recorrencia !== 'RECORRENTE') return;
      const ate = d.recorrencia_ate ? mesDe(d.recorrencia_ate) : '9999-12';
      futuros.forEach(m => { if (m > mesDe(d.competencia || d.data) && m <= ate) base[m].saidasRecorr += Number(d.valor_total) || 0; });
    });
    if (estimarFuturo) {
      futuros.forEach(m => {
        const lancadas = new Set((recebimentos || []).filter(r => r.tipo === 'MENSALIDADE' && r.status !== 'CANCELADO' && mesDe(r.competencia) === m).map(r => String(r.empresa_id)));
        // mensalidade do mês m costuma ser recebida no mês seguinte; simplificamos: entra no próprio mês
        base[m].entradasEstim = (empresas || []).filter(e => !lancadas.has(String(e.id)))
          .reduce((s, e) => s + placasDoMes(veiculos, e.id, m).reduce((t, v) => t + (Number(v.mensalidade) || 0), 0), 0);
      });
    }
  }

  let saldo = arred((Number(saldoInicial) || 0) + antes);
  const lista = meses.map(m => {
    const x = base[m];
    Object.keys(x).forEach(k => { if (typeof x[k] === 'number') x[k] = arred(x[k]); });
    x.saldoInicio = saldo;
    x.totalEntradas = arred(x.entradas + x.entradasPrev + x.entradasEstim);
    x.totalSaidas = arred(x.saidas + x.saidasPrev + x.saidasRecorr);
    x.liquido = arred(x.totalEntradas - x.totalSaidas);
    // Meses passados contam só o realizado (o que ficou em aberto foi jogado para o mês atual)
    saldo = arred(saldo + x.liquido - x.foraSaldo);
    x.saldoFim = saldo;
    x.passado = m < atual;
    x.atual = m === atual;
    return x;
  });
  return lista;
}

// Próximos lançamentos (para a lista "próximos 30 dias")
export function proximosMovimentos({ despesas, recebimentos, empresas, fornecedores, dias = 30 }) {
  const hoje = new Date();
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias);
  const fimIso = `${fim.getFullYear()}-${pad(fim.getMonth() + 1)}-${pad(fim.getDate())}`;
  const nomeEmp = Object.fromEntries((empresas || []).map(e => [String(e.id), e.nome]));
  const nomeForn = Object.fromEntries((fornecedores || []).map(f => [f.id, f.nome_fantasia || f.nome]));
  const out = [];
  (recebimentos || []).filter(r => r.status === 'ABERTO' && r.vencimento <= fimIso).forEach(r => out.push({
    tipo: 'entrada', data: r.vencimento, quem: nomeEmp[String(r.empresa_id)] || '', descricao: r.descricao, valor: Number(r.valor),
  }));
  (despesas || []).filter(d => d.status === 'A_PAGAR' && (d.vencimento || d.data) <= fimIso).forEach(d => out.push({
    tipo: 'saida', data: d.vencimento || d.data, quem: nomeForn[d.fornecedor_id] || '', descricao: d.descricao || d.numero || 'Gasto', valor: Number(d.valor_total),
  }));
  return out.sort((a, b) => String(a.data).localeCompare(String(b.data)));
}
