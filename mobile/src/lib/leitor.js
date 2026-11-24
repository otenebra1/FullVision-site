// Ponte entre a tela do leitor (câmera) e quem pediu a leitura.
// Quem abre o leitor registra um retorno; o leitor chama com o valor lido.
let retorno = null;
export const aguardarLeitura = (fn) => { retorno = fn; };
export const entregarLeitura = (valor) => { const fn = retorno; retorno = null; if (fn) fn(valor); };
export const cancelarLeitura = () => { retorno = null; };

// Placas brasileiras: Mercosul (ABC1D23) e antiga (ABC1234)
const PLACA = /\b([A-Z]{3})[\s-]?(\d)([A-Z0-9])(\d{2})\b/;
export function acharPlaca(linhas) {
  for (const bruta of linhas) {
    const t = String(bruta).toUpperCase().replace(/[^A-Z0-9\s-]/g, ' ');
    const m = t.match(PLACA);
    if (m) {
      // Na posição 5 da placa antiga só há número; O lido no lugar de 0 é corrigido
      return `${m[1]}${m[2]}${m[3]}${m[4]}`.replace(/^([A-Z]{3}\d)O/, '$10');
    }
  }
  return null;
}

// Serial: maior sequência de letras/números com pelo menos 6 caracteres e algum dígito
export function acharSerial(linhas) {
  const candidatos = [];
  for (const bruta of linhas) {
    for (const p of String(bruta).toUpperCase().split(/[^A-Z0-9]+/)) {
      if (p.length >= 6 && /\d/.test(p)) candidatos.push(p);
    }
  }
  candidatos.sort((a, b) => (/^\d+$/.test(b) - /^\d+$/.test(a)) || b.length - a.length);
  return candidatos;
}

// Abre o leitor e devolve o valor lido (a promessa não resolve se a pessoa fechar)
export function lerComCamera(router, modo) {
  return new Promise((resolve) => {
    aguardarLeitura(resolve);
    router.push({ pathname: '/leitor', params: { modo } });
  });
}
