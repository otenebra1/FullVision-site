// lib/precos.js
// Cálculo automático do financeiro de uma OS (quanto cobrar do cliente e quanto pagar ao técnico).
// Funções puras: funcionam no navegador (prévia na tela) e no servidor (valor oficial gravado).

export const REGRAS_PADRAO = { kmLimite: 30, atendimentosIsencao: 3, kmCliente: 0 };

export const arredonda = (n) => Math.round((Number(n) || 0) * 100) / 100;

const mapaDe = (rows, chave = 'servico_id') => new Map((rows || []).map(r => [r[chave], Number(r.valor)]));

// Lê as tabelas de preço do banco (aceita o cliente do navegador ou o admin do servidor)
export async function carregarTabelas(client) {
  const q = (t) => client.from(t).select('*');
  const [servicos, faixas, faixaPrecos, tecnicos, tecnicoPrecos, clientePadrao, clienteEmpresa, config] = await Promise.all([
    q('servicos_catalogo').order('ordem'), q('faixas_tecnico').order('ordem'), q('faixa_tecnico_precos'),
    q('tecnicos').order('nome'), q('tecnico_precos'), q('precos_cliente_padrao'), q('precos_cliente_empresa'),
    q('financeiro_config'),
  ]);
  const erro = [servicos, faixas, faixaPrecos, tecnicos, tecnicoPrecos, clientePadrao, clienteEmpresa, config].find(r => r.error)?.error;
  if (erro) throw new Error(erro.message);
  return {
    servicos: servicos.data || [],
    faixas: faixas.data || [],
    faixaPrecos: faixaPrecos.data || [],
    tecnicos: tecnicos.data || [],
    tecnicoPrecos: tecnicoPrecos.data || [],
    clientePadrao: clientePadrao.data || [],
    clienteEmpresa: clienteEmpresa.data || [],
    config: (config.data || [])[0] || null,
  };
}

// Junta só o que vale para esta OS: o técnico escolhido e o cliente escolhido
export function montarContexto(tabelas, { tecnicoId, empresaId }) {
  const tecnico = (tabelas.tecnicos || []).find(t => t.id === tecnicoId) || null;
  const faixa = tecnico ? (tabelas.faixas || []).find(f => f.id === tecnico.faixa_id) || null : null;
  const cfg = tabelas.config || {};
  return {
    tecnico,
    faixa,
    precosFaixa: faixa ? mapaDe((tabelas.faixaPrecos || []).filter(p => p.faixa_id === faixa.id)) : new Map(),
    precosTecnico: tecnico ? mapaDe((tabelas.tecnicoPrecos || []).filter(p => p.tecnico_id === tecnico.id)) : new Map(),
    valorKmTecnico: tecnico?.valor_km != null ? Number(tecnico.valor_km) : Number(faixa?.valor_km || 0),
    precosClienteEmpresa: mapaDe((tabelas.clienteEmpresa || []).filter(p => String(p.empresa_id) === String(empresaId))),
    precosClientePadrao: mapaDe(tabelas.clientePadrao),
    regras: {
      kmLimite: cfg.km_limite != null ? Number(cfg.km_limite) : REGRAS_PADRAO.kmLimite,
      atendimentosIsencao: cfg.atendimentos_isencao != null ? Number(cfg.atendimentos_isencao) : REGRAS_PADRAO.atendimentosIsencao,
      kmCliente: cfg.km_cliente != null ? Number(cfg.km_cliente) : REGRAS_PADRAO.kmCliente,
    },
  };
}

// Preço do técnico: manual da OS > preço individual do técnico > preço da faixa dele
export function precoTecnico(ctx, servicoId, manual) {
  if (manual != null && manual !== '') return { valor: arredonda(manual), origem: 'manual' };
  if (ctx.precosTecnico.has(servicoId)) return { valor: ctx.precosTecnico.get(servicoId), origem: 'tecnico' };
  if (ctx.precosFaixa.has(servicoId)) return { valor: ctx.precosFaixa.get(servicoId), origem: 'faixa' };
  return { valor: 0, origem: 'sem_preco' };
}

// Preço do cliente: manual da OS > preço desse cliente > tabela padrão
export function precoCliente(ctx, servicoId, manual) {
  if (manual != null && manual !== '') return { valor: arredonda(manual), origem: 'manual' };
  if (ctx.precosClienteEmpresa.has(servicoId)) return { valor: ctx.precosClienteEmpresa.get(servicoId), origem: 'empresa' };
  if (ctx.precosClientePadrao.has(servicoId)) return { valor: ctx.precosClientePadrao.get(servicoId), origem: 'padrao' };
  return { valor: 0, origem: 'sem_preco' };
}

// Deslocamento: 3 ou mais atendimentos no mesmo local não pagam; senão, acima de 30 km paga o total de km
export function calcularDeslocamento({ km, atendimentos, valorKm, regras }) {
  const kmNum = Number(km) || 0;
  const atend = Number(atendimentos) || 1;
  if (kmNum <= 0) return { valor: 0, motivo: 'sem_km' };
  if (atend >= regras.atendimentosIsencao) return { valor: 0, motivo: 'isento_atendimentos' };
  if (kmNum <= regras.kmLimite) return { valor: 0, motivo: 'ate_limite' };
  return { valor: arredonda(kmNum * (Number(valorKm) || 0)), motivo: 'pago' };
}

/**
 * entrada: {
 *   itens: [{ servicoId, nome, quantidade, tecnicoManual?, clienteManual? }],   // manual = preço por unidade
 *   km, atendimentosMesmoLocal,
 *   deslocamentoTecnicoManual?, deslocamentoClienteManual?
 * }
 */
export function calcularOS(ctx, entrada) {
  const avisos = [];
  if (!ctx.tecnico) avisos.push('Escolha o técnico para calcular o valor dele.');
  else if (!ctx.faixa && ctx.precosTecnico.size === 0) avisos.push(`O técnico ${ctx.tecnico.nome} ainda não tem faixa de preço (veja em Preços).`);

  const itens = (entrada.itens || []).map(it => {
    const qtd = Math.max(1, Number(it.quantidade) || 1);
    const t = precoTecnico(ctx, it.servicoId, it.tecnicoManual);
    const c = precoCliente(ctx, it.servicoId, it.clienteManual);
    if (ctx.tecnico && t.origem === 'sem_preco') avisos.push(`Sem preço de técnico para ${it.nome}: informe o valor.`);
    if (c.origem === 'sem_preco') avisos.push(`Sem preço de cliente para ${it.nome}: informe o valor.`);
    return {
      servicoId: it.servicoId, nome: it.nome, quantidade: qtd,
      unitTecnico: t.valor, unitCliente: c.valor,
      valorTecnico: arredonda(t.valor * qtd), valorCliente: arredonda(c.valor * qtd),
      origemTecnico: t.origem, origemCliente: c.origem,
    };
  });

  const km = Number(entrada.km) || 0;
  const dT = calcularDeslocamento({ km, atendimentos: entrada.atendimentosMesmoLocal, valorKm: ctx.valorKmTecnico, regras: ctx.regras });
  const dC = calcularDeslocamento({ km, atendimentos: entrada.atendimentosMesmoLocal, valorKm: ctx.regras.kmCliente, regras: ctx.regras });
  if (dC.motivo === 'pago' && ctx.regras.kmCliente === 0) avisos.push('O valor do km cobrado do cliente não está configurado (veja em Preços > Regras).');
  if (dT.motivo === 'pago' && ctx.valorKmTecnico === 0) avisos.push('O técnico não tem valor de km definido.');

  const manualT = entrada.deslocamentoTecnicoManual;
  const manualC = entrada.deslocamentoClienteManual;
  const deslocamentoTecnico = manualT != null && manualT !== '' ? arredonda(manualT) : dT.valor;
  const deslocamentoCliente = manualC != null && manualC !== '' ? arredonda(manualC) : dC.valor;

  const totalTecnico = arredonda(itens.reduce((s, i) => s + i.valorTecnico, 0) + deslocamentoTecnico);
  const totalCliente = arredonda(itens.reduce((s, i) => s + i.valorCliente, 0) + deslocamentoCliente);

  return {
    itens, deslocamentoTecnico, deslocamentoCliente, motivoDeslocamento: dT.motivo,
    totalTecnico, totalCliente, avisos: [...new Set(avisos)],
  };
}
