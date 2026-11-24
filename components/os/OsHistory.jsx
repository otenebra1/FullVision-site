import React, { useEffect, useMemo, useState } from 'react';
import { FaCamera, FaChevronDown, FaTrashAlt } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import {
  BRL, norm, formatDateBR, mkOptions, uniqueSorted, summarizeSelection, chipText,
  SectionCard, PrimaryButton, StatStrip, SearchInput, FilterDropdown, DateRangeFilter,
  ToggleFilter, FilterSummary, ActionButton,
} from '../admin/ui';
import { FOTO_TIPOS, osCodigo, splitServicos } from '../../lib/osConstants';
import OsDetalhe from './OsDetalhe';

const GROUP_OPTIONS = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'tecnico', label: 'Técnico' },
  { key: 'mes', label: 'Mês' },
];
const INITIAL_PER_GROUP = 12;
const TOTAL_FOTOS = FOTO_TIPOS.length;
const COR_CLIENTE = 'text-emerald-400'; // valor cobrado do cliente
const COR_TECNICO = 'text-amber-400'; // valor pago ao técnico

const labelMes = (ym) => (
  ym && ym !== 'sem-data'
    ? new Date(`${ym}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : 'Sem data'
);

function groupKeyOf(o, groupBy) {
  if (groupBy === 'tecnico') return o.tecnico_nome || 'Sem técnico';
  if (groupBy === 'mes') return (o.data || '').slice(0, 7) || 'sem-data';
  return o.empresas?.nome || 'Sem empresa';
}

// Situação das fotos: base da prova de que o serviço foi documentado
function fotosStatus(o, count) {
  if (o.fotos_legado_nota) return 'legado';
  if (count == null) return 'carregando';
  return count >= TOTAL_FOTOS ? 'ok' : 'incompleta';
}

function FotosBadge({ status, count }) {
  if (status === 'carregando') return <span className="w-12" />;
  if (status === 'legado') return <span className="text-xs text-gray-500" title="OS importada da planilha original">legado</span>;
  const ok = status === 'ok';
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs tabular-nums ${ok ? 'text-gray-400' : 'text-amber-400'}`}
      title={ok ? 'Todas as fotos obrigatórias enviadas' : 'Faltam fotos obrigatórias'}
    >
      <FaCamera size={11} /> {count || 0}/{TOTAL_FOTOS}
    </span>
  );
}

function OsRow({ os, status, count, showTecnico, onOpen, onDelete }) {
  const placa = os.veiculos?.placa || os.placa_texto || '—';
  const servicos = splitServicos(os.servico_realizado);
  const visiveis = servicos.slice(0, 3);
  const extra = servicos.length - visiveis.length;
  return (
    <div className="group flex items-center gap-2 hover:bg-gray-800/40 transition-colors">
      <button
        type="button"
        onClick={() => onOpen(os)}
        className="flex-1 min-w-0 grid grid-cols-[1fr_auto] sm:grid-cols-[150px_1fr_auto] gap-x-4 gap-y-1 items-center text-left px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/50"
      >
        <div className="min-w-0">
          <div className="font-semibold text-white tracking-wide truncate">{placa}</div>
          {showTecnico && <div className="text-xs text-gray-500 truncate">{os.tecnico_nome}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 col-span-2 sm:col-span-1 order-3 sm:order-none">
          {visiveis.map(s => (
            <span key={s} className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-full px-2.5 py-0.5">{s}</span>
          ))}
          {extra > 0 && <span className="text-xs text-gray-500">+{extra}</span>}
        </div>
        <div className="flex items-center gap-4 justify-end">
          {os.status === 'aberta'
            ? <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-0.5">Aberta</span>
            : <FotosBadge status={status} count={count} />}
          <span className="text-sm text-gray-400 tabular-nums w-[84px] text-right">{formatDateBR(os.data)}</span>
        </div>
      </button>
      <div className="pr-2">
        {onDelete && <ActionButton title={`Excluir ${osCodigo(os.id)}`} hover="hover:text-red-400" onClick={() => onDelete(os.id)}><FaTrashAlt size={13} /></ActionButton>}
      </div>
    </div>
  );
}

// Histórico de OS: agrupado por cliente (ou técnico/mês), com filtros combináveis e detalhe com fotos
export default function OsHistory({ ordens, empresaOptions, rastreadores, onNew, onDelete, onFinalizar, onUpdated }) {
  const [search, setSearch] = useState('');
  const [empresas, setEmpresas] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [soIncompletas, setSoIncompletas] = useState(false);
  const [tecnico, setTecnico] = useState('');
  const [groupBy, setGroupBy] = useState('cliente');
  const [collapsed, setCollapsed] = useState({});
  const [shown, setShown] = useState({});
  const [fotosCount, setFotosCount] = useState(null);
  const [detalhe, setDetalhe] = useState(null);

  // Quantas fotos cada OS tem (pagina de 1000 em 1000: limite padrão do Supabase)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const counts = {};
      let from = 0;
      for (;;) {
        const { data, error } = await supabase
          .from('ordens_servico_fotos').select('ordem_servico_id').order('id').range(from, from + 999);
        if (error || !data) break;
        data.forEach(r => { counts[r.ordem_servico_id] = (counts[r.ordem_servico_id] || 0) + 1; });
        if (data.length < 1000) break;
        from += 1000;
      }
      if (!cancelled) setFotosCount(counts);
    })();
    return () => { cancelled = true; };
  }, [ordens.length]);

  const countOf = (o) => (fotosCount ? (fotosCount[o.id] || 0) : null);
  const servicoOptions = useMemo(() => mkOptions(uniqueSorted(ordens.flatMap(o => splitServicos(o.servico_realizado)))), [ordens]);

  // Tudo menos o técnico: assim a coluna de técnicos mostra quantas OS cada um tem dentro dos outros filtros
  const base = useMemo(() => {
    const q = norm(search.trim());
    return ordens.filter(o => {
      if (q) {
        const placa = o.veiculos?.placa || o.placa_texto || '';
        const texto = norm([placa, o.tecnico_nome, o.servico_realizado, o.empresas?.nome, o.local_instalacao, o.observacoes].join(' '));
        if (!texto.includes(q)) return false;
      }
      if (empresas.length && !empresas.includes(o.empresa_id)) return false;
      if (servicos.length && !splitServicos(o.servico_realizado).some(s => servicos.includes(s))) return false;
      if (dateFrom && (o.data || '') < dateFrom) return false;
      if (dateTo && (o.data || '') > dateTo) return false;
      if (soIncompletas && fotosStatus(o, countOf(o)) !== 'incompleta') return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordens, search, empresas, servicos, dateFrom, dateTo, soIncompletas, fotosCount]);

  const tecnicos = useMemo(() => {
    const map = new Map();
    base.forEach(o => { const n = o.tecnico_nome || 'Sem técnico'; map.set(n, (map.get(n) || 0) + 1); });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [base]);

  const filtered = useMemo(
    () => (tecnico ? base.filter(o => (o.tecnico_nome || 'Sem técnico') === tecnico) : base),
    [base, tecnico],
  );

  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach(o => {
      const k = groupKeyOf(o, groupBy);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(o);
    });
    const list = [...map.entries()].map(([key, items]) => {
      const sorted = [...items].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
      return {
        key,
        label: groupBy === 'mes' ? labelMes(key) : key,
        items: sorted,
        faturado: sorted.reduce((s, o) => s + (Number(o.faturamento_cliente) || 0), 0),
        custo: sorted.reduce((s, o) => s + (Number(o.custo_tecnico) || 0), 0),
      };
    });
    list.sort((a, b) => (groupBy === 'mes' ? b.key.localeCompare(a.key) : a.label.localeCompare(b.label, 'pt-BR')));
    return list;
  }, [filtered, groupBy]);

  const totais = useMemo(() => {
    const faturado = filtered.reduce((s, o) => s + (Number(o.faturamento_cliente) || 0), 0);
    const custo = filtered.reduce((s, o) => s + (Number(o.custo_tecnico) || 0), 0);
    return { faturado, custo };
  }, [filtered]);

  const clearAll = () => {
    setSearch(''); setEmpresas([]); setServicos([]); setDateFrom(''); setDateTo(''); setSoIncompletas(false); setTecnico('');
  };

  const chips = useMemo(() => {
    const c = [];
    if (search.trim()) c.push({ key: 'q', label: `Busca: ${search.trim()}`, onRemove: () => setSearch('') });
    const emp = summarizeSelection(empresaOptions, empresas);
    if (emp.length) c.push({ key: 'emp', label: chipText('Cliente', emp, 'selecionados'), onRemove: () => setEmpresas([]) });
    const srv = summarizeSelection(servicoOptions, servicos);
    if (srv.length) c.push({ key: 'srv', label: chipText('Serviço', srv), onRemove: () => setServicos([]) });
    if (dateFrom || dateTo) {
      const periodo = dateFrom && dateTo
        ? `${formatDateBR(dateFrom)} a ${formatDateBR(dateTo)}`
        : dateFrom ? `a partir de ${formatDateBR(dateFrom)}` : `até ${formatDateBR(dateTo)}`;
      c.push({ key: 'per', label: `Período: ${periodo}`, onRemove: () => { setDateFrom(''); setDateTo(''); } });
    }
    if (soIncompletas) c.push({ key: 'inc', label: 'Fotos incompletas', onRemove: () => setSoIncompletas(false) });
    if (tecnico) c.push({ key: 'tec', label: `Técnico: ${tecnico}`, onRemove: () => setTecnico('') });
    return c;
  }, [search, empresaOptions, empresas, servicoOptions, servicos, dateFrom, dateTo, soIncompletas, tecnico]);

  const toggleGroup = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  const todosRecolhidos = groups.length > 0 && groups.every(g => collapsed[g.key]);
  const setAllCollapsed = (value) => setCollapsed(Object.fromEntries(groups.map(g => [g.key, value])));

  return (
    <SectionCard title="Ordens de serviço" action={<PrimaryButton onClick={onNew}>Nova OS</PrimaryButton>}>
      <StatStrip
        colsClass="grid-cols-1 sm:grid-cols-2"
        items={[
          { label: 'Cobrado do cliente', value: BRL(totais.faturado), valueClass: COR_CLIENTE },
          { label: 'Pago ao técnico', value: BRL(totais.custo), valueClass: COR_TECNICO },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por placa, cliente, técnico ou serviço" />
        <FilterDropdown label="Cliente" options={empresaOptions} selected={empresas} onChange={setEmpresas} searchable />
        <FilterDropdown label="Serviço" options={servicoOptions} selected={servicos} onChange={setServicos} />
        <DateRangeFilter from={dateFrom} to={dateTo} onChange={({ from, to }) => { setDateFrom(from); setDateTo(to); }} />
        <ToggleFilter label="Fotos incompletas" active={soIncompletas} onClick={() => setSoIncompletas(v => !v)} />
      </div>

      <FilterSummary
        total={filtered.length}
        noun={filtered.length === 1 ? 'ordem de serviço' : 'ordens de serviço'}
        chips={chips}
        onClearAll={clearAll}
        extra={chips.length > 0 ? 'Os valores acima refletem os filtros aplicados' : null}
      />

      <div className="flex flex-col md:flex-row gap-5">
        {/* Técnicos (com contagem) */}
        <nav aria-label="Filtrar por técnico" className="md:w-56 shrink-0">
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
            {[['', 'Todos', base.length], ...tecnicos.map(([n, c]) => [n, n, c])].map(([value, label, count]) => (
              <button
                key={label}
                type="button"
                onClick={() => setTecnico(value)}
                aria-pressed={tecnico === value}
                className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm whitespace-nowrap text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${tecnico === value ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
              >
                <span className="truncate">{label}</span>
                <span className={`text-xs tabular-nums ${tecnico === value ? 'text-blue-100' : 'text-gray-500'}`}>{count}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Lista agrupada */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Agrupar por</span>
              <div className="inline-flex rounded-lg border border-gray-800 overflow-hidden" role="group" aria-label="Agrupar por">
                {GROUP_OPTIONS.map(g => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => { setGroupBy(g.key); setCollapsed({}); }}
                    aria-pressed={groupBy === g.key}
                    className={`px-3 py-1.5 transition-colors ${groupBy === g.key ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            {groups.length > 1 && (
              <button type="button" onClick={() => setAllCollapsed(!todosRecolhidos)} className="text-gray-400 hover:text-white">
                {todosRecolhidos ? 'Expandir tudo' : 'Recolher tudo'}
              </button>
            )}
          </div>

          {groups.length === 0 ? (
            <div className="rounded-xl border border-gray-800 px-4 py-12 text-center text-gray-500">
              Nenhuma ordem de serviço encontrada{chips.length > 0 ? ' com esses filtros.' : '.'}
              {chips.length > 0 && (
                <button type="button" onClick={clearAll} className="block mx-auto mt-2 text-sm text-blue-400 hover:text-blue-300">Limpar filtros</button>
              )}
            </div>
          ) : (
            groups.map(g => {
              const isCollapsed = Boolean(collapsed[g.key]);
              const limit = shown[g.key] || INITIAL_PER_GROUP;
              const visible = g.items.slice(0, limit);
              return (
                <section key={g.key} className="rounded-xl border border-gray-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.key)}
                    aria-expanded={!isCollapsed}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-900/80 hover:bg-gray-800/60 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/50"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <FaChevronDown size={11} className={`text-gray-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                      <span className="font-semibold text-white truncate first-letter:uppercase">{g.label}</span>
                      <span className="text-xs bg-gray-800 text-gray-300 rounded-md px-2 py-0.5 tabular-nums">{g.items.length}</span>
                    </span>
                    <span className="hidden sm:flex items-center gap-5 text-sm tabular-nums whitespace-nowrap">
                      <span className="text-gray-500">Cliente <span className={`font-medium ${COR_CLIENTE}`}>{BRL(g.faturado)}</span></span>
                      <span className="text-gray-500">Técnico <span className={`font-medium ${COR_TECNICO}`}>{BRL(g.custo)}</span></span>
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="divide-y divide-gray-800/70 border-t border-gray-800">
                      {visible.map(o => (
                        <OsRow
                          key={o.id}
                          os={o}
                          status={fotosStatus(o, countOf(o))}
                          count={countOf(o)}
                          showTecnico={groupBy !== 'tecnico'}
                          onOpen={setDetalhe}
                          onDelete={onDelete}
                        />
                      ))}
                      {g.items.length > visible.length && (
                        <button
                          type="button"
                          onClick={() => setShown(prev => ({ ...prev, [g.key]: limit + 25 }))}
                          className="w-full px-4 py-3 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-800/40 transition-colors"
                        >
                          Mostrar mais ({g.items.length - visible.length} restantes)
                        </button>
                      )}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>

      {detalhe && (
        <OsDetalhe
          os={detalhe}
          rastreadores={rastreadores}
          onClose={() => setDetalhe(null)}
          onDelete={onDelete ? (id) => { setDetalhe(null); onDelete(id); } : undefined}
          onFinalizar={onFinalizar ? (os) => { setDetalhe(null); onFinalizar(os); } : null}
          onUpdated={onUpdated}
        />
      )}
    </SectionCard>
  );
}
