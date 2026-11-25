// lib/nfe.js
// Lê o XML de uma NF-e (o arquivo .xml que o fornecedor manda por e-mail) direto no navegador.
// Devolve fornecedor, número, chave, data, itens e totais. Não precisa de biblioteca.

const num = (s) => {
  const n = Number(String(s ?? '').trim());
  return Number.isFinite(n) ? n : 0;
};

// Primeiro elemento com esse nome dentro de "raiz" (ignora namespace)
const el = (raiz, nome) => (raiz ? raiz.getElementsByTagNameNS('*', nome)[0] || raiz.getElementsByTagName(nome)[0] || null : null);
const txt = (raiz, nome) => (el(raiz, nome)?.textContent || '').trim();
const filhoDireto = (raiz, nome) => {
  if (!raiz) return null;
  for (const c of Array.from(raiz.children || [])) if (c.localName === nome) return c;
  return null;
};

export const soDigitos = (s) => String(s || '').replace(/\D/g, '');

export function formatarCnpj(s) {
  const d = soDigitos(s);
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return s || '';
}

export function lerXmlNfe(texto) {
  const doc = new DOMParser().parseFromString(texto, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('O arquivo não é um XML válido.');

  const infNFe = el(doc, 'infNFe');
  if (!infNFe) throw new Error('Esse XML não parece ser de uma NF-e (não achei a tag infNFe).');

  const ide = el(infNFe, 'ide');
  const emit = el(infNFe, 'emit');
  const ender = el(emit, 'enderEmit');
  const tot = el(infNFe, 'ICMSTot');

  const chave = soDigitos(txt(doc, 'chNFe')) || soDigitos(infNFe.getAttribute('Id'));
  const dataEmissao = (txt(ide, 'dhEmi') || txt(ide, 'dEmi')).slice(0, 10);

  const fornecedor = {
    nome: txt(emit, 'xNome'),
    nome_fantasia: txt(emit, 'xFant'),
    cnpj: soDigitos(txt(emit, 'CNPJ') || txt(emit, 'CPF')),
    telefone: txt(ender, 'fone'),
    cidade: txt(ender, 'xMun'),
    uf: txt(ender, 'UF'),
    endereco: [txt(ender, 'xLgr'), txt(ender, 'nro'), txt(ender, 'xBairro')].filter(Boolean).join(', '),
  };

  const itens = Array.from(infNFe.getElementsByTagNameNS('*', 'det')).map((det, i) => {
    const prod = filhoDireto(det, 'prod') || el(det, 'prod');
    const qtd = num(txt(prod, 'qCom')) || 1;
    const vProd = num(txt(prod, 'vProd'));
    const vDesc = num(txt(prod, 'vDesc'));
    return {
      codigo_fornecedor: txt(prod, 'cProd'),
      descricao: txt(prod, 'xProd'),
      ncm: txt(prod, 'NCM'),
      unidade: txt(prod, 'uCom') || 'UN',
      quantidade: qtd,
      valor_unitario: num(txt(prod, 'vUnCom')) || (vProd / qtd),
      valor_total: round2(vProd),
      desconto: vDesc,
      ordem: i,
    };
  });

  const totais = {
    produtos: num(txt(tot, 'vProd')),
    frete: num(txt(tot, 'vFrete')),
    seguro: num(txt(tot, 'vSeg')),
    desconto: num(txt(tot, 'vDesc')),
    outros: num(txt(tot, 'vOutro')),
    ipi: num(txt(tot, 'vIPI')),
    st: num(txt(tot, 'vST')),
    ii: num(txt(tot, 'vII')),
    nota: num(txt(tot, 'vNF')),
  };

  // Formas de pagamento (tPag) e duplicatas (vencimentos)
  const tPag = txt(el(infNFe, 'pag'), 'tPag');
  const dup = Array.from(infNFe.getElementsByTagNameNS('*', 'dup')).map(d => ({
    numero: txt(d, 'nDup'), vencimento: txt(d, 'dVenc'), valor: num(txt(d, 'vDup')),
  }));

  return {
    chave,
    numero: txt(ide, 'nNF'),
    serie: txt(ide, 'serie'),
    data: dataEmissao,
    fornecedor,
    itens,
    totais,
    forma_pagamento: FORMA_POR_TPAG[tPag] || '',
    duplicatas: dup,
    observacao: txt(el(infNFe, 'infAdic'), 'infCpl'),
  };
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Código tPag da NF-e → forma de pagamento do painel
const FORMA_POR_TPAG = {
  '01': 'DINHEIRO', '03': 'CARTAO_CREDITO', '04': 'CARTAO_DEBITO', '15': 'BOLETO',
  '16': 'TRANSFERENCIA', '17': 'PIX', '18': 'TRANSFERENCIA',
};

// Linhas extras para o total do gasto bater com o valor da nota
// (frete, seguro/outras despesas, impostos fora do produto e desconto)
export function linhasDeAjuste(totais) {
  const extras = [];
  const imp = round2(totais.ipi + totais.st + totais.ii);
  if (totais.frete) extras.push({ descricao: 'Frete da NF', valor: totais.frete, categoria: 'Frete' });
  if (totais.seguro + totais.outros) extras.push({ descricao: 'Seguro / outras despesas da NF', valor: round2(totais.seguro + totais.outros), categoria: 'Impostos e taxas' });
  if (imp) extras.push({ descricao: 'Impostos da NF (IPI / ST)', valor: imp, categoria: 'Impostos e taxas' });
  if (totais.desconto) extras.push({ descricao: 'Desconto da NF', valor: -totais.desconto, categoria: 'Descontos' });
  return extras;
}
