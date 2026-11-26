// Tela de uma viagem: lançamento rápido dos gastos (estadia, refeições, combustível,
// aluguel de veículo, outros) e inventário (o que a equipe tirou do estoque e o que voltou).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FaTimes, FaSpinner, FaBed, FaUtensils, FaGasPump, FaCarSide, FaEllipsisH, FaCamera, FaPaperclip,
  FaTrashAlt, FaEdit, FaBoxOpen, FaUndoAlt, FaHistory, FaPlus, FaSearch,
} from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { inputBase, Dash, norm } from '../admin/ui';
import { DateInput, Combobox } from '../ui/FormControls';
import { BUCKET_FINANCEIRO, reais, dataBR, lerNumero, hojeIso, numBR } from '../../lib/financeiro';

const campo = `w-full px-3 py-2 ${inputBase}`;
const rotuloCls = 'block text-xs font-medium text-gray-400 mb-1';

// Os 5 tipos de gasto de viagem e a categoria do financeiro de cada um
export const TIPOS_GASTO_VIAGEM = [
  { key: 'estadia', label: 'Estadia', categoria: 'Hospedagem', Icone: FaBed },
  { key: 'refeicao', label: 'Refeições', categoria: 'Alimentação', Icone: FaUtensils },
  { key: 'combustivel', label: 'Combustível', categoria: 'Combustível', Icone: FaGasPump },
  { key: 'aluguel', label: 'Aluguel de veículo', categoria: 'Aluguel de veículo', Icone: FaCarSide },
  { key: 'outros', label: 'Outros', categoria: 'Outros gastos de viagem', reserva: 'Outros', Icone: FaEllipsisH },
];
const ROTULO_POR_CATEGORIA = Object.fromEntries(TIPOS_GASTO_VIAGEM.map(t => [t.categoria, t.label]));

const STATUS_ITEM = {
  estoque_central: 'Estoque Central', estoque_tecnico: 'Estoque c/ Técnico', instalado: 'Instalado',
  aguardando_manutencao: 'Aguardando manutenção', baixado: 'Baixado',
};

const dataHoraBR = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
// Data escolhida → instante: hoje = agora; outro dia = meio-dia daquele dia
const instanteDe = (dia) => (!dia || dia === hojeIso() ? new Date().toISOString() : new Date(`${dia}T12:00:00`).toISOString());
const nomeArquivoLimpo = (n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_');

function Aba({ ativo, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${ativo ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
      {children}
    </button>
  );
}

function Numero({ rotulo, valor, destaque }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/50 px-4 py-3">
      <div className="text-xs text-gray-400">{rotulo}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${destaque || 'text-white'}`}>{valor}</div>
    </div>
  );
}

export default function ViagemDetalhe({
  viagem, tecnicos, empresas, categorias, despesas, abaInicial = 'gastos',
  recarregar, showToast, askConfirm, onAbrirGasto, onClose,
}) {
  const [aba, setAba] = useState(abaInicial);
  const tecnico = tecnicos.find(t => String(t.id) === String(viagem.tecnico_id));
  const cliente = empresas.find(e => String(e.id) === String(viagem.empresa_id));
  const pessoas = useMemo(() => {
    const nomes = tecnicos.map(t => t.nome).filter(Boolean);
    if (tecnico) nomes.sort((a, b) => (a === tecnico.nome ? -1 : b === tecnico.nome ? 1 : 0));
    return [...nomes, 'Cartão da empresa'];
  }, [tecnicos, tecnico]);

  // ---------- GASTOS ----------
  const catPorId = useMemo(() => Object.fromEntries(categorias.map(c => [c.id, c])), [categorias]);
  const catPorNome = useMemo(() => Object.fromEntries(categorias.map(c => [c.nome, c])), [categorias]);
  const gastos = useMemo(() => despesas.filter(d => d.viagem_id === viagem.id)
    .sort((a, b) => (a.data === b.data ? String(b.created_at).localeCompare(String(a.created_at)) : (a.data < b.data ? 1 : -1))), [despesas, viagem.id]);

  const totais = useMemo(() => {
    const porTipo = Object.fromEntries(TIPOS_GASTO_VIAGEM.map(t => [t.label, 0]));
    let total = 0;
    gastos.forEach(d => {
      total += Number(d.valor_total) || 0;
      (d.fin_despesa_itens || []).forEach(l => {
        const nome = catPorId[l.categoria_id]?.nome || 'Sem categoria';
        const rot = ROTULO_POR_CATEGORIA[nome] || (nome === 'Outros' ? 'Outros' : nome);
        porTipo[rot] = (porTipo[rot] || 0) + (Number(l.valor_total) || 0);
      });
    });
    return { total, porTipo };
  }, [gastos, catPorId]);

  const vazioGasto = () => ({ tipo: 'estadia', valor: '', data: hojeIso(), pago_por: tecnico?.nome || '', descricao: '' });
  const [g, setG] = useState(vazioGasto);
  const [foto, setFoto] = useState(null);
  const [salvandoGasto, setSalvandoGasto] = useState(false);
  const fotoRef = useRef(null);
  const setCampoG = (k) => (e) => setG(p => ({ ...p, [k]: e?.target ? e.target.value : e }));

  const lancarGasto = async (e) => {
    e?.preventDefault();
    const valor = lerNumero(g.valor);
    if (!(valor > 0)) { showToast('Informe o valor do gasto.', 'error'); return; }
    const tipo = TIPOS_GASTO_VIAGEM.find(t => t.key === g.tipo);
    const cat = catPorNome[tipo.categoria] || (tipo.reserva && catPorNome[tipo.reserva]);
    if (!cat) { showToast(`A categoria "${tipo.categoria}" não existe. Rode o SQL 20261126d no Supabase.`, 'error'); return; }
    setSalvandoGasto(true);
    try {
      const descricao = g.descricao.trim() ? `${tipo.label}: ${g.descricao.trim()}` : tipo.label;
      const cab = {
        data: g.data || hojeIso(), tipo_documento: foto ? 'RECIBO' : 'SEM_DOC', viagem_id: viagem.id, descricao,
        status: 'PAGO', data_pagamento: g.data || hojeIso(), pago_por: g.pago_por.trim() || null, origem: 'VIAGEM',
      };
      const { data: d, error } = await supabase.from('fin_despesas').insert([cab]).select().single();
      if (error) {
        if (/pago_por|origem/.test(error.message)) throw new Error('Falta rodar o SQL 20261126d_viagens_gastos_inventario.sql no Supabase.');
        throw error;
      }
      const { error: el } = await supabase.from('fin_despesa_itens').insert([{
        despesa_id: d.id, categoria_id: cat.id, descricao, quantidade: 1, unidade: 'UN', valor_unitario: valor, valor_total: valor, ordem: 0,
      }]);
      if (el) { await supabase.from('fin_despesas').delete().eq('id', d.id); throw el; }
      if (foto) {
        const path = `${d.id}/${Date.now()}-${nomeArquivoLimpo(foto.name || 'comprovante.jpg')}`;
        const { error: eu } = await supabase.storage.from(BUCKET_FINANCEIRO).upload(path, foto, { contentType: foto.type || undefined });
        if (eu) showToast('Gasto salvo, mas a foto não subiu: ' + eu.message, 'error');
        else await supabase.from('fin_despesas').update({ anexos: [{ path, nome: foto.name || 'comprovante', tipo: foto.type || '' }] }).eq('id', d.id);
      }
      showToast(`${tipo.label} de ${reais(valor)} lançado.`);
      setG(p => ({ ...vazioGasto(), tipo: p.tipo, data: p.data, pago_por: p.pago_por }));
      setFoto(null);
      if (fotoRef.current) fotoRef.current.value = '';
      recarregar();
    } catch (err) {
      showToast('Não deu para lançar: ' + (err.message || err), 'error');
    } finally {
      setSalvandoGasto(false);
    }
  };

  const verComprovante = async (a) => {
    const { data, error } = await supabase.storage.from(BUCKET_FINANCEIRO).createSignedUrl(a.path, 300);
    if (error) { showToast('Não deu para abrir: ' + error.message, 'error'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const excluirGasto = (d) => askConfirm(`Excluir o gasto "${d.descricao || ''}" de ${reais(d.valor_total)}?`, async () => {
    if ((d.anexos || []).length) await supabase.storage.from(BUCKET_FINANCEIRO).remove(d.anexos.map(a => a.path));
    const { error } = await supabase.from('fin_despesas').delete().eq('id', d.id);
    if (error) { showToast('Não deu para excluir: ' + error.message, 'error'); return; }
    showToast('Gasto excluído.');
    recarregar();
  });

  // ---------- INVENTÁRIO ----------
  const [movs, setMovs] = useState([]);
  const [itensEstoque, setItensEstoque] = useState([]);
  const [carregandoInv, setCarregandoInv] = useState(true);
  const [erroInv, setErroInv] = useState('');

  const carregarInventario = useCallback(async () => {
    setCarregandoInv(true);
    const [m, r] = await Promise.all([
      supabase.from('fin_viagem_estoque').select('*').eq('viagem_id', viagem.id).order('data', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('rastreadores').select('id, serial, modelo, categoria, status, viagem_id, placa_atual, localizacao_atual').order('modelo').order('serial'),
    ]);
    if (m.error || r.error) {
      const msg = (m.error || r.error).message;
      setErroInv(/fin_viagem_estoque|viagem_id/.test(msg) ? 'O inventário precisa do SQL novo. Rode o arquivo 20261126d_viagens_gastos_inventario.sql no Supabase e abra a viagem de novo.' : msg);
    } else setErroInv('');
    setMovs(m.data || []);
    setItensEstoque(r.data || []);
    setCarregandoInv(false);
  }, [viagem.id]);
  useEffect(() => { carregarInventario(); }, [carregarInventario]);

  const itemPorId = useMemo(() => Object.fromEntries(itensEstoque.map(i => [String(i.id), i])), [itensEstoque]);

  // Itens com serial que passaram pela viagem (pela ordem do histórico) e a situação de cada um hoje
  const itensViagem = useMemo(() => {
    const m = {};
    [...movs].reverse().forEach(x => {
      if (x.rastreador_id == null) return;
      const k = String(x.rastreador_id);
      const a = m[k] || (m[k] = { id: k, descricao: x.descricao, retirada: null, devolucao: null });
      if (x.tipo === 'RETIRADA') { a.retirada = x; a.devolucao = null; } else a.devolucao = x;
    });
    return Object.values(m).map(a => {
      const atual = itemPorId[a.id];
      let situacao; let tom; let podeDevolver = false;
      if (a.devolucao) { situacao = 'Devolvido'; tom = 'text-emerald-400'; }
      else if (atual?.status === 'instalado') { situacao = `Instalado${atual.placa_atual ? ` na placa ${atual.placa_atual}` : ''}`; tom = 'text-blue-300'; }
      else if (atual && atual.viagem_id === viagem.id) { situacao = 'Com a equipe'; tom = 'text-amber-300'; podeDevolver = true; }
      else { situacao = atual ? `Saiu da viagem (${STATUS_ITEM[atual.status] || atual.status})` : 'Item excluído do estoque'; tom = 'text-gray-400'; }
      return { ...a, atual, situacao, tom, podeDevolver };
    }).sort((x, y) => Number(y.podeDevolver) - Number(x.podeDevolver) || String(x.descricao).localeCompare(String(y.descricao)));
  }, [movs, itemPorId, viagem.id]);

  // Material avulso (sem serial): retirado x devolvido por descrição
  const avulsos = useMemo(() => {
    const m = {};
    movs.forEach(x => {
      if (x.rastreador_id != null) return;
      const k = norm(x.descricao).trim();
      const a = m[k] || (m[k] = { chave: k, descricao: x.descricao, unidade: x.unidade, retirado: 0, devolvido: 0 });
      if (x.tipo === 'RETIRADA') a.retirado += Number(x.quantidade) || 0; else a.devolvido += Number(x.quantidade) || 0;
    });
    return Object.values(m).map(a => ({ ...a, usado: Math.max(0, a.retirado - a.devolvido) })).sort((x, y) => x.descricao.localeCompare(y.descricao));
  }, [movs]);

  const resumoInv = useMemo(() => ({
    retirados: itensViagem.length,
    comEquipe: itensViagem.filter(i => i.podeDevolver).length,
    instalados: itensViagem.filter(i => !i.devolucao && i.atual?.status === 'instalado').length,
    devolvidos: itensViagem.filter(i => i.devolucao).length,
  }), [itensViagem]);

  // Retirada
  const [retirando, setRetirando] = useState(false);
  const [buscaEstoque, setBuscaEstoque] = useState('');
  const [selRetirar, setSelRetirar] = useState([]);
  const [avulsosNovos, setAvulsosNovos] = useState([]);
  const [ret, setRet] = useState({ pessoa: '', data: hojeIso(), obs: '' });
  const [salvandoInv, setSalvandoInv] = useState(false);

  const disponiveis = useMemo(() => {
    const q = norm(buscaEstoque.trim());
    return itensEstoque.filter(i => (i.status === 'estoque_central' || i.status === 'estoque_tecnico') && !i.viagem_id
      && (!q || norm(`${i.serial} ${i.modelo} ${i.categoria} ${i.localizacao_atual}`).includes(q)));
  }, [itensEstoque, buscaEstoque]);

  const abrirRetirada = () => {
    setRet({ pessoa: tecnico?.nome || '', data: hojeIso(), obs: '' });
    setSelRetirar([]); setAvulsosNovos([]); setBuscaEstoque(''); setRetirando(true); setDevolvendo(false);
  };
  const alternar = (lista, setLista, id) => setLista(lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id]);

  const registrarRetirada = async () => {
    const avs = avulsosNovos.map(a => ({ ...a, descricao: a.descricao.trim(), qtd: lerNumero(a.quantidade) })).filter(a => a.descricao && a.qtd > 0);
    if (!selRetirar.length && !avs.length) { showToast('Marque os itens do estoque ou informe um material avulso.', 'error'); return; }
    if (!ret.pessoa.trim()) { showToast('Informe quem pegou.', 'error'); return; }
    setSalvandoInv(true);
    try {
      const quando = instanteDe(ret.data);
      if (selRetirar.length) {
        const { error } = await supabase.rpc('fv_viagem_retirar', { p_viagem: viagem.id, p_itens: selRetirar, p_pessoa: ret.pessoa.trim(), p_data: quando, p_obs: ret.obs || null });
        if (error) throw error;
      }
      if (avs.length) {
        const { error } = await supabase.from('fin_viagem_estoque').insert(avs.map(a => ({
          viagem_id: viagem.id, tipo: 'RETIRADA', descricao: a.descricao, quantidade: a.qtd, unidade: a.unidade || 'UN',
          pessoa: ret.pessoa.trim(), data: quando, observacao: ret.obs || null,
        })));
        if (error) throw error;
      }
      showToast(`Retirada registrada: ${selRetirar.length + avs.length} ${selRetirar.length + avs.length === 1 ? 'item' : 'itens'}.`);
      setRetirando(false);
      carregarInventario();
    } catch (err) {
      showToast('Não deu para registrar: ' + (err.message || err), 'error');
    } finally {
      setSalvandoInv(false);
    }
  };

  // Devolução
  const [devolvendo, setDevolvendo] = useState(false);
  const [selDevolver, setSelDevolver] = useState([]);
  const [qtdDevolver, setQtdDevolver] = useState({}); // avulsos: chave → quantidade
  const [dev, setDev] = useState({ pessoa: '', data: hojeIso(), obs: '' });

  const abrirDevolucao = () => {
    setDev({ pessoa: tecnico?.nome || '', data: hojeIso(), obs: '' });
    setSelDevolver(itensViagem.filter(i => i.podeDevolver).map(i => i.id));
    setQtdDevolver({}); setDevolvendo(true); setRetirando(false);
  };

  const registrarDevolucao = async () => {
    const avs = avulsos.map(a => ({ ...a, qtd: lerNumero(qtdDevolver[a.chave]) })).filter(a => a.qtd > 0);
    const excesso = avs.find(a => a.qtd > a.usado);
    if (excesso) { showToast(`${excesso.descricao}: só ${numBR(excesso.usado)} ${excesso.unidade} ainda estão com a equipe.`, 'error'); return; }
    if (!selDevolver.length && !avs.length) { showToast('Marque o que voltou.', 'error'); return; }
    if (!dev.pessoa.trim()) { showToast('Informe quem devolveu.', 'error'); return; }
    setSalvandoInv(true);
    try {
      const quando = instanteDe(dev.data);
      if (selDevolver.length) {
        const { error } = await supabase.rpc('fv_viagem_devolver', { p_viagem: viagem.id, p_itens: selDevolver, p_pessoa: dev.pessoa.trim(), p_data: quando, p_obs: dev.obs || null });
        if (error) throw error;
      }
      if (avs.length) {
        const { error } = await supabase.from('fin_viagem_estoque').insert(avs.map(a => ({
          viagem_id: viagem.id, tipo: 'DEVOLUCAO', descricao: a.descricao, quantidade: a.qtd, unidade: a.unidade || 'UN',
          pessoa: dev.pessoa.trim(), data: quando, observacao: dev.obs || null,
        })));
        if (error) throw error;
      }
      showToast('Devolução registrada. Os itens voltaram para o Estoque Central.');
      setDevolvendo(false);
      carregarInventario();
    } catch (err) {
      showToast('Não deu para registrar: ' + (err.message || err), 'error');
    } finally {
      setSalvandoInv(false);
    }
  };

  const excluirMovAvulso = (x) => askConfirm(`Apagar o registro "${x.descricao}" (${numBR(x.quantidade)} ${x.unidade})?`, async () => {
    const { error } = await supabase.from('fin_viagem_estoque').delete().eq('id', x.id);
    if (error) { showToast('Não deu para apagar: ' + error.message, 'error'); return; }
    carregarInventario();
  });

  const tituloDatas = `${dataBR(viagem.data_ida)}${viagem.data_volta && viagem.data_volta !== viagem.data_ida ? ` a ${dataBR(viagem.data_volta)}` : ''}`;
  const tiposComValor = Object.entries(totais.porTipo).filter(([rot, val]) => val || TIPOS_GASTO_VIAGEM.some(t => t.label === rot));

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-5xl my-4 shadow-2xl" role="dialog" aria-modal="true" aria-label={viagem.titulo}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-800">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-white truncate">{viagem.titulo}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {[viagem.destino, tituloDatas, tecnico?.nome && `Técnico: ${tecnico.nome}`, cliente?.nome && `Cliente: ${cliente.nome}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-gray-500 hover:text-white p-2"><FaTimes /></button>
        </div>

        <div className="px-5 pt-4 flex gap-2">
          <Aba ativo={aba === 'gastos'} onClick={() => setAba('gastos')}>Gastos · {reais(totais.total)}</Aba>
          <Aba ativo={aba === 'inventario'} onClick={() => setAba('inventario')}>Inventário{resumoInv.comEquipe ? ` · ${resumoInv.comEquipe} com a equipe` : ''}</Aba>
        </div>

        {/* ===================== GASTOS ===================== */}
        {aba === 'gastos' && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Numero rotulo="Total da viagem" valor={reais(totais.total)} destaque="text-emerald-400" />
              {tiposComValor.map(([rot, val]) => <Numero key={rot} rotulo={rot} valor={reais(val)} />)}
              {viagem.km ? <Numero rotulo="R$ por km" valor={reais(totais.total / viagem.km)} /> : null}
            </div>

            <form onSubmit={lancarGasto} className="rounded-xl border border-gray-800 bg-gray-950/40 p-4 space-y-3">
              <div className="text-sm font-semibold text-white">Lançar gasto</div>
              <div className="flex flex-wrap gap-2">
                {TIPOS_GASTO_VIAGEM.map(({ key, label, Icone }) => (
                  <button key={key} type="button" onClick={() => setG(p => ({ ...p, tipo: key }))}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${g.tipo === key ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-gray-800 text-gray-300 hover:border-gray-700 hover:text-white'}`}>
                    <Icone size={13} /> {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <label><span className={rotuloCls}>Valor (R$) *</span>
                  <input inputMode="decimal" value={g.valor} onChange={setCampoG('valor')} placeholder="0,00" className={`${campo} tabular-nums`} autoFocus />
                </label>
                <label><span className={rotuloCls}>Data</span><DateInput value={g.data} onChange={setCampoG('data')} className={campo} /></label>
                <label className="sm:col-span-2"><span className={rotuloCls}>Quem pagou</span>
                  <Combobox value={g.pago_por} onChange={setCampoG('pago_por')} options={pessoas} placeholder="Nome do técnico ou Cartão da empresa" className={campo} />
                </label>
                <label className="sm:col-span-3"><span className={rotuloCls}>Detalhe (opcional)</span>
                  <input value={g.descricao} onChange={setCampoG('descricao')} placeholder="Ex.: Hotel Central 2 diárias, almoço equipe, posto BR..." className={campo} />
                </label>
                <div><span className={rotuloCls}>Comprovante (opcional)</span>
                  <input ref={fotoRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={e => setFoto(e.target.files?.[0] || null)} />
                  <button type="button" onClick={() => fotoRef.current?.click()}
                    className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm ${foto ? 'border-emerald-500/60 text-emerald-300' : 'border-gray-800 text-gray-300 hover:text-white hover:border-gray-700'}`}>
                    <FaCamera size={13} /> <span className="truncate">{foto ? foto.name : 'Foto do comprovante'}</span>
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={salvandoGasto} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-semibold">
                  {salvandoGasto ? <FaSpinner className="animate-spin" /> : <FaPlus size={11} />} Lançar
                </button>
              </div>
            </form>

            <div className="rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-4 py-2 bg-gray-900/80 border-b border-gray-800 text-xs font-medium text-gray-400">Gastos lançados ({gastos.length})</div>
              {gastos.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">Nenhum gasto nesta viagem ainda.</div>
              ) : (
                <ul className="divide-y divide-gray-800/70">
                  {gastos.map(d => {
                    const cats = [...new Set((d.fin_despesa_itens || []).map(l => { const n = catPorId[l.categoria_id]?.nome; return ROTULO_POR_CATEGORIA[n] || n || 'Sem categoria'; }))];
                    return (
                      <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm hover:bg-gray-800/30">
                        <span className="text-gray-400 tabular-nums w-20">{dataBR(d.data)}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">{cats.join(', ')}</span>
                        <span className="flex-1 min-w-[160px] text-gray-200 truncate">{d.descricao || <Dash />}</span>
                        <span className="text-xs text-gray-400">{d.pago_por ? `pago por ${d.pago_por}` : ''}</span>
                        <span className="tabular-nums text-white font-medium w-24 text-right">{reais(d.valor_total)}</span>
                        <span className="flex items-center gap-1">
                          {(d.anexos || []).map(a => (
                            <button key={a.path} type="button" title={`Ver ${a.nome}`} onClick={() => verComprovante(a)} className="p-1.5 text-gray-400 hover:text-emerald-400"><FaPaperclip size={12} /></button>
                          ))}
                          <button type="button" title="Abrir no formulário completo" onClick={() => onAbrirGasto(d)} className="p-1.5 text-gray-400 hover:text-blue-400"><FaEdit size={12} /></button>
                          <button type="button" title="Excluir" onClick={() => excluirGasto(d)} className="p-1.5 text-gray-400 hover:text-red-400"><FaTrashAlt size={12} /></button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ===================== INVENTÁRIO ===================== */}
        {aba === 'inventario' && (
          <div className="p-5 space-y-5">
            {erroInv ? (
              <div className="text-sm text-amber-200 bg-amber-950/40 border border-amber-500/30 rounded-lg px-4 py-3">{erroInv}</div>
            ) : carregandoInv ? (
              <div className="py-10 text-center text-gray-500"><FaSpinner className="animate-spin inline mr-2" /> Carregando…</div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Numero rotulo="Retirados do estoque" valor={resumoInv.retirados} />
                  <Numero rotulo="Com a equipe" valor={resumoInv.comEquipe} destaque={resumoInv.comEquipe ? 'text-amber-300' : 'text-white'} />
                  <Numero rotulo="Instalados (usados)" valor={resumoInv.instalados} destaque="text-blue-300" />
                  <Numero rotulo="Devolvidos" valor={resumoInv.devolvidos} destaque="text-emerald-400" />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={abrirRetirada} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold"><FaBoxOpen size={13} /> Retirar do estoque</button>
                  <button type="button" onClick={abrirDevolucao} disabled={!resumoInv.comEquipe && !avulsos.some(a => a.usado > 0)}
                    className="inline-flex items-center gap-2 border border-gray-700 hover:border-gray-600 text-gray-200 hover:text-white disabled:opacity-40 px-4 py-2 rounded-lg text-sm"><FaUndoAlt size={12} /> Devolução (volta da viagem)</button>
                </div>

                {/* Formulário de retirada */}
                {retirando && (
                  <div className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-4 space-y-3">
                    <div className="text-sm font-semibold text-white">Retirar do estoque para esta viagem</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label><span className={rotuloCls}>Quem pegou *</span><Combobox value={ret.pessoa} onChange={e => setRet(p => ({ ...p, pessoa: e.target.value }))} options={pessoas.slice(0, -1)} className={campo} /></label>
                      <label><span className={rotuloCls}>Quando</span><DateInput value={ret.data} onChange={e => setRet(p => ({ ...p, data: e.target.value }))} className={campo} /></label>
                      <label><span className={rotuloCls}>Observação</span><input value={ret.obs} onChange={e => setRet(p => ({ ...p, obs: e.target.value }))} className={campo} /></label>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={rotuloCls}>Itens do estoque ({selRetirar.length} marcados)</span>
                      </div>
                      <div className="relative mb-2">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
                        <input value={buscaEstoque} onChange={e => setBuscaEstoque(e.target.value)} placeholder="Buscar por serial ou modelo" className={`${campo} pl-8`} />
                      </div>
                      <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-800 divide-y divide-gray-800/70">
                        {disponiveis.length === 0 && <div className="px-3 py-4 text-sm text-gray-500 text-center">Nenhum item disponível no estoque{buscaEstoque ? ' com essa busca' : ''}.</div>}
                        {disponiveis.map(i => (
                          <label key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-800/40">
                            <input type="checkbox" checked={selRetirar.includes(String(i.id))} onChange={() => alternar(selRetirar, setSelRetirar, String(i.id))} className="accent-blue-500" />
                            <span className="text-white font-medium tabular-nums">{i.serial}</span>
                            <span className="text-gray-400">{i.categoria}{i.modelo ? ` — ${i.modelo}` : ''}</span>
                            <span className="ml-auto text-xs text-gray-500">{STATUS_ITEM[i.status]}{i.localizacao_atual ? ` · ${i.localizacao_atual}` : ''}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className={rotuloCls}>Material avulso, sem serial (cabo, abraçadeira, fita...)</span>
                      <div className="space-y-2">
                        {avulsosNovos.map((a, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input value={a.descricao} onChange={e => setAvulsosNovos(l => l.map((x, j) => (j === idx ? { ...x, descricao: e.target.value } : x)))} placeholder="Material" className={`${campo} flex-1`} />
                            <input inputMode="decimal" value={a.quantidade} onChange={e => setAvulsosNovos(l => l.map((x, j) => (j === idx ? { ...x, quantidade: e.target.value } : x)))} placeholder="Qtd" className={`${campo} !w-20 tabular-nums`} />
                            <input value={a.unidade} onChange={e => setAvulsosNovos(l => l.map((x, j) => (j === idx ? { ...x, unidade: e.target.value.toUpperCase() } : x)))} placeholder="UN" className={`${campo} !w-20`} />
                            <button type="button" onClick={() => setAvulsosNovos(l => l.filter((_, j) => j !== idx))} className="px-2 text-gray-500 hover:text-red-400" aria-label="Remover"><FaTrashAlt size={12} /></button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setAvulsosNovos(l => [...l, { descricao: '', quantidade: '1', unidade: 'UN' }])} className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"><FaPlus size={10} /> Adicionar material</button>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setRetirando(false)} className="text-gray-400 hover:text-white text-sm px-3">Cancelar</button>
                      <button type="button" onClick={registrarRetirada} disabled={salvandoInv} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-semibold">
                        {salvandoInv && <FaSpinner className="animate-spin" />} Registrar retirada
                      </button>
                    </div>
                  </div>
                )}

                {/* Formulário de devolução */}
                {devolvendo && (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 space-y-3">
                    <div className="text-sm font-semibold text-white">Devolução: o que sobrou volta para o Estoque Central</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label><span className={rotuloCls}>Quem devolveu *</span><Combobox value={dev.pessoa} onChange={e => setDev(p => ({ ...p, pessoa: e.target.value }))} options={pessoas.slice(0, -1)} className={campo} /></label>
                      <label><span className={rotuloCls}>Quando</span><DateInput value={dev.data} onChange={e => setDev(p => ({ ...p, data: e.target.value }))} className={campo} /></label>
                      <label><span className={rotuloCls}>Observação</span><input value={dev.obs} onChange={e => setDev(p => ({ ...p, obs: e.target.value }))} className={campo} /></label>
                    </div>
                    {itensViagem.some(i => i.podeDevolver) && (
                      <div className="rounded-lg border border-gray-800 divide-y divide-gray-800/70">
                        {itensViagem.filter(i => i.podeDevolver).map(i => (
                          <label key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-800/40">
                            <input type="checkbox" checked={selDevolver.includes(i.id)} onChange={() => alternar(selDevolver, setSelDevolver, i.id)} className="accent-emerald-500" />
                            <span className="text-white">{i.descricao}</span>
                            <span className="ml-auto text-xs text-gray-500">pegou: {i.retirada?.pessoa || '—'}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {avulsos.some(a => a.usado > 0) && (
                      <div className="space-y-2">
                        <span className={rotuloCls}>Material avulso que voltou</span>
                        {avulsos.filter(a => a.usado > 0).map(a => (
                          <div key={a.chave} className="flex items-center gap-3 text-sm">
                            <span className="flex-1 text-gray-200">{a.descricao} <span className="text-xs text-gray-500">(com a equipe: {numBR(a.usado)} {a.unidade})</span></span>
                            <input inputMode="decimal" value={qtdDevolver[a.chave] || ''} onChange={e => setQtdDevolver(p => ({ ...p, [a.chave]: e.target.value }))} placeholder="0" className={`${campo} !w-24 tabular-nums`} />
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-500">O que não for marcado continua com a equipe. Item instalado numa placa não entra aqui: ele já aparece como usado.</p>
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setDevolvendo(false)} className="text-gray-400 hover:text-white text-sm px-3">Cancelar</button>
                      <button type="button" onClick={registrarDevolucao} disabled={salvandoInv} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-semibold">
                        {salvandoInv && <FaSpinner className="animate-spin" />} Registrar devolução
                      </button>
                    </div>
                  </div>
                )}

                {/* Itens da viagem */}
                <div className="rounded-xl border border-gray-800 overflow-hidden">
                  <div className="px-4 py-2 bg-gray-900/80 border-b border-gray-800 text-xs font-medium text-gray-400">Itens do estoque nesta viagem</div>
                  {itensViagem.length === 0 && avulsos.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">Nada retirado do estoque para esta viagem ainda.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[620px]">
                        <thead className="text-xs text-gray-400 border-b border-gray-800">
                          <tr><th className="text-left px-4 py-2 font-medium">Item</th><th className="text-left px-4 py-2 font-medium">Quem pegou</th><th className="text-left px-4 py-2 font-medium">Retirado em</th><th className="text-left px-4 py-2 font-medium">Situação</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/70">
                          {itensViagem.map(i => (
                            <tr key={i.id}>
                              <td className="px-4 py-2 text-white">{i.descricao}</td>
                              <td className="px-4 py-2 text-gray-300">{i.retirada?.pessoa || <Dash />}</td>
                              <td className="px-4 py-2 text-gray-400 tabular-nums whitespace-nowrap">{dataHoraBR(i.retirada?.data)}</td>
                              <td className={`px-4 py-2 ${i.tom}`}>{i.situacao}{i.devolucao ? <span className="text-xs text-gray-500"> · {dataHoraBR(i.devolucao.data)}{i.devolucao.pessoa ? ` por ${i.devolucao.pessoa}` : ''}</span> : null}</td>
                            </tr>
                          ))}
                          {avulsos.map(a => (
                            <tr key={a.chave}>
                              <td className="px-4 py-2 text-white">{a.descricao} <span className="text-xs text-gray-500">(avulso)</span></td>
                              <td className="px-4 py-2 text-gray-300" colSpan={2}>Retirado {numBR(a.retirado)} {a.unidade} · devolvido {numBR(a.devolvido)} {a.unidade}</td>
                              <td className={`px-4 py-2 ${a.usado > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>{a.usado > 0 ? `${numBR(a.usado)} ${a.unidade} usados ou com a equipe` : 'Tudo devolvido'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Histórico */}
                <div className="rounded-xl border border-gray-800 overflow-hidden">
                  <div className="px-4 py-2 bg-gray-900/80 border-b border-gray-800 text-xs font-medium text-gray-400 flex items-center gap-2"><FaHistory size={11} /> Histórico de retiradas e devoluções</div>
                  {movs.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">Sem movimentações.</div>
                  ) : (
                    <ul className="divide-y divide-gray-800/70">
                      {movs.map(x => (
                        <li key={x.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
                          <span className="text-gray-400 tabular-nums w-36">{dataHoraBR(x.data)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${x.tipo === 'RETIRADA' ? 'bg-blue-500/15 text-blue-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{x.tipo === 'RETIRADA' ? 'Retirada' : 'Devolução'}</span>
                          <span className="flex-1 min-w-[160px] text-gray-200">{x.descricao}{x.rastreador_id == null ? ` · ${numBR(x.quantidade)} ${x.unidade}` : ''}</span>
                          <span className="text-xs text-gray-400">{x.pessoa || ''}{x.observacao ? ` · ${x.observacao}` : ''}</span>
                          {x.rastreador_id == null && (
                            <button type="button" title="Apagar este registro" onClick={() => excluirMovAvulso(x)} className="p-1 text-gray-500 hover:text-red-400"><FaTrashAlt size={11} /></button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
