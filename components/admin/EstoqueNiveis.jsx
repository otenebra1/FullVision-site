// components/admin/EstoqueNiveis.jsx
// Aba "Estoque mínimo" do painel: quanto tem de cada produto, mínimo e ideal, e os materiais por quantidade.
//   - Produto por SERIAL (rastreador, sensor): conta os itens no estoque central ou com técnico.
//   - Produto por QUANTIDADE (material): saldo com entrada, saída e ajuste (inventário).
//   - Abaixo do mínimo: o banco abre sozinho uma solicitação de compra (cai no fluxo de /compras).
// ADM edita mínimo/ideal e cria material; funcionário movimenta.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaSpinner, FaPlus, FaArrowDown, FaArrowUp, FaBalanceScale, FaHistory, FaExclamationCircle, FaShoppingCart } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { tableWrap, theadClass, tbodyClass, rowClass, StatStrip, SectionCard, SearchInput, Th, inputBase, norm } from './ui';

const UNIDADES = ['UN', 'PCT', 'CX', 'M', 'KG', 'L', 'PAR', 'KIT', 'ROLO'];
const num = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const lerNum = (s) => { const t = String(s ?? '').trim(); if (!t) return null; const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); return Number.isFinite(n) ? n : null; };
const quando = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const inputCls = `w-full px-3 py-2 ${inputBase}`;
const SOL_ABERTA = (s) => s !== 'FINALIZADA' && s !== 'RECUSADA';

function Modal({ titulo, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full p-6 space-y-4 my-10" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white">{titulo}</h3>
        {children}
      </div>
    </div>
  );
}
const Campo = ({ label, ajuda, children }) => (
  <label className="block space-y-1.5">
    <span className="text-sm text-gray-300">{label}</span>
    {children}
    {ajuda && <span className="block text-xs text-gray-500">{ajuda}</span>}
  </label>
);

export default function EstoqueNiveis({ isAdmin, showToast, onSolicitar }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [contagem, setContagem] = useState({});
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [mov, setMov] = useState(null);        // { produto, tipo }
  const [historico, setHistorico] = useState(null); // { produto, lista }
  const [novo, setNovo] = useState(false);

  const carregar = useCallback(async () => {
    try { await supabase.rpc('fv_estoque_verificar_todos'); } catch { /* ignora */ }
    const [p, c, r, s] = await Promise.all([
      supabase.from('estoque_produtos').select('*').order('codigo'),
      supabase.from('estoque_categorias').select('*').order('ordem'),
      supabase.from('rastreadores').select('produto_id, status'),
      supabase.from('fin_solicitacoes').select('id, produto_id, status, quantidade, created_at').not('produto_id', 'is', null),
    ]);
    if (p.error) setErro(p.error.message);
    else if (p.data?.length && !('controle' in p.data[0])) setErro('Rode o SQL 20261126h_estoque_minimo.sql no Supabase para ligar o estoque mínimo.');
    else setErro('');
    setProdutos(p.data || []);
    setCategorias(c.data || []);
    const cont = {};
    (r.data || []).forEach(x => {
      if (!x.produto_id) return;
      const k = x.produto_id;
      cont[k] = cont[k] || { estoque: 0, tecnico: 0, instalado: 0 };
      if (x.status === 'estoque_central') cont[k].estoque += 1;
      else if (x.status === 'estoque_tecnico') cont[k].tecnico += 1;
      else if (x.status === 'instalado') cont[k].instalado += 1;
    });
    setContagem(cont);
    setSolicitacoes(s.data || []);
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const catPorId = useMemo(() => Object.fromEntries(categorias.map(c => [c.id, c])), [categorias]);
  const linhas = useMemo(() => produtos.filter(p => p.ativo !== false).map(p => {
    const serial = p.controle !== 'QUANTIDADE';
    const ct = contagem[p.id] || { estoque: 0, tecnico: 0, instalado: 0 };
    const disponivel = serial ? ct.estoque + ct.tecnico : Number(p.saldo || 0);
    const minimo = p.estoque_minimo == null ? null : Number(p.estoque_minimo);
    const pedido = solicitacoes.find(s => s.produto_id === p.id && SOL_ABERTA(s.status));
    let situacao = 'ok';
    if (minimo == null) situacao = 'sem';
    else if (disponivel <= 0) situacao = 'zerado';
    else if (disponivel < minimo) situacao = 'baixo';
    return { p, serial, ct, disponivel, minimo, pedido, situacao, cat: catPorId[p.categoria_id] };
  }), [produtos, contagem, solicitacoes, catPorId]);

  const filtradas = linhas
    .filter(l => filtro === 'todos' || (filtro === 'alerta' ? ['baixo', 'zerado'].includes(l.situacao) : filtro === 'material' ? !l.serial : l.serial))
    .filter(l => !busca || norm(`${l.p.codigo} ${l.p.nome} ${l.cat?.nome || ''}`).includes(norm(busca)));

  const salvarCampo = async (p, campo, valor) => {
    const { error } = await supabase.from('estoque_produtos').update({ [campo]: valor }).eq('id', p.id);
    if (error) { showToast('Erro: ' + error.message, 'error'); return; }
    setProdutos(xs => xs.map(x => (x.id === p.id ? { ...x, [campo]: valor } : x)));
    if (campo === 'estoque_minimo' || campo === 'repor_automatico') {
      const { data } = await supabase.rpc('fv_estoque_verificar_minimo', { p_produto: p.id });
      if (data) { showToast('Ficou abaixo do mínimo: abri uma solicitação de compra.'); carregar(); }
    }
  };

  const abrirHistorico = async (p) => {
    const { data, error } = await supabase.from('estoque_movimentos').select('*').eq('produto_id', p.id).order('created_at', { ascending: false }).limit(100);
    if (error) { showToast(error.message, 'error'); return; }
    setHistorico({ produto: p, lista: data || [] });
  };

  if (carregando) return <div className="flex items-center justify-center py-16 text-gray-500"><FaSpinner className="animate-spin text-2xl mr-3" /> Carregando estoque...</div>;

  const alerta = linhas.filter(l => ['baixo', 'zerado'].includes(l.situacao));
  const semPedido = alerta.filter(l => !l.pedido);

  return (
    <div className="space-y-6">
      {erro && <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3"><FaExclamationCircle className="mt-0.5 shrink-0" /> {erro}</div>}

      <StatStrip
        colsClass="grid-cols-2 lg:grid-cols-4"
        items={[
          { label: 'Produtos com mínimo', value: linhas.filter(l => l.minimo != null).length },
          { label: 'Abaixo do mínimo', value: alerta.length, valueClass: alerta.length ? 'text-amber-300' : 'text-white' },
          { label: 'Zerados', value: linhas.filter(l => l.situacao === 'zerado').length, valueClass: linhas.some(l => l.situacao === 'zerado') ? 'text-red-300' : 'text-white' },
          { label: 'Compras de reposição em andamento', value: solicitacoes.filter(s => SOL_ABERTA(s.status)).length },
        ]}
      />

      <SectionCard
        title="Níveis do estoque"
        action={isAdmin && (
          <button type="button" onClick={() => setNovo(true)} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-lg text-sm font-semibold">
            <FaPlus size={11} /> Novo material
          </button>
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-gray-950 border border-gray-800">
            {[['todos', 'Todos'], ['alerta', 'Abaixo do mínimo'], ['material', 'Materiais (quantidade)'], ['serial', 'Com serial']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setFiltro(k)} className={`px-3 py-1.5 rounded-lg text-sm ${filtro === k ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}>{l}</button>
            ))}
          </div>
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar produto" />
        </div>

        {semPedido.length > 0 && (
          <div className="text-sm text-amber-200 bg-amber-950/40 border border-amber-500/40 rounded-xl px-4 py-3">
            {semPedido.length} produto(s) abaixo do mínimo sem compra em andamento (a reposição automática deles está desligada): {semPedido.map(l => l.p.nome).join(', ')}.
          </div>
        )}

        <div className={tableWrap}>
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <Th>Produto</Th>
                <Th align="right">Disponível</Th>
                <Th align="right">Mínimo</Th>
                <Th align="right">Repor até</Th>
                <Th>Situação</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {filtradas.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">Nada aqui.</td></tr>}
              {filtradas.map(l => (
                <tr key={l.p.id} className={rowClass}>
                  <td className="px-4 py-3">
                    <div className="text-white">{l.p.nome}</div>
                    <div className="text-xs text-gray-500">{l.p.codigo} · {l.serial ? 'controle por serial' : `material em ${l.p.unidade || 'UN'}`}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    <span className={l.situacao === 'zerado' ? 'text-red-300' : l.situacao === 'baixo' ? 'text-amber-300' : 'text-white'}>{num(l.disponivel)}</span>
                    {l.serial && <div className="text-xs text-gray-500">{l.ct.estoque} central · {l.ct.tecnico} c/ técnico · {l.ct.instalado} instalados</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <NumCell valor={l.p.estoque_minimo} disabled={!isAdmin} onSalvar={(v) => salvarCampo(l.p, 'estoque_minimo', v)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <NumCell valor={l.p.estoque_ideal} disabled={!isAdmin} placeholder={l.minimo != null ? num(l.minimo * 2) : ''} onSalvar={(v) => salvarCampo(l.p, 'estoque_ideal', v)} />
                  </td>
                  <td className="px-4 py-3">
                    {l.situacao === 'sem' && <span className="text-xs text-gray-500">Sem mínimo</span>}
                    {l.situacao === 'ok' && <span className="text-xs text-emerald-300">OK</span>}
                    {l.situacao === 'baixo' && <span className="text-xs text-amber-300">Abaixo do mínimo</span>}
                    {l.situacao === 'zerado' && <span className="text-xs text-red-300">Zerado</span>}
                    {l.pedido && <div className="text-xs text-blue-300">Compra de {num(l.pedido.quantidade)} em andamento</div>}
                    {isAdmin && l.minimo != null && (
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                        <input type="checkbox" checked={l.p.repor_automatico !== false} onChange={e => salvarCampo(l.p, 'repor_automatico', e.target.checked)} /> pedir compra sozinho
                      </label>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {!l.serial ? (
                      <div className="inline-flex gap-0.5">
                        <button type="button" title="Entrada" onClick={() => setMov({ produto: l.p, tipo: 'ENTRADA' })} className="text-gray-400 hover:text-emerald-300 p-2 rounded-md hover:bg-gray-800"><FaArrowDown size={12} /></button>
                        <button type="button" title="Saída" onClick={() => setMov({ produto: l.p, tipo: 'SAIDA' })} className="text-gray-400 hover:text-red-300 p-2 rounded-md hover:bg-gray-800"><FaArrowUp size={12} /></button>
                        <button type="button" title="Contagem (ajuste de inventário)" onClick={() => setMov({ produto: l.p, tipo: 'AJUSTE' })} className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-800"><FaBalanceScale size={12} /></button>
                        <button type="button" title="Histórico" onClick={() => abrirHistorico(l.p)} className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-800"><FaHistory size={12} /></button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">entra/sai pela aba Estoque</span>
                    )}
                    {!l.pedido && onSolicitar && ['baixo', 'zerado'].includes(l.situacao) && (
                      <button type="button" title="Pedir compra agora" onClick={onSolicitar} className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-800 ml-0.5"><FaShoppingCart size={12} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">
          Quando um produto fica abaixo do mínimo, o sistema abre uma solicitação de compra com a quantidade para chegar no "repor até"
          (vazio = o dobro do mínimo). Ela segue o fluxo normal: ADM aprova, compras orça, compra e entrega. Material entregue entra no saldo sozinho.
          Para os produtos com serial, conta o que está no estoque central e com os técnicos.
        </p>
      </SectionCard>

      {mov && (
        <MovimentoModal mov={mov} showToast={showToast} onClose={() => setMov(null)} onDone={() => { setMov(null); carregar(); }} />
      )}
      {historico && (
        <Modal titulo={`Histórico: ${historico.produto.nome}`} onClose={() => setHistorico(null)}>
          {historico.lista.length === 0 ? <p className="text-sm text-gray-500">Sem movimentos.</p> : (
            <ul className="divide-y divide-gray-800 text-sm max-h-[60vh] overflow-y-auto">
              {historico.lista.map(m => (
                <li key={m.id} className="py-2 flex items-start gap-3">
                  <span className={`tabular-nums w-16 text-right shrink-0 ${m.quantidade >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{m.quantidade >= 0 ? '+' : ''}{num(m.quantidade)}</span>
                  <span className="flex-1 min-w-0 text-gray-300">
                    {m.tipo === 'AJUSTE' ? 'Contagem' : m.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}{m.motivo ? ` · ${m.motivo}` : ''}{m.pessoa ? ` · ${m.pessoa}` : ''}
                    <span className="block text-xs text-gray-500">{quando(m.created_at)}{m.usuario_nome ? ` · ${m.usuario_nome}` : ''} · saldo {num(m.saldo_apos)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setHistorico(null)} className="text-gray-400 hover:text-white text-sm">Fechar</button>
        </Modal>
      )}
      {novo && (
        <NovoMaterial categorias={categorias} showToast={showToast} onClose={() => setNovo(false)} onDone={() => { setNovo(false); carregar(); }} />
      )}
    </div>
  );
}

// Número editável na própria tabela (salva ao sair do campo)
function NumCell({ valor, onSalvar, disabled, placeholder }) {
  const [txt, setTxt] = useState(valor == null ? '' : String(valor).replace('.', ','));
  useEffect(() => { setTxt(valor == null ? '' : String(valor).replace('.', ',')); }, [valor]);
  if (disabled) return <span className="tabular-nums text-gray-300">{valor == null ? '—' : num(valor)}</span>;
  return (
    <input
      value={txt} placeholder={placeholder} inputMode="decimal"
      onChange={e => setTxt(e.target.value)}
      onBlur={() => { const v = lerNum(txt); if (v !== (valor == null ? null : Number(valor))) onSalvar(v); }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className={`w-20 text-right px-2 py-1 ${inputBase}`}
    />
  );
}

const MOTIVOS = {
  ENTRADA: ['Compra', 'Devolução de técnico', 'Sobra de viagem', 'Outro'],
  SAIDA: ['Instalação / OS', 'Viagem', 'Manutenção', 'Perda / avaria', 'Outro'],
  AJUSTE: ['Contagem de inventário'],
};

function MovimentoModal({ mov, showToast, onClose, onDone }) {
  const { produto, tipo } = mov;
  const [qtd, setQtd] = useState(tipo === 'AJUSTE' ? String(produto.saldo ?? 0).replace('.', ',') : '');
  const [motivo, setMotivo] = useState(MOTIVOS[tipo][0]);
  const [pessoa, setPessoa] = useState('');
  const [salvando, setSalvando] = useState(false);
  const titulo = tipo === 'ENTRADA' ? 'Entrada' : tipo === 'SAIDA' ? 'Saída' : 'Contagem (ajuste)';
  const salvar = async () => {
    const q = lerNum(qtd);
    if (q == null || q < 0 || (tipo !== 'AJUSTE' && q === 0)) return showToast('Quantidade inválida.', 'error');
    setSalvando(true);
    const { data, error } = await supabase.rpc('fv_estoque_movimentar', { p_produto: produto.id, p_tipo: tipo, p_quantidade: q, p_motivo: motivo, p_pessoa: pessoa || null });
    setSalvando(false);
    if (error) return showToast(error.message, 'error');
    showToast(`${titulo} registrada. Saldo: ${num(data)} ${produto.unidade || ''}`);
    onDone();
    return null;
  };
  return (
    <Modal titulo={`${titulo}: ${produto.nome}`} onClose={onClose}>
      <p className="text-sm text-gray-400">Saldo atual: {num(produto.saldo)} {produto.unidade}</p>
      <Campo label={tipo === 'AJUSTE' ? 'Quantidade contada' : `Quantidade (${produto.unidade || 'UN'})`} ajuda={tipo === 'AJUSTE' ? 'O saldo passa a ser exatamente este número.' : undefined}>
        <input value={qtd} onChange={e => setQtd(e.target.value)} inputMode="decimal" autoFocus className={inputCls} />
      </Campo>
      <Campo label="Motivo">
        <select value={motivo} onChange={e => setMotivo(e.target.value)} className={inputCls}>
          {MOTIVOS[tipo].map(m => <option key={m}>{m}</option>)}
        </select>
      </Campo>
      {tipo !== 'AJUSTE' && (
        <Campo label={tipo === 'SAIDA' ? 'Quem pegou / para qual OS (opcional)' : 'Observação (opcional)'}>
          <input value={pessoa} onChange={e => setPessoa(e.target.value)} className={inputCls} />
        </Campo>
      )}
      <div className="flex gap-3 pt-2">
        <button type="button" disabled={salvando} onClick={salvar} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
          {salvando && <FaSpinner className="animate-spin" />} Salvar
        </button>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
      </div>
    </Modal>
  );
}

function NovoMaterial({ categorias, showToast, onClose, onDone }) {
  const mat = categorias.find(c => c.codigo === 'MAT') || categorias[0];
  const [f, setF] = useState({ categoria_id: mat?.id || '', nome: '', unidade: 'UN', estoque_minimo: '', estoque_ideal: '', saldo: '' });
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const salvar = async () => {
    if (!f.categoria_id || !f.nome.trim()) return showToast('Informe categoria e nome.', 'error');
    setSalvando(true);
    const { data, error } = await supabase.from('estoque_produtos').insert({
      categoria_id: f.categoria_id, nome: f.nome.trim().toUpperCase(), controle: 'QUANTIDADE', unidade: f.unidade,
      estoque_minimo: lerNum(f.estoque_minimo), estoque_ideal: lerNum(f.estoque_ideal), ordem: 999,
    }).select('*').single();
    if (!error && lerNum(f.saldo) > 0) {
      const r = await supabase.rpc('fv_estoque_movimentar', { p_produto: data.id, p_tipo: 'AJUSTE', p_quantidade: lerNum(f.saldo), p_motivo: 'Saldo inicial', p_pessoa: null });
      if (r.error) showToast(r.error.message, 'error');
    }
    setSalvando(false);
    if (error) return showToast(error.message, 'error');
    showToast(`Material ${data.codigo} criado.`);
    onDone();
    return null;
  };
  return (
    <Modal titulo="Novo material (controle por quantidade)" onClose={onClose}>
      <Campo label="Categoria">
        <select value={f.categoria_id} onChange={e => set('categoria_id', e.target.value)} className={inputCls}>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}
        </select>
      </Campo>
      <Campo label="Nome"><input value={f.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex.: ABRAÇADEIRA 20CM" className={inputCls} /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Unidade">
          <select value={f.unidade} onChange={e => set('unidade', e.target.value)} className={inputCls}>{UNIDADES.map(u => <option key={u}>{u}</option>)}</select>
        </Campo>
        <Campo label="Quanto tem hoje"><input value={f.saldo} onChange={e => set('saldo', e.target.value)} inputMode="decimal" className={inputCls} /></Campo>
        <Campo label="Estoque mínimo"><input value={f.estoque_minimo} onChange={e => set('estoque_minimo', e.target.value)} inputMode="decimal" className={inputCls} /></Campo>
        <Campo label="Repor até"><input value={f.estoque_ideal} onChange={e => set('estoque_ideal', e.target.value)} inputMode="decimal" className={inputCls} /></Campo>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" disabled={salvando} onClick={salvar} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
          {salvando && <FaSpinner className="animate-spin" />} Criar
        </button>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
      </div>
    </Modal>
  );
}
