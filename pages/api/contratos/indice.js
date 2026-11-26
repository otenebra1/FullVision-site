// POST /api/contratos/indice  (só ADM)  corpo: { indice: 'IPCA' | 'IGPM' | 'INPC', ate?: 'AAAA-MM' }
// Busca no Banco Central (séries SGS) a variação mensal dos 12 meses até "ate" (ou os 12 últimos publicados)
// e devolve o acumulado em %.
import { quemChamou } from '../../../lib/apiAuth';
import { INDICES } from '../../../lib/contratos';

const br = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' });
  const quem = await quemChamou(req);
  if (!quem || quem.role !== 'admin') return res.status(403).json({ erro: 'Só o ADM.' });
  const ind = INDICES.find(i => i.value === req.body?.indice && i.sgs);
  if (!ind) return res.status(400).json({ erro: 'Índice sem consulta automática.' });

  let url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${ind.sgs}/dados/ultimos/12?formato=json`;
  const ate = String(req.body?.ate || '');
  if (/^\d{4}-\d{2}$/.test(ate)) {
    const [a, m] = ate.split('-').map(Number);
    const fim = new Date(a, m, 0);
    const ini = new Date(a, m - 12, 1);
    url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${ind.sgs}/dados?formato=json&dataInicial=${br(ini)}&dataFinal=${br(fim)}`;
  }
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`Banco Central respondeu ${r.status}.`);
    const dados = await r.json();
    if (!Array.isArray(dados) || !dados.length) throw new Error('O Banco Central não devolveu dados para esse período.');
    const meses = dados.map(d => ({ data: d.data, valor: Number(String(d.valor).replace(',', '.')) }));
    const fator = meses.reduce((f, x) => f * (1 + x.valor / 100), 1);
    const acumulado = Math.round((fator - 1) * 10000) / 100;
    const mesTxt = (s) => { const [, mm, aa] = s.split('/'); return `${mm}/${aa}`; };
    return res.status(200).json({
      indice: ind.value, acumulado, meses,
      referencia: `${ind.value} acumulado ${mesTxt(meses[0].data)} a ${mesTxt(meses[meses.length - 1].data)} (${meses.length} meses)`,
    });
  } catch (e) {
    return res.status(502).json({ erro: `Não consegui consultar o índice agora (${e.message}). Digite o % à mão.` });
  }
}
