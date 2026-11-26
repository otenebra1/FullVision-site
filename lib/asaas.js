// lib/asaas.js
// Integração com o Asaas (https://www.asaas.com) para boleto e PIX dos clientes.
// SÓ PARA O SERVIDOR (/pages/api/*): usa o token do Asaas e a service role do Supabase.
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables, e .env.local para testar no PC):
//   ASAAS_TOKEN_SANDBOX   chave de API da conta de teste (sandbox.asaas.com > Integrações)
//   ASAAS_TOKEN_PRODUCAO  chave de API da conta de verdade (www.asaas.com > Integrações)
//   ASAAS_WEBHOOK_TOKEN   uma senha qualquer que você inventa e cola também no webhook do Asaas
// O ambiente usado é escolhido na aba "A receber" > Configuração.
import { supabaseAdmin } from './supabaseAdmin';
import { CONFIG_COBRANCA_PADRAO, statusDoAsaas, problemasCliente } from './cobranca';

const BASES = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  producao: 'https://api.asaas.com/v3',
};

export const tokenAsaas = (ambiente) => (
  ambiente === 'producao' ? process.env.ASAAS_TOKEN_PRODUCAO : process.env.ASAAS_TOKEN_SANDBOX
) || '';

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

export function mensagemAsaas(j, http) {
  const erros = Array.isArray(j?.errors) ? j.errors.map(e => e.description).filter(Boolean) : [];
  if (erros.length) return erros.join(' ');
  return j?.message || `Asaas respondeu erro ${http}.`;
}

async function chamar(ambiente, metodo, caminho, corpo) {
  const token = tokenAsaas(ambiente);
  if (!token) {
    throw new Error(`Falta a chave do Asaas de ${ambiente === 'producao' ? 'produção' : 'teste'} na Vercel (variável ${ambiente === 'producao' ? 'ASAAS_TOKEN_PRODUCAO' : 'ASAAS_TOKEN_SANDBOX'}).`);
  }
  const r = await fetch(BASES[ambiente] + caminho, {
    method: metodo,
    headers: { access_token: token, 'Content-Type': 'application/json', 'User-Agent': 'FullVision-ERP' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let json = {};
  try { json = texto ? JSON.parse(texto) : {}; } catch { json = { message: texto.slice(0, 300) }; }
  if (!r.ok) throw new Error(mensagemAsaas(json, r.status));
  return json;
}

export async function carregarConfigCobranca() {
  const { data, error } = await supabaseAdmin.from('fin_cobranca_config').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error(/fin_cobranca_config/.test(error.message) ? 'Rode o SQL 20261126e_contas_receber.sql no Supabase.' : error.message);
  return { ...CONFIG_COBRANCA_PADRAO, ...(data || {}) };
}

// Cria (ou reaproveita) o cliente no Asaas e guarda o id na empresa
async function garantirCliente(ambiente, empresa, cfg) {
  const coluna = ambiente === 'producao' ? 'asaas_cliente_producao' : 'asaas_cliente_sandbox';
  if (empresa[coluna]) return empresa[coluna];
  const prob = problemasCliente(empresa);
  if (prob.length) throw new Error(`Cadastro do cliente sem ${prob.join(', ')}.`);
  const doc = soDigitos(empresa.cnpj);
  // Já existe com o mesmo CNPJ? (evita duplicar)
  const achados = await chamar(ambiente, 'GET', `/customers?cpfCnpj=${doc}`);
  let id = achados?.data?.[0]?.id;
  if (!id) {
    const email = (empresa.contato_financeiro_email || empresa.contato_comercial_email || '').trim();
    const fone = soDigitos(empresa.contato_financeiro_telefone || empresa.contato_comercial_telefone || '');
    const novo = await chamar(ambiente, 'POST', '/customers', {
      name: empresa.razao_social || empresa.nome,
      cpfCnpj: doc,
      email: email || undefined,
      mobilePhone: fone.length >= 10 ? fone : undefined,
      postalCode: soDigitos(empresa.cep) || undefined,
      address: empresa.logradouro || undefined,
      addressNumber: empresa.numero || undefined,
      complement: empresa.complemento || undefined,
      province: empresa.bairro || undefined,
      externalReference: String(empresa.id),
      notificationDisabled: !cfg.avisar_cliente,
    });
    id = novo.id;
  }
  await supabaseAdmin.from('empresas').update({ [coluna]: id }).eq('id', empresa.id);
  return id;
}

// Busca linha digitável e PIX copia-e-cola (não trava se o Asaas ainda não tiver gerado)
async function detalhesPagamento(ambiente, pagamento) {
  const extra = {};
  if (pagamento.billingType !== 'PIX') {
    try {
      const b = await chamar(ambiente, 'GET', `/payments/${pagamento.id}/identificationField`);
      extra.linha_digitavel = b.identificationField || null;
    } catch { /* boleto ainda sendo registrado */ }
  }
  try {
    const p = await chamar(ambiente, 'GET', `/payments/${pagamento.id}/pixQrCode`);
    extra.pix_copia_cola = p.payload || null;
  } catch { /* conta sem chave PIX cadastrada */ }
  return extra;
}

export function camposDoPagamento(p) {
  const status = statusDoAsaas(p.status);
  return {
    asaas_status: p.status,
    status,
    link_fatura: p.invoiceUrl || null,
    link_boleto: p.bankSlipUrl || null,
    data_pagamento: status === 'PAGO' ? (p.clientPaymentDate || p.paymentDate || p.confirmedDate || null) : null,
    valor_pago: status === 'PAGO' ? Number(p.value) : null,
    valor_liquido: status === 'PAGO' ? Number(p.netValue ?? p.value) : null,
  };
}

// Manda um recebimento para o Asaas (gera boleto/PIX) e grava o resultado
export async function gerarCobranca(recebimento, cfg) {
  if (recebimento.asaas_id) throw new Error('Esta conta já tem boleto/PIX gerado.');
  if (recebimento.status !== 'ABERTO') throw new Error('Só dá para gerar cobrança de conta em aberto.');
  const { data: empresa, error } = await supabaseAdmin.from('empresas').select('*').eq('id', recebimento.empresa_id).single();
  if (error || !empresa) throw new Error('Cliente não encontrado.');
  const ambiente = cfg.ambiente;
  const forma = ['BOLETO', 'PIX', 'UNDEFINED'].includes(recebimento.forma) ? recebimento.forma : cfg.forma_padrao;
  try {
    const customer = await garantirCliente(ambiente, empresa, cfg);
    const corpo = {
      customer,
      billingType: forma,
      value: Number(recebimento.valor),
      dueDate: String(recebimento.vencimento).slice(0, 10),
      description: String(recebimento.descricao || '').slice(0, 500),
      externalReference: recebimento.id,
    };
    if (Number(cfg.multa_percentual) > 0) corpo.fine = { value: Number(cfg.multa_percentual), type: 'PERCENTAGE' };
    if (Number(cfg.juros_mensal) > 0) corpo.interest = { value: Number(cfg.juros_mensal) };
    if (Number(cfg.desconto_valor) > 0) corpo.discount = { value: Number(cfg.desconto_valor), dueDateLimitDays: 0, type: 'FIXED' };
    const pag = await chamar(ambiente, 'POST', '/payments', corpo);
    const extra = await detalhesPagamento(ambiente, pag);
    const upd = { ...camposDoPagamento(pag), ...extra, asaas_id: pag.id, ambiente, forma, mensagem: null };
    const { data } = await supabaseAdmin.from('fin_recebimentos').update(upd).eq('id', recebimento.id).select('*').single();
    return data;
  } catch (e) {
    const { data } = await supabaseAdmin.from('fin_recebimentos').update({ mensagem: e.message }).eq('id', recebimento.id).select('*').single();
    const err = new Error(e.message);
    err.recebimento = data;
    throw err;
  }
}

export async function atualizarCobranca(recebimento) {
  if (!recebimento.asaas_id) return recebimento;
  const amb = recebimento.ambiente || 'sandbox';
  const pag = await chamar(amb, 'GET', `/payments/${recebimento.asaas_id}`);
  const upd = camposDoPagamento(pag);
  if (pag.deleted) { upd.status = 'CANCELADO'; upd.asaas_status = 'DELETED'; }
  if (upd.status === 'ABERTO' && (!recebimento.linha_digitavel || !recebimento.pix_copia_cola)) {
    Object.assign(upd, await detalhesPagamento(amb, pag));
  }
  const { data } = await supabaseAdmin.from('fin_recebimentos').update(upd).eq('id', recebimento.id).select('*').single();
  return data;
}

export async function cancelarCobranca(recebimento) {
  if (recebimento.asaas_id) {
    await chamar(recebimento.ambiente || 'sandbox', 'DELETE', `/payments/${recebimento.asaas_id}`);
  }
  const { data } = await supabaseAdmin.from('fin_recebimentos')
    .update({ status: 'CANCELADO', asaas_status: recebimento.asaas_id ? 'DELETED' : null }).eq('id', recebimento.id).select('*').single();
  return data;
}

// Baixa manual (cliente pagou por fora): avisa o Asaas para não cobrar mais
export async function baixarNoAsaas(recebimento, dataPagamento, valor) {
  if (!recebimento.asaas_id) return;
  await chamar(recebimento.ambiente || 'sandbox', 'POST', `/payments/${recebimento.asaas_id}/receiveInCash`, {
    paymentDate: dataPagamento, value: Number(valor), notifyCustomer: false,
  });
}
