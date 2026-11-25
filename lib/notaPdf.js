// lib/notaPdf.js
// Lê o PDF de uma nota (DANFE da NF-e ou NFS-e) no navegador e tenta preencher o gasto.
// Usa o pdf.js (carregado do CDN só quando precisa) para tirar o texto, e depois procura
// os campos pelo texto. Funciona com PDF gerado por sistema (texto selecionável).
// PDF escaneado / foto não tem texto: nesse caso avisamos e o arquivo fica só anexado.
import { soDigitos } from './nfe';
import { montar } from './nfse';

const PDFJS_VERSAO = '3.11.174';
const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSAO}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSAO}/pdf.worker.min.js`;

let carregando = null;
function carregarPdfJs() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Só no navegador.'));
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!carregando) {
    carregando = new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = PDFJS_URL;
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; ok(window.pdfjsLib); };
      s.onerror = () => { carregando = null; erro(new Error('Não consegui carregar o leitor de PDF. Confira a internet e tente de novo.')); };
      document.head.appendChild(s);
    });
  }
  return carregando;
}

// Texto do PDF em linhas. Cada linha guarda os pedaços com a posição x, para achar
// o valor que fica embaixo de um rótulo (layout em quadros, como DANFE e DANFSe).
export async function textoDoPdf(file) {
  const pdfjs = await carregarPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const linhas = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 5); p++) {
    const pagina = await pdf.getPage(p);
    const { items } = await pagina.getTextContent();
    const porY = [];
    items.forEach(it => {
      if (!it.str || !it.str.trim()) return;
      const y = it.transform[5]; const x = it.transform[4];
      let grupo = porY.find(g => Math.abs(g.y - y) < 3);
      if (!grupo) { grupo = { y, partes: [] }; porY.push(grupo); }
      grupo.partes.push({ x, s: it.str.trim() });
    });
    porY.sort((a, b) => b.y - a.y).forEach(g => {
      const partes = g.partes.sort((a, b) => a.x - b.x);
      linhas.push({ texto: partes.map(x => x.s).join('  '), partes });
    });
  }
  return linhas;
}

// ---------- utilidades de texto ----------
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = (s) => semAcento(s).toUpperCase().replace(/\s+/g, ' ');
const valorBR = (s) => {
  const m = String(s || '').match(/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}|-?\d+\.\d{2}(?!\d)/);
  if (!m) return 0;
  const t = m[0];
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t) || 0;
};
const dataIso = (s) => {
  const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};
const RE_CNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;
const RE_VALOR = /\d{1,3}(?:\.\d{3})*,\d{2}/;
const RE_DATA = /\d{2}\/\d{2}\/\d{4}/;

// Campo que vem depois de um rótulo: no mesmo pedaço de texto, ou na linha de baixo,
// no pedaço mais perto na horizontal (mesma coluna do quadro).
function campo(linhas, rotulos, re) {
  for (const r of rotulos) {
    const alvo = norm(r);
    for (let i = 0; i < linhas.length; i++) {
      const parte = linhas[i].partes.find(pt => norm(pt.s).includes(alvo));
      if (!parte) continue;
      const pos = norm(parte.s).indexOf(alvo);
      const resto = parte.s.slice(pos + alvo.length).replace(/^[\s:.\-/]+/, '');
      const m = resto.match(re);
      if (m) return m[0];
      // pedaço logo à direita, na mesma linha (rótulo: valor)
      const dir = linhas[i].partes.find(pt => pt.x > parte.x && !/[A-Za-z]{4}/.test(semAcento(pt.s).replace(/R\$/, '')) && re.test(pt.s));
      if (dir && re !== null && /\d/.test(dir.s)) return dir.s.match(re)[0];
      for (let k = 1; k <= 4 && i + k < linhas.length; k++) {
        const cand = linhas[i + k].partes.filter(pt => re.test(pt.s));
        if (!cand.length) continue;
        const perto = cand.sort((a, b) => Math.abs(a.x - parte.x) - Math.abs(b.x - parte.x))[0];
        if (Math.abs(perto.x - parte.x) < 120) return perto.s.match(re)[0];
      }
    }
  }
  return '';
}
const valorDepois = (linhas, ...rot) => valorBR(campo(linhas, rot, RE_VALOR));
const dataDepois = (linhas, ...rot) => dataIso(campo(linhas, rot, RE_DATA));
const textoDepois = (linhas, ...rot) => campo(linhas, rot, /\S.*/).trim();

// ---------- DANFE (NF-e de produto) ----------
function lerDanfe(linhas, texto) {
  const chave = acharChave(linhas, 44);
  const avisos = [];

  // Emitente: "RECEBEMOS DE <NOME> OS PRODUTOS..." ou primeira linha do quadro do emitente
  const nome = ((texto.replace(/\s+/g, ' ').match(/RECEBEMOS DE\s+(.+?)\s+OS PRODUTOS/i) || [])[1] || '').trim();
  const cnpjChave = chave.length === 44 ? chave.slice(6, 20) : '';
  const cnpj = cnpjChave || soDigitos((texto.match(RE_CNPJ) || [])[0]);

  const nTxt = soDigitos((texto.match(/N[º°o.]\s*:?\s*([\d.]{3,15})/) || [])[1]);
  const numero = chave.length === 44 ? String(Number(chave.slice(25, 34))) : (nTxt ? String(Number(nTxt)) : '');
  const serie = chave.length === 44 ? String(Number(chave.slice(22, 25))) : '';
  const data = dataDepois(linhas, 'DATA DA EMISSAO', 'DATA DE EMISSAO', 'EMISSAO') || dataIso(texto);

  const totais = {
    produtos: valorDepois(linhas, 'VALOR TOTAL DOS PRODUTOS'),
    frete: valorDepois(linhas, 'VALOR DO FRETE'),
    seguro: valorDepois(linhas, 'VALOR DO SEGURO'),
    desconto: valorDepois(linhas, 'DESCONTO'),
    outros: valorDepois(linhas, 'OUTRAS DESPESAS'),
    ipi: valorDepois(linhas, 'VALOR TOTAL DO IPI', 'VALOR DO IPI'),
    st: valorDepois(linhas, 'VALOR DO ICMS SUBST', 'VALOR DO ICMS ST'),
    ii: 0,
    nota: valorDepois(linhas, 'VALOR TOTAL DA NOTA', 'V. TOTAL DA NOTA', 'VALOR TOTAL DA NF'),
  };

  // Itens: código, descrição, NCM (8 dígitos), CST, CFOP, unidade, quantidade, valor unit., valor total
  const reItem = /^(\S+)\s+(.+?)\s+(\d{8})\s+(\d{3,4})\s+(\d{4})\s+([A-Za-z]{1,6}\.?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/;
  const itens = [];
  linhas.forEach(({ texto: l }) => {
    const m = l.replace(/\s{2,}/g, ' ').match(reItem);
    if (!m) return;
    const q = valorQtd(m[7]); const vu = valorQtd(m[8]); const vt = valorBR(m[9]);
    if (!vt) return;
    itens.push({ codigo_fornecedor: m[1], descricao: m[2].trim(), unidade: m[6].replace('.', '').toUpperCase(), quantidade: q || 1, valor_unitario: vu || vt / (q || 1), valor_total: vt, ordem: itens.length });
  });

  const somaItens = itens.reduce((s, i) => s + i.valor_total, 0);
  if (!itens.length || (totais.produtos && Math.abs(somaItens - totais.produtos) > 0.05)) {
    if (itens.length) avisos.push('Não consegui ler todos os itens do PDF. Pus uma linha só com o total dos produtos: confira ou separe à mão.');
    else avisos.push('Não consegui ler os itens do PDF. Pus uma linha só com o total dos produtos: confira ou separe à mão.');
    itens.length = 0;
    const base = totais.produtos || totais.nota;
    if (base) itens.push({ codigo_fornecedor: '', descricao: `Produtos da NF ${numero}`.trim(), unidade: 'UN', quantidade: 1, valor_unitario: base, valor_total: base, ordem: 0 });
    if (!totais.produtos) Object.assign(totais, { frete: 0, seguro: 0, desconto: 0, outros: 0, ipi: 0, st: 0 });
  }
  if (chave) avisos.push('Dica: se o fornecedor mandou o XML desta nota, importe o XML. Ele traz todos os itens certinho.');

  return {
    tipo: 'NFE', origem: 'pdf', chave, numero, serie, data,
    fornecedor: { nome, cnpj },
    itens, totais, forma_pagamento: '', duplicatas: [], observacao: '', avisos,
  };
}
// Quantidade e valor unitário podem ter 4 casas ("10,0000")
const valorQtd = (s) => {
  const t = String(s || '').trim();
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : 0;
};

// ---------- NFS-e (nota de serviço) ----------
function lerNfsePdf(linhas, texto) {
  const N = linhas.map(l => norm(l.texto));
  // Divide em quadros: prestador (emitente) e tomador
  let iPrest = N.findIndex(l => /PRESTADOR|EMITENTE DA NFS/.test(l));
  if (iPrest < 0) iPrest = 0;
  let iToma = N.findIndex((l, i) => i > iPrest && /TOMADOR/.test(l));
  if (iToma < 0) iToma = Math.min(linhas.length, iPrest + 15);
  const prest = linhas.slice(iPrest, iToma);
  const toma = linhas.slice(iToma, iToma + 12);
  const txtPrest = prest.map(l => l.texto).join('\n');

  const cnpj = soDigitos((txtPrest.match(RE_CNPJ) || [])[0] || (txtPrest.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/) || [])[0]);
  const ROT_NOME = ['Nome / Nome Empresarial', 'Nome/Nome Empresarial', 'Razao Social/Nome', 'Nome/Razao Social', 'Razao Social', 'Nome Empresarial', 'Nome:'];
  let nome = textoDepois(prest, ...ROT_NOME);
  if (!nome || RE_CNPJ.test(nome) || /^(E-?MAIL|TELEFONE|CNPJ|CPF)/i.test(semAcento(nome))) {
    // primeiro texto "de nome" no quadro do prestador
    nome = prest.slice(1).flatMap(l => l.partes.map(p => p.s))
      .find(t => /[A-Za-z]{3}/.test(t) && !/CNPJ|CPF|NIF|INSCRI|ENDERE|MUNIC|TELEFONE|E-?MAIL|PRESTADOR|EMITENTE|NOME|RAZAO|CEP|SIMPLES|REGIME/i.test(semAcento(t))) || '';
  }
  const nomeToma = textoDepois(toma, ...ROT_NOME);

  const numero = campo(linhas, ['Numero da NFS-e', 'Numero da Nota', 'N° da NFS-e', 'Nº da NFS-e', 'NFS-e N', 'Numero NFS-e', 'Numero:', 'Numero da', 'Numero'], /\d{1,15}/);
  const codigoVerificacao = textoDepois(linhas, 'Codigo de Verificacao', 'Cod. Verificacao', 'Codigo Verificacao').split(' ')[0];
  const chaveNfse = acharChave(linhas, 50);
  const data = dataDepois(linhas, 'Data e Hora da emissao da NFS-e', 'Data e Hora de Emissao', 'Data de Emissao', 'Emissao', 'Competencia') || dataIso(texto);

  const vServ = valorDepois(linhas, 'Valor do Servico', 'Valor dos Servicos', 'VALOR TOTAL DO SERVICO', 'Valor Total da Nota', 'VALOR TOTAL DA NFS-E', 'Valor Bruto');
  const vLiq = valorDepois(linhas, 'Valor Liquido da NFS-e', 'Valor Liquido');

  let descricao = '';
  const iDesc = N.findIndex(l => /DISCRIMINACAO DOS SERVICOS|DESCRICAO DO SERVICO|DISCRIMINACAO DO SERVICO|DESCRICAO DOS SERVICOS/.test(l));
  if (iDesc >= 0) {
    const partes = [];
    for (let k = iDesc + 1; k < Math.min(linhas.length, iDesc + 5); k++) {
      if (/VALOR|TRIBUT|RETEN|IMPOSTO|INFORMAC/.test(N[k])) break;
      partes.push(linhas[k].texto);
    }
    descricao = partes.join(' ').replace(/\s+/g, ' ').trim();
  }

  const r = montar({
    chave: chaveNfse, numero, codigoVerificacao, data,
    fornecedor: { nome: nome.trim(), cnpj },
    descricao: descricao || 'Serviço', vServ, vLiq, tomador: nomeToma, origem: 'pdf',
  });
  if (!vServ && !vLiq) r.avisos.push('Não achei o valor no PDF. Preencha o valor à mão.');
  return r;
}

// ---------- entrada ----------
// Chave de acesso: 44 dígitos (NF-e) ou 50 (NFS-e nacional), às vezes em grupos de 4
function acharChave(linhas, tamanho) {
  // embaixo do rótulo "chave de acesso" (pode quebrar em mais de uma linha)
  const i = linhas.findIndex(l => /CHAVE DE ACESSO/.test(norm(l.texto)));
  if (i >= 0) {
    const rot = linhas[i].partes.find(p => /CHAVE/.test(norm(p.s))) || linhas[i].partes[0];
    let d = soDigitos(rot.s.replace(/.*ACESSO/i, ''));
    for (let k = i + 1; k < Math.min(linhas.length, i + 5) && d.length < tamanho; k++) {
      const p = linhas[k].partes.filter(x => /^[\d .]+$/.test(x.s) && soDigitos(x.s).length >= 4)
        .sort((a, b) => Math.abs(a.x - rot.x) - Math.abs(b.x - rot.x))[0];
      if (p && Math.abs(p.x - rot.x) < 150) d += soDigitos(p.s);
    }
    if (d.length === tamanho) return d;
  }
  for (const { texto } of linhas) {
    for (const m of texto.matchAll(/\d[\d .]{20,}\d/g)) {
      const d = soDigitos(m[0]);
      if (d.length === tamanho) return d;
    }
  }
  return '';
}

export async function lerPdfNota(file) {
  const linhas = await textoDoPdf(file);
  const texto = linhas.map(l => l.texto).join('\n');
  if (texto.replace(/\s/g, '').length < 40) {
    throw new Error('Esse PDF não tem texto (parece escaneado ou foto). Ele vai ficar anexado, e os dados precisam ser digitados.');
  }
  const T = semAcento(texto).toUpperCase();
  const ehServico = /NFS-?E|NOTA FISCAL (ELETRONICA )?DE SERVICO|PRESTADOR DE SERVICO|DANFSE/.test(T);
  const ehDanfe = /DANFE|DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA/.test(T) && !/DANFSE/.test(T);
  return ehDanfe || !ehServico ? lerDanfe(linhas, texto) : lerNfsePdf(linhas, texto);
}
