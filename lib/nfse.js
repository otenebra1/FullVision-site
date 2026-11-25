// lib/nfse.js
// Lê o XML de uma NFS-e (nota de serviço): padrão nacional (infNFSe / DPS) e o padrão
// ABRASF que a maioria das prefeituras usa (CompNfse / InfNfse). Devolve no mesmo formato da NF-e.
import { soDigitos } from './nfe';

const num = (s) => {
  const t = String(s ?? '').trim();
  if (!t) return 0;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : 0;
};

// Procura o primeiro elemento com um dos nomes (sem ligar para maiúsculas nem namespace)
function achar(raiz, ...nomes) {
  if (!raiz) return null;
  const alvo = nomes.map(n => n.toLowerCase());
  const todos = raiz.getElementsByTagName('*');
  for (const nome of alvo) {
    for (let i = 0; i < todos.length; i++) if (todos[i].localName.toLowerCase() === nome) return todos[i];
  }
  return null;
}
const txt = (raiz, ...nomes) => (achar(raiz, ...nomes)?.textContent || '').trim();

export function ehXmlNfse(doc) {
  return Boolean(achar(doc, 'infNFSe', 'InfNfse', 'CompNfse', 'Nfse', 'infDPS'));
}

export function lerXmlNfse(doc) {
  // ---------- Padrão nacional ----------
  const nac = doc.getElementsByTagNameNS('*', 'infNFSe')[0] || null; // nome exato (o ABRASF usa InfNfse)
  if (nac) {
    const emit = achar(nac, 'emit');
    const ender = achar(emit, 'enderNac', 'ender');
    const dps = achar(doc, 'infDPS');
    const vServ = num(txt(dps, 'vServ')) || num(txt(nac, 'vBC'));
    const vLiq = num(txt(nac, 'vLiq'));
    const descricao = txt(dps, 'xDescServ') || 'Serviço';
    const chave = soDigitos((nac.getAttribute('Id') || '').replace(/^NFS/i, ''));
    return montar({
      chave,
      numero: txt(nac, 'nNFSe'),
      data: (txt(dps, 'dhEmi') || txt(nac, 'dhProc')).slice(0, 10),
      fornecedor: {
        nome: txt(emit, 'xNome'), nome_fantasia: txt(emit, 'xFant'),
        cnpj: soDigitos(txt(emit, 'CNPJ') || txt(emit, 'CPF')),
        telefone: txt(emit, 'fone'), email: txt(emit, 'email'),
        cidade: txt(nac, 'xLocEmi'), uf: txt(ender, 'UF'),
        endereco: [txt(ender, 'xLgr'), txt(ender, 'nro'), txt(ender, 'xBairro')].filter(Boolean).join(', '),
      },
      descricao, vServ, vLiq,
      tomador: txt(achar(dps, 'toma'), 'xNome'),
    });
  }

  // ---------- ABRASF (prefeituras) ----------
  const inf = achar(doc, 'InfNfse') || doc.documentElement;
  const prest = achar(inf, 'PrestadorServico', 'Prestador', 'DadosPrestador');
  const ender = achar(prest, 'Endereco');
  const vServ = num(txt(inf, 'ValorServicos'));
  const vLiq = num(txt(inf, 'ValorLiquidoNfse'));
  return montar({
    chave: '',
    numero: txt(inf, 'Numero'),
    codigoVerificacao: txt(inf, 'CodigoVerificacao'),
    data: txt(inf, 'DataEmissao', 'DataEmissaoRps', 'Competencia').slice(0, 10),
    fornecedor: {
      nome: txt(prest, 'RazaoSocial', 'xNome', 'Nome'), nome_fantasia: txt(prest, 'NomeFantasia'),
      cnpj: soDigitos(txt(prest, 'Cnpj', 'CNPJ') || txt(prest, 'Cpf')),
      telefone: txt(prest, 'Telefone'), email: txt(prest, 'Email'),
      cidade: txt(ender, 'Cidade', 'NomeMunicipio'), uf: txt(ender, 'Uf', 'Estado'),
      endereco: [txt(ender, 'Endereco', 'Logradouro'), txt(ender, 'Numero'), txt(ender, 'Bairro')].filter(Boolean).join(', '),
    },
    descricao: txt(inf, 'Discriminacao', 'Descricao') || 'Serviço',
    vServ, vLiq,
    tomador: txt(achar(inf, 'TomadorServico', 'Tomador'), 'RazaoSocial', 'Nome'),
  });
}

// Monta o resultado no formato do lerXmlNfe (uma linha com o serviço)
export function montar({ chave, numero, codigoVerificacao, data, fornecedor, descricao, vServ, vLiq, tomador, origem = 'xml' }) {
  const valor = vServ || vLiq;
  const avisos = [];
  const retido = vServ && vLiq && Math.abs(vServ - vLiq) > 0.004 ? Math.round((vServ - vLiq) * 100) / 100 : 0;
  const desc = String(descricao || 'Serviço').replace(/\s+/g, ' ').trim();
  return {
    tipo: 'NFSE',
    origem,
    chave: chave || '',
    numero: numero || '',
    serie: '',
    data: data || '',
    fornecedor,
    itens: valor ? [{
      codigo_fornecedor: '', descricao: desc.length > 180 ? desc.slice(0, 177) + '...' : desc,
      unidade: 'SERV', quantidade: 1, valor_unitario: valor, valor_total: valor, ordem: 0,
    }] : [],
    totais: { produtos: valor, frete: 0, seguro: 0, desconto: 0, outros: 0, ipi: 0, st: 0, ii: 0, nota: valor },
    forma_pagamento: '',
    duplicatas: [],
    observacao: [
      codigoVerificacao ? `Código de verificação: ${codigoVerificacao}` : '',
      retido ? `Valor líquido ${vLiq.toFixed(2).replace('.', ',')} (impostos retidos ${retido.toFixed(2).replace('.', ',')})` : '',
      desc.length > 180 ? `Serviço: ${desc}` : '',
    ].filter(Boolean).join(' · '),
    tomador: tomador || '',
    avisos,
  };
}
