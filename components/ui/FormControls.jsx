// components/ui/FormControls.jsx
// Dropdown, campo de data (com calendário) e campo com sugestões no padrão visual do site.
// São trocas diretas dos nativos: <select> → <Select>, <input type="date"> → <DateInput>,
// <input list=...> → <Combobox>. O onChange recebe { target: { value, name } }, igual ao nativo.
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaChevronDown, FaChevronLeft, FaChevronRight, FaCheck, FaRegCalendarAlt, FaSearch } from 'react-icons/fa';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// ---------- utilidades ----------

// Classes de largura/margem vão para o contêiner; o resto (cor, borda, padding) vai para o campo
const LAYOUT_RE = /^(?:[a-z0-9]+:)?(?:w-|max-w-|min-w-|m[trblxy]?-|-m[trblxy]?-|flex-|shrink|grow|basis-|self-|col-|row-|order-)|^(?:[a-z0-9]+:)?(?:block|inline-block|flex-1|hidden)$/;
function splitClasses(className = '') {
  const layout = [];
  const field = [];
  className.split(/\s+/).filter(Boolean).forEach(c => (LAYOUT_RE.test(c) ? layout : field).push(c));
  return { layout: layout.join(' '), field: field.join(' ') };
}

const textOf = (node) => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node.props) return textOf(node.props.children);
  return '';
};

// Lê <option> (inclusive dentro de fragments e arrays) para { value, label, disabled }
function optionsFromChildren(children) {
  const out = [];
  const walk = (nodes) => React.Children.forEach(nodes, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) { walk(child.props.children); return; }
    if (child.type === 'option') {
      const label = textOf(child.props.children);
      out.push({ value: String(child.props.value ?? label), label, disabled: Boolean(child.props.disabled) });
    } else if (child.type === 'optgroup') {
      walk(child.props.children);
    }
  });
  walk(children);
  return out;
}

const fakeEvent = (value, name) => ({ target: { value, name }, currentTarget: { value, name } });

// Painel flutuante preso ao campo (renderizado no body para não ser cortado por modais com rolagem)
function useFloating(open, anchorRef, onClose) {
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const panelH = panelRef.current?.offsetHeight || 300;
    const below = vh - r.bottom;
    const openUp = below < panelH + 12 && r.top > below;
    const width = Math.max(r.width, 0);
    const left = Math.min(Math.max(8, r.left), Math.max(8, vw - Math.max(width, panelRef.current?.offsetWidth || width) - 8));
    setPos({ left, width, top: openUp ? undefined : r.bottom + 6, bottom: openUp ? vh - r.top + 6 : undefined });
  }, [anchorRef]);

  useIsoLayoutEffect(() => { if (open) update(); }, [open, update]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (anchorRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    const raf = requestAnimationFrame(update); // reposiciona depois de saber a altura real do painel
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, update, onClose, anchorRef]);

  return { panelRef, pos };
}

function FloatingPanel({ open, pos, panelRef, minWidth, className = '', children }) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={panelRef}
      data-floating=""
      style={{
        position: 'fixed', zIndex: 120, left: pos?.left ?? -9999, top: pos?.top, bottom: pos?.bottom,
        minWidth: minWidth ?? pos?.width, visibility: pos ? 'visible' : 'hidden',
      }}
      className={`bg-gray-900 border border-gray-700 rounded-xl shadow-2xl shadow-black/50 text-sm text-white ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}

// Campo escondido só para o "required" do formulário funcionar
function RequiredProxy({ value, required, name }) {
  if (!required) return null;
  return (
    <input
      tabIndex={-1} aria-hidden="true" required name={name} value={value || ''} onChange={() => {}}
      className="absolute inset-x-0 bottom-0 h-px w-full opacity-0 pointer-events-none"
    />
  );
}

const fieldBase = 'w-full flex items-center justify-between gap-2 text-left outline-none transition-colors focus-within:border-blue-500 focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed';

// ---------- Select ----------

export function Select({
  value, onChange, children, options: optionsProp, className = '', placeholder = 'Selecione...',
  disabled, required, name, id, searchable, 'aria-label': ariaLabel, title,
}) {
  const options = useMemo(() => optionsProp || optionsFromChildren(children), [optionsProp, children]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(-1);
  const anchorRef = useRef(null);
  const listRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  const { panelRef, pos } = useFloating(open, anchorRef, close);
  const { layout, field } = splitClasses(className);

  const current = options.find(o => o.value === String(value ?? ''));
  const showSearch = searchable ?? options.length > 8;
  const shown = useMemo(() => {
    const n = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const t = n(q.trim());
    return t ? options.filter(o => n(o.label).includes(t)) : options;
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setActive(Math.max(0, options.findIndex(o => o.value === String(value ?? ''))));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const pick = (o) => {
    if (!o || o.disabled) return;
    setOpen(false);
    anchorRef.current?.querySelector('button')?.focus();
    if (o.value !== String(value ?? '')) onChange?.(fakeEvent(o.value, name));
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(shown.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(shown[active]); }
    else if (e.key === 'Tab') setOpen(false);
  };

  const isPlaceholder = !current || current.value === '';

  return (
    <div ref={anchorRef} className={`relative ${layout || 'inline-block'}`} onKeyDown={onKeyDown}>
      <button
        type="button" id={id} disabled={disabled} title={title} aria-label={ariaLabel}
        aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={`${field} ${fieldBase} ${open ? 'border-blue-500' : ''}`}
      >
        <span className={`truncate tabular-nums lining-nums ${isPlaceholder ? 'text-gray-400' : ''}`}>{current ? current.label : placeholder}</span>
        <FaChevronDown size={10} className={`shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <RequiredProxy value={value} required={required} name={name} />

      <FloatingPanel open={open} pos={pos} panelRef={panelRef} className="overflow-hidden">
        {showSearch && (
          <div className="p-2 border-b border-gray-800">
            <div className="relative">
              <FaSearch size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                autoFocus value={q} onChange={e => { setQ(e.target.value); setActive(0); }} placeholder="Buscar..."
                className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-8 pr-2 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}
        <ul ref={listRef} role="listbox" className="max-h-64 overflow-y-auto py-1">
          {shown.map((o, i) => {
            const sel = o.value === String(value ?? '');
            return (
              <li
                key={`${o.value}-${i}`} data-idx={i} role="option" aria-selected={sel}
                onMouseEnter={() => setActive(i)}
                onMouseDown={e => e.preventDefault()}
                onClick={() => pick(o)}
                className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer ${o.disabled ? 'opacity-40 cursor-not-allowed' : ''} ${i === active ? 'bg-gray-800' : ''} ${sel ? 'text-white' : 'text-gray-300'} ${o.value === '' ? 'text-gray-400' : ''}`}
              >
                <span className="truncate tabular-nums lining-nums">{o.label}</span>
                {sel && <FaCheck size={10} className="text-blue-400 shrink-0" />}
              </li>
            );
          })}
          {shown.length === 0 && <li className="px-3 py-3 text-gray-500">Nada encontrado</li>}
        </ul>
      </FloatingPanel>
    </div>
  );
}

// ---------- DateInput (calendário) ----------

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const pad = (n) => String(n).padStart(2, '0');
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const fmtBR = (iso) => { const d = parseIso(iso); return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : ''; };

/**
 * Campo de data com calendário. value: 'AAAA-MM-DD' (ou 'AAAA-MM-DDTHH:MM' com withTime).
 * Também aceita digitar dd/mm/aaaa.
 */
export function DateInput({
  value, onChange, className = '', placeholder, disabled, required, name, id, withTime = false,
  min, max, 'aria-label': ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  const { panelRef, pos } = useFloating(open, anchorRef, close);
  const { layout, field } = splitClasses(className);

  const datePart = (value || '').slice(0, 10);
  const timePart = withTime ? ((value || '').slice(11, 16) || '') : '';
  const selected = parseIso(datePart);
  const [view, setView] = useState(() => selected || new Date());
  const [texto, setTexto] = useState(fmtBR(datePart));
  useEffect(() => { setTexto(fmtBR(datePart)); }, [datePart]);
  useEffect(() => { if (open) setView(selected || new Date()); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (dateIso, time = timePart) => {
    let v = dateIso || '';
    if (withTime && v) v = `${v}T${time || '08:00'}`;
    if (v !== (value || '')) onChange?.(fakeEvent(v, name));
  };

  const minD = parseIso(min);
  const maxD = parseIso(max);
  const fora = (d) => (minD && d < minD) || (maxD && d > maxD);

  const ano = view.getFullYear();
  const mes = view.getMonth();
  const primeiro = new Date(ano, mes, 1);
  const inicio = new Date(ano, mes, 1 - primeiro.getDay());
  const dias = Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
  const hojeIso = toIso(new Date());

  const onTextCommit = () => {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim());
    if (!texto.trim()) { emit(''); return; }
    if (m) {
      const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      if (d.getDate() === Number(m[1])) { emit(toIso(d)); return; }
    }
    setTexto(fmtBR(datePart));
  };

  const mascara = (s) => {
    const dg = s.replace(/\D/g, '').slice(0, 8);
    if (dg.length <= 2) return dg;
    if (dg.length <= 4) return `${dg.slice(0, 2)}/${dg.slice(2)}`;
    return `${dg.slice(0, 2)}/${dg.slice(2, 4)}/${dg.slice(4)}`;
  };

  return (
    <div ref={anchorRef} className={`relative ${layout || 'inline-block'}`}>
      <div className={`${field} ${fieldBase} ${open ? 'border-blue-500' : ''} ${disabled ? 'opacity-50' : ''}`}>
        <input
          id={id} disabled={disabled} aria-label={ariaLabel} inputMode="numeric"
          value={texto} placeholder={placeholder || 'dd/mm/aaaa'}
          onChange={e => setTexto(mascara(e.target.value))}
          onBlur={onTextCommit}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onTextCommit(); } if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } }}
          onFocus={() => setOpen(true)}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder-gray-500 tabular-nums lining-nums"
        />
        {withTime && datePart && <span className="text-gray-400 tabular-nums lining-nums">{timePart}</span>}
        <button type="button" tabIndex={-1} disabled={disabled} onClick={() => setOpen(o => !o)} aria-label="Abrir calendário" className="text-gray-500 hover:text-white shrink-0">
          <FaRegCalendarAlt size={13} />
        </button>
      </div>
      <RequiredProxy value={value} required={required} name={name} />

      <FloatingPanel open={open} pos={pos} panelRef={panelRef} minWidth={272} className="p-3 w-[272px]">
        <div onMouseDown={e => { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') e.preventDefault(); }}>
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setView(new Date(ano, mes - 1, 1))} aria-label="Mês anterior" className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800"><FaChevronLeft size={11} /></button>
            <div className="flex items-center gap-1 font-semibold">
              <span>{MESES[mes]}</span>
              <button type="button" onClick={() => setView(new Date(ano - 1, mes, 1))} className="px-1 text-gray-500 hover:text-white" aria-label="Ano anterior">‹</button>
              <span className="tabular-nums lining-nums">{ano}</span>
              <button type="button" onClick={() => setView(new Date(ano + 1, mes, 1))} className="px-1 text-gray-500 hover:text-white" aria-label="Próximo ano">›</button>
            </div>
            <button type="button" onClick={() => setView(new Date(ano, mes + 1, 1))} aria-label="Próximo mês" className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800"><FaChevronRight size={11} /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] text-gray-500 mb-1">
            {DIAS.map((d, i) => <div key={i} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {dias.map(d => {
              const iso = toIso(d);
              const doMes = d.getMonth() === mes;
              const sel = iso === datePart;
              const off = fora(d);
              return (
                <button
                  key={iso} type="button" disabled={off}
                  onClick={() => { emit(iso); if (!withTime) setOpen(false); }}
                  className={`h-8 rounded-md text-sm tabular-nums lining-nums transition-colors disabled:opacity-25 disabled:cursor-not-allowed
                    ${sel ? 'bg-blue-600 text-white font-semibold' : doMes ? 'text-gray-200 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-800/60'}
                    ${!sel && iso === hojeIso ? 'ring-1 ring-inset ring-blue-500/60' : ''}`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          {withTime && (
            <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-800">
              <span className="text-xs text-gray-400">Horário</span>
              <input
                type="time" value={timePart || ''} disabled={!datePart}
                onChange={e => emit(datePart, e.target.value)}
                className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-1 text-sm text-white outline-none focus:border-blue-500 [color-scheme:dark] disabled:opacity-40"
              />
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-800 text-xs">
            <button type="button" onClick={() => { emit(''); setOpen(false); }} className="text-gray-400 hover:text-white">Limpar</button>
            <button type="button" onClick={() => { emit(hojeIso); setView(new Date()); if (!withTime) setOpen(false); }} className="text-blue-400 hover:text-blue-300">Hoje</button>
            {withTime && <button type="button" onClick={() => setOpen(false)} className="text-white font-semibold">OK</button>}
          </div>
        </div>
      </FloatingPanel>
    </div>
  );
}

// ---------- Combobox (digitar ou escolher) ----------

export function Combobox({
  value, onChange, options = [], className = '', placeholder, disabled, required, name, id,
  autoCapitalize, 'aria-label': ariaLabel, inputClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const anchorRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  const { panelRef, pos } = useFloating(open, anchorRef, close);
  const { layout, field } = splitClasses(className);

  const lista = useMemo(() => options.map(o => (typeof o === 'string' ? { value: o, label: o } : o)), [options]);
  const shown = useMemo(() => {
    const t = String(value || '').trim().toLowerCase();
    if (!t || lista.some(o => o.value.toLowerCase() === t)) return lista;
    return lista.filter(o => o.label.toLowerCase().includes(t));
  }, [lista, value]);

  const pick = (o) => { onChange?.(fakeEvent(o.value, name)); setOpen(false); };

  return (
    <div ref={anchorRef} className={`relative ${layout || 'block'}`}>
      <div className={`${field} ${fieldBase} ${open ? 'border-blue-500' : ''}`}>
        <input
          id={id} name={name} disabled={disabled} required={required} aria-label={ariaLabel} autoComplete="off"
          autoCapitalize={autoCapitalize} value={value || ''} placeholder={placeholder}
          onChange={e => { onChange?.(fakeEvent(e.target.value, name)); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(shown.length - 1, i + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
            else if (e.key === 'Enter' && open && active >= 0 && shown[active]) { e.preventDefault(); pick(shown[active]); }
            else if (e.key === 'Tab') setOpen(false);
          }}
          className={`min-w-0 flex-1 bg-transparent outline-none placeholder-gray-500 tabular-nums lining-nums ${inputClassName}`}
        />
        {lista.length > 0 && (
          <button type="button" tabIndex={-1} onClick={() => setOpen(o => !o)} aria-label="Ver opções" className="text-gray-500 hover:text-white shrink-0">
            <FaChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      <FloatingPanel open={open && shown.length > 0} pos={pos} panelRef={panelRef} className="overflow-hidden">
        <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
          {shown.map((o, i) => (
            <li
              key={`${o.value}-${i}`} role="option" aria-selected={o.value === value}
              onMouseEnter={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => pick(o)}
              className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer ${i === active ? 'bg-gray-800' : ''} ${o.value === value ? 'text-white' : 'text-gray-300'} tabular-nums lining-nums`}
            >
              <span className="truncate">{o.label}</span>
              {o.hint && <span className="text-xs text-gray-500 shrink-0">{o.hint}</span>}
            </li>
          ))}
        </ul>
      </FloatingPanel>
    </div>
  );
}
