// Formulário de um gasto (NF-e, NF, romaneio, cupom, recibo...) com as linhas de itens.
// Dá para importar a nota (XML da NF-e ou NFS-e, ou o PDF): preenche fornecedor, número, data e itens.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaTimes, FaPlus, FaTrashAlt, FaFileCode, FaPaperclip, FaSpinner, FaExclamationTriangle, FaExternalLinkAlt, FaRedoAlt } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { inputBase } from '../admin/ui';
import { Select, DateInput } from '../ui/FormControls';
import { lerXmlNfe, linhasDeAjuste, formatarCnpj, soDigitos } from '../../lib/nfe';
import { ehXmlNfse, lerXmlNfse } from '../../lib/nfse';
import { lerPdfNota } from '../../lib/notaPdf';
import {
  TIPOS_DOCUMENTO, FORMAS_PAGAMENTO, STATUS_PAGAMENTO, UNIDADES, BUCKET_FINANCEIRO,
  TIPOS_RECORRENCIA, TIPOS_VALOR_RECORRENTE, precisaConferir,
  reais, lerNumero, hojeIso, dataBR,
} from '../../lib/financeiro';

const campo = `w-full px-3 py-2 ${inputBase}`;
const rotuloCls = 'block text-xs font-medium text-gray-400 mb-1';
// Lê o arquivo da nota: XML de NF-e, XML de NFS-e ou PDF (DANFE / NFS-e)
async function lerArquivoNota(file) {
  const nome = (file.name || '').toLowerCase();
  if (nome.endsWith('.pdf') || file.type === 'application/pdf') return lerPdfNota(file);
  const texto = await file.text();
  const doc = new DOMParser().parseFromString(texto, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('O arquivo não é um XML válido.');
  if (doc.getElementsByTagNameNS('*', 'infNFe').length) return { tipo: 'NFE', origem: 'xml', avisos: [], ...lerXmlNfe(texto) };
  if (ehXmlNfse(doc)) return lerXmlNfse(doc);
  throw new Error('Não reconheci esse XML. Ele não é de NF-e nem de NFS-e.');
}

const linhaVazia = (ordem = 0) => ({ chave: Math.random().toString(36).slice(2), item_id: '', categoria_id: '', descricao: '', codigo_fornecedor: '', quantidade: '1', unidade: 'UN', valor_unitario: '', ordem });
const virgula = (n) => String(n ?? '').replace('.', ',');
// Botões lado a lado (escolha única)
function Opcoes({ value, onChange, options, ariaLabel }) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label={ariaLabel}>
      {options.map(o => (
        <button
          key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg py-2 px-3 text-sm border transition-colors ${value === o.value ? 'border-blue-500 bg-blue-600/15 text-white' : 'border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'}`}
        >{o.label}</button>
      ))}
    </div>
  );
}

const totalLinha = (l) => Math.round(lerNumero(l.quantidade) * lerNumero(l.valor_unitario) * 100) / 100;

export default function DespesaForm({ despesa, catalogo, viagemPadrao, abrirXml, solicitacoes = [], onClose, onSaved, showToast }) {
  const { categorias, itens, fornecedores, viagens, vinculos } = catalogo;
  const editando = Boolean(despesa?.id);

  const [f, setF] = useState(() => ({
    tipo_documento: despesa?.tipo_documento || 'SEM_DOC',
    data: despesa?.data || hojeIso(),
    numero: despesa?.numero || '',
    serie: despesa?.serie || '',
    chave_nfe: despesa?.chave_nfe || '',
    fornecedor_id: despesa?.fornecedor_id || '',
    viagem_id: despesa?.viagem_id || viagemPadrao || '',
    descricao: despesa?.descricao || (solicitacoes.length ? `Compra solicitada: ${solicitacoes.map(s => s.descricao).join(', ')}` : ''),
    forma_pagamento: despesa?.forma_pagamento || '',
    status: despesa?.status || 'PAGO',
    vencimento: despesa?.vencimento || '',
    data_pagamento: despesa?.data_pagamento || '',
    observacao: despesa?.observacao || '',
    recorrencia: despesa?.recorrencia || 'PONTUAL',
    valor_tipo: despesa?.valor_tipo || 'FIXO',
    recorrencia_ate: despesa?.recorrencia_ate || '',
  }));
  const conferir = editando && precisaConferir(despesa);
  const set = (k) => (e) => setF(prev => ({ ...prev, [k]: e?.target ? e.target.value : e }));

  const [linhas, setLinhas] = useState(() => {
    const ls = (despesa?.fin_despesa_itens || []).slice().sort((a, b) => a.ordem - b.ordem).map(l => ({
      chave: l.id, item_id: l.item_id || '', categoria_id: l.categoria_id || '', descricao: l.descricao || '',
      codigo_fornecedor: l.codigo_fornecedor || '', quantidade: virgula(l.quantidade ?? 1), unidade: l.unidade || 'UN',
      valor_unitario: virgula(l.valor_unitario ?? 0), ordem: l.ordem,
    }));
    if (!ls.length && solicitacoes.length) {
      // Compra que atende solicitações: uma linha por pedido, com item e quantidade
      return solicitacoes.map((s, i) => {
        const it = catalogo.itens.find(x => x.id === s.item_id);
        return { ...linhaVazia(i), item_id: s.item_id || '', categoria_id: it?.categoria_id || '', descricao: s.descricao, quantidade: virgula(s.quantidade), unidade: s.unidade || 'UN' };
      });
    }
    return ls.length ? ls : [linhaVazia()];
  });

  const [fornecedorNovo, setFornecedorNovo] = useState(null); // vindo do XML, ainda não cadastrado
  const [totalNota, setTotalNota] = useState(null);
  const [anexos, setAnexos] = useState(despesa?.anexos || []); // já salvos
  const [arquivosNovos, setArquivosNovos] = useState([]); // File[]
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [categoriaTodas, setCategoriaTodas] = useState('');
  const xmlRef = useRef(null);
  const anexoRef = useRef(null);
  // Botão "Lançar NF-e (XML)" do topo: já abre a escolha do arquivo
  useEffect(() => { if (abrirXml) xmlRef.current?.click(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const categoriaPorNome = useMemo(() => Object.fromEntries(categorias.map(c => [c.nome, c.id])), [categorias]);
  const itemPorId = useMemo(() => Object.fromEntries(itens.map(i => [i.id, i])), [itens]);

  const opcoesCategoria = useMemo(() => [{ value: '', label: 'Categoria...' }, ...categorias.filter(c => c.ativo !== false).map(c => ({ value: c.id, label: c.nome }))], [categorias]);
  const opcoesItem = useMemo(() => [{ value: '', label: '— sem item do catálogo —' }, ...itens.filter(i => i.ativo !== false).map(i => ({ value: i.id, label: i.nome }))], [itens]);
  const opcoesFornecedor = useMemo(() => [{ value: '', label: 'Sem fornecedor' }, ...fornecedores.filter(x => x.ativo !== false || x.id === f.fornecedor_id).map(x => ({ value: x.id, label: x.nome_fantasia ? `${x.nome_fantasia} (${x.nome})` : x.nome }))], [fornecedores, f.fornecedor_id]);
  const opcoesViagem = useMemo(() => [{ value: '', label: 'Nenhuma viagem' }, ...viagens.map(v => ({ value: v.id, label: `${v.titulo}${v.data_ida ? ' · ' + dataBR(v.data_ida) : ''}` }))], [viagens]);

  const total = linhas.reduce((s, l) => s + totalLinha(l), 0);

  const mudarLinha = (chave, campoNome, valor) => setLinhas(ls => ls.map(l => {
    if (l.chave !== chave) return l;
    const nova = { ...l, [campoNome]: valor };
    if (campoNome === 'item_id' && valor) {
      const it = itemPorId[valor];
      if (it?.categoria_id) nova.categoria_id = it.categoria_id;
      if (it?.unidade) nova.unidade = it.unidade;
      if (!l.descricao) nova.descricao = it?.nome || '';
    }
    return nova;
  }));

  // Fornecedor escolhido sugere a categoria das linhas sem categoria
  const escolherFornecedor = (e) => {
    const id = e.target.value;
    setF(prev => ({ ...prev, fornecedor_id: id }));
    setFornecedorNovo(null);
    const forn = fornecedores.find(x => x.id === id);
    if (forn?.categoria_id) setLinhas(ls => ls.map(l => (l.categoria_id ? l : { ...l, categoria_id: forn.categoria_id })));
  };

  // ---------- Importar a nota (XML ou PDF) ----------
  const [lendo, setLendo] = useState(false);
  const [avisos, setAvisos] = useState([]);
  const importarXml = async (file) => {
    if (!file) return;
    setErro(''); setAvisos([]); setLendo(true);
    try {
      const nfe = await lerArquivoNota(file);
      const servico = nfe.tipo === 'NFSE';
      const avisosNota = [...(nfe.avisos || [])];
      if (/full\s*vision/i.test(nfe.fornecedor?.nome || '')) {
        avisosNota.unshift('Essa nota parece ter sido emitida pela própria Full Vision (ela aparece como prestador/emitente). Se for um serviço que a Full Vision prestou ou vendeu, não é gasto.');
      }

      if (nfe.chave) {
        const { data: ja } = await supabase.from('fin_despesas').select('id, data').eq('chave_nfe', nfe.chave).maybeSingle();
        if (ja && ja.id !== despesa?.id) {
          setErro(`Essa NF-e já foi lançada (gasto de ${dataBR(ja.data)}). Não importei de novo.`);
          return;
        }
      }

      const cnpj = nfe.fornecedor.cnpj;
      const existente = fornecedores.find(x => soDigitos(x.cnpj) === cnpj && cnpj);
      const catPadrao = existente?.categoria_id || '';

      const novasLinhas = nfe.itens.map((it, i) => {
        const v = vinculos.find(x => x.fornecedor_cnpj === cnpj && x.codigo === it.codigo_fornecedor);
        const item = v?.item_id ? itemPorId[v.item_id] : null;
        return {
          ...linhaVazia(i),
          item_id: item?.id || '',
          categoria_id: v?.categoria_id || item?.categoria_id || catPadrao || (servico ? categoriaPorNome['Serviços de terceiros'] || '' : ''),
          descricao: it.descricao,
          codigo_fornecedor: it.codigo_fornecedor,
          quantidade: virgula(it.quantidade),
          unidade: it.unidade,
          valor_unitario: virgula(Math.round((it.valor_total / (it.quantidade || 1)) * 10000) / 10000),
        };
      });
      linhasDeAjuste(nfe.totais).forEach((a, k) => novasLinhas.push({
        ...linhaVazia(nfe.itens.length + k),
        categoria_id: categoriaPorNome[a.categoria] || '',
        descricao: a.descricao, quantidade: '1', unidade: 'UN', valor_unitario: virgula(a.valor),
      }));

      const primeiraDup = nfe.duplicatas.find(d => d.vencimento && d.vencimento >= hojeIso());
      setF(prev => ({
        ...prev,
        tipo_documento: servico ? 'NFSE' : 'NFE',
        data: nfe.data || prev.data,
        numero: nfe.numero,
        serie: nfe.serie,
        chave_nfe: nfe.chave,
        fornecedor_id: existente?.id || '',
        forma_pagamento: nfe.forma_pagamento || prev.forma_pagamento,
        status: primeiraDup ? 'A_PAGAR' : prev.status,
        vencimento: primeiraDup?.vencimento || prev.vencimento,
        descricao: prev.descricao || [`${servico ? 'NFS-e' : 'NF'} ${nfe.numero || ''}`.trim(), nfe.fornecedor.nome_fantasia || nfe.fornecedor.nome].filter(Boolean).join(' · '),
        observacao: prev.observacao || [nfe.duplicatas.length > 1
          ? `Parcelas: ${nfe.duplicatas.map(d => `${dataBR(d.vencimento)} ${reais(d.valor)}`).join(' | ')}`
          : '', nfe.observacao || ''].filter(Boolean).join(' · '),
      }));
      setFornecedorNovo(existente || !(nfe.fornecedor.nome || nfe.fornecedor.cnpj) ? null : { ...nfe.fornecedor, nome: nfe.fornecedor.nome || `Fornecedor ${formatarCnpj(nfe.fornecedor.cnpj)}` });
      setAvisos(avisosNota);
      setTotalNota(nfe.totais.nota);
      setLinhas(novasLinhas.length ? novasLinhas : [linhaVazia()]);
      setArquivosNovos(prev => [...prev.filter(a => a !== file), file]); // o arquivo fica anexado
      showToast(`${servico ? 'NFS-e' : 'NF'} ${nfe.numero || ''} lida${nfe.origem === 'pdf' ? ' do PDF' : ''}: confira os dados e salve.`);
    } catch (e) {
      setErro(e.message || 'Não consegui ler esse arquivo.');
      setArquivosNovos(prev => (prev.includes(file) ? prev : [...prev, file])); // mesmo sem ler, fica anexado
    } finally {
      setLendo(false);
    }
  };

  const abrirAnexo = async (a) => {
    const { data, error } = await supabase.storage.from(BUCKET_FINANCEIRO).createSignedUrl(a.path, 300);
    if (error) { showToast('Não consegui abrir o arquivo: ' + error.message, 'error'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  // ---------- Salvar ----------
  const salvar = async () => {
    setErro('');
    const validas = linhas.filter(l => l.descricao.trim() || l.item_id || lerNumero(l.valor_unitario));
    if (!validas.length) { setErro('Coloque pelo menos uma linha com valor.'); return; }
    if (validas.some(l => !l.categoria_id)) { setErro('Toda linha precisa de categoria.'); return; }
    if (!f.data) { setErro('Informe a data.'); return; }
    if (f.status === 'A_PAGAR' && !f.vencimento) { setErro('Gasto a pagar precisa de vencimento.'); return; }
    if (f.recorrencia === 'RECORRENTE' && f.recorrencia_ate && f.recorrencia_ate.slice(0, 7) < f.data.slice(0, 7)) { setErro('O prazo da recorrência não pode ser antes da data do gasto.'); return; }

    setSalvando(true);
    try {
      // 1) Fornecedor novo vindo do XML
      let fornecedorId = f.fornecedor_id || null;
      let cnpjFornecedor = fornecedores.find(x => x.id === fornecedorId)?.cnpj || '';
      if (!fornecedorId && fornecedorNovo?.nome) {
        const payloadForn = { ...fornecedorNovo, cnpj: fornecedorNovo.cnpj || null };
        const { data: fn, error: ef } = await supabase.from('fin_fornecedores')
          .upsert([payloadForn], { onConflict: 'cnpj' }).select().single();
        if (ef) throw ef;
        fornecedorId = fn.id;
        cnpjFornecedor = fn.cnpj || '';
      }

      // 2) Cabeçalho
      const { recorrencia, valor_tipo, recorrencia_ate, ...resto } = f;
      const recorrente = recorrencia === 'RECORRENTE';
      // Campos de recorrência só vão quando usados (ou quando o banco já tem as colunas), para não quebrar antes do SQL novo
      const temColunasRecorrencia = recorrente || (despesa && 'recorrencia' in despesa);
      const cab = {
        ...resto,
        ...(temColunasRecorrencia ? {
          recorrencia,
          valor_tipo: recorrente ? valor_tipo : null,
          recorrencia_ate: recorrente ? (recorrencia_ate || null) : null,
          conferido: true, // salvar = operador conferiu o valor
        } : {}),
        fornecedor_id: fornecedorId,
        viagem_id: f.viagem_id || null,
        chave_nfe: f.chave_nfe || null,
        vencimento: f.status === 'A_PAGAR' ? (f.vencimento || null) : (f.vencimento || null),
        data_pagamento: f.status === 'PAGO' ? (f.data_pagamento || f.data) : null,
        forma_pagamento: f.forma_pagamento || null,
        updated_at: new Date().toISOString(),
      };
      const res = editando
        ? await supabase.from('fin_despesas').update(cab).eq('id', despesa.id).select().single()
        : await supabase.from('fin_despesas').insert([cab]).select().single();
      if (res.error) throw res.error;
      const id = res.data.id;

      // 3) Anexos novos
      let listaAnexos = anexos;
      if (arquivosNovos.length) {
        const enviados = [];
        for (const arq of arquivosNovos) {
          const limpo = arq.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_');
          const path = `${id}/${Date.now()}-${limpo}`;
          const { error: eu } = await supabase.storage.from(BUCKET_FINANCEIRO).upload(path, arq, { contentType: arq.type || undefined });
          if (eu) throw new Error(`Falha ao enviar ${arq.name}: ${eu.message}`);
          enviados.push({ path, nome: arq.name, tipo: arq.type || '' });
        }
        listaAnexos = [...anexos, ...enviados];
      }
      const removidos = (despesa?.anexos || []).filter(a => !listaAnexos.some(b => b.path === a.path));
      if (removidos.length) await supabase.storage.from(BUCKET_FINANCEIRO).remove(removidos.map(a => a.path));
      await supabase.from('fin_despesas').update({ anexos: listaAnexos }).eq('id', id);

      // 4) Linhas (troca todas)
      if (editando) {
        const { error: ed } = await supabase.from('fin_despesa_itens').delete().eq('despesa_id', id);
        if (ed) throw ed;
      }
      const payloadLinhas = validas.map((l, i) => ({
        despesa_id: id,
        item_id: l.item_id || null,
        categoria_id: l.categoria_id || null,
        descricao: l.descricao.trim() || itemPorId[l.item_id]?.nome || null,
        codigo_fornecedor: l.codigo_fornecedor || null,
        quantidade: lerNumero(l.quantidade) || 1,
        unidade: l.unidade || 'UN',
        valor_unitario: lerNumero(l.valor_unitario),
        valor_total: totalLinha(l),
        ordem: i,
      }));
      const { error: el } = await supabase.from('fin_despesa_itens').insert(payloadLinhas);
      if (el) throw el;

      // 5) Memória: código do fornecedor → item/categoria (próxima NF já vem classificada)
      const cnpj = soDigitos(cnpjFornecedor);
      if (cnpj) {
        const memoria = validas.filter(l => l.codigo_fornecedor && l.categoria_id).map(l => ({
          fornecedor_cnpj: cnpj, codigo: l.codigo_fornecedor, item_id: l.item_id || null, categoria_id: l.categoria_id,
        }));
        if (memoria.length) await supabase.from('fin_item_vinculos').upsert(memoria, { onConflict: 'fornecedor_cnpj,codigo' });
      }

      // 6) Solicitações atendidas por esta compra
      if (solicitacoes.length) {
        await supabase.from('fin_solicitacoes')
          .update({ status: 'COMPRADA', despesa_id: id, decidido_em: new Date().toISOString() })
          .in('id', solicitacoes.map(s => s.id));
      }

      showToast(editando ? 'Gasto atualizado.' : 'Gasto lançado.');
      onSaved();
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setSalvando(false);
    }
  };

  const diferencaNota = totalNota != null ? Math.round((total - totalNota) * 100) / 100 : 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-5xl my-4 shadow-2xl">
        {/* Cabeçalho do modal */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">{editando ? 'Editar gasto' : 'Novo gasto'}</h3>
          <div className="flex items-center gap-2">
            <input ref={xmlRef} type="file" accept=".xml,.pdf,text/xml,application/xml,application/pdf" className="hidden"
              onChange={e => { importarXml(e.target.files?.[0]); e.target.value = ''; }} />
            <button type="button" onClick={() => xmlRef.current?.click()} disabled={lendo}
              className="inline-flex items-center gap-2 text-sm border border-blue-500/50 bg-blue-500/10 text-blue-300 hover:text-white disabled:opacity-60 rounded-lg px-3 py-2">
              {lendo ? <FaSpinner className="animate-spin" /> : <FaFileCode />} Importar nota (XML ou PDF)
            </button>
            <button type="button" onClick={onClose} aria-label="Fechar" className="text-gray-500 hover:text-white p-2"><FaTimes /></button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {erro && (
            <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/60 border border-red-500/30 rounded-lg px-3 py-2">
              <FaExclamationTriangle className="mt-0.5 shrink-0" /> {erro}
            </div>
          )}

          {avisos.length > 0 && (
            <ul className="text-sm text-amber-200 bg-amber-950/40 border border-amber-500/30 rounded-lg px-3 py-2 space-y-1">
              {avisos.map(a => <li key={a} className="flex items-start gap-2"><FaExclamationTriangle className="mt-0.5 shrink-0 text-amber-400" /> {a}</li>)}
            </ul>
          )}

          {conferir && (
            <div className="flex items-start gap-2 text-sm text-amber-200 bg-amber-950/40 border border-amber-500/40 rounded-lg px-3 py-2">
              <FaExclamationTriangle className="mt-0.5 shrink-0 text-amber-400" />
              <span>Gasto variável criado automaticamente com o valor do mês anterior. Confira os valores deste mês e salve: o aviso some.</span>
            </div>
          )}

          {/* Documento */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="col-span-2 md:col-span-1"><span className={rotuloCls}>Documento</span>
              <Select value={f.tipo_documento} onChange={set('tipo_documento')} options={TIPOS_DOCUMENTO} className={campo} />
            </label>
            <label><span className={rotuloCls}>Data da compra</span>
              <DateInput value={f.data} onChange={set('data')} className={campo} />
            </label>
            <label><span className={rotuloCls}>Número</span>
              <input value={f.numero} onChange={set('numero')} className={campo} placeholder="Nº da NF / romaneio" />
            </label>
            <label><span className={rotuloCls}>Série</span>
              <input value={f.serie} onChange={set('serie')} className={campo} />
            </label>

            <label className="col-span-2"><span className={rotuloCls}>Fornecedor</span>
              {fornecedorNovo ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-sm">
                  <span className="text-emerald-300 truncate">Novo: {fornecedorNovo.nome} · {formatarCnpj(fornecedorNovo.cnpj)} <span className="text-gray-400">(cadastrado ao salvar)</span></span>
                  <button type="button" onClick={() => setFornecedorNovo(null)} className="text-gray-400 hover:text-white"><FaTimes size={11} /></button>
                </div>
              ) : (
                <Select value={f.fornecedor_id} onChange={escolherFornecedor} options={opcoesFornecedor} searchable className={campo} />
              )}
            </label>
            <label className="col-span-2"><span className={rotuloCls}>Viagem (opcional)</span>
              <Select value={f.viagem_id} onChange={set('viagem_id')} options={opcoesViagem} searchable className={campo} />
            </label>

            <label className="col-span-2 md:col-span-4"><span className={rotuloCls}>Descrição</span>
              <input value={f.descricao} onChange={set('descricao')} className={campo} placeholder="Ex.: Compra de rastreadores FT4G, abastecimento viagem Campinas..." />
            </label>
            {f.chave_nfe && (
              <div className="col-span-2 md:col-span-4 text-xs text-gray-500 break-all">Chave NF-e: <span className="text-gray-300 tabular-nums">{f.chave_nfe}</span></div>
            )}
          </div>

          {/* Pagamento */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label><span className={rotuloCls}>Situação</span>
              <Select value={f.status} onChange={set('status')} options={STATUS_PAGAMENTO} className={campo} />
            </label>
            <label><span className={rotuloCls}>Forma de pagamento</span>
              <Select value={f.forma_pagamento} onChange={set('forma_pagamento')} options={[{ value: '', label: '—' }, ...FORMAS_PAGAMENTO]} className={campo} />
            </label>
            <label><span className={rotuloCls}>Vencimento{f.status === 'A_PAGAR' ? ' *' : ''}</span>
              <DateInput value={f.vencimento} onChange={set('vencimento')} className={campo} />
            </label>
            {f.status === 'PAGO' && (
              <label><span className={rotuloCls}>Pago em</span>
                <DateInput value={f.data_pagamento} onChange={set('data_pagamento')} className={campo} placeholder="Mesma data da compra" />
              </label>
            )}
          </div>

          {/* Recorrência */}
          <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-white inline-flex items-center gap-2"><FaRedoAlt size={11} className="text-blue-400" /> Tipo de recorrência</h4>
            <div className="grid md:grid-cols-3 gap-3">
              <div><span className={rotuloCls}>Recorrência</span>
                <Opcoes value={f.recorrencia} onChange={set('recorrencia')} options={TIPOS_RECORRENCIA} ariaLabel="Tipo de recorrência" />
              </div>
              {f.recorrencia === 'RECORRENTE' && (
                <>
                  <div><span className={rotuloCls}>Valor</span>
                    <Opcoes value={f.valor_tipo} onChange={set('valor_tipo')} options={TIPOS_VALOR_RECORRENTE} ariaLabel="Valor fixo ou variável" />
                  </div>
                  <label><span className={rotuloCls}>Prazo (opcional)</span>
                    <DateInput value={f.recorrencia_ate} onChange={set('recorrencia_ate')} className={campo} placeholder="Sem data limite" />
                  </label>
                </>
              )}
            </div>
            {f.recorrencia === 'RECORRENTE' && (
              <p className="text-xs text-gray-400">
                Todo mês um novo lançamento nasce sozinho, a pagar, copiando o do mês anterior
                {f.recorrencia_ate ? `, até ${dataBR(f.recorrencia_ate)}` : ', sem data para acabar'}.
                {f.valor_tipo === 'VARIAVEL'
                  ? ' Como é variável, ele vem com o valor do mês anterior e fica marcado "Conferir valor" até alguém abrir, ajustar e salvar.'
                  : ' Como é fixo, o valor é sempre o mesmo.'}
                {' '}Para parar, mude o último lançamento para Pontual.
              </p>
            )}
          </div>

          {/* Linhas */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-white">Itens</h4>
              {linhas.length > 1 && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  Categoria para todas as linhas:
                  <Select value={categoriaTodas} onChange={e => { setCategoriaTodas(e.target.value); if (e.target.value) setLinhas(ls => ls.map(l => ({ ...l, categoria_id: e.target.value }))); }}
                    options={opcoesCategoria} className={`w-52 px-2 py-1.5 ${inputBase}`} />
                </div>
              )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-gray-900/80 border-b border-gray-800 text-xs text-gray-400">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium w-[17%]">Item do catálogo</th>
                    <th className="px-2 py-2 text-left font-medium w-[16%]">Categoria</th>
                    <th className="px-2 py-2 text-left font-medium">Descrição</th>
                    <th className="px-2 py-2 text-right font-medium w-20">Qtd</th>
                    <th className="px-2 py-2 text-left font-medium w-20">Un.</th>
                    <th className="px-2 py-2 text-right font-medium w-28">Valor unit.</th>
                    <th className="px-2 py-2 text-right font-medium w-28">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/70">
                  {linhas.map(l => (
                    <tr key={l.chave}>
                      <td className="px-2 py-1.5"><Select value={l.item_id} onChange={e => mudarLinha(l.chave, 'item_id', e.target.value)} options={opcoesItem} searchable className={`w-full px-2 py-1.5 ${inputBase}`} /></td>
                      <td className="px-2 py-1.5"><Select value={l.categoria_id} onChange={e => mudarLinha(l.chave, 'categoria_id', e.target.value)} options={opcoesCategoria} searchable className={`w-full px-2 py-1.5 ${inputBase} ${!l.categoria_id ? 'border-amber-500/50' : ''}`} /></td>
                      <td className="px-2 py-1.5">
                        <input value={l.descricao} onChange={e => mudarLinha(l.chave, 'descricao', e.target.value)} className={`w-full px-2 py-1.5 ${inputBase}`} />
                        {l.codigo_fornecedor && <div className="text-[11px] text-gray-500 mt-0.5">Cód. fornecedor: {l.codigo_fornecedor}</div>}
                      </td>
                      <td className="px-2 py-1.5"><input inputMode="decimal" value={l.quantidade} onChange={e => mudarLinha(l.chave, 'quantidade', e.target.value)} className={`w-full px-2 py-1.5 text-right tabular-nums ${inputBase}`} /></td>
                      <td className="px-2 py-1.5"><Select value={l.unidade} onChange={e => mudarLinha(l.chave, 'unidade', e.target.value)} options={[...new Set([...UNIDADES, l.unidade].filter(Boolean))].map(u => ({ value: u, label: u }))} className={`w-full px-2 py-1.5 ${inputBase}`} /></td>
                      <td className="px-2 py-1.5"><input inputMode="decimal" value={l.valor_unitario} onChange={e => mudarLinha(l.chave, 'valor_unitario', e.target.value)} placeholder="0,00" className={`w-full px-2 py-1.5 text-right tabular-nums ${inputBase}`} /></td>
                      <td className={`px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${totalLinha(l) < 0 ? 'text-emerald-400' : 'text-white'}`}>{reais(totalLinha(l))}</td>
                      <td className="px-1 py-1.5 text-center">
                        <button type="button" onClick={() => setLinhas(ls => (ls.length > 1 ? ls.filter(x => x.chave !== l.chave) : [linhaVazia()]))} aria-label="Remover linha" className="text-gray-500 hover:text-red-400 p-1"><FaTrashAlt size={12} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setLinhas(ls => [...ls, linhaVazia(ls.length)])} className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"><FaPlus size={11} /> Adicionar linha</button>
              <div className="text-right">
                <div className="text-sm text-gray-400">Total do gasto: <span className="text-xl font-semibold text-white tabular-nums ml-1">{reais(total)}</span></div>
                {totalNota != null && (
                  <div className={`text-xs ${Math.abs(diferencaNota) > 0.05 ? 'text-amber-400' : 'text-gray-500'}`}>
                    Valor da NF: {reais(totalNota)}{Math.abs(diferencaNota) > 0.05 ? ` · diferença de ${reais(diferencaNota)}` : ' · confere'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Anexos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Anexos <span className="text-gray-500 font-normal">(NF em PDF, foto do romaneio, cupom, recibo)</span></h4>
              <input ref={anexoRef} type="file" multiple accept=".pdf,.xml,image/*" className="hidden"
                onChange={e => { const fs = Array.from(e.target.files || []); setArquivosNovos(prev => [...prev, ...fs]); e.target.value = ''; }} />
              <button type="button" onClick={() => anexoRef.current?.click()} className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-1.5">
                <FaPaperclip size={12} /> Anexar arquivo
              </button>
            </div>
            {(anexos.length + arquivosNovos.length) === 0 ? (
              <p className="text-xs text-gray-500">Nenhum arquivo anexado.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {anexos.map(a => (
                  <li key={a.path} className="inline-flex items-center gap-2 bg-gray-800/70 border border-gray-700 rounded-full pl-3 pr-1.5 py-1 text-xs text-gray-200">
                    <button type="button" onClick={() => abrirAnexo(a)} className="inline-flex items-center gap-1.5 hover:text-white"><FaExternalLinkAlt size={9} /> {a.nome}</button>
                    <button type="button" onClick={() => setAnexos(xs => xs.filter(x => x.path !== a.path))} aria-label="Remover anexo" className="text-gray-500 hover:text-red-400 p-0.5"><FaTimes size={10} /></button>
                  </li>
                ))}
                {arquivosNovos.map((a, i) => (
                  <li key={`${a.name}-${i}`} className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/40 rounded-full pl-3 pr-1.5 py-1 text-xs text-blue-200">
                    {a.name} <span className="text-gray-500">(envia ao salvar)</span>
                    <button type="button" onClick={() => setArquivosNovos(xs => xs.filter((_, j) => j !== i))} aria-label="Remover anexo" className="text-gray-500 hover:text-red-400 p-0.5"><FaTimes size={10} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="block"><span className={rotuloCls}>Observação</span>
            <textarea value={f.observacao} onChange={set('observacao')} rows={2} className={campo} />
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-800">
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-sm px-3">Cancelar</button>
          <button type="button" onClick={salvar} disabled={salvando}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-semibold">
            {salvando && <FaSpinner className="animate-spin" />} {editando ? 'Salvar alterações' : 'Lançar gasto'}
          </button>
        </div>
      </div>
    </div>
  );
}
