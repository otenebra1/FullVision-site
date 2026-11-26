// POST /api/cobranca/acao  (só ADM)
// corpo: { acao: 'situacao' | 'gerar' | 'atualizar' | 'cancelar' | 'baixar', ids?: [...], id?, data_pagamento?, valor?, forma? }
//   situacao  → diz se as chaves do Asaas estão na Vercel (sem mostrar a chave)
//   gerar     → manda as contas para o Asaas (boleto/PIX)
//   atualizar → busca no Asaas se já pagaram
//   cancelar  → cancela a conta (e o boleto no Asaas, se tiver)
//   baixar    → marca como pago à mão (e avisa o Asaas, se tiver boleto)
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { quemChamou } from '../../../lib/apiAuth';
import {
  carregarConfigCobranca, gerarCobranca, atualizarCobranca, cancelarCobranca, baixarNoAsaas,
} from '../../../lib/asaas';

export const config = { maxDuration: 60 };

async function buscar(ids) {
  const { data, error } = await supabaseAdmin.from('fin_recebimentos').select('*').in('id', ids);
  if (error) throw new Error(error.message);
  return data || [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' });
  const quem = await quemChamou(req);
  if (!quem || quem.role !== 'admin') return res.status(403).json({ erro: 'Só o ADM mexe na cobrança.' });
  const { acao } = req.body || {};

  try {
    if (acao === 'situacao') {
      return res.status(200).json({
        sandbox: Boolean(process.env.ASAAS_TOKEN_SANDBOX),
        producao: Boolean(process.env.ASAAS_TOKEN_PRODUCAO),
        webhook: Boolean(process.env.ASAAS_WEBHOOK_TOKEN),
      });
    }

    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : [req.body?.id]).filter(Boolean).slice(0, 50);
    if (!ids.length) return res.status(400).json({ erro: 'Nenhuma conta escolhida.' });
    const lista = await buscar(ids);

    if (acao === 'gerar') {
      const cfg = await carregarConfigCobranca();
      const resultados = [];
      for (const r of lista) {
        try { resultados.push({ id: r.id, ok: true, recebimento: await gerarCobranca(r, cfg) }); }
        catch (e) { resultados.push({ id: r.id, ok: false, erro: e.message, recebimento: e.recebimento }); }
      }
      return res.status(200).json({ resultados });
    }

    if (acao === 'atualizar') {
      const recebimentos = [];
      for (const r of lista) {
        try { recebimentos.push(await atualizarCobranca(r)); } catch (e) { recebimentos.push({ ...r, mensagem: e.message }); }
      }
      return res.status(200).json({ recebimentos });
    }

    if (acao === 'cancelar') {
      const recebimentos = [];
      for (const r of lista) recebimentos.push(await cancelarCobranca(r));
      return res.status(200).json({ recebimentos });
    }

    if (acao === 'baixar') {
      const r = lista[0];
      if (!r) return res.status(404).json({ erro: 'Conta não encontrada.' });
      const dataPag = String(req.body.data_pagamento || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
      const valor = Number(req.body.valor) > 0 ? Number(req.body.valor) : Number(r.valor);
      await baixarNoAsaas(r, dataPag, valor);
      const { data, error } = await supabaseAdmin.from('fin_recebimentos').update({
        status: 'PAGO', data_pagamento: dataPag, valor_pago: valor, valor_liquido: valor,
        forma: req.body.forma || r.forma, asaas_status: r.asaas_id ? 'RECEIVED_IN_CASH' : r.asaas_status,
      }).eq('id', r.id).select('*').single();
      if (error) throw new Error(error.message);
      return res.status(200).json({ recebimentos: [data] });
    }

    return res.status(400).json({ erro: 'Ação desconhecida.' });
  } catch (e) {
    return res.status(400).json({ erro: e.message });
  }
}
