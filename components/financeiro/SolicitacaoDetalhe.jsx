// Ficha de uma solicitação de compra, usada pelo ADM (/financeiro, aba Solicitações)
// e pela equipe de compras (/compras).
//
// Fluxo: PENDENTE (ADM aprova) → APROVADA (compras faz orçamentos) → ORCADA (ADM escolhe o orçamento)
//        → COMPRA_APROVADA → EM_COMPRA → COMPRADA → ENTREGUE → FINALIZADA (todos que participaram são avisados)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FaTimes, FaSpinner, FaPlus, FaEdit, FaTrashAlt, FaPaperclip, FaCheck, FaRedoAlt, FaBan, FaTrophy, FaArrowRight,
} from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { Select } from '../ui/FormControls';
import {
  statusInfo, reais, dataBR, lerNumero, BUCKET_FINANCEIRO, ETAPAS_COMPRA, proximaEtapaCompra, ROTULO_BOTAO_ETAPA, quemAge,
} from '../../lib/financeiro';
import { rotuloPerfil } from '../../lib/perfis';

const campo = 'w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500';
const rotuloCls = 'block text-xs font-medium text-gray-400 mb-1';
const virgula = (n) => (n == null || n === '' ? '' : String(n).replace('.', ','));
const qtdTxt = (n) => Number(n || 0).toLocaleString('pt-BR');
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

const ORC_VAZIO = {
  id: null, fornecedor_id: '', fornecedor_nome: '', contato: '', quantidade: '', valor_unitario: '', frete: '',
  prazo_entrega: '', condicao_pagamento: '', validade: '', observacao: '', anexos: [], salvarFornecedor: true,
};

export function BadgeStatus({ status }) {
  const st = statusInfo(status);
  return <span className={`inline-block text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap ${st.badge}`}>{st.label}</span>;
}

export default function SolicitacaoDetalhe({ solicitacao: s, modo = 'compras', fornecedores = [], itens = [], onClose, onChanged, showToast }) {
  const adm = modo === 'adm';
  const [orcamentos, setOrcamentos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [comentario, setComentario] = useState('');
  const [escolhido, setEscolhido] = useState(s.orcamento_id || '');
  const [form, setForm] = useState(null); // orçamento em edição
  const [arquivos, setArquivos] = useState([]);
  const [listaFornecedores, setListaFornecedores] = useState(fornecedores);

  const carregar = useCallback(async () => {
    const [o, e] = await Promise.all([
      supabase.from('fin_orcamentos').select('*').eq('solicitacao_id', s.id).order('created_at'),
      supabase.from('fin_solicitacao_eventos').select('*').eq('solicitacao_id', s.id).order('created_at'),
    ]);
    if (o.error) setErro(o.error.message.includes('fin_orcamentos') ? 'O fluxo de compras ainda não foi ligado no banco (falta rodar o SQL 20261126b_fluxo_compras.sql).' : o.error.message);
    setOrcamentos(o.data || []);
    setEventos(e.data || []);
    setCarregando(false);
  }, [s.id]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { setListaFornecedores(fornecedores); }, [fornecedores]);

  const menor = useMemo(() => (orcamentos.length ? Math.min(...orcamentos.map(o => Number(o.valor_total || 0))) : null), [orcamentos]);
  const item = itens.find(i => i.id === s.item_id);
  const st = statusInfo(s.status);
  const vez = quemAge(s.status);

  const podeOrcar = s.status === 'APROVADA';
  const podeEscolher = adm && (s.status === 'ORCADA' || s.status === 'APROVADA') && orcamentos.length > 0;
  const proxima = proximaEtapaCompra(s.status);

  // ---------- Mudar etapa ----------
  const mudar = async (status, extra = {}, msg = 'Atualizado.') => {
    setErro('');
    setSalvando(true);
    const { error } = await supabase.from('fin_solicitacoes')
      .update({ status, comentario_etapa: comentario.trim() || null, ...extra })
      .eq('id', s.id);
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    showToast?.(msg);
    onChanged?.();
    onClose();
  };

  const aprovarPedido = () => mudar('APROVADA', { decidido_em: new Date().toISOString(), resposta: null }, 'Aprovada e enviada para a equipe de compras.');
  const recusar = () => {
    if (!comentario.trim()) { setErro('Escreva o motivo da recusa no campo de comentário (quem pediu vê essa resposta).'); return; }
    mudar('RECUSADA', { decidido_em: new Date().toISOString(), resposta: comentario.trim() }, 'Solicitação recusada.');
  };
  const concluirOrcamentos = () => {
    if (!orcamentos.length) { setErro('Cadastre pelo menos um orçamento.'); return; }
    mudar('ORCADA', {}, 'Orçamentos enviados para o ADM aprovar.');
  };
  const aprovarCompra = () => {
    if (!escolhido) { setErro('Escolha o orçamento vencedor.'); return; }
    mudar('COMPRA_APROVADA', { orcamento_id: escolhido }, 'Compra aprovada. A equipe de compras foi avisada.');
  };
  const pedirNovos = () => {
    if (!comentario.trim()) { setErro('Explique no comentário o que falta nos orçamentos.'); return; }
    mudar('APROVADA', { orcamento_id: null }, 'Pedido de novos orçamentos enviado para compras.');
  };
  const avancar = () => mudar(proxima, {}, proxima === 'FINALIZADA' ? 'Compra finalizada. Todos que participaram foram avisados.' : 'Etapa atualizada.');

  // ---------- Orçamentos ----------
  const opcoesFornecedor = useMemo(() => [
    { value: '', label: 'Outro (digitar o nome)' },
    ...listaFornecedores.filter(f => f.ativo !== false).map(f => ({ value: f.id, label: f.nome_fantasia ? `${f.nome_fantasia} (${f.nome})` : f.nome })),
  ], [listaFornecedores]);

  const novoOrcamento = () => { setArquivos([]); setForm({ ...ORC_VAZIO, quantidade: virgula(s.quantidade) }); };
  const editarOrcamento = (o) => {
    setArquivos([]);
    setForm({
      ...ORC_VAZIO, ...o, fornecedor_id: o.fornecedor_id || '', quantidade: virgula(o.quantidade), valor_unitario: virgula(o.valor_unitario),
      frete: virgula(o.frete), validade: o.validade || '', contato: o.contato || '', prazo_entrega: o.prazo_entrega || '',
      condicao_pagamento: o.condicao_pagamento || '', observacao: o.observacao || '', salvarFornecedor: false,
    });
  };
  const setF = (k) => (e) => setForm(p => ({ ...p, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const escolherFornecedor = (e) => {
    const f = listaFornecedores.find(x => x.id === e.target.value);
    setForm(p => ({
      ...p, fornecedor_id: e.target.value,
      fornecedor_nome: f ? (f.nome_fantasia || f.nome) : p.fornecedor_nome,
      contato: f ? [f.contato, f.telefone].filter(Boolean).join(' · ') || p.contato : p.contato,
    }));
  };

  const totalForm = form ? lerNumero(form.valor_unitario) * (lerNumero(form.quantidade) || Number(s.quantidade || 1)) + lerNumero(form.frete) : 0;

  const salvarOrcamento = async () => {
    setErro('');
    if (!form.fornecedor_nome.trim()) { setErro('Informe o fornecedor.'); return; }
    if (!(lerNumero(form.valor_unitario) > 0)) { setErro('Informe o valor unitário.'); return; }
    setSalvando(true);
    try {
      let fornecedorId = form.fornecedor_id || null;
      if (!fornecedorId && form.salvarFornecedor) {
        const { data: fn, error: ef } = await supabase.from('fin_fornecedores')
          .insert([{ nome: form.fornecedor_nome.trim(), contato: form.contato.trim() || null }]).select().single();
        if (ef) throw new Error('Não consegui cadastrar o fornecedor: ' + ef.message);
        fornecedorId = fn.id;
        setListaFornecedores(xs => [...xs, fn]);
      }
      let anexos = form.anexos || [];
      for (const arq of arquivos) {
        const limpo = arq.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
        const path = `orcamentos/${s.id}/${Date.now()}-${limpo}`;
        const { error: eu } = await supabase.storage.from(BUCKET_FINANCEIRO).upload(path, arq, { contentType: arq.type || undefined });
        if (eu) throw new Error(`Falha ao enviar ${arq.name}: ${eu.message}`);
        anexos = [...anexos, { path, nome: arq.name, tipo: arq.type || '' }];
      }
      const dados = {
        solicitacao_id: s.id,
        fornecedor_id: fornecedorId,
        fornecedor_nome: form.fornecedor_nome.trim(),
        contato: form.contato.trim() || null,
        quantidade: lerNumero(form.quantidade) || null,
        valor_unitario: lerNumero(form.valor_unitario),
        frete: lerNumero(form.frete),
        prazo_entrega: form.prazo_entrega.trim() || null,
        condicao_pagamento: form.condicao_pagamento.trim() || null,
        validade: form.validade || null,
        observacao: form.observacao.trim() || null,
        anexos,
      };
      const { error } = form.id
        ? await supabase.from('fin_orcamentos').update(dados).eq('id', form.id)
        : await supabase.from('fin_orcamentos').insert([dados]);
      if (error) throw new Error(error.message);
      setForm(null);
      setArquivos([]);
      showToast?.('Orçamento salvo.');
      carregar();
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setSalvando(false);
    }
  };

  const excluirOrcamento = async (o) => {
    const { error } = await supabase.from('fin_orcamentos').delete().eq('id', o.id);
    if (error) { setErro(error.message); return; }
    if ((o.anexos || []).length) await supabase.storage.from(BUCKET_FINANCEIRO).remove(o.anexos.map(a => a.path));
    carregar();
  };

  const abrirAnexo = async (a) => {
    const { data, error } = await supabase.storage.from(BUCKET_FINANCEIRO).createSignedUrl(a.path, 300);
    if (error) { setErro('Não consegui abrir o arquivo: ' + error.message); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  // ---------- Botões da etapa ----------
  const acoes = [];
  if (adm && s.status === 'PENDENTE') {
    acoes.push({ k: 'apr', l: 'Aprovar e enviar para compras', icon: <FaCheck size={12} />, cor: 'bg-emerald-600 hover:bg-emerald-500', fn: aprovarPedido });
  }
  if (podeOrcar) {
    acoes.push({ k: 'orc', l: 'Concluir orçamentos e enviar para o ADM', icon: <FaArrowRight size={12} />, cor: 'bg-blue-600 hover:bg-blue-500', fn: concluirOrcamentos });
  }
  if (podeEscolher) {
    acoes.push({ k: 'comp', l: 'Aprovar compra com o orçamento escolhido', icon: <FaCheck size={12} />, cor: 'bg-emerald-600 hover:bg-emerald-500', fn: aprovarCompra });
  }
  if (adm && s.status === 'ORCADA') {
    acoes.push({ k: 'novos', l: 'Pedir novos orçamentos', icon: <FaRedoAlt size={11} />, cor: 'bg-gray-700 hover:bg-gray-600', fn: pedirNovos });
  }
  if (proxima && (adm || ETAPAS_COMPRA.includes(s.status))) {
    acoes.push({ k: 'prox', l: ROTULO_BOTAO_ETAPA[proxima] || statusInfo(proxima).label, icon: <FaArrowRight size={12} />, cor: proxima === 'FINALIZADA' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500', fn: avancar });
  }
  if (adm && ['PENDENTE', 'APROVADA', 'ORCADA'].includes(s.status)) {
    acoes.push({ k: 'rec', l: 'Recusar', icon: <FaBan size={11} />, cor: 'bg-red-600/80 hover:bg-red-500', fn: recusar });
  }
  if (adm && s.status === 'RECUSADA') {
    acoes.push({ k: 'reab', l: 'Reabrir (volta para aprovação)', icon: <FaRedoAlt size={11} />, cor: 'bg-gray-700 hover:bg-gray-600', fn: () => mudar('PENDENTE', { resposta: null }, 'Solicitação reaberta.') });
  }

  return (
    <div className="fixed inset-0 z-[88] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-3xl max-h-[94dvh] flex flex-col shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-800">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <BadgeStatus status={s.status} />
              {s.urgencia === 'URGENTE' && <span className="text-[11px] font-semibold text-red-400">URGENTE</span>}
              {vez && <span className="text-[11px] text-gray-500">Agora com: <span className="text-gray-300">{vez === 'ADM' ? 'ADM' : 'Equipe de compras'}</span></span>}
            </div>
            <h3 className="text-lg font-semibold text-white mt-1">{qtdTxt(s.quantidade)} {s.unidade} · {s.descricao}</h3>
            {item && item.nome !== s.descricao && <div className="text-xs text-gray-500">Item do catálogo: {item.nome}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-gray-500 hover:text-white p-2"><FaTimes /></button>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto">
          {erro && <div className="text-sm text-red-300 bg-red-950/60 border border-red-500/30 rounded-lg px-3 py-2">{erro}</div>}

          {/* Dados do pedido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><div className={rotuloCls}>Quem pediu</div><div className="text-white">{s.solicitante_nome || '—'} {s.solicitante_perfil && <span className="text-xs text-gray-500">({rotuloPerfil(s.solicitante_perfil)})</span>}</div></div>
            <div><div className={rotuloCls}>Pedido em</div><div className="text-white">{dataHora(s.created_at)}</div></div>
            <div className="sm:col-span-2"><div className={rotuloCls}>Motivo</div><div className="text-gray-200 whitespace-pre-wrap">{s.motivo}</div></div>
            <div><div className={rotuloCls}>Local de entrega</div><div className="text-gray-200">{s.local_entrega || '—'}</div></div>
            <div><div className={rotuloCls}>Centro de custo</div><div className="text-gray-200">{s.centro_custo || '—'}</div></div>
            {s.resposta && <div className="sm:col-span-2"><div className={rotuloCls}>Resposta do ADM</div><div className="text-gray-200">{s.resposta}</div></div>}
          </div>

          {/* Orçamentos */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-white">Orçamentos <span className="text-gray-500 font-normal tabular-nums">({orcamentos.length})</span></h4>
              {podeOrcar && !form && (
                <button type="button" onClick={novoOrcamento} className="inline-flex items-center gap-1.5 text-sm text-blue-300 hover:text-white border border-blue-500/40 rounded-lg px-3 py-1.5">
                  <FaPlus size={10} /> Adicionar orçamento
                </button>
              )}
            </div>
            {podeOrcar && orcamentos.length > 0 && orcamentos.length < 3 && (
              <p className="text-xs text-amber-300/90">O ideal é ter orçamentos de pelo menos 3 fornecedores diferentes.</p>
            )}
            {podeEscolher && <p className="text-xs text-gray-400">Marque o orçamento vencedor e clique em "Aprovar compra".</p>}

            {carregando ? (
              <div className="text-sm text-gray-500 flex items-center gap-2"><FaSpinner className="animate-spin" /> Carregando...</div>
            ) : orcamentos.length === 0 && !form ? (
              <div className="text-sm text-gray-500 border border-dashed border-gray-800 rounded-xl px-4 py-6 text-center">
                {s.status === 'PENDENTE' ? 'Os orçamentos são feitos pela equipe de compras depois que o ADM aprova.' : 'Nenhum orçamento ainda.'}
              </div>
            ) : (
              <div className="grid gap-3">
                {orcamentos.map(o => {
                  const ehEscolhido = s.orcamento_id === o.id;
                  const marcado = escolhido === o.id;
                  const ehMenor = orcamentos.length > 1 && Number(o.valor_total) === menor;
                  return (
                    <div key={o.id} className={`rounded-xl border p-3 sm:p-4 ${marcado || ehEscolhido ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-gray-800 bg-gray-950/60'}`}>
                      <div className="flex items-start gap-3">
                        {podeEscolher && (
                          <input type="radio" name="orc-escolhido" aria-label={`Escolher ${o.fornecedor_nome}`} checked={marcado} onChange={() => setEscolhido(o.id)} className="mt-1 accent-emerald-500 w-4 h-4" />
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-white font-medium">{o.fornecedor_nome}</span>
                            {ehMenor && <span className="text-[10px] font-semibold uppercase rounded-full px-2 py-0.5 bg-emerald-500/15 text-emerald-300">Menor preço</span>}
                            {ehEscolhido && <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase rounded-full px-2 py-0.5 bg-emerald-600 text-white"><FaTrophy size={8} /> Escolhido</span>}
                          </div>
                          {o.contato && <div className="text-xs text-gray-400">{o.contato}</div>}
                          <div className="text-sm text-gray-300 tabular-nums">
                            {qtdTxt(o.quantidade)} × {reais(o.valor_unitario)}{Number(o.frete) > 0 && <> + frete {reais(o.frete)}</>}
                            {' = '}<span className="text-white font-semibold">{reais(o.valor_total)}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400">
                            {o.prazo_entrega && <span>Prazo: <span className="text-gray-200">{o.prazo_entrega}</span></span>}
                            {o.condicao_pagamento && <span>Pagamento: <span className="text-gray-200">{o.condicao_pagamento}</span></span>}
                            {o.validade && <span>Válido até: <span className="text-gray-200">{dataBR(o.validade)}</span></span>}
                          </div>
                          {o.observacao && <div className="text-xs text-gray-400 whitespace-pre-wrap">{o.observacao}</div>}
                          {(o.anexos || []).length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {o.anexos.map(a => (
                                <button key={a.path} type="button" onClick={() => abrirAnexo(a)} className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"><FaPaperclip size={10} /> {a.nome}</button>
                              ))}
                            </div>
                          )}
                          <div className="text-[11px] text-gray-500">por {o.criado_por_nome || '—'} em {dataHora(o.created_at)}</div>
                        </div>
                        {podeOrcar && !form && (
                          <div className="flex gap-1">
                            <button type="button" title="Editar" aria-label="Editar orçamento" onClick={() => editarOrcamento(o)} className="text-gray-500 hover:text-white p-2"><FaEdit size={12} /></button>
                            <button type="button" title="Excluir" aria-label="Excluir orçamento" onClick={() => excluirOrcamento(o)} className="text-gray-500 hover:text-red-400 p-2"><FaTrashAlt size={12} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Formulário de orçamento */}
            {form && (
              <div className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-4 space-y-3">
                <div className="text-sm font-semibold text-white">{form.id ? 'Editar orçamento' : 'Novo orçamento'}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block"><span className={rotuloCls}>Fornecedor cadastrado</span>
                    <Select value={form.fornecedor_id} onChange={escolherFornecedor} options={opcoesFornecedor} searchable className={campo} />
                  </label>
                  <label className="block"><span className={rotuloCls}>Nome do fornecedor *</span>
                    <input value={form.fornecedor_nome} onChange={setF('fornecedor_nome')} className={campo} placeholder="Ex.: Loja Elétrica Central" />
                  </label>
                  <label className="block sm:col-span-2"><span className={rotuloCls}>Contato (vendedor, telefone, site)</span>
                    <input value={form.contato} onChange={setF('contato')} className={campo} />
                  </label>
                  <label className="block"><span className={rotuloCls}>Quantidade</span>
                    <input inputMode="decimal" value={form.quantidade} onChange={setF('quantidade')} className={campo} />
                  </label>
                  <label className="block"><span className={rotuloCls}>Valor unitário (R$) *</span>
                    <input inputMode="decimal" value={form.valor_unitario} onChange={setF('valor_unitario')} className={campo} placeholder="0,00" />
                  </label>
                  <label className="block"><span className={rotuloCls}>Frete (R$)</span>
                    <input inputMode="decimal" value={form.frete} onChange={setF('frete')} className={campo} placeholder="0,00" />
                  </label>
                  <div className="flex items-end"><div className="text-sm text-gray-300">Total: <span className="text-white font-semibold tabular-nums">{reais(totalForm)}</span></div></div>
                  <label className="block"><span className={rotuloCls}>Prazo de entrega</span>
                    <input value={form.prazo_entrega} onChange={setF('prazo_entrega')} className={campo} placeholder="Ex.: 5 dias úteis" />
                  </label>
                  <label className="block"><span className={rotuloCls}>Condição de pagamento</span>
                    <input value={form.condicao_pagamento} onChange={setF('condicao_pagamento')} className={campo} placeholder="Ex.: PIX à vista, boleto 28 dias" />
                  </label>
                  <label className="block"><span className={rotuloCls}>Válido até</span>
                    <input type="date" value={form.validade} onChange={setF('validade')} className={campo} />
                  </label>
                  <label className="block sm:col-span-2"><span className={rotuloCls}>Observação</span>
                    <textarea rows={2} value={form.observacao} onChange={setF('observacao')} className={campo} />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-300 border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-1.5 cursor-pointer">
                    <FaPaperclip size={11} /> Anexar orçamento (PDF ou foto)
                    <input type="file" multiple accept=".pdf,image/*" className="hidden" onChange={e => { setArquivos(xs => [...xs, ...Array.from(e.target.files || [])]); e.target.value = ''; }} />
                  </label>
                  {[...(form.anexos || []).map(a => a.nome), ...arquivos.map(a => a.name)].map((n, i) => <span key={i} className="text-xs text-gray-400">{n}</span>)}
                </div>
                {!form.fornecedor_id && !form.id && (
                  <label className="flex items-center gap-2 text-xs text-gray-400">
                    <input type="checkbox" checked={form.salvarFornecedor} onChange={setF('salvarFornecedor')} className="accent-blue-500" />
                    Cadastrar este fornecedor na lista de fornecedores
                  </label>
                )}
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => { setForm(null); setArquivos([]); }} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
                  <button type="button" onClick={salvarOrcamento} disabled={salvando} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                    {salvando && <FaSpinner className="animate-spin" />} Salvar orçamento
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Histórico */}
          {eventos.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-white">Histórico</h4>
              <ol className="relative border-l border-gray-800 ml-1.5 space-y-3">
                {eventos.map(ev => (
                  <li key={ev.id} className="ml-4">
                    <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-gray-700 border border-gray-900" />
                    <div className="text-sm text-gray-200">
                      {ev.de_status === ev.para_status ? 'Comentário' : (ev.de_status ? statusInfo(ev.para_status).label : 'Solicitação criada')}
                      <span className="text-gray-500"> · {ev.usuario_nome || '—'} · {dataHora(ev.created_at)}</span>
                    </div>
                    {ev.comentario && <div className="text-xs text-gray-400 whitespace-pre-wrap">{ev.comentario}</div>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {/* Ações da etapa */}
        {acoes.length > 0 && !form && (
          <div className="border-t border-gray-800 px-5 py-4 space-y-3">
            <textarea rows={2} value={comentario} onChange={e => setComentario(e.target.value)} className={campo}
              placeholder={adm ? 'Comentário (opcional; obrigatório para recusar ou pedir novos orçamentos)' : 'Comentário (opcional), ex.: número do pedido, nota, previsão'} />
            <div className="flex flex-wrap justify-end gap-2">
              {acoes.map(a => (
                <button key={a.k} type="button" onClick={a.fn} disabled={salvando}
                  className={`inline-flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 ${a.cor}`}>
                  {salvando ? <FaSpinner className="animate-spin" /> : a.icon} {a.l}
                </button>
              ))}
            </div>
          </div>
        )}
        {acoes.length === 0 && (
          <div className="border-t border-gray-800 px-5 py-3 text-xs text-gray-500">
            {st.value === 'FINALIZADA' ? 'Compra finalizada.' : vez === 'ADM' ? 'Aguardando o ADM.' : vez === 'Compras' ? 'Aguardando a equipe de compras.' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
