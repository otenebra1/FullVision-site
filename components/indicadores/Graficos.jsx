// components/indicadores/Graficos.jsx
// Gráficos simples (sem biblioteca) para o painel de indicadores. Tema escuro do site.
//   Colunas: uma ou duas séries lado a lado por mês, com dica ao passar o mouse.
//   Linha: uma série ao longo dos meses, com linha-guia e dica.
//   Barras: ranking horizontal (técnicos, categorias...).
import React, { useEffect, useRef, useState } from 'react';

export const CORES = ['#338ced', '#e76624'];   // série 1 azul, série 2 laranja (validadas para fundo escuro)
const GRADE = '#1f2937';
const EIXO = '#9ca3af';

function useLargura() {
  const ref = useRef(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// Topo "redondo" do eixo e 3 marcas
function escala(max) {
  if (!(max > 0)) return { topo: 1, marcas: [0, 1] };
  const pot = 10 ** Math.floor(Math.log10(max));
  const passo = [1, 2, 2.5, 5, 10].map(m => m * pot).find(s => max / s <= 4) || 10 * pot;
  const topo = Math.ceil(max / passo) * passo;
  const marcas = [];
  for (let v = 0; v <= topo + 1e-9; v += passo) marcas.push(v);
  return { topo, marcas };
}

// Mostra no máximo ~8 rótulos de mês, sempre o último, sem encostar no penúltimo
const rotuloVisivel = (i, n) => {
  if (n <= 8 || i === n - 1) return true;
  const k = Math.ceil(n / 8);
  return i % k === 0 && n - 1 - i >= k;
};

const compacto = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (a >= 1e3) return `${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
};

export function Legenda({ series }) {
  if (!series || series.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-4 text-xs text-gray-400">
      {series.map((s, i) => (
        <span key={s.nome} className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.cor || CORES[i] }} />{s.nome}
        </span>
      ))}
    </div>
  );
}

function Dica({ x, w, titulo, linhas }) {
  const esquerda = Math.min(Math.max(x - 80, 0), w - 160);
  return (
    <div className="absolute top-0 z-10 pointer-events-none bg-gray-950/95 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl w-40" style={{ left: esquerda }}>
      <div className="text-gray-300 font-medium mb-1">{titulo}</div>
      {linhas.map(l => (
        <div key={l.nome} className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-gray-400">{l.cor && <span className="w-2 h-2 rounded-sm" style={{ background: l.cor }} />}{l.nome}</span>
          <span className="text-white tabular-nums">{l.valor}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * dados: [{ rotulo, valores: [n, n?], extra?: [{nome, valor}] }]
 * series: [{ nome, cor? }]
 */
export function Colunas({ dados, series, formato = (v) => v.toLocaleString('pt-BR'), altura = 200 }) {
  const [ref, w] = useLargura();
  const [hover, setHover] = useState(null);
  const esq = 48; const dir = 8; const topoPad = 8; const base = 22;
  const h = altura;
  const max = Math.max(0, ...dados.flatMap(d => d.valores.map(v => Number(v) || 0)));
  const { topo, marcas } = escala(max);
  const areaW = w - esq - dir; const areaH = h - topoPad - base;
  const grupo = areaW / Math.max(1, dados.length);
  const nS = series.length;
  const barW = Math.max(3, Math.min(28, (grupo * 0.7 - (nS - 1) * 2) / nS));
  const y = (v) => topoPad + areaH - (Math.max(0, v) / topo) * areaH;
  const mostrarRot = (i) => rotuloVisivel(i, dados.length);

  return (
    <div className="space-y-2">
      <Legenda series={series} />
      <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
        <svg width={w} height={h} role="img" aria-label={series.map(s => s.nome).join(' e ')}>
          {marcas.map(m => (
            <g key={m}>
              <line x1={esq} x2={w - dir} y1={y(m)} y2={y(m)} stroke={GRADE} strokeWidth="1" />
              <text x={esq - 6} y={y(m) + 4} textAnchor="end" fontSize="11" fill={EIXO}>{compacto(m)}</text>
            </g>
          ))}
          {dados.map((d, i) => {
            const gx = esq + i * grupo;
            const x0 = gx + (grupo - (nS * barW + (nS - 1) * 2)) / 2;
            return (
              <g key={d.rotulo}>
                {hover === i && <rect x={gx} y={topoPad} width={grupo} height={areaH} fill="#ffffff" opacity="0.04" />}
                {d.valores.map((v, k) => {
                  const val = Math.max(0, Number(v) || 0);
                  const bh = Math.max(val > 0 ? 1 : 0, (val / topo) * areaH);
                  const r = Math.min(4, barW / 2, bh);
                  const bx = x0 + k * (barW + 2); const by = topoPad + areaH - bh;
                  return bh > 0 ? (
                    <path key={k} fill={series[k]?.cor || CORES[k]}
                      d={`M${bx},${by + bh} V${by + r} Q${bx},${by} ${bx + r},${by} H${bx + barW - r} Q${bx + barW},${by} ${bx + barW},${by + r} V${by + bh} Z`} />
                  ) : null;
                })}
                {mostrarRot(i) && <text x={gx + grupo / 2} y={h - 6} textAnchor="middle" fontSize="11" fill={EIXO}>{d.rotulo}</text>}
                <rect x={gx} y={0} width={grupo} height={h} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
              </g>
            );
          })}
          <line x1={esq} x2={w - dir} y1={topoPad + areaH} y2={topoPad + areaH} stroke="#374151" strokeWidth="1" />
        </svg>
        {hover != null && dados[hover] && (
          <Dica x={esq + hover * grupo + grupo / 2} w={w} titulo={dados[hover].titulo || dados[hover].rotulo}
            linhas={[
              ...series.map((s, k) => ({ nome: s.nome, cor: s.cor || CORES[k], valor: formato(Number(dados[hover].valores[k]) || 0) })),
              ...(dados[hover].extra || []),
            ]} />
        )}
      </div>
    </div>
  );
}

/** dados: [{ rotulo, v }] */
export function Linha({ dados, nome, cor = CORES[0], formato = (v) => v.toLocaleString('pt-BR'), altura = 200, comecarNoZero = true }) {
  const [ref, w] = useLargura();
  const [hover, setHover] = useState(null);
  const esq = 48; const dir = 20; const topoPad = 16; const base = 22;
  const h = altura;
  const vals = dados.map(d => Number(d.v) || 0);
  const maxV = Math.max(0, ...vals); const minV = comecarNoZero ? 0 : Math.min(...vals);
  // eixo começa num número redondo abaixo do menor valor (ou no zero)
  const { marcas: m0 } = escala(Math.max(maxV - minV, maxV * 0.1, 1));
  const passoY = m0.length > 1 ? m0[1] - m0[0] : 1;
  const piso = comecarNoZero ? 0 : Math.max(0, Math.floor(minV / passoY) * passoY);
  const teto = Math.max(piso + passoY, Math.ceil(maxV / passoY) * passoY);
  const marcas = []; for (let v = piso; v <= teto + 1e-9; v += passoY) marcas.push(v);
  const topo = teto - piso;
  const areaW = w - esq - dir; const areaH = h - topoPad - base;
  const x = (i) => esq + (dados.length <= 1 ? areaW / 2 : (i / (dados.length - 1)) * areaW);
  const y = (v) => topoPad + areaH - ((v - piso) / topo) * areaH;
  const caminho = dados.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(Number(d.v) || 0)}`).join(' ');
  const passo = dados.length > 1 ? areaW / (dados.length - 1) : areaW;
  const mostrarRot = (i) => rotuloVisivel(i, dados.length);
  const ultimo = dados.length - 1;

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      <svg width={w} height={h} role="img" aria-label={nome}>
        {marcas.map(m => (
          <g key={m}>
            <line x1={esq} x2={w - dir} y1={y(m)} y2={y(m)} stroke={GRADE} strokeWidth="1" />
            <text x={esq - 6} y={y(m) + 4} textAnchor="end" fontSize="11" fill={EIXO}>{compacto(m)}</text>
          </g>
        ))}
        {dados.map((d, i) => mostrarRot(i) && <text key={d.rotulo} x={x(i)} y={h - 6} textAnchor={i === ultimo && dados.length > 1 ? 'end' : i === 0 && dados.length > 1 ? 'start' : 'middle'} fontSize="11" fill={EIXO}>{d.rotulo}</text>)}
        <path d={caminho} fill="none" stroke={cor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={topoPad} y2={topoPad + areaH} stroke="#4b5563" strokeWidth="1" strokeDasharray="3 3" />}
        {[hover, ultimo].filter((v, i, a) => v != null && a.indexOf(v) === i).map(i => (
          <circle key={i} cx={x(i)} cy={y(Number(dados[i].v) || 0)} r="4" fill={cor} stroke="#111827" strokeWidth="2" />
        ))}
        {ultimo >= 0 && hover == null && (
          <text x={Math.min(x(ultimo), w - dir - 2)} y={y(Number(dados[ultimo].v) || 0) - 10} textAnchor="end" fontSize="12" fontWeight="600" fill="#f3f4f6">{formato(Number(dados[ultimo].v) || 0)}</text>
        )}
        {dados.map((d, i) => (
          <rect key={`h${i}`} x={x(i) - passo / 2} y={0} width={passo} height={h} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
        ))}
      </svg>
      {hover != null && dados[hover] && (
        <Dica x={x(hover)} w={w} titulo={dados[hover].titulo || dados[hover].rotulo}
          linhas={[{ nome, cor, valor: formato(Number(dados[hover].v) || 0) }, ...(dados[hover].extra || [])]} />
      )}
    </div>
  );
}

/** itens: [{ nome, n, detalhe? }] */
export function Barras({ itens, cor = CORES[0], max = 8, formato = (v) => v.toLocaleString('pt-BR'), vazio = 'Sem dados no período.' }) {
  if (!itens?.length) return <p className="text-sm text-gray-500 py-4">{vazio}</p>;
  const lista = itens.length > max
    ? [...itens.slice(0, max - 1), { nome: `Outros (${itens.length - max + 1})`, n: itens.slice(max - 1).reduce((s, x) => s + x.n, 0) }]
    : itens;
  const topo = Math.max(...lista.map(x => x.n), 1);
  return (
    <ul className="space-y-2">
      {lista.map(x => (
        <li key={x.nome} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm" title={x.detalhe || ''}>
          <span className="text-gray-300 truncate">{x.nome}</span>
          <span className="h-3 bg-gray-800/60 rounded-r">
            <span className="block h-3 rounded-r" style={{ width: `${Math.max(2, (x.n / topo) * 100)}%`, background: cor }} />
          </span>
          <span className="text-white tabular-nums text-right min-w-[2.5rem]">{formato(x.n)}</span>
        </li>
      ))}
    </ul>
  );
}
