// lib/contratos.js
// Contratos dos clientes (tela /contratos): constantes, modelo padrão e preenchimento dos campos.

export const STATUS_CONTRATO = [
  { value: 'ATIVO', label: 'Ativo', badge: 'bg-emerald-500/15 text-emerald-300' },
  { value: 'RASCUNHO', label: 'Rascunho', badge: 'bg-gray-500/20 text-gray-300' },
  { value: 'ENCERRADO', label: 'Encerrado', badge: 'bg-gray-500/20 text-gray-400' },
  { value: 'CANCELADO', label: 'Cancelado', badge: 'bg-red-500/15 text-red-300' },
];
export const infoStatusContrato = (v) => STATUS_CONTRATO.find(s => s.value === v) || { value: v, label: v || '', badge: 'bg-gray-500/20 text-gray-300' };

// Códigos das séries do Banco Central (SGS): variação mensal em %
export const INDICES = [
  { value: 'IPCA', label: 'IPCA (IBGE)', sgs: 433 },
  { value: 'IGPM', label: 'IGP-M (FGV)', sgs: 189 },
  { value: 'INPC', label: 'INPC (IBGE)', sgs: 188 },
  { value: 'FIXO', label: '% fixo combinado' },
  { value: 'NENHUM', label: 'Sem reajuste' },
];
export const rotuloIndice = (v) => INDICES.find(i => i.value === v)?.label || v || '';

const pad = (n) => String(n).padStart(2, '0');
export const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const somaDias = (iso, dias) => {
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const diasAte = (iso) => {
  if (!iso) return null;
  const a = new Date(hojeIso() + 'T00:00:00');
  const b = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  return Math.round((b - a) / 86400000);
};
// Fim = início + duração (meses) − 1 dia (o banco faz a mesma conta)
export const calcularFim = (inicio, meses, renovacoes = 0) => {
  if (!inicio || !meses) return '';
  const d = new Date(String(inicio).slice(0, 10) + 'T00:00:00');
  d.setMonth(d.getMonth() + Number(meses) * (Number(renovacoes) + 1));
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Situação na lista (avisos)
export function alertasContrato(c) {
  const out = [];
  if (c.status !== 'ATIVO') return out;
  const dFim = diasAte(c.fim);
  if (dFim != null && dFim < 0) out.push({ tom: 'bad', texto: `Venceu há ${-dFim} dia(s)` });
  else if (dFim != null && dFim <= (c.aviso_dias ?? 60)) out.push({ tom: c.renovacao_automatica ? 'warn' : 'bad', texto: `${c.renovacao_automatica ? 'Renova' : 'Vence'} em ${dFim} dia(s)` });
  const dRe = diasAte(c.proximo_reajuste);
  if (c.indice_reajuste !== 'NENHUM' && dRe != null && dRe <= 15) out.push({ tom: 'warn', texto: dRe < 0 ? `Reajuste atrasado ${-dRe} dia(s)` : `Reajuste em ${dRe} dia(s)` });
  if (!c.arquivo_path) out.push({ tom: 'muted', texto: 'Sem PDF assinado' });
  return out;
}

export const MODELO_PADRAO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE RASTREAMENTO E MONITORAMENTO VEICULAR
Contrato nº {numero}

CONTRATADA: {prestador_razao}, inscrita no CNPJ sob o nº {prestador_cnpj}, doravante denominada FULL VISION.

CONTRATANTE: {cliente_razao}, inscrita no CNPJ/CPF sob o nº {cliente_cnpj}, com endereço em {cliente_endereco}, neste ato representada por {cliente_responsavel}.

CLÁUSULA 1ª – DO OBJETO
1.1. A FULL VISION prestará à CONTRATANTE os serviços de {objeto}, por meio de equipamentos rastreadores instalados nos veículos indicados pela CONTRATANTE (quantidade inicial estimada: {qtd_placas} veículo(s)).
1.2. A inclusão ou retirada de veículos poderá ser feita a qualquer tempo, mediante solicitação, sendo cobrada a mensalidade proporcional aos veículos ativos em cada mês.

CLÁUSULA 2ª – DO PRAZO
2.1. Este contrato vigora por {duracao} meses, de {inicio} a {fim}.
2.2. {texto_renovacao}

CLÁUSULA 3ª – DO PREÇO E DO PAGAMENTO
3.1. Pelos serviços, a CONTRATANTE pagará a mensalidade de {valor_mensal} por veículo, conforme a tabela de serviços vigente: {tabela_mensalidades}.
3.2. O pagamento será feito por boleto bancário ou PIX, com vencimento todo dia {dia_vencimento} de cada mês.
3.3. O atraso no pagamento sujeitará a CONTRATANTE a multa de 2% e juros de 1% ao mês, e poderá levar à suspensão do serviço após 30 dias.

CLÁUSULA 4ª – DO REAJUSTE
4.1. {texto_reajuste}

CLÁUSULA 5ª – DOS EQUIPAMENTOS
5.1. Os equipamentos instalados são cedidos em comodato e continuam de propriedade da FULL VISION, devendo ser devolvidos ao final do contrato.
5.2. Em caso de dano, perda ou extravio por responsabilidade da CONTRATANTE, será cobrado o valor do equipamento conforme tabela vigente.

CLÁUSULA 6ª – DA RESCISÃO
6.1. Qualquer das partes poderá rescindir este contrato mediante aviso prévio de 30 dias.
6.2. {texto_multa}

CLÁUSULA 7ª – DO FORO
7.1. Fica eleito o foro da comarca de {prestador_cidade} para dirimir as dúvidas deste contrato.

{prestador_cidade}, {data_hoje}.


_____________________________________
{prestador_razao} – CONTRATADA


_____________________________________
{cliente_razao} – CONTRATANTE
{cliente_responsavel}`;

const dataBR = (iso) => (iso ? new Date(String(iso).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : '____');
const reais = (n) => (n == null || n === '' ? '____' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const docFormatado = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return v || '____';
};

/**
 * Troca os {campos} do modelo pelos dados do contrato, do cliente e da Full Vision.
 * prestador: { razao_social, cnpj_prestador, cidade } (vem da configuração fiscal)
 * mensalidades: { rastreamento, monitoramento, full_route } valores atuais do cliente
 */
export function preencherContrato(modelo, { contrato, empresa, prestador, mensalidades }) {
  const c = contrato || {};
  const e = empresa || {};
  const end = [e.logradouro, e.numero, e.complemento, e.bairro, e.cidade && `${e.cidade}/${e.uf || ''}`, e.cep && `CEP ${e.cep}`].filter(Boolean).join(', ');
  const tabela = [
    mensalidades?.rastreamento != null && `Rastreamento ${reais(mensalidades.rastreamento)}`,
    mensalidades?.monitoramento != null && `Monitoramento ${reais(mensalidades.monitoramento)}`,
    mensalidades?.full_route != null && `Full Route ${reais(mensalidades.full_route)}`,
  ].filter(Boolean).join('; ') || 'conforme proposta comercial';
  const indice = c.indice_reajuste === 'FIXO'
    ? `Os valores serão reajustados a cada 12 meses, na data de aniversário do contrato, em ${String(c.percentual_fixo ?? '____').replace('.', ',')}%.`
    : c.indice_reajuste === 'NENHUM'
      ? 'Os valores ficam fixos durante a vigência deste contrato.'
      : `Os valores serão reajustados a cada 12 meses, na data de aniversário do contrato, pela variação acumulada do ${rotuloIndice(c.indice_reajuste)} nos 12 meses anteriores. Se o índice for negativo, os valores ficam mantidos.`;
  const subs = {
    '{numero}': c.numero || '(será gerado ao salvar)',
    '{prestador_razao}': prestador?.razao_social || 'FULL VISION',
    '{prestador_cnpj}': docFormatado(prestador?.cnpj_prestador),
    '{prestador_cidade}': prestador?.cidade || '____',
    '{cliente_razao}': e.razao_social || e.nome || '____',
    '{cliente_nome}': e.nome || '____',
    '{cliente_cnpj}': docFormatado(e.cnpj),
    '{cliente_endereco}': end || '____',
    '{cliente_responsavel}': e.responsavel_comercial || '____',
    '{objeto}': c.objeto || 'rastreamento e monitoramento veicular',
    '{qtd_placas}': c.qtd_placas_ref != null ? String(c.qtd_placas_ref) : '____',
    '{duracao}': String(c.duracao_meses || '____'),
    '{inicio}': dataBR(c.inicio),
    '{fim}': dataBR(c.fim || calcularFim(c.inicio, c.duracao_meses)),
    '{texto_renovacao}': c.renovacao_automatica
      ? `Ao final do prazo, o contrato será renovado automaticamente por iguais períodos, salvo aviso contrário de qualquer das partes com ${c.aviso_dias || 30} dias de antecedência.`
      : 'Ao final do prazo, o contrato poderá ser renovado mediante termo aditivo assinado pelas partes.',
    '{valor_mensal}': reais(c.valor_mensal_ref),
    '{tabela_mensalidades}': tabela,
    '{dia_vencimento}': String(c.dia_vencimento || e.dia_vencimento_boleto || '____'),
    '{texto_reajuste}': indice,
    '{texto_multa}': c.multa_rescisao
      ? `Em caso de rescisão antes de ${c.fidelidade_meses ? `${c.fidelidade_meses} meses (fidelidade)` : 'o fim do prazo'}, a parte que der causa pagará multa de ${c.multa_rescisao}.`
      : 'A rescisão antecipada não gera multa, desde que cumprido o aviso prévio e quitados os valores em aberto.',
    '{data_hoje}': new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
  };
  let t = String(modelo || MODELO_PADRAO);
  Object.entries(subs).forEach(([k, v]) => { t = t.split(k).join(v); });
  return t;
}

export const CAMPOS_MODELO = [
  '{numero}', '{prestador_razao}', '{prestador_cnpj}', '{prestador_cidade}', '{cliente_razao}', '{cliente_nome}', '{cliente_cnpj}',
  '{cliente_endereco}', '{cliente_responsavel}', '{objeto}', '{qtd_placas}', '{duracao}', '{inicio}', '{fim}', '{texto_renovacao}',
  '{valor_mensal}', '{tabela_mensalidades}', '{dia_vencimento}', '{texto_reajuste}', '{texto_multa}', '{data_hoje}',
];

// Abre o contrato numa janela pronta para imprimir / "Salvar como PDF"
export function abrirParaImprimir(titulo, texto) {
  const w = window.open('', '_blank');
  if (!w) return false;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const corpo = esc(texto).split('\n').map(l => {
    if (/^CL[ÁA]USULA/i.test(l.trim())) return `<h2>${l}</h2>`;
    return l.trim() ? `<p>${l}</p>` : '<p class="vazio">&nbsp;</p>';
  }).join('\n');
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
  @page { size: A4; margin: 22mm 20mm; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #111; max-width: 170mm; margin: 0 auto; padding: 16px; }
  p { margin: 0 0 4px; text-align: justify; white-space: pre-wrap; }
  p:first-child { text-align: center; font-weight: bold; font-size: 13pt; }
  h2 { font-size: 12pt; margin: 14px 0 4px; }
  .vazio { margin: 0; line-height: 0.9; }
  .dica { font-family: Arial, sans-serif; font-size: 12px; background: #fff7d6; border: 1px solid #e5c76b; padding: 8px 12px; border-radius: 6px; margin-bottom: 16px; }
  @media print { .dica { display: none; } }
</style></head><body>
<div class="dica">Para salvar em PDF: na janela de impressão, escolha <b>Salvar como PDF</b> como impressora.</div>
${corpo}
<script>setTimeout(function(){ window.print(); }, 400);</script>
</body></html>`);
  w.document.close();
  return true;
}
