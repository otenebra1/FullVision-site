import React, { useState, useEffect, useRef } from 'react';
import {
  FaSearch, FaPlus, FaTimes, FaChevronLeft, FaChevronRight, FaChevronDown, FaCheck, FaArrowUp, FaArrowDown,
} from 'react-icons/fa';
import { DateInput } from '../ui/FormControls';

// ==========================================
// Utilitários e componentes do padrão visual do painel
// (todas as abas usam os mesmos: busca, filtros combináveis, tabela e paginação)
// ==========================================
export const BRL = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Normaliza texto pra busca: ignora acento e maiúsculas ("racao" acha "RAÇÃO")
export const norm = (s) => (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const formatDateBR = (iso) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR') : '');

export const mkOptions = (list) => list.map(v => ({ value: v, label: v, values: [v] }));
export const uniqueSorted = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));

export function sortBy(list, sort, getters) {
  const get = getters[sort.key];
  if (!get) return list;
  const mult = sort.dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * mult;
    return String(x ?? '').localeCompare(String(y ?? ''), 'pt-BR', { numeric: true }) * mult;
  });
}

export const nextSort = (sort, key) => (
  sort.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
);

// Nomes das opções marcadas (um grupo inteiro marcado aparece só como o nome do grupo)
export function summarizeSelection(options, selected) {
  const covered = new Set();
  const labels = [];
  options.forEach(o => {
    if (o.values.length > 1 && o.values.every(v => selected.includes(v))) {
      labels.push(o.label);
      o.values.forEach(v => covered.add(v));
    }
  });
  options.forEach(o => {
    if (o.values.length === 1 && selected.includes(o.value) && !covered.has(o.value)) labels.push(o.label);
  });
  return labels;
}

export const chipText = (name, labels, plural = 'selecionados') => (
  labels.length <= 2 ? `${name}: ${labels.join(', ')}` : `${name}: ${labels.length} ${plural}`
);

export const inputBase = 'bg-gray-950 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500/50';
export const filterBtnBase = 'inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50';
export const filterBtnOff = 'border-gray-800 bg-gray-950 text-gray-300 hover:border-gray-700 hover:text-white';
export const filterBtnOn = 'border-blue-500/60 bg-blue-500/10 text-white';

// Classes compartilhadas das tabelas
export const tableWrap = 'overflow-x-auto rounded-xl border border-gray-800';
export const theadClass = 'bg-gray-900/80 border-b border-gray-800';
export const tbodyClass = 'divide-y divide-gray-800/70';
export const rowClass = 'hover:bg-gray-800/40 transition-colors';

export const Dash = () => <span className="text-gray-600">—</span>;

// Cartões de números (topo do painel e resumos de cada aba)
export function StatStrip({ items, colsClass, spanLast = false }) {
  return (
    <div className={`grid ${colsClass} gap-px bg-gray-800 border border-gray-800 rounded-2xl overflow-hidden`}>
      {items.map((it, i) => {
        const cls = `bg-gray-900 px-5 py-4 block ${spanLast && i === items.length - 1 ? 'col-span-2 lg:col-span-1' : ''}`;
        const inner = (
          <>
            <div className="text-sm text-gray-400">{it.label}</div>
            <div className={`mt-1 text-2xl font-semibold tabular-nums ${it.valueClass || 'text-white'}`}>{it.value}</div>
          </>
        );
        return it.href
          ? <a key={it.label} href={it.href} className={`${cls} hover:bg-gray-800/80 transition-colors`}>{inner}</a>
          : <div key={it.label} className={cls}>{inner}</div>;
      })}
    </div>
  );
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-gray-800 overflow-x-auto" role="tablist">
      {tabs.map(t => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors rounded-t-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${active === t.key ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
        >
          {t.label}
          {t.count != null && <span className="ml-2 text-xs text-gray-500 tabular-nums">{t.count}</span>}
          {active === t.key && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-blue-500" />}
        </button>
      ))}
    </div>
  );
}

export function SectionCard({ title, action, children }) {
  return (
    <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PrimaryButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
    >
      <FaPlus size={11} /> {children}
    </button>
  );
}

export function ActionButton({ title, onClick, hover = 'hover:text-white', children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`text-gray-500 ${hover} p-2 rounded-md hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50`}
    >
      {children}
    </button>
  );
}

export const TONE_DOT = {
  ok: 'bg-emerald-400',
  bad: 'bg-red-400',
  warn: 'bg-amber-400',
  info: 'bg-blue-400',
  muted: 'bg-gray-500',
};

export function StatusDot({ tone = 'muted', children }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[tone]}`} />
      {children}
    </span>
  );
}

// Cabeçalho de coluna (clicável quando recebe sortKey)
export function Th({ children, sortKey, sort, onSort, align = 'left' }) {
  const base = `px-4 py-3 text-xs font-medium text-gray-400 whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`;
  if (!sortKey) return <th className={base}>{children}</th>;
  const active = sort && sort.key === sortKey;
  return (
    <th className={base} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1.5 hover:text-white ${active ? 'text-white' : ''} ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {children}
        {active ? (sort.dir === 'asc' ? <FaArrowUp size={9} /> : <FaArrowDown size={9} />) : <span className="w-[9px]" />}
      </button>
    </th>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative flex-1 min-w-[220px]">
      <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full pl-9 pr-8 py-2 ${inputBase}`}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-1">
          <FaTimes size={11} />
        </button>
      )}
    </div>
  );
}

// Botão que abre um painel flutuante (fecha clicando fora ou com Esc)
export function FilterShell({ label, count = 0, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest?.('[data-floating]')) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`${filterBtnBase} ${count > 0 ? filterBtnOn : filterBtnOff}`}
      >
        {label}
        {count > 0 && (
          <span className="bg-blue-600 text-white text-[11px] font-semibold rounded-full min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center tabular-nums">{count}</span>
        )}
        <FaChevronDown size={10} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 w-72 max-w-[calc(100vw-3rem)] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
          {children}
        </div>
      )}
    </div>
  );
}

export function OptionList({ options, selected, onChange, searchable }) {
  const [q, setQ] = useState('');
  const visible = searchable && q ? options.filter(o => norm(o.label).includes(norm(q))) : options;
  const hasSelection = selected.length > 0;

  const toggle = (opt) => {
    const all = opt.values.every(v => selected.includes(v));
    onChange(all
      ? selected.filter(v => !opt.values.includes(v))
      : Array.from(new Set([...selected, ...opt.values])));
  };

  return (
    <>
      {searchable && (
        <div className="p-2 border-b border-gray-800">
          <input
            autoFocus
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Procurar..."
            className={`w-full px-3 py-1.5 ${inputBase}`}
          />
        </div>
      )}
      <div className="max-h-64 overflow-y-auto py-1">
        {visible.length === 0 && <div className="px-3 py-3 text-sm text-gray-500">Nada encontrado.</div>}
        {visible.map(opt => {
          const checked = opt.values.every(v => selected.includes(v));
          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => toggle(opt)}
              className={`w-full flex items-center gap-3 py-2 pr-3 text-left text-sm hover:bg-gray-800/70 ${opt.indent ? 'pl-8' : 'pl-3'}`}
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-blue-600 border-blue-600' : 'border-gray-600'}`}>
                {checked && <FaCheck size={9} className="text-white" />}
              </span>
              <span className={`flex-1 truncate ${checked ? 'text-white' : 'text-gray-300'}`}>{opt.label}</span>
              {opt.hint && <span className="text-xs text-gray-500">{opt.hint}</span>}
            </button>
          );
        })}
      </div>
      {hasSelection && (
        <div className="border-t border-gray-800 p-2">
          <button type="button" onClick={() => onChange([])} className="text-xs text-gray-400 hover:text-white px-2 py-1">Limpar seleção</button>
        </div>
      )}
    </>
  );
}

// Filtro de múltipla escolha. options: [{ value, label, values: [..], indent?, hint? }]
export function FilterDropdown({ label, options, selected, onChange, searchable = false }) {
  const count = summarizeSelection(options, selected).length;
  return (
    <FilterShell label={label} count={count}>
      <OptionList options={options} selected={selected} onChange={onChange} searchable={searchable} />
    </FilterShell>
  );
}

export function DateRangeFilter({ label = 'Período', from, to, onChange }) {
  const count = from || to ? 1 : 0;
  return (
    <FilterShell label={label} count={count}>
      <div className="p-3 space-y-3">
        <label className="block text-xs text-gray-400">
          De
          <DateInput value={from} onChange={e => onChange({ from: e.target.value, to })} className={`mt-1 w-full px-3 py-2 ${inputBase}`} />
        </label>
        <label className="block text-xs text-gray-400">
          Até
          <DateInput value={to} onChange={e => onChange({ from, to: e.target.value })} className={`mt-1 w-full px-3 py-2 ${inputBase}`} />
        </label>
        {count > 0 && (
          <button type="button" onClick={() => onChange({ from: '', to: '' })} className="text-xs text-gray-400 hover:text-white">Limpar período</button>
        )}
      </div>
    </FilterShell>
  );
}

export function ToggleFilter({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`${filterBtnBase} ${active ? filterBtnOn : filterBtnOff}`}>
      {label}
    </button>
  );
}

// Linha com a contagem de resultados + filtros aplicados (cada um removível)
export function FilterSummary({ total, noun, chips, onClearAll, extra }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span className="text-gray-400"><span className="text-white font-medium tabular-nums">{total}</span> {noun}</span>
      {chips.map(c => (
        <span key={c.key} className="inline-flex items-center gap-1.5 bg-gray-800/80 border border-gray-700 rounded-full pl-3 pr-1.5 py-1 text-xs text-gray-200">
          {c.label}
          <button type="button" onClick={c.onRemove} aria-label={`Remover filtro ${c.label}`} className="text-gray-500 hover:text-white p-0.5">
            <FaTimes size={10} />
          </button>
        </span>
      ))}
      {chips.length > 0 && (
        <button type="button" onClick={onClearAll} className="text-xs text-blue-400 hover:text-blue-300">Limpar filtros</button>
      )}
      {extra && <span className="sm:ml-auto text-gray-400">{extra}</span>}
    </div>
  );
}

export function Pagination({ page, totalPages, total, perPage, onPage }) {
  if (total === 0) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  const navBtn = 'p-2 rounded-md hover:bg-gray-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-400">
      <span>Mostrando <span className="text-white tabular-nums">{from}–{to}</span> de <span className="tabular-nums">{total}</span></span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} aria-label="Página anterior" className={navBtn}><FaChevronLeft size={11} /></button>
        <span className="px-2 tabular-nums">Página {page} de {totalPages}</span>
        <button type="button" onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} aria-label="Próxima página" className={navBtn}><FaChevronRight size={11} /></button>
      </div>
    </div>
  );
}

// Linha de resumo (usada tanto pro grupo quanto pela unidade filha)
// Deadline do contrato: vermelho se venceu, âmbar se vence em até 30 dias
function DeadlineCell({ data }) {
  if (!data) return <Dash />;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((new Date(data + 'T00:00:00') - hoje) / 86400000);
  const cls = dias < 0 ? 'text-red-400' : dias <= 30 ? 'text-amber-400' : 'text-gray-300';
  return <span className={cls} title={dias < 0 ? 'Contrato vencido' : `Vence em ${dias} dia(s)`}>{formatDateBR(data)}</span>;
}

export function ResumoRow({ nome, isGrupo, total, ativos, inativos, mensalidade, faturamento, custoTotal, contratoFim, onEditContrato }) {
  const num = (n) => `px-4 py-3 text-right tabular-nums ${n === 0 ? 'text-gray-600' : 'text-gray-300'}`;
  return (
    <tr className={isGrupo ? 'bg-gray-800/40' : rowClass}>
      <td className={`px-4 py-3 ${isGrupo ? 'text-white font-semibold' : 'pl-9 text-gray-300'}`}>{nome}</td>
      <td className={num(total)}>{total}</td>
      <td className={num(ativos)}>{ativos}</td>
      <td className={num(inativos)}>{inativos}</td>
      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-gray-300">{BRL(mensalidade)}</td>
      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-gray-300">{BRL(faturamento)}</td>
      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-gray-300">{BRL(custoTotal)}</td>
      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
        {onEditContrato ? (
          <button type="button" onClick={onEditContrato} title="Alterar deadline do contrato" className="hover:underline decoration-gray-600 underline-offset-4">
            <DeadlineCell data={contratoFim} />
          </button>
        ) : <DeadlineCell data={contratoFim} />}
      </td>
    </tr>
  );
}


// Seletor de opções lado a lado (ex.: "Agrupar por: Cliente | Operação | Lista")
export function SegmentedControl({ label, options, value, onChange }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {label && <span className="text-gray-500">{label}</span>}
      <div className="inline-flex rounded-lg border border-gray-800 overflow-hidden" role="group" aria-label={label}>
        {options.map(o => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={value === o.key}
            className={`px-3 py-1.5 transition-colors ${value === o.key ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
