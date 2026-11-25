// Ajudantes do cadastro de cliente: máscaras, validação e busca de CNPJ/CEP (BrasilAPI, com ViaCEP de reserva)

export const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

export function formatCNPJ(v) {
  const d = soDigitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function formatCEP(v) {
  const d = soDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function formatTelefone(v) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function cnpjValido(v) {
  const c = soDigitos(v);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split('').reduce((s, n, i) => s + Number(n) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(c.slice(0, 12));
  const d2 = dv(c.slice(0, 12) + d1);
  return c.endsWith(`${d1}${d2}`);
}

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

const titulo = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());

// Dados da Receita pelo CNPJ (razão social, endereço e contato)
export async function buscarCNPJ(cnpj) {
  const d = await getJson(`https://brasilapi.com.br/api/cnpj/v1/${soDigitos(cnpj)}`);
  const tel = soDigitos(d.ddd_telefone_1 || '');
  return {
    razao_social: d.razao_social || '',
    nome_fantasia: d.nome_fantasia || '',
    cep: formatCEP(d.cep),
    logradouro: titulo([d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' ')),
    numero: d.numero || '',
    complemento: d.complemento || '',
    bairro: titulo(d.bairro),
    cidade: titulo(d.municipio),
    uf: (d.uf || '').toUpperCase(),
    telefone: tel ? formatTelefone(tel) : '',
    email: (d.email || '').toLowerCase(),
    situacao: d.descricao_situacao_cadastral || '',
  };
}

// Endereço pelo CEP
export async function buscarCEP(cep) {
  const d = soDigitos(cep);
  try {
    const r = await getJson(`https://brasilapi.com.br/api/cep/v1/${d}`);
    return { logradouro: r.street || '', bairro: r.neighborhood || '', cidade: r.city || '', uf: r.state || '' };
  } catch {
    const r = await getJson(`https://viacep.com.br/ws/${d}/json/`);
    if (r.erro) throw new Error('CEP não encontrado');
    return { logradouro: r.logradouro || '', bairro: r.bairro || '', cidade: r.localidade || '', uf: r.uf || '' };
  }
}

// Início + duração (meses) => data de fim, no formato AAAA-MM-DD
export function somarMeses(iso, meses) {
  if (!iso || !meses) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(a, m - 1 + Number(meses), 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d, ultimoDia));
  alvo.setDate(alvo.getDate() - 1); // contrato de 12 meses a partir de 01/01 termina em 31/12
  const p = (n) => String(n).padStart(2, '0');
  return `${alvo.getFullYear()}-${p(alvo.getMonth() + 1)}-${p(alvo.getDate())}`;
}

export function enderecoTexto(e) {
  if (!e) return '';
  const l1 = [e.logradouro, e.numero].filter(Boolean).join(', ');
  const l2 = [l1, e.complemento].filter(Boolean).join(' - ');
  const l3 = [e.bairro, [e.cidade, e.uf].filter(Boolean).join('/')].filter(Boolean).join(', ');
  return [l2, l3, e.cep ? `CEP ${formatCEP(e.cep)}` : ''].filter(Boolean).join(' · ');
}

// Campos do cadastro, na ordem do formulário
export const CAMPOS_CLIENTE = [
  'cnpj', 'razao_social', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf',
  'responsavel_comercial', 'contato_comercial_telefone', 'contato_comercial_email',
  'contato_financeiro_nome', 'contato_financeiro_telefone', 'contato_financeiro_email',
  'contrato_inicio', 'contrato_duracao_meses', 'contrato_fim', 'dia_vencimento_boleto',
];
