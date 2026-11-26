// Aba "Solicitações" do /financeiro: pedidos de compra da equipe.
// ADM aprova, recusa (com resposta) ou lança a compra, que vira um gasto ligado ao pedido.
import React, { useMemo, useState } from 'react';
import { FaCheck, FaTimes, FaShoppingCart, FaExternalLinkAlt } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import {
  inputBase, tableWrap, theadClass, tbodyClass, rowClass, Dash, SectionCard, PrimaryButton, ActionButton,
  SearchInput, FilterDropdown, ToggleFilter, StatusDot, norm,
} from '../admin/ui';
import { STATUS_SOLICITACAO, rotulo, reais, dataBR } from '../../lib/financeiro';
import { rotuloPerfil } from '../../lib/perfis';

const TOM = { PENDENTE: 'warn', APROVADA: 'info', COMPRADA: 'ok', RECUSADA: 'bad' };
const ABERTAS = ['PENDENTE', 'APROVADA'];

export default function SolicitacoesPanel({
  solicitacoes, itens, despesas, rastreadores, recarregar, showToast, onLancarCompra, onAbrirGasto, onNovaSolicitacao,
}) {
  const [busca, setBusca] = useState('');
  const [fStatus, setFStatus] = useState(ABERTAS);
  const [soUrgentes, setSoUrgentes] = useState(false);
  const [selecionadas, setSelecionadas] = useState([]);
  const [recusando, setRecusando] = useState(null); // solicitação
  const [resposta, setResposta] = useState('');

  const itemPorId = useMemo(() => Object.fromEntries(itens.map(i => [i.id, i])), [itens]);
  const despesaPorId = useMemo(() => Object.fromEntries(despesas.map(d => [d.id, d])), [despesas]);

  // Último preço pago por item (para estimar o custo do pedido)
  const ultimoPreco = useMemo(() => {
    const m = {};
    despesas.slice().sort((a, b) => (a.data < b.data ? -1 : 1)).forEach(d => (d.fin_despesa_itens || []).forEach(l => {
      if (l.item_id && Number(l.valor_unitario) > 0) m[l.item_id] = { valor: Number(l.valor_unitario), data: d.data };
    }));
    return m;
  }, [despesas]);

  // Disponível no estoque (rastreador, sensor, atuador ligados ao produto do item)
  const emEstoque = useMemo(() => {
    const m = {};
    rastreadores.forEach(r => {
      if (r.produto_id && (r.status === 'estoque_central' || r.status === 'estoque_tecnico')) m[r.produto_id] = (m[r.produto_id] || 0) + 1;
    });
    return m;
  }, [rastreadores]);

  const lista = useMemo(() => {
    const q = norm(busca);
    return solicitacoes
      .filter(s => (!fStatus.length || fStatus.includes(s.status)) && (!soUrgentes || s.urgencia === 'URGENTE')
        && (!q || norm(`${s.descricao} ${s.motivo} ${s.solicitante_nome} ${s.local_entrega || ''} ${s.centro_custo || ''}`).includes(q)))
      .sort((a, b) => (ABERTAS.includes(b.status) - ABERTAS.includes(a.status))
        || ((b.urgencia === 'URGENTE') - (a.urgencia === 'URGENTE'))
        || (a.created_at < b.created_at ? 1 : -1));
  }, [solicitacoes, busca, fStatus, soUrgentes]);

  const pendentes = solicitacoes.filter(s => s.status === 'PENDENTE').length;
  const aprovadas = solicitacoes.filter(s => s.status === 'APROVADA').length;
  const estimativa = (s) => (s.item_id && ultimoPreco[s.item_id] ? ultimoPreco[s.item_id].valor * Number(s.quantidade || 0) : null);

  const mudarStatus = async (s, status, extra = {}) => {
    const { error } = await supabase.from('fin_solicitacoes').update({ status, decidido_em: new Date().toISOString(), ...extra }).eq('id', s.id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(status === 'APROVADA' ? 'Solicitação aprovada.' : status === 'RECUSADA' ? 'Solicitação recusada.' : 'Atualizado.');
    recarregar();
  };

  const toggle = (id) => setSelecionadas(sel => (sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]));
  const lancar = (ids) => {
    const escolhidas = solicitacoes.filter(s => ids.includes(s.id));
    if (escolhidas.length) onLancarCompra(escolhidas);
    setSelecionadas([]);
  };

  const opcoesStatus = STATUS_SOLICITACAO.map(s => ({ value: s.value, label: s.label, values: [s.value] }));

  return (
    <SectionCard title="Solicitações de compra" action={<PrimaryButton onClick={onNovaSolicitacao}>Nova solicitação</PrimaryButton>}>
      <p className="text-sm text-gray-400">
        Pedidos feitos pela equipe no painel e no app do técnico.{' '}
        <span className="text-amber-400 tabular-nums">{pendentes}</span> pendente(s) e <span className="text-blue-300 tabular-nums">{aprovadas}</span> aprovada(s) aguardando compra.
        Para lançar a compra, marque um ou mais pedidos e clique em "Lançar compra": o gasto já vem com os itens e os pedidos ficam como comprados.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar item, motivo, quem pediu, local ou centro de custo" />
        <FilterDropdown label="Situação" options={opcoesStatus} selected={fStatus} onChange={setFStatus} />
        <ToggleFilter label="Só urgentes" active={soUrgentes} onClick={() => setSoUrgentes(v => !v)} />
        {selecionadas.length > 0 && (
          <button type="button" onClick={() => lancar(selecionadas)} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg text-sm font-semibold">
            <FaShoppingCart size={12} /> Lançar compra ({selecionadas.length})
          </button>
        )}
      </div>

      <div className={tableWrap}>
        <table className="w-full text-sm">
          <thead className={theadClass}>
            <tr>
              <th className="w-10" />
              {['Pedido em', 'Quem pediu', 'Item', 'Qtd', 'Motivo', 'Entrega / C. custo', 'Estoque', 'Estimativa', 'Situação', ''].map((h, i) => (
                <th key={i} className={`px-4 py-3 text-xs font-medium text-gray-400 whitespace-nowrap ${['Qtd', 'Estimativa', 'Estoque'].includes(h) || h === '' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className={tbodyClass}>
            {lista.length === 0 && <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-500">Nenhuma solicitação.</td></tr>}
            {lista.map(s => {
              const aberta = ABERTAS.includes(s.status);
              const est = estimativa(s);
              const prodId = itemPorId[s.item_id]?.produto_id;
              const despesa = despesaPorId[s.despesa_id];
              return (
                <tr key={s.id} className={`${rowClass} ${!aberta ? 'opacity-70' : ''}`}>
                  <td className="pl-4 py-3">
                    {aberta && <input type="checkbox" aria-label="Selecionar" checked={selecionadas.includes(s.id)} onChange={() => toggle(s.id)} className="accent-blue-500 w-4 h-4" />}
                  </td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                    {dataBR(String(s.created_at).slice(0, 10))}
                    {s.urgencia === 'URGENTE' && <div className="text-[11px] font-semibold text-red-400">URGENTE</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white">{s.solicitante_nome || <Dash />}</div>
                    {s.solicitante_perfil && <div className="text-xs text-gray-500">{rotuloPerfil(s.solicitante_perfil)}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white">{s.descricao}</div>
                    {s.item_id && itemPorId[s.item_id] && itemPorId[s.item_id].nome !== s.descricao && <div className="text-xs text-gray-500">{itemPorId[s.item_id].nome}</div>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-200 whitespace-nowrap">{Number(s.quantidade).toLocaleString('pt-BR')} {s.unidade}</td>
                  <td className="px-4 py-3 text-gray-300 max-w-[260px]">
                    <div className="whitespace-pre-wrap">{s.motivo}</div>
                    {s.resposta && <div className="text-xs text-gray-500 mt-1">Resposta: {s.resposta}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-300 max-w-[200px]">
                    {s.local_entrega || s.centro_custo ? (
                      <>
                        <div>{s.local_entrega || <Dash />}</div>
                        {s.centro_custo && <div className="text-xs text-gray-500">{s.centro_custo}</div>}
                      </>
                    ) : <Dash />}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    {prodId ? <span className={emEstoque[prodId] ? 'text-gray-200' : 'text-red-400'}>{emEstoque[prodId] || 0} disp.</span> : <Dash />}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-gray-300" title={est != null ? `Último preço: ${reais(ultimoPreco[s.item_id].valor)} em ${dataBR(ultimoPreco[s.item_id].data)}` : 'Sem compra anterior deste item'}>
                    {est != null ? reais(est) : <Dash />}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusDot tone={TOM[s.status]}>{rotulo(STATUS_SOLICITACAO, s.status)}</StatusDot>
                    {despesa && (
                      <button type="button" onClick={() => onAbrirGasto(despesa)} className="mt-1 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                        <FaExternalLinkAlt size={9} /> gasto de {reais(despesa.valor_total)}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {s.status === 'PENDENTE' && <ActionButton title="Aprovar" hover="hover:text-emerald-400" onClick={() => mudarStatus(s, 'APROVADA')}><FaCheck size={12} /></ActionButton>}
                      {aberta && <ActionButton title="Lançar compra" hover="hover:text-blue-400" onClick={() => lancar([s.id])}><FaShoppingCart size={12} /></ActionButton>}
                      {aberta && <ActionButton title="Recusar" hover="hover:text-red-400" onClick={() => { setResposta(''); setRecusando(s); }}><FaTimes size={12} /></ActionButton>}
                      {s.status === 'RECUSADA' && <button type="button" onClick={() => mudarStatus(s, 'PENDENTE', { resposta: null })} className="text-xs text-gray-400 hover:text-white px-2">Reabrir</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {recusando && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Recusar solicitação</h3>
            <p className="text-sm text-gray-400">{recusando.solicitante_nome} pediu {Number(recusando.quantidade).toLocaleString('pt-BR')} {recusando.unidade} de {recusando.descricao}.</p>
            <textarea rows={3} autoFocus value={resposta} onChange={e => setResposta(e.target.value)} placeholder="Motivo (a pessoa vê essa resposta)" className={`w-full px-3 py-2 ${inputBase}`} />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setRecusando(null)} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
              <button type="button" onClick={() => { const s = recusando; setRecusando(null); mudarStatus(s, 'RECUSADA', { resposta: resposta.trim() || null }); }} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Recusar</button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
