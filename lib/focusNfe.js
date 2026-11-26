// lib/focusNfe.js
// Integração com o emissor Focus NFe (https://focusnfe.com.br) para NFS-e.
// SÓ PARA O SERVIDOR (/pages/api/*): usa o token do emissor e a service role do Supabase.
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables, e .env.local para testar no PC):
//   FOCUS_NFE_TOKEN_HOMOLOGACAO  token de homologação (teste) da empresa no painel da Focus
//   FOCUS_NFE_TOKEN_PRODUCAO     token de produção (nota de verdade)
// O ambiente usado (homologação ou produção) é escolhido na tela /notas-fiscais > Configuração fiscal.
import { supabaseAdmin } from './supabaseAdmin';
import { soDigitos, fotoTomador } from './notasFiscais';

export const BUCKET_NOTAS = 'notas-fiscais';

const BASES = {
  homologacao: 'https://homologacao.focusnfe.com.br',
  producao: 'https://api.focusnfe.com.br',
};

export const tokenDo = (ambiente) => (
  ambiente === 'producao' ? process.env.FOCUS_NFE_TOKEN_PRODUCAO : process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO
) || '';

const caminhoApi = (padrao) => (padrao === 'municipal' ? '/v2/nfse' : '/v2/nfsen');

async function chamar(ambiente, metodo, caminho, corpo) {
  const token = tokenDo(ambiente);
  if (!token) {
    throw new Error(`Falta o token da Focus NFe de ${ambiente === 'producao' ? 'produção' : 'homologação'} na Vercel (variável ${ambiente === 'producao' ? 'FOCUS_NFE_TOKEN_PRODUCAO' : 'FOCUS_NFE_TOKEN_HOMOLOGACAO'}).`);
  }
  const r = await fetch(BASES[ambiente] + caminho, {
    method: metodo,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${token}:`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = { mensagem: texto.slice(0, 500) }; }
  return { ok: r.ok, http: r.status, json: json || {} };
}

// ---------- Endereço do tomador: código IBGE do município pelo CEP ----------
async function codigoIbgePorCep(cep) {
  const d = soDigitos(cep);
  if (d.length !== 8) return '';
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const j = await r.json();
    return j && !j.erro ? String(j.ibge || '') : '';
  } catch { return ''; }
}

const juntar = (base, extra) => {
  if (!extra || typeof extra !== 'object') return base;
  const out = { ...base };
  Object.entries(extra).forEach(([k, v]) => {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' ? juntar(out[k] || {}, v) : v;
  });
  return out;
};
const semVazios = (obj) => {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v === '' || v == null) return;
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? semVazios(v) : v;
  });
  return out;
};
const numOuNull = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

// Data e hora de Brasília no formato que a Focus aceita (2026-11-26T10:30:00-03:00)
function agoraBrasilia() {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 19) + '-03:00';
}

/**
 * Monta o JSON da nota para a Focus.
 * nota: { valor, discriminacao, competencia (AAAA-MM-01), tomador (fotoTomador) }
 */
export function montarPayload(cfg, nota, ibgeTomador) {
  const t = nota.tomador;
  const doc = soDigitos(t.cnpj);
  const aliquota = numOuNull(cfg.aliquota_iss);
  const valor = Number(nota.valor);
  const email = cfg.enviar_email_tomador ? t.email : '';

  if (cfg.padrao === 'municipal') {
    const base = {
      data_emissao: agoraBrasilia(),
      natureza_operacao: numOuNull(cfg.natureza_operacao) || 1,
      optante_simples_nacional: Number(cfg.codigo_opcao_simples_nacional) !== 1,
      regime_especial_tributacao: Number(cfg.regime_especial_tributacao) || null,
      prestador: {
        cnpj: soDigitos(cfg.cnpj_prestador),
        inscricao_municipal: soDigitos(cfg.inscricao_municipal) || cfg.inscricao_municipal,
        codigo_municipio: soDigitos(cfg.codigo_municipio),
      },
      tomador: {
        ...(doc.length === 11 ? { cpf: doc } : { cnpj: doc }),
        razao_social: t.razao_social,
        email,
        telefone: t.telefone,
        endereco: {
          logradouro: t.logradouro, numero: t.numero, complemento: t.complemento, bairro: t.bairro,
          codigo_municipio: ibgeTomador, uf: t.uf, cep: t.cep,
        },
      },
      servico: {
        valor_servicos: valor,
        discriminacao: nota.discriminacao,
        iss_retido: Boolean(cfg.iss_retido),
        aliquota,
        item_lista_servico: cfg.item_lista_servico,
        codigo_tributario_municipio: cfg.codigo_tributacao_municipal_iss,
        codigo_cnae: soDigitos(cfg.codigo_cnae),
        codigo_municipio: soDigitos(cfg.codigo_municipio),
      },
    };
    return juntar(semVazios(base), cfg.campos_extras);
  }

  // NFS-e Nacional (DPS)
  const base = {
    data_emissao: agoraBrasilia(),
    data_competencia: String(nota.competencia).slice(0, 10),
    codigo_municipio_emissora: soDigitos(cfg.codigo_municipio),
    cnpj_prestador: soDigitos(cfg.cnpj_prestador),
    inscricao_municipal_prestador: cfg.inscricao_municipal ? soDigitos(cfg.inscricao_municipal) || cfg.inscricao_municipal : '',
    codigo_opcao_simples_nacional: Number(cfg.codigo_opcao_simples_nacional) || 1,
    regime_especial_tributacao: Number(cfg.regime_especial_tributacao) || 0,
    ...(doc.length === 11 ? { cpf_tomador: doc } : { cnpj_tomador: doc }),
    razao_social_tomador: t.razao_social,
    codigo_municipio_tomador: ibgeTomador,
    cep_tomador: t.cep,
    logradouro_tomador: t.logradouro,
    numero_tomador: t.numero,
    complemento_tomador: t.complemento,
    bairro_tomador: t.bairro,
    telefone_tomador: t.telefone,
    email_tomador: email,
    codigo_municipio_prestacao: soDigitos(cfg.codigo_municipio),
    codigo_tributacao_nacional_iss: soDigitos(cfg.codigo_tributacao_nacional_iss),
    codigo_tributacao_municipal_iss: cfg.codigo_tributacao_municipal_iss,
    codigo_nbs: soDigitos(cfg.codigo_nbs),
    descricao_servico: nota.discriminacao,
    valor_servico: valor,
    tributacao_iss: 1, // operação tributável
    tipo_retencao_iss: cfg.iss_retido ? 2 : 1, // 1 = não retido; 2 = retido pelo tomador
    aliquota_iss: Number(cfg.codigo_opcao_simples_nacional) === 1 ? aliquota : null,
    ...(numOuNull(cfg.percentual_tributos) != null
      ? { percentual_total_tributos_federais: 0, percentual_total_tributos_estaduais: 0, percentual_total_tributos_municipais: numOuNull(cfg.percentual_tributos) }
      : {}),
  };
  return juntar(semVazios(base), cfg.campos_extras);
}

// ---------- Leitura da resposta da Focus ----------
const STATUS_FOCUS = {
  processando_autorizacao: 'PROCESSANDO',
  autorizado: 'AUTORIZADA',
  erro_autorizacao: 'ERRO',
  denegado: 'ERRO',
  cancelado: 'CANCELADA',
};

export function mensagemErro(j) {
  if (!j) return '';
  const erros = Array.isArray(j.erros) ? j.erros : [];
  const partes = erros.map(e => [e.codigo, e.mensagem, e.correcao ? `(${e.correcao})` : ''].filter(Boolean).join(' '));
  if (j.mensagem_sefaz) partes.push(j.mensagem_sefaz);
  if (!partes.length && j.mensagem) partes.push(j.mensagem);
  if (!partes.length && j.codigo) partes.push(j.codigo);
  return partes.join(' | ').slice(0, 2000);
}

function camposDaResposta(j, ambiente) {
  const abs = (u) => (!u ? null : /^https?:/i.test(u) ? u : BASES[ambiente] + (u.startsWith('/') ? '' : '/') + u);
  return {
    numero: j.numero || j.numero_nfse || null,
    codigo_verificacao: j.codigo_verificacao || null,
    chave: j.chave_nfse || j.chave_acesso || null,
    url_prefeitura: j.url || null,
    url_pdf: abs(j.url_danfse || j.caminho_danfse || j.url_pdf),
    url_xml: abs(j.caminho_xml_nota_fiscal || j.url_xml),
    data_emissao: j.data_emissao || null,
  };
}

// Baixa o PDF/XML da Focus e guarda uma cópia no Storage (a Focus não guarda para sempre)
async function guardarArquivo(url, caminho, tipo, ambiente) {
  if (!url) return null;
  try {
    const token = tokenDo(ambiente);
    const r = await fetch(url, token && url.includes('focusnfe.com.br')
      ? { headers: { Authorization: 'Basic ' + Buffer.from(`${token}:`).toString('base64') } } : {});
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (tipo === 'pdf' && !ct.includes('pdf')) return null; // às vezes é uma página da prefeitura
    const buf = Buffer.from(await r.arrayBuffer());
    const { error } = await supabaseAdmin.storage.from(BUCKET_NOTAS).upload(caminho, buf, {
      contentType: tipo === 'pdf' ? 'application/pdf' : 'application/xml', upsert: true,
    });
    return error ? null : caminho;
  } catch { return null; }
}

export async function carregarConfig() {
  const { data, error } = await supabaseAdmin.from('nf_config').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error(error.message.includes('nf_config') ? 'Rode o SQL 20261126c_notas_fiscais.sql no Supabase.' : error.message);
  if (!data) throw new Error('Preencha e salve a Configuração fiscal antes de emitir.');
  return data;
}

// Referência única da nota na Focus (letras, números e hífen)
const novaReferencia = (empresaId, competencia) => (
  `fv-${String(competencia).slice(0, 7).replace('-', '')}-${String(empresaId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
);

/**
 * Emite uma nota: grava no banco (PROCESSANDO) e manda para a Focus.
 * Retorna a linha de nf_notas atualizada.
 */
export async function emitirNota({ cfg, empresa, competencia, valor, discriminacao, placas, criadoPor, avulsa = false }) {
  const tomador = fotoTomador(empresa);
  const ibge = await codigoIbgePorCep(tomador.cep);
  if (!ibge) throw new Error(`Não achei o município do CEP ${tomador.cep || '(vazio)'} de ${empresa.nome}. Confira o CEP no cadastro do cliente.`);
  tomador.codigo_municipio = ibge;

  const referencia = novaReferencia(empresa.id, competencia);
  const { data: nota, error } = await supabaseAdmin.from('nf_notas').insert([{
    empresa_id: empresa.id,
    competencia,
    referencia,
    ambiente: cfg.ambiente,
    padrao: cfg.padrao,
    status: 'PROCESSANDO',
    valor,
    aliquota_iss: cfg.aliquota_iss,
    discriminacao,
    placas: placas || [],
    tomador,
    avulsa,
    criado_por: criadoPor || null,
  }]).select().single();
  if (error) {
    if (error.code === '23505') throw new Error(`${empresa.nome} já tem nota emitida (ou processando) em ${String(competencia).slice(5, 7)}/${String(competencia).slice(0, 4)}. Cancele a anterior se quiser emitir de novo.`);
    throw new Error(error.message);
  }

  const payload = montarPayload(cfg, { valor, discriminacao, competencia, tomador }, ibge);
  let resp;
  try {
    resp = await chamar(cfg.ambiente, 'POST', `${caminhoApi(cfg.padrao)}?ref=${encodeURIComponent(referencia)}`, payload);
  } catch (e) {
    await supabaseAdmin.from('nf_notas').update({ status: 'ERRO', mensagem: e.message, enviado: payload }).eq('id', nota.id);
    return { ...nota, status: 'ERRO', mensagem: e.message };
  }
  const j = resp.json;
  const novo = resp.ok
    ? { status: STATUS_FOCUS[j.status] || 'PROCESSANDO', mensagem: mensagemErro(j) || null, ...camposDaResposta(j, cfg.ambiente) }
    : { status: 'ERRO', mensagem: mensagemErro(j) || `Erro ${resp.http} no emissor` };
  const { data: final } = await supabaseAdmin.from('nf_notas').update({ ...novo, enviado: payload, resposta: j, updated_at: new Date().toISOString() })
    .eq('id', nota.id).select().single();
  return final || { ...nota, ...novo };
}

// Consulta a nota na Focus e atualiza status, número e arquivos
export async function atualizarNota(nota) {
  const { ok, http, json: j } = await chamar(nota.ambiente, 'GET', `${caminhoApi(nota.padrao)}/${encodeURIComponent(nota.referencia)}`);
  if (!ok) {
    if (http === 404 && nota.status === 'PROCESSANDO') {
      const { data } = await supabaseAdmin.from('nf_notas').update({ status: 'ERRO', mensagem: mensagemErro(j) || 'Nota não encontrada no emissor', updated_at: new Date().toISOString() })
        .eq('id', nota.id).select().single();
      return data || nota;
    }
    return { ...nota, aviso: mensagemErro(j) || `Erro ${http} ao consultar` };
  }
  const campos = camposDaResposta(j, nota.ambiente);
  const status = STATUS_FOCUS[j.status] || nota.status;
  const upd = { status, resposta: j, updated_at: new Date().toISOString() };
  Object.entries(campos).forEach(([k, v]) => { if (v) upd[k] = v; });
  if (status === 'ERRO') upd.mensagem = mensagemErro(j) || 'Recusada pela prefeitura';
  else if (j.status === 'erro_cancelamento') upd.mensagem = 'Cancelamento recusado: ' + (mensagemErro(j) || '');
  else upd.mensagem = null;
  if (status === 'CANCELADA' && !nota.cancelada_em) upd.cancelada_em = new Date().toISOString();

  if (status === 'AUTORIZADA' || status === 'CANCELADA') {
    const pasta = `${nota.ambiente}/${String(nota.competencia).slice(0, 7)}/${nota.referencia}`;
    if (!nota.pdf_path && (upd.url_pdf || nota.url_pdf)) upd.pdf_path = await guardarArquivo(upd.url_pdf || nota.url_pdf, `${pasta}.pdf`, 'pdf', nota.ambiente);
    if ((!nota.xml_path || status === 'CANCELADA') && (upd.url_xml || nota.url_xml)) {
      upd.xml_path = await guardarArquivo(upd.url_xml || nota.url_xml, `${pasta}${status === 'CANCELADA' ? '-cancelada' : ''}.xml`, 'xml', nota.ambiente) || nota.xml_path;
    }
  }
  const { data } = await supabaseAdmin.from('nf_notas').update(upd).eq('id', nota.id).select().single();
  return data || { ...nota, ...upd };
}

export async function cancelarNota(nota, justificativa) {
  const { ok, json: j } = await chamar(nota.ambiente, 'DELETE', `${caminhoApi(nota.padrao)}/${encodeURIComponent(nota.referencia)}`, { justificativa });
  if (!ok) throw new Error(mensagemErro(j) || 'O emissor recusou o cancelamento.');
  const cancelada = j.status === 'cancelado';
  const upd = {
    justificativa_cancelamento: justificativa,
    mensagem: cancelada ? null : (j.status === 'erro_cancelamento' ? 'Cancelamento recusado: ' + mensagemErro(j) : 'Cancelamento pedido, aguardando a prefeitura.'),
    updated_at: new Date().toISOString(),
  };
  if (cancelada) { upd.status = 'CANCELADA'; upd.cancelada_em = new Date().toISOString(); }
  await supabaseAdmin.from('nf_notas').update(upd).eq('id', nota.id);
  // Busca o XML de cancelamento e o status final
  return atualizarNota({ ...nota, ...upd });
}
