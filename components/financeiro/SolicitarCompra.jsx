// Janela "Solicitar compra": qualquer pessoa da equipe (ADM, funcionário, técnico) pede um item.
// O pedido cai na aba "Solicitações" do /financeiro com o nome de quem pediu.
import React, { useEffect, useMemo, useState } from 'react';
import { FaTimes, FaSpinner, FaShoppingCart, FaTrashAlt } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { Select } from '../ui/FormControls';
import { UNIDADES, lerNumero, STATUS_SOLICITACAO, rotulo, CENTROS_CUSTO } from '../../lib/financeiro';

const campo = 'w-full px-3 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500';
const rotuloCls = 'block text-xs font-medium text-gray-400 mb-1';
const COR_STATUS = {
  PENDENTE: 'bg-amber-500/15 text-amber-300',
  APROVADA: 'bg-blue-500/15 text-blue-300',
  COMPRADA: 'bg-emerald-500/15 text-emerald-300',
  RECUSADA: 'bg-red-500/15 text-red-300',
};
const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

export default function SolicitarCompra({ onClose, showToast, itemInicial }) {
  const [itens, setItens] = useState([]);
  const [minhas, setMinhas] = useState([]);
  const [aba, setAba] = useState('nova');
  const [f, setF] = useState({ item_id: '', descricao: itemInicial || '', quantidade: '1', unidade: 'UN', motivo: '', urgencia: 'NORMAL', local_entrega: '', centro_custo: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e?.target ? e.target.value : e }));

  const carregar = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const [i, m] = await Promise.all([
      supabase.from('fin_itens').select('id, nome, unidade, ativo').order('nome'),
      supabase.from('fin_solicitacoes').select('*').eq('solicitante_id', session?.user?.id || '').order('created_at', { ascending: false }).limit(30),
    ]);
    setItens((i.data || []).filter(x => x.ativo !== false));
    setMinhas(m.data || []);
    if (m.error) setErro(m.error.message.includes('fin_solicitacoes') ? 'A função de solicitação ainda não foi ligada no banco (falta rodar o SQL).' : m.error.message);
  };
  useEffect(() => { carregar(); }, []);

  // Sugestões para local de entrega e centro de custo: o que a pessoa já usou antes
  const sugestoes = (campoNome, base = []) => [...new Set([...base, ...minhas.map(m => m[campoNome]).filter(Boolean)])];
  const sugLocal = sugestoes('local_entrega');
  const sugCentro = sugestoes('centro_custo', CENTROS_CUSTO);

  const opcoesItem = useMemo(() => [{ value: '', label: 'Outro (escrever abaixo)' }, ...itens.map(i => ({ value: i.id, label: i.nome }))], [itens]);

  const escolherItem = (e) => {
    const it = itens.find(x => x.id === e.target.value);
    setF(p => ({ ...p, item_id: e.target.value, descricao: it ? it.nome : p.descricao, unidade: it?.unidade || p.unidade }));
  };

  const enviar = async () => {
    setErro('');
    if (!f.descricao.trim()) { setErro('Diga qual item precisa.'); return; }
    if (!(lerNumero(f.quantidade) > 0)) { setErro('Informe a quantidade.'); return; }
    if (!f.motivo.trim()) { setErro('Explique o motivo da compra.'); return; }
    setSalvando(true);
    const { error } = await supabase.from('fin_solicitacoes').insert([{
      item_id: f.item_id || null, descricao: f.descricao.trim(), quantidade: lerNumero(f.quantidade),
      unidade: f.unidade, motivo: f.motivo.trim(), urgencia: f.urgencia,
      // só manda quando preenchido (assim não quebra se o SQL novo ainda não rodou)
      ...(f.local_entrega.trim() ? { local_entrega: f.local_entrega.trim() } : {}),
      ...(f.centro_custo.trim() ? { centro_custo: f.centro_custo.trim() } : {}),
    }]);
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    showToast?.('Solicitação enviada para o financeiro.');
    setF(p => ({ item_id: '', descricao: '', quantidade: '1', unidade: 'UN', motivo: '', urgencia: 'NORMAL', local_entrega: p.local_entrega, centro_custo: p.centro_custo }));
    setAba('minhas');
    carregar();
  };

  const cancelar = async (s) => {
    const { error } = await supabase.from('fin_solicitacoes').delete().eq('id', s.id);
    if (error) { setErro(error.message); return; }
    carregar();
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92dvh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white inline-flex items-center gap-2"><FaShoppingCart className="text-blue-400" /> Solicitar compra</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-gray-500 hover:text-white p-2"><FaTimes /></button>
        </div>
        <div className="px-5 pt-4 flex gap-2">
          {[{ k: 'nova', l: 'Nova solicitação' }, { k: 'minhas', l: `Minhas (${minhas.length})` }].map(t => (
            <button key={t.k} type="button" onClick={() => setAba(t.k)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium border ${aba === t.k ? 'bg-blue-600/15 border-blue-500 text-white' : 'border-gray-800 text-gray-400'}`}>{t.l}</button>
          ))}
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {erro && <div className="text-sm text-red-300 bg-red-950/60 border border-red-500/30 rounded-lg px-3 py-2">{erro}</div>}

          {aba === 'nova' ? (
            <>
              <label className="block"><span className={rotuloCls}>Item</span>
                <Select value={f.item_id} onChange={escolherItem} options={opcoesItem} searchable className={campo} />
              </label>
              <label className="block"><span className={rotuloCls}>O que precisa *</span>
                <input value={f.descricao} onChange={set('descricao')} className={campo} placeholder="Ex.: Fita isolante, rastreador FT4G, alicate..." />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label><span className={rotuloCls}>Quantidade *</span>
                  <input inputMode="decimal" value={f.quantidade} onChange={set('quantidade')} className={campo} />
                </label>
                <label><span className={rotuloCls}>Unidade</span>
                  <Select value={f.unidade} onChange={set('unidade')} options={[...new Set([...UNIDADES, f.unidade])].map(u => ({ value: u, label: u }))} className={campo} />
                </label>
              </div>
              <label className="block"><span className={rotuloCls}>Motivo da compra *</span>
                <textarea rows={3} value={f.motivo} onChange={set('motivo')} className={campo} placeholder="Ex.: acabou no estoque, instalação da frota X na semana que vem" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label><span className={rotuloCls}>Local de entrega</span>
                  <input value={f.local_entrega} onChange={set('local_entrega')} list="sc-locais" className={campo} placeholder="Ex.: Base Uberlândia" />
                  <datalist id="sc-locais">{sugLocal.map(v => <option key={v} value={v} />)}</datalist>
                </label>
                <label><span className={rotuloCls}>Centro de custo</span>
                  <input value={f.centro_custo} onChange={set('centro_custo')} list="sc-centros" className={campo} placeholder="Ex.: Operacional" />
                  <datalist id="sc-centros">{sugCentro.map(v => <option key={v} value={v} />)}</datalist>
                </label>
              </div>
              <div className="flex gap-2">
                {[{ k: 'NORMAL', l: 'Normal' }, { k: 'URGENTE', l: 'Urgente' }].map(u => (
                  <button key={u.k} type="button" onClick={() => setF(p => ({ ...p, urgencia: u.k }))}
                    className={`flex-1 rounded-xl py-2 text-sm border ${f.urgencia === u.k ? (u.k === 'URGENTE' ? 'border-red-500 bg-red-500/15 text-red-200' : 'border-blue-500 bg-blue-600/15 text-white') : 'border-gray-800 text-gray-400'}`}>{u.l}</button>
                ))}
              </div>
              <button type="button" onClick={enviar} disabled={salvando}
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-semibold">
                {salvando && <FaSpinner className="animate-spin" />} Enviar solicitação
              </button>
            </>
          ) : (
            <ul className="space-y-2">
              {minhas.length === 0 && <li className="text-sm text-gray-500 text-center py-8">Você ainda não fez solicitações.</li>}
              {minhas.map(s => (
                <li key={s.id} className="rounded-xl border border-gray-800 bg-gray-950/60 p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm text-white">{Number(s.quantidade).toLocaleString('pt-BR')} {s.unidade} · {s.descricao}</div>
                    <span className={`shrink-0 text-[11px] font-semibold rounded-full px-2 py-0.5 ${COR_STATUS[s.status] || ''}`}>{rotulo(STATUS_SOLICITACAO, s.status)}</span>
                  </div>
                  <div className="text-xs text-gray-400">{s.motivo}</div>
                  {(s.local_entrega || s.centro_custo) && (
                    <div className="text-xs text-gray-500">
                      {s.local_entrega && <>Entrega: <span className="text-gray-300">{s.local_entrega}</span></>}
                      {s.local_entrega && s.centro_custo && ' · '}
                      {s.centro_custo && <>Centro de custo: <span className="text-gray-300">{s.centro_custo}</span></>}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{dataBR(s.created_at)}{s.urgencia === 'URGENTE' ? ' · urgente' : ''}</span>
                    {s.status === 'PENDENTE' && (
                      <button type="button" onClick={() => cancelar(s)} className="inline-flex items-center gap-1 text-gray-400 hover:text-red-400"><FaTrashAlt size={10} /> Cancelar</button>
                    )}
                  </div>
                  {s.resposta && <div className="text-xs text-gray-300 bg-gray-800/60 rounded-lg px-2 py-1">ADM: {s.resposta}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
