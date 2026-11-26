// Aba "Solicitações" do /financeiro: pedidos de compra da equipe.
// Fluxo: ADM aprova → equipe de compras faz orçamentos → ADM escolhe o orçamento e aprova a compra
// → compras atualiza as etapas até finalizar. O ADM também pode lançar o gasto ligado ao pedido.
import React, { useMemo, useState } from 'react';
import { FaCheck, FaTimes, FaShoppingCart, FaExternalLinkAlt, FaFolderOpen } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import {
  inputBase, tableWrap, theadClass, tbodyClass, rowClass, Dash, SectionCard, PrimaryButton, ActionButton,
  SearchInput, FilterDropdown, ToggleFilter, StatusDot, norm,
} from '../admin/ui';
import { STATUS_SOLICITACAO, statusInfo, solicitacaoAberta, quemAge, reais, dataBR } from '../../lib/financeiro';
import SolicitacaoDetalhe from './SolicitacaoDetalhe';
import { rotuloPerfil } from '../../lib/perfis';

const ABERTAS = STATUS_SOLICITACAO.map(s => s.value).filter(solicitacaoAberta);

export default function SolicitacoesPanel({
  solicitacoes, itens, despesas, rastreadores, orcamentos = [], fornecedores = [], recarregar, showToast, onLancarCompra, onAbrirGasto, onNovaSolicitacao,
}) {
  const [busca, setBusca] = useState('');
  const [fStatus, setFStatus] = useState(ABERTAS);
  const [soUrgentes, setSoUrgentes] = useState(false);
  const [selecionadas, setSelecionadas] = useState([]);
  const [recusando, setRecusando] = useState(null); // solicitação
  const [resposta, setResposta] = useState('');
  const [aberta, setAberta] = useState(null); // ficha da solicitação (orçamentos e etapas)
  const orcPorId = useMemo(() => Object.fromEntries(orcamentos.map(o => [o.id, o])), [orcamentos]);
  const qtdOrc = useMemo(() => {
    const m = {};
    orcamentos.forEach(o => { m[o.solicitacao_id] = (m[o.solicitacao_id] || 0) + 1; });
    return m;
  }, [orcamentos]);

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
  const orcadas = solicitacoes.filter(s => s.status === 'ORCADA').length;
  const comCompras = solicitacoes.filter(s => quemAge(s.status) === 'Compras').length;
  const estimativa = (s) => (s.item_id && ultimoPreco[s.item_id] ? ultimoPreco[s.item_id].valor * Number(s.quantidade || 0) : null);
  // Pode lançar o gasto: pedido ainda sem gasto ligado e não recusado
  const podeLancar = (s) => !s.despesa_id && s.status !== 'RECUSADA';

  const mudarStatus = async (s, status, extra = {}) => {
    const { error } = await supabase.from('fin_solicitacoes').update({ status, decidido_em: new Date().toISOString(), ...extra }).eq('id', s.id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(status === 'APROVADA' ? 'Aprovada e enviada para a equipe de compras.' : status === 'RECUSADA' ? 'Solicitação recusada.' : 'Atualizado.');
    recarregar();
  };

  const toggle = (id) => setSelecionadas(sel => (sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]));
  const lancar = (ids) => {
    // Leva junto o orçamento escolhido (fornecedor e preço já vêm preenchidos no gasto)
    const escolhidas = solicitacoes.filter(s => ids.includes(s.id)).map(s => ({ ...s, orcamento: orcPorId[s.orcamento_id] || null }));
    if (escolhidas.length) onLancarCompra(escolhidas);
    setSelecionadas([]);
  };

  const opcoesStatus = STATUS_SOLICITACAO.map(s => ({ value: s.value, label: s.label, values: [s.value] }));
  const qtdTxt = (n) => Number(n).toLocaleString('pt-BR');

  return (
    <SectionCard title="Solicitações de compra" action={<PrimaryButton onClick={onNovaSolicitacao}>Nova solicitação</PrimaryButton>}>
      <p className="text-sm text-gray-400">
        Pedidos feitos pela equipe no painel e no app do técnico.{' '}
        <span className="text-amber-400 tabular-nums">{pendentes}</span> aguardando sua aprovação,{' '}
        <span className="text-amber-400 tabular-nums">{orcadas}</span> com orçamentos para você escolher e{' '}
        <span className="text-blue-300 tabular-nums">{comCompras}</span> com a equipe de compras.
        Clique numa linha para ver os orçamentos, escolher o melhor e acompanhar as etapas.
        Para lançar o gasto, marque os pedidos e clique em "Lançar compra": fornecedor e preço do orçamento escolhido já vêm preenchidos.
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
              {['Pedido em', 'Quem pediu', 'Item', 'Qtd', 'Motivo', 'Entrega / C. custo', 'Estoque', 'Valor', 'Situação', ''].map((h, i) => (
                <th key={i} className={`px-4 py-3 text-xs font-medium text-gray-400 whitespace-nowrap ${['Qtd', 'Valor', 'Estoque'].includes(h) || h === '' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className={tbodyClass}>
            {lista.length === 0 && <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-500">Nenhuma solicitação.</td></tr>}
            {lista.map(s => {
              const emAberto = solicitacaoAberta(s.status);
              const est = estimativa(s);
              const orcEscolhido = orcPorId[s.orcamento_id];
              const st = statusInfo(s.status);
              const prodId = itemPorId[s.item_id]?.produto_id;
              const despesa = despesaPorId[s.despesa_id];
              return (
                <tr key={s.id} onClick={() => setAberta(s)} className={`${rowClass} cursor-pointer ${!emAberto ? 'opacity-70' : ''}`}>
                  <td className="pl-4 py-3" onClick={e => e.stopPropagation()}>
                    {podeLancar(s) && <input type="checkbox" aria-label="Selecionar" checked={selecionadas.includes(s.id)} onChange={() => toggle(s.id)} className="accent-blue-500 w-4 h-4" />}
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
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-gray-300" title={orcEscolhido ? `Orçamento escolhido: ${orcEscolhido.fornecedor_nome}` : est != null ? `Estimativa pelo último preço: ${reais(ultimoPreco[s.item_id].valor)} em ${dataBR(ultimoPreco[s.item_id].data)}` : 'Sem compra anterior deste item'}>
                    {orcEscolhido ? (
                      <>
                        <div className="text-emerald-300">{reais(orcEscolhido.valor_total)}</div>
                        <div className="text-[11px] text-gray-500 truncate max-w-[140px] ml-auto">{orcEscolhido.fornecedor_nome}</div>
                      </>
                    ) : est != null ? <span className="text-gray-400">~{reais(est)}</span> : <Dash />}
                    {qtdOrc[s.id] > 0 && !orcEscolhido && <div className="text-[11px] text-gray-500">{qtdOrc[s.id]} orçamento(s)</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusDot tone={st.tom}>{st.label}</StatusDot>
                    {despesa && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); onAbrirGasto(despesa); }} className="mt-1 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                        <FaExternalLinkAlt size={9} /> gasto de {reais(despesa.valor_total)}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {s.status === 'PENDENTE' && <ActionButton title="Aprovar e enviar para compras" hover="hover:text-emerald-400" onClick={() => mudarStatus(s, 'APROVADA', { resposta: null })}><FaCheck size={12} /></ActionButton>}
                      {s.status === 'ORCADA' && (
                        <button type="button" onClick={() => setAberta(s)} className="text-xs font-semibold text-amber-300 hover:text-white border border-amber-500/40 rounded-lg px-2.5 py-1 whitespace-nowrap">Escolher orçamento</button>
                      )}
                      <ActionButton title="Abrir" hover="hover:text-white" onClick={() => setAberta(s)}><FaFolderOpen size={12} /></ActionButton>
                      {podeLancar(s) && <ActionButton title="Lançar compra (gasto)" hover="hover:text-blue-400" onClick={() => lancar([s.id])}><FaShoppingCart size={12} /></ActionButton>}
                      {['PENDENTE', 'APROVADA', 'ORCADA'].includes(s.status) && <ActionButton title="Recusar" hover="hover:text-red-400" onClick={() => { setResposta(''); setRecusando(s); }}><FaTimes size={12} /></ActionButton>}
                      {s.status === 'RECUSADA' && <button type="button" onClick={() => mudarStatus(s, 'PENDENTE', { resposta: null })} className="text-xs text-gray-400 hover:text-white px-2">Reabrir</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {aberta && (
        <SolicitacaoDetalhe
          solicitacao={aberta}
          modo="adm"
          itens={itens}
          fornecedores={fornecedores}
          showToast={showToast}
          onChanged={recarregar}
          onClose={() => setAberta(null)}
        />
      )}

      {recusando && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Recusar solicitação</h3>
            <p className="text-sm text-gray-400">{recusando.solicitante_nome} pediu {qtdTxt(recusando.quantidade)} {recusando.unidade} de {recusando.descricao}.</p>
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
