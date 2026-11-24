import React, { useMemo, useState } from 'react';
import { FaChevronDown, FaExpandAlt, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { BRL, StatusDot, Dash, ActionButton } from './ui';

const COLS = 'grid grid-cols-[minmax(130px,1.1fr)_minmax(120px,1fr)_minmax(110px,1fr)_110px_120px_52px] gap-x-4 items-center';
const INITIAL_ROWS = 10;
const MORE_ROWS = 25;

const SORTABLE = [
  { key: 'placa', label: 'Placa' },
  { key: 'modelo', label: 'Modelo' },
  { key: 'id_instalado', label: 'ID instalado' },
  { key: 'status', label: 'Status' },
  { key: 'mensalidade', label: 'Mensalidade', right: true },
];

const somaAtiva = (items) => items.reduce((s, v) => s + (v.status === 'Ativo' ? Number(v.mensalidade) || 0 : 0), 0);
const contaInativos = (items) => items.filter(v => v.status !== 'Ativo').length;

// Banco de veículos sempre agrupado por cliente; dentro dele, por operação ou por cliente associado
export default function VeiculosAgrupados({ veiculos, empresaNomeById, clienteNomeById, subGroupBy, sort, onSort, onOpen }) {
  const [collapsed, setCollapsed] = useState({});
  const [shown, setShown] = useState({});

  const primaryOf = (v) => clienteNomeById[v.empresa_id] || 'Sem cliente';
  const secondaryOf = (v) => (subGroupBy === 'associado' ? (empresaNomeById[v.empresa_id] || 'Sem cliente associado') : (v.operacao || 'Sem operação'));

  const groups = useMemo(() => {
    const map = new Map();
    veiculos.forEach(v => {
      const p = primaryOf(v);
      const s = secondaryOf(v);
      if (!map.has(p)) map.set(p, new Map());
      const sub = map.get(p);
      if (!sub.has(s)) sub.set(s, []);
      sub.get(s).push(v);
    });
    const byName = (a, b) => a.localeCompare(b, 'pt-BR');
    return [...map.entries()].sort((a, b) => byName(a[0], b[0])).map(([name, sub]) => {
      const subs = [...sub.entries()].sort((a, b) => byName(a[0], b[0])).map(([subName, items]) => ({ name: subName, items }));
      const all = subs.flatMap(s => s.items);
      return { name, subs, total: all.length, inativos: contaInativos(all), mensalidade: somaAtiva(all) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veiculos, subGroupBy, empresaNomeById, clienteNomeById]);

  const todosRecolhidos = groups.length > 0 && groups.every(g => collapsed[g.name]);
  const setAll = (value) => setCollapsed(Object.fromEntries(groups.map(g => [g.name, value])));

  return (
    <div className="space-y-3">
      <div className="flex justify-end text-sm">
        {groups.length > 1 && (
          <button type="button" onClick={() => setAll(!todosRecolhidos)} className="text-gray-400 hover:text-white">
            {todosRecolhidos ? 'Expandir tudo' : 'Recolher tudo'}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px] space-y-4">
          {/* Cabeçalho das colunas (uma vez só, vale para todos os grupos) */}
          <div className={`${COLS} px-4 text-xs font-medium text-gray-400`}>
            {SORTABLE.map(c => {
              const active = sort.key === c.key;
              return (
                <div key={c.key} className={c.right ? 'text-right' : ''}>
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    aria-label={`Ordenar por ${c.label}`}
                    className={`inline-flex items-center gap-1.5 hover:text-white ${active ? 'text-white' : ''} ${c.right ? 'flex-row-reverse' : ''}`}
                  >
                    {c.label}
                    {active && (sort.dir === 'asc' ? <FaArrowUp size={9} /> : <FaArrowDown size={9} />)}
                  </button>
                </div>
              );
            })}
            <div />
          </div>

          {groups.map(g => {
            const isCollapsed = Boolean(collapsed[g.name]);
            return (
              <section key={g.name} className="rounded-xl border border-gray-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCollapsed(prev => ({ ...prev, [g.name]: !prev[g.name] }))}
                  aria-expanded={!isCollapsed}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-900/80 hover:bg-gray-800/60 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/50"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <FaChevronDown size={11} className={`text-gray-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                    <span className="font-semibold text-white truncate">{g.name}</span>
                    <span className="text-xs bg-gray-800 text-gray-300 rounded-md px-2 py-0.5 tabular-nums">{g.total}</span>
                    {g.inativos > 0 && <span className="text-xs text-red-400 tabular-nums">{g.inativos} {g.inativos === 1 ? 'inativo' : 'inativos'}</span>}
                  </span>
                  <span className="text-sm text-gray-400 tabular-nums whitespace-nowrap">{BRL(g.mensalidade)} <span className="text-gray-600">/ mês</span></span>
                </button>

                {!isCollapsed && g.subs.map(sub => {
                  const key = `${g.name}|${sub.name}`;
                  const limit = shown[key] || INITIAL_ROWS;
                  const visible = sub.items.slice(0, limit);
                  return (
                    <div key={sub.name} className="border-t border-gray-800">
                      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-gray-900/30">
                        <span className="text-sm text-gray-300">
                          {sub.name} <span className="text-gray-500 tabular-nums">({sub.items.length})</span>
                        </span>
                        <span className="text-xs text-gray-500 tabular-nums">{BRL(somaAtiva(sub.items))}</span>
                      </div>
                      <div className="divide-y divide-gray-800/70">
                        {visible.map(v => (
                          <div key={v.id} onClick={() => onOpen(v)} className={`${COLS} px-4 py-2.5 hover:bg-gray-800/40 transition-colors text-sm cursor-pointer`}>
                            <div className="font-semibold text-white tracking-wide truncate">{v.placa}</div>
                            <div className="text-gray-400 truncate">{v.modelo || <Dash />}</div>
                            <div className="text-gray-400 tabular-nums truncate">{v.id_instalado || <Dash />}</div>
                            <div className="text-gray-300"><StatusDot tone={v.status === 'Ativo' ? 'ok' : 'bad'}>{v.status || '—'}</StatusDot></div>
                            <div className="text-right tabular-nums whitespace-nowrap text-gray-200">{v.mensalidade != null ? BRL(v.mensalidade) : <Dash />}</div>
                            <div className="flex justify-end">
                              <ActionButton title="Ver detalhes" hover="hover:text-blue-400" onClick={(e) => { e.stopPropagation(); onOpen(v); }}><FaExpandAlt size={13} /></ActionButton>
                            </div>
                          </div>
                        ))}
                        {sub.items.length > visible.length && (
                          <button
                            type="button"
                            onClick={() => setShown(prev => ({ ...prev, [key]: limit + MORE_ROWS }))}
                            className="w-full px-4 py-2.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-800/40 transition-colors"
                          >
                            Mostrar mais ({sub.items.length - visible.length} restantes)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
