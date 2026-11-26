// components/admin/AuditoriaPanel.jsx
// Aba "Registro de alterações" do painel (só ADM): quem incluiu, alterou ou excluiu o quê, e quando.
// Os registros são gravados pelo banco (SQL 20261126j_auditoria.sql); ninguém edita nem apaga pela tela.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaSpinner, FaChevronDown, FaChevronRight, FaHistory, FaRobot, FaTimes } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { SectionCard, SearchInput, inputBase, tableWrap, theadClass, tbodyClass } from './ui';

const POR_PAGINA = 100;

export const NOMES_TABELA = {
  profiles: 'Usuários',
  empresas: 'Clientes',
  veiculos: 'Placas',
  rastreadores: 'Estoque (rastreadores)',
  tecnicos: 'Técnicos',
  ordens_servico: 'Ordens de serviço',
  solicitacoes_servico: 'Solicitações de serviço',
  servicos_catalogo: 'Catálogo de serviços',
  precos_cliente_padrao: 'Preço padrão do cliente',
  precos_cliente_empresa: 'Preço por cliente',
  mensalidade_cliente: 'Mensalidade do cliente',
  faixas_tecnico: 'Faixas do técnico',
  faixa_tecnico_precos: 'Preços da faixa do técnico',
  tecnico_precos: 'Preços do técnico',
  financeiro_config: 'Configuração financeira',
  fin_despesas: 'Gastos',
  fin_despesa_itens: 'Itens do gasto',
  fin_fornecedores: 'Fornecedores',
  fin_categorias: 'Categorias financeiras',
  fin_itens: 'Itens de compra',
  fin_solicitacoes: 'Solicitações de compra',
  fin_orcamentos: 'Orçamentos',
  fin_viagens: 'Viagens',
  fin_recebimentos: 'Contas a receber',
  fin_cobranca_config: 'Configuração de cobrança',
  fin_caixa_config: 'Configuração do caixa',
  nf_config: 'Configuração de nota fiscal',
  nf_notas: 'Notas fiscais',
  contratos: 'Contratos',
  contrato_modelo: 'Modelo de contrato',
  contrato_reajustes: 'Reajustes de contrato',
  estoque_produtos: 'Produtos do estoque',
  estoque_categorias: 'Categorias do estoque',
  chamados: 'Chamados de suporte',
};
const nomeTabela = (t) => NOMES_TABELA[t] || t;

const ACOES = {
  INCLUIU: { label: 'Incluiu', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  ALTEROU: { label: 'Alterou', cls: 'bg-blue-500/10 text-blue-300 border-blue-500/30' },
  EXCLUIU: { label: 'Excluiu', cls: 'bg-red-500/10 text-red-300 border-red-500/30' },
};

const quando = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
const nomeCampo = (k) => {
  const s = String(k).replace(/_id$/, '').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const DATA_ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

function valorTexto(v, k, nomes) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (k === 'empresa_id' && nomes.empresas[v]) return `${nomes.empresas[v]} (#${v})`;
  if (k === 'servico_id' && nomes.servicos[v]) return nomes.servicos[v];
  if (k === 'tecnico_id' && nomes.tecnicos[v]) return nomes.tecnicos[v];
  if (typeof v === 'string' && DATA_ISO.test(v)) {
    const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
    if (!Number.isNaN(d.getTime())) return v.length === 10 ? d.toLocaleDateString('pt-BR') : d.toLocaleString('pt-BR');
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function Detalhe({ r, nomes, onHistorico }) {
  const linhas = useMemo(() => {
    if (r.acao === 'ALTEROU') return (r.campos || []).map(k => ({ k, a: r.antes?.[k], d: r.depois?.[k] }));
    const base = r.acao === 'INCLUIU' ? r.depois : r.antes;
    return Object.keys(base || {}).filter(k => base[k] !== null && base[k] !== '' && !(Array.isArray(base[k]) && !base[k].length))
      .sort().map(k => ({ k, a: r.acao === 'EXCLUIU' ? base[k] : undefined, d: r.acao === 'INCLUIU' ? base[k] : undefined }));
  }, [r]);
  return (
    <div className="bg-gray-950/70 border-t border-gray-800 px-4 py-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>Tabela: <span className="text-gray-300">{r.tabela}</span></span>
        {r.registro_id && <span>Registro: <span className="text-gray-300 font-mono">{r.registro_id}</span></span>}
        {r.usuario_papel && <span>Perfil: <span className="text-gray-300">{r.usuario_papel}</span></span>}
        {r.registro_id && (
          <button type="button" onClick={() => onHistorico(r)} className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300">
            <FaHistory size={11} /> Ver todo o histórico deste registro
          </button>
        )}
      </div>
      {linhas.length === 0 ? <p className="text-sm text-gray-500">Sem campos para mostrar.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 text-left">
                <th className="py-1.5 pr-4 font-medium w-48">Campo</th>
                {r.acao !== 'INCLUIU' && <th className="py-1.5 pr-4 font-medium">{r.acao === 'EXCLUIU' ? 'Valor que tinha' : 'Antes'}</th>}
                {r.acao !== 'EXCLUIU' && <th className="py-1.5 font-medium">{r.acao === 'INCLUIU' ? 'Valor' : 'Depois'}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {linhas.map(l => (
                <tr key={l.k} className="align-top">
                  <td className="py-1.5 pr-4 text-gray-400">{nomeCampo(l.k)}</td>
                  {r.acao !== 'INCLUIU' && <td className={`py-1.5 pr-4 break-all ${r.acao === 'ALTEROU' ? 'text-red-300/90 line-through decoration-red-500/40' : 'text-gray-200'}`}>{valorTexto(l.a, l.k, nomes)}</td>}
                  {r.acao !== 'EXCLUIU' && <td className={`py-1.5 break-all ${r.acao === 'ALTEROU' ? 'text-emerald-300' : 'text-gray-200'}`}>{valorTexto(l.d, l.k, nomes)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AuditoriaPanel() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [maisCarregando, setMaisCarregando] = useState(false);
  const [temMais, setTemMais] = useState(false);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(null);
  const [tabelas, setTabelas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [nomes, setNomes] = useState({ empresas: {}, servicos: {}, tecnicos: {} });

  const [tabela, setTabela] = useState('');
  const [acao, setAcao] = useState('');
  const [usuario, setUsuario] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [semAuto, setSemAuto] = useState(false);
  const [registro, setRegistro] = useState(null); // { tabela, registro_id, rotulo }

  // busca com pequena espera para não consultar a cada letra
  useEffect(() => { const t = setTimeout(() => setBuscaAplicada(busca.trim()), 400); return () => clearTimeout(t); }, [busca]);

  useEffect(() => {
    (async () => {
      const [t, u, e, s, tc] = await Promise.all([
        supabase.rpc('fv_auditoria_tabelas'),
        supabase.from('profiles').select('id, username, role').in('role', ['admin', 'funcionario', 'tecnico']).order('username'),
        supabase.from('empresas').select('id, nome'),
        supabase.from('servicos_catalogo').select('id, nome'),
        supabase.from('tecnicos').select('id, nome'),
      ]);
      if (!t.error) setTabelas((t.data || []).map(x => (typeof x === 'string' ? x : Object.values(x)[0])));
      if (!u.error) setUsuarios(u.data || []);
      const mapa = (r) => Object.fromEntries((r.data || []).map(x => [x.id, x.nome]));
      setNomes({ empresas: mapa(e), servicos: mapa(s), tecnicos: mapa(tc) });
    })();
  }, []);

  const montarConsulta = useCallback((desde) => {
    let q = supabase.from('fv_auditoria').select('*').order('created_at', { ascending: false }).order('id', { ascending: false });
    if (registro) q = q.eq('tabela', registro.tabela).eq('registro_id', registro.registro_id);
    else {
      if (tabela) q = q.eq('tabela', tabela);
      if (acao) q = q.eq('acao', acao);
      if (usuario === 'sistema') q = q.is('usuario_id', null);
      else if (usuario) q = q.eq('usuario_id', usuario);
      if (de) q = q.gte('created_at', new Date(`${de}T00:00:00`).toISOString());
      if (ate) q = q.lt('created_at', new Date(new Date(`${ate}T00:00:00`).getTime() + 86400000).toISOString());
      if (semAuto) q = q.eq('automatico', false);
      if (buscaAplicada) {
        const t = buscaAplicada.replace(/[%,()]/g, ' ');
        q = q.or(`rotulo.ilike.%${t}%,registro_id.ilike.%${t}%,usuario_nome.ilike.%${t}%`);
      }
    }
    return q.range(desde, desde + POR_PAGINA - 1);
  }, [registro, tabela, acao, usuario, de, ate, semAuto, buscaAplicada]);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setAberto(null);
    montarConsulta(0).then(({ data, error }) => {
      if (!vivo) return;
      if (error) {
        setErro(/fv_auditoria/.test(error.message) && /does not exist|not find/i.test(error.message)
          ? 'Rode o SQL 20261126j_auditoria.sql no Supabase para ligar o registro de alterações.'
          : error.message);
        setLista([]); setTemMais(false);
      } else {
        setErro(''); setLista(data || []); setTemMais((data || []).length === POR_PAGINA);
      }
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, [montarConsulta]);

  const carregarMais = async () => {
    setMaisCarregando(true);
    const { data, error } = await montarConsulta(lista.length);
    if (!error) { setLista(l => [...l, ...(data || [])]); setTemMais((data || []).length === POR_PAGINA); }
    setMaisCarregando(false);
  };

  const limpar = () => { setTabela(''); setAcao(''); setUsuario(''); setDe(''); setAte(''); setBusca(''); setSemAuto(false); };
  const temFiltro = tabela || acao || usuario || de || ate || busca || semAuto;
  const selectCls = `px-3 py-2 ${inputBase}`;

  return (
    <SectionCard title="Registro de alterações">
      <p className="text-sm text-gray-400 -mt-2">
        Tudo o que foi incluído, alterado ou excluído no sistema, com quem fez e quando. Ninguém consegue apagar estes registros pela tela.
      </p>

      {registro ? (
        <div className="flex flex-wrap items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 text-sm">
          <FaHistory className="text-blue-400" />
          <span className="text-gray-200">Histórico de <b>{nomeTabela(registro.tabela)}</b>{registro.rotulo ? `: ${registro.rotulo}` : ` #${registro.registro_id}`}</span>
          <button type="button" onClick={() => setRegistro(null)} className="ml-auto inline-flex items-center gap-1 text-gray-300 hover:text-white"><FaTimes size={11} /> Voltar para todos</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="w-full sm:w-64"><SearchInput value={busca} onChange={setBusca} placeholder="Buscar placa, nome, serial, usuário..." /></div>
          <select value={tabela} onChange={e => setTabela(e.target.value)} className={selectCls} aria-label="Onde">
            <option value="">Todas as áreas</option>
            {[...tabelas].sort((a, b) => nomeTabela(a).localeCompare(nomeTabela(b), 'pt-BR')).map(t => <option key={t} value={t}>{nomeTabela(t)}</option>)}
          </select>
          <select value={acao} onChange={e => setAcao(e.target.value)} className={selectCls} aria-label="Ação">
            <option value="">Todas as ações</option>
            {Object.entries(ACOES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={usuario} onChange={e => setUsuario(e.target.value)} className={selectCls} aria-label="Quem">
            <option value="">Todos os usuários</option>
            <option value="sistema">Sistema (automático)</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.username || u.id.slice(0, 8)}</option>)}
          </select>
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-400">De <input type="date" value={de} onChange={e => setDe(e.target.value)} className={`px-2 py-1.5 ${inputBase}`} /></label>
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-400">Até <input type="date" value={ate} onChange={e => setAte(e.target.value)} className={`px-2 py-1.5 ${inputBase}`} /></label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
            <input type="checkbox" checked={semAuto} onChange={e => setSemAuto(e.target.checked)} className="accent-blue-500" />
            Só o que pessoas fizeram
          </label>
          {temFiltro && <button type="button" onClick={limpar} className="text-xs text-gray-400 hover:text-white">Limpar filtros</button>}
        </div>
      )}

      {erro && <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-xl px-4 py-3 text-sm">{erro}</div>}

      {carregando ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-10 justify-center"><FaSpinner className="animate-spin" /> Carregando...</div>
      ) : !erro && lista.length === 0 ? (
        <p className="text-sm text-gray-500 py-10 text-center">Nenhuma alteração encontrada{temFiltro ? ' com esses filtros' : ''}.</p>
      ) : !erro && (
        <div className={tableWrap}>
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-semibold w-8" />
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Quando</th>
                <th className="px-4 py-3 font-semibold">Quem</th>
                <th className="px-4 py-3 font-semibold">Ação</th>
                <th className="px-4 py-3 font-semibold">Onde</th>
                <th className="px-4 py-3 font-semibold">Registro</th>
                <th className="px-4 py-3 font-semibold">O que mudou</th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {lista.map(r => {
                const ab = aberto === r.id;
                const a = ACOES[r.acao] || ACOES.ALTEROU;
                const rot = r.rotulo && r.rotulo !== r.registro_id ? r.rotulo
                  : (r.tabela === 'precos_cliente_padrao' || r.tabela === 'precos_cliente_empresa' || r.tabela === 'mensalidade_cliente')
                    ? (nomes.empresas[(r.depois || r.antes)?.empresa_id] || nomes.servicos[(r.depois || r.antes)?.servico_id] || r.rotulo)
                    : r.rotulo;
                return (
                  <React.Fragment key={r.id}>
                    <tr className={`cursor-pointer transition-colors ${ab ? 'bg-gray-800/50' : 'hover:bg-gray-800/40'}`} onClick={() => setAberto(ab ? null : r.id)}>
                      <td className="px-4 py-2.5 text-gray-500">{ab ? <FaChevronDown size={11} /> : <FaChevronRight size={11} />}</td>
                      <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap tabular-nums">{quando(r.created_at)}</td>
                      <td className="px-4 py-2.5 text-gray-200 whitespace-nowrap">
                        {r.usuario_nome || '—'}
                        {r.automatico && <FaRobot className="inline ml-1.5 text-gray-500" size={11} title="Feito automaticamente pelo sistema" />}
                      </td>
                      <td className="px-4 py-2.5"><span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${a.cls}`}>{a.label}</span></td>
                      <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">{nomeTabela(r.tabela)}</td>
                      <td className="px-4 py-2.5 text-white max-w-[16rem] truncate" title={rot || r.registro_id || ''}>{rot || (r.registro_id ? `#${r.registro_id.slice(0, 12)}` : '—')}</td>
                      <td className="px-4 py-2.5 text-gray-400 max-w-[20rem] truncate">
                        {r.acao === 'ALTEROU' ? (r.campos || []).map(nomeCampo).join(', ') : r.acao === 'INCLUIU' ? 'Novo registro' : 'Registro apagado'}
                      </td>
                    </tr>
                    {ab && (
                      <tr><td colSpan={7} className="p-0">
                        <Detalhe r={r} nomes={nomes} onHistorico={(x) => { setRegistro({ tabela: x.tabela, registro_id: x.registro_id, rotulo: rot }); }} />
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!carregando && temMais && (
        <div className="flex justify-center">
          <button type="button" onClick={carregarMais} disabled={maisCarregando} className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-4 py-2 disabled:opacity-50">
            {maisCarregando && <FaSpinner className="animate-spin" />} Carregar mais
          </button>
        </div>
      )}
    </SectionCard>
  );
}
