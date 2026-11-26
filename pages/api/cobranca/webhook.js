// POST /api/cobranca/webhook  — o Asaas chama aqui quando um boleto/PIX é pago, vence ou é estornado.
// Configure no Asaas: Integrações > Webhooks > URL https://SEU-SITE/api/cobranca/webhook
// e o "Token de autenticação" igual à variável ASAAS_WEBHOOK_TOKEN da Vercel.
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { camposDoPagamento } from '../../../lib/asaas';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' });
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado || req.headers['asaas-access-token'] !== esperado) return res.status(401).json({ erro: 'Token inválido.' });

  const pag = req.body?.payment;
  if (!pag?.id) return res.status(200).json({ ok: true, ignorado: true });

  const upd = camposDoPagamento(pag);
  if (req.body.event === 'PAYMENT_DELETED') { upd.status = 'CANCELADO'; upd.asaas_status = 'DELETED'; }
  if (req.body.event === 'PAYMENT_RESTORED') { upd.status = 'ABERTO'; }

  let q = supabaseAdmin.from('fin_recebimentos').update(upd);
  const refOk = /^[0-9a-f-]{36}$/i.test(String(pag.externalReference || ''));
  q = refOk ? q.or(`asaas_id.eq.${pag.id},id.eq.${pag.externalReference}`) : q.eq('asaas_id', pag.id);
  const { error } = await q;
  if (error) return res.status(500).json({ erro: error.message });
  // Sempre 200 para o Asaas não pausar a fila de avisos
  return res.status(200).json({ ok: true });
}
