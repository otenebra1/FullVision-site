import React, { useMemo, useState } from 'react';
import { FaChevronDown, FaPen } from 'react-icons/fa';
import { BRL, Dash, SectionCard, PrimaryButton, SearchInput, SegmentedControl, ActionButton, formatDateBR, norm } from './ui';

const COLS = 'grid grid-cols-[minmax(180px,1.6fr)_70px_70px_70px_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_110px_44px] gap-x-4 items-center';
const VAZIO = { total: 0, ativos: 0, inativos: 0, mensalidade: 0, faturamento: 0, custoTotal: 0 };

function Deadline({ data }) {
  if (!data) return <Dash />;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((new Date(data + 'T00:00:00') - hoje) / 86400000);
  const cls = dias < 0 ? 'text-red-400' : dias <= 30 ? 'text-amber-400' : 'text-gray-300';
  return <span className={cls} title={dias < 0 ? 'Contrato vencido' : `Vence em ${dias} dia(s)`}>{formatDateBR(data)}</span>;
}

const n = (v, cls = '') => <div className={`text-right tabular-nums ${v === 0 ? 'text-gray-600' : 'text-gray-300'} ${cls}`}>{v}</div>;
const money = (v, cls = 'text-gray-300') => <div className={`text-right tabular-nums whitespace-nowrap ${cls}`}>{BRL(v)}</div>;

function Linha({ nome, r, contratoFim, onEdit, destaque, recuo }) {
  return (
    <>
      <div className={`truncate ${destaque ? 'font-semibold text-white' : 'text-gray-300'} ${recuo ? 'pl-5' : ''}`}>{nome}</div>
      {n(r.total, destaque ? 'text-white' : '')}
      {n(r.ativos)}
      {n(r.inativos, r.inativos > 0 ? 'text-red-400' : '')}
      {money(r.mensalidade)}
      {money(r.faturamento, 'text-emerald-400/90')}
      {money(r.custoTotal)}
      <div className="text-right tabular-nums whitespace-nowrap"><Deadline data={contratoFim} /></div>
      <div className="flex justify-end">
        <ActionButton title="Editar cliente" hover="hover:text-blue-400" onClick={(e) => { e.stopPropagation(); onEdit(); }}><FaPen size={11} /></ActionButton>
      </div>
    </>
  );
}

// Clientes organizados como o banco de veículos: busca, ordenação e grupos que abrem e fecham
export default function ClientesPanel({ hierarquia, resumoPorEmpresa, onNovo, onEditar }) {
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState('nome');
  const [collapsed, setCollapsed] = useState({});

  const blocos = useMemo(() => {
    const q = norm(busca.trim());
    const bate = (e) => !q || norm(e.nome).includes(q);
    const lista = [
      ...hierarquia.gruposComFilhos.map(({ grupo, resumo, filhos }) => {
        const filhosVisiveis = bate(grupo) ? filhos : filhos.filter(bate);
        return { empresa: grupo, resumo, filhos: filhosVisiveis, visivel: bate(grupo) || filhosVisiveis.length > 0 };
      }),
      ...hierarquia.avulsos.map(e => ({ empresa: e, resumo: resumoPorEmpresa[e.id] || VAZIO, filhos: [], visivel: bate(e) })),
    ].filter(b => b.visivel);
    const chave = {
      nome: (a, b) => a.empresa.nome.localeCompare(b.empresa.nome, 'pt-BR'),
      placas: (a, b) => b.resumo.total - a.resumo.total,
      faturamento: (a, b) => b.resumo.faturamento - a.resumo.faturamento,
      deadline: (a, b) => (a.empresa.contrato_fim || '9999').localeCompare(b.empresa.contrato_fim || '9999'),
    }[ordem];
    return lista.sort(chave);
  }, [hierarquia, resumoPorEmpresa, busca, ordem]);

  const totalClientes = blocos.reduce((s, b) => s + 1 + b.filhos.length, 0);
  const comFilhos = blocos.filter(b => b.filhos.length > 0);
  const todosRecolhidos = comFilhos.length > 0 && comFilhos.every(b => collapsed[b.empresa.id]);

  return (
    <SectionCard title="Clientes" action={<PrimaryButton onClick={onNovo}>Novo cliente</PrimaryButton>}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar cliente" />
        <SegmentedControl
          label="Ordenar por"
          value={ordem}
          onChange={setOrdem}
          options={[{ key: 'nome', label: 'Nome' }, { key: 'placas', label: 'Placas' }, { key: 'faturamento', label: 'Faturamento' }, { key: 'deadline', label: 'Deadline' }]}
        />
      </div>

      <div className="flex items-center justify-between text-sm text-gray-400">
        <span><span className="text-white font-medium tabular-nums">{totalClientes}</span> {totalClientes === 1 ? 'cliente' : 'clientes'}</span>
        {comFilhos.length > 0 && (
          <button type="button" onClick={() => setCollapsed(Object.fromEntries(comFilhos.map(b => [b.empresa.id, !todosRecolhidos])))} className="hover:text-white">
            {todosRecolhidos ? 'Expandir tudo' : 'Recolher tudo'}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1000px] space-y-3">
          <div className={`${COLS} px-4 text-xs font-medium text-gray-400`}>
            <div>Cliente</div>
            <div className="text-right">Placas</div>
            <div className="text-right">Ativos</div>
            <div className="text-right">Inativos</div>
            <div className="text-right">Mensalidade ativa</div>
            <div className="text-right">Faturamento</div>
            <div className="text-right">Custo total</div>
            <div className="text-right">Deadline</div>
            <div />
          </div>

          {blocos.length === 0 && (
            <div className="rounded-xl border border-gray-800 px-4 py-12 text-center text-gray-500">Nenhum cliente encontrado.</div>
          )}

          {blocos.map(({ empresa, resumo, filhos }) => {
            const temFilhos = filhos.length > 0;
            const fechado = Boolean(collapsed[empresa.id]);
            return (
              <section key={empresa.id} className="rounded-xl border border-gray-800 overflow-hidden">
                <div
                  role={temFilhos ? 'button' : undefined}
                  tabIndex={temFilhos ? 0 : undefined}
                  onClick={() => temFilhos && setCollapsed(p => ({ ...p, [empresa.id]: !p[empresa.id] }))}
                  onKeyDown={e => { if (temFilhos && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setCollapsed(p => ({ ...p, [empresa.id]: !p[empresa.id] })); } }}
                  className={`${COLS} px-4 py-2.5 text-sm bg-gray-900/80 ${temFilhos ? 'cursor-pointer hover:bg-gray-800/60' : ''} transition-colors`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {temFilhos
                      ? <FaChevronDown size={10} className={`shrink-0 text-gray-500 transition-transform ${fechado ? '-rotate-90' : ''}`} />
                      : <span className="w-[10px] shrink-0" />}
                    <span className="font-semibold text-white truncate">{empresa.nome}</span>
                    {temFilhos && <span className="text-xs bg-gray-800 text-gray-400 rounded-md px-1.5 py-0.5 tabular-nums shrink-0">{filhos.length} associados</span>}
                  </div>
                  {n(resumo.total, 'text-white font-medium')}
                  {n(resumo.ativos)}
                  {n(resumo.inativos, resumo.inativos > 0 ? 'text-red-400' : '')}
                  {money(resumo.mensalidade, 'text-white')}
                  {money(resumo.faturamento, 'text-emerald-400')}
                  {money(resumo.custoTotal, 'text-gray-300')}
                  <div className="text-right tabular-nums whitespace-nowrap"><Deadline data={empresa.contrato_fim} /></div>
                  <div className="flex justify-end">
                    <ActionButton title="Editar cliente" hover="hover:text-blue-400" onClick={(e) => { e.stopPropagation(); onEditar(empresa); }}><FaPen size={11} /></ActionButton>
                  </div>
                </div>

                {temFilhos && !fechado && (
                  <div className="divide-y divide-gray-800/70 border-t border-gray-800">
                    {filhos.map(f => (
                      <div key={f.id} className={`${COLS} px-4 py-2 text-sm hover:bg-gray-800/40 transition-colors`}>
                        <Linha nome={f.nome} r={resumoPorEmpresa[f.id] || VAZIO} contratoFim={f.contrato_fim} onEdit={() => onEditar(f)} recuo />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
