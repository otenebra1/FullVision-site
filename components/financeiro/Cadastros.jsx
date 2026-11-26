// Cadastros do financeiro: fornecedores, viagens, itens e categorias
import React, { useMemo, useState } from 'react';
import { FaTimes, FaSpinner, FaEdit, FaTrashAlt, FaListUl, FaBoxOpen } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import {
  inputBase, tableWrap, theadClass, tbodyClass, rowClass, Dash, SectionCard, PrimaryButton, ActionButton,
  SearchInput, ToggleFilter, Th, sortBy, nextSort, norm,
} from '../admin/ui';
import { Select, DateInput } from '../ui/FormControls';
import { formatarCnpj, soDigitos } from '../../lib/nfe';
import { GRUPOS_CATEGORIA, UNIDADES, reais, dataBR, lerNumero, hojeIso } from '../../lib/financeiro';
import ViagemDetalhe from './ViagemDetalhe';

const campo = `w-full px-3 py-2 ${inputBase}`;
const rotuloCls = 'block text-xs font-medium text-gray-400 mb-1';

// Modal simples com formulário
function Modal({ titulo, onClose, onSalvar, salvando, erro, children, largura = 'max-w-2xl' }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className={`bg-gray-900 border border-gray-800 rounded-2xl w-full ${largura} my-4 shadow-2xl`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">{titulo}</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-gray-500 hover:text-white p-2"><FaTimes /></button>
        </div>
        <div className="p-5 space-y-4">
          {erro && <div className="text-sm text-red-300 bg-red-950/60 border border-red-500/30 rounded-lg px-3 py-2">{erro}</div>}
          {children}
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-800">
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-sm px-3">Cancelar</button>
          <button type="button" onClick={onSalvar} disabled={salvando} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-semibold">
            {salvando && <FaSpinner className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook para formulário em modal que grava numa tabela
function useCadastro(tabela, recarregar, showToast) {
  const [aberto, setAberto] = useState(null); // registro (ou {} para novo)
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const abrir = (r) => { setErro(''); setAberto(r || {}); };
  const fechar = () => setAberto(null);
  const salvar = async (payload) => {
    setSalvando(true); setErro('');
    const res = aberto?.id
      ? await supabase.from(tabela).update(payload).eq('id', aberto.id)
      : await supabase.from(tabela).insert([payload]);
    setSalvando(false);
    if (res.error) {
      setErro(res.error.code === '23505' ? 'Já existe um cadastro com esse nome / CNPJ.' : res.error.message);
      return;
    }
    showToast('Salvo.');
    fechar();
    recarregar();
  };
  const excluir = async (id, askConfirm, msg) => {
    askConfirm(msg, async () => {
      const { error } = await supabase.from(tabela).delete().eq('id', id);
      if (error) { showToast('Não deu para excluir: ' + error.message, 'error'); return; }
      showToast('Excluído.');
      recarregar();
    });
  };
  return { aberto, abrir, fechar, salvar, salvando, erro, setErro, excluir };
}

// =====================================================================
// FORNECEDORES
// =====================================================================
export function FornecedoresPanel({ fornecedores, categorias, despesas, recarregar, showToast, askConfirm, onVerGastos }) {
  const cad = useCadastro('fin_fornecedores', recarregar, showToast);
  const [busca, setBusca] = useState('');
  const [soAtivos, setSoAtivos] = useState(true);
  const [sort, setSort] = useState({ key: 'total', dir: 'desc' });
  const [form, setForm] = useState({});
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e?.target ? e.target.value : e }));

  const catNome = useMemo(() => Object.fromEntries(categorias.map(c => [c.id, c.nome])), [categorias]);

  // Números de cada fornecedor (todas as compras)
  const numeros = useMemo(() => {
    const m = {};
    despesas.forEach(d => {
      if (!d.fornecedor_id) return;
      const x = m[d.fornecedor_id] || (m[d.fornecedor_id] = { total: 0, compras: 0, ultima: '', aPagar: 0 });
      x.total += Number(d.valor_total) || 0;
      x.compras += 1;
      if (d.data > x.ultima) x.ultima = d.data;
      if (d.status === 'A_PAGAR') x.aPagar += Number(d.valor_total) || 0;
    });
    return m;
  }, [despesas]);

  const lista = useMemo(() => {
    const q = norm(busca);
    const filtrados = fornecedores.filter(f => (!soAtivos || f.ativo !== false)
      && (!q || norm(`${f.nome} ${f.nome_fantasia} ${f.cnpj} ${f.cidade} ${f.contato}`).includes(q) || soDigitos(f.cnpj).includes(soDigitos(busca) || '#')));
    return sortBy(filtrados, sort, {
      nome: f => norm(f.nome_fantasia || f.nome),
      total: f => numeros[f.id]?.total || 0,
      compras: f => numeros[f.id]?.compras || 0,
      ultima: f => numeros[f.id]?.ultima || '',
      aPagar: f => numeros[f.id]?.aPagar || 0,
    });
  }, [fornecedores, busca, soAtivos, sort, numeros]);

  const abrir = (f) => {
    setForm({
      nome: f?.nome || '', nome_fantasia: f?.nome_fantasia || '', cnpj: f?.cnpj ? formatarCnpj(f.cnpj) : '', contato: f?.contato || '',
      telefone: f?.telefone || '', email: f?.email || '', cidade: f?.cidade || '', uf: f?.uf || '', endereco: f?.endereco || '',
      pix: f?.pix || '', categoria_id: f?.categoria_id || '', observacao: f?.observacao || '', ativo: f?.ativo !== false,
    });
    cad.abrir(f);
  };

  const salvar = () => {
    if (!form.nome.trim()) { cad.setErro('Informe o nome / razão social.'); return; }
    cad.salvar({
      ...form,
      nome: form.nome.trim(),
      cnpj: soDigitos(form.cnpj) || null,
      uf: (form.uf || '').toUpperCase().slice(0, 2) || null,
      categoria_id: form.categoria_id || null,
    });
  };

  const onSort = (key) => setSort(s => nextSort(s, key));

  return (
    <SectionCard title="Fornecedores" action={<PrimaryButton onClick={() => abrir(null)}>Novo fornecedor</PrimaryButton>}>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome, CNPJ, cidade ou contato" />
        <ToggleFilter label="Só ativos" active={soAtivos} onClick={() => setSoAtivos(v => !v)} />
      </div>
      <p className="text-xs text-gray-500">Fornecedor de NF-e importada por XML é cadastrado sozinho. Os números abaixo somam todas as compras.</p>

      <div className={tableWrap}>
        <table className="w-full text-sm">
          <thead className={theadClass}>
            <tr>
              <Th sortKey="nome" sort={sort} onSort={onSort}>Fornecedor</Th>
              <Th>CNPJ / CPF</Th>
              <Th>Contato</Th>
              <Th>Categoria</Th>
              <Th sortKey="compras" sort={sort} onSort={onSort} align="right">Compras</Th>
              <Th sortKey="total" sort={sort} onSort={onSort} align="right">Total gasto</Th>
              <Th sortKey="aPagar" sort={sort} onSort={onSort} align="right">A pagar</Th>
              <Th sortKey="ultima" sort={sort} onSort={onSort} align="right">Última compra</Th>
              <Th align="right">Ações</Th>
            </tr>
          </thead>
          <tbody className={tbodyClass}>
            {lista.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Nenhum fornecedor.</td></tr>}
            {lista.map(f => {
              const n = numeros[f.id] || {};
              return (
                <tr key={f.id} className={`${rowClass} ${f.ativo === false ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{f.nome_fantasia || f.nome}</div>
                    {f.nome_fantasia && <div className="text-xs text-gray-500">{f.nome}</div>}
                    {(f.cidade || f.uf) && <div className="text-xs text-gray-500">{[f.cidade, f.uf].filter(Boolean).join(' / ')}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-300 tabular-nums whitespace-nowrap">{f.cnpj ? formatarCnpj(f.cnpj) : <Dash />}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {f.contato && <div>{f.contato}</div>}
                    {f.telefone && <div className="text-xs text-gray-400">{f.telefone}</div>}
                    {f.email && <div className="text-xs text-gray-400">{f.email}</div>}
                    {!f.contato && !f.telefone && !f.email && <Dash />}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{catNome[f.categoria_id] || <Dash />}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-300">{n.compras || 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-white whitespace-nowrap">{reais(n.total)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${n.aPagar ? 'text-amber-400' : 'text-gray-600'}`}>{reais(n.aPagar)}</td>
                  <td className="px-4 py-3 text-right text-gray-300 whitespace-nowrap">{n.ultima ? dataBR(n.ultima) : <Dash />}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <ActionButton title="Ver gastos deste fornecedor" onClick={() => onVerGastos(f.id)}><FaListUl size={12} /></ActionButton>
                      <ActionButton title="Editar" onClick={() => abrir(f)}><FaEdit size={12} /></ActionButton>
                      <ActionButton title="Excluir" hover="hover:text-red-400" onClick={() => cad.excluir(f.id, askConfirm, n.compras ? `Esse fornecedor tem ${n.compras} gasto(s). Eles continuam, mas ficam sem fornecedor. Para só esconder, desmarque "Ativo". Excluir mesmo assim?` : 'Excluir este fornecedor?')}><FaTrashAlt size={12} /></ActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cad.aberto && (
        <Modal titulo={cad.aberto.id ? 'Editar fornecedor' : 'Novo fornecedor'} onClose={cad.fechar} onSalvar={salvar} salvando={cad.salvando} erro={cad.erro}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="sm:col-span-2"><span className={rotuloCls}>Razão social / nome *</span><input value={form.nome} onChange={set('nome')} className={campo} /></label>
            <label><span className={rotuloCls}>Nome fantasia</span><input value={form.nome_fantasia} onChange={set('nome_fantasia')} className={campo} /></label>
            <label><span className={rotuloCls}>CNPJ / CPF</span><input value={form.cnpj} onChange={set('cnpj')} onBlur={() => setForm(p => ({ ...p, cnpj: formatarCnpj(p.cnpj) }))} className={campo} /></label>
            <label><span className={rotuloCls}>Contato (vendedor)</span><input value={form.contato} onChange={set('contato')} className={campo} /></label>
            <label><span className={rotuloCls}>Telefone / WhatsApp</span><input value={form.telefone} onChange={set('telefone')} className={campo} /></label>
            <label><span className={rotuloCls}>E-mail</span><input type="email" value={form.email} onChange={set('email')} className={campo} /></label>
            <label><span className={rotuloCls}>Chave PIX / dados bancários</span><input value={form.pix} onChange={set('pix')} className={campo} /></label>
            <label><span className={rotuloCls}>Cidade</span><input value={form.cidade} onChange={set('cidade')} className={campo} /></label>
            <label><span className={rotuloCls}>UF</span><input value={form.uf} onChange={set('uf')} maxLength={2} className={`${campo} uppercase`} /></label>
            <label className="sm:col-span-2"><span className={rotuloCls}>Endereço</span><input value={form.endereco} onChange={set('endereco')} className={campo} /></label>
            <label className="sm:col-span-2"><span className={rotuloCls}>O que costuma vender (sugere a categoria no lançamento)</span>
              <Select value={form.categoria_id} onChange={set('categoria_id')} options={[{ value: '', label: '—' }, ...categorias.map(c => ({ value: c.id, label: c.nome }))]} searchable className={campo} />
            </label>
            <label className="sm:col-span-2"><span className={rotuloCls}>Observação</span><textarea rows={2} value={form.observacao} onChange={set('observacao')} className={campo} /></label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={form.ativo} onChange={e => setForm(p => ({ ...p, ativo: e.target.checked }))} /> Ativo</label>
          </div>
        </Modal>
      )}
    </SectionCard>
  );
}

// =====================================================================
// VIAGENS
// =====================================================================
export function ViagensPanel({ viagens, despesas, tecnicos, empresas, categorias, recarregar, showToast, askConfirm, onVerGastos, onAbrirGasto }) {
  const cad = useCadastro('fin_viagens', recarregar, showToast);
  const [aberta, setAberta] = useState(null); // { id, aba } viagem aberta (gastos rápidos e inventário)
  const viagemAberta = aberta && viagens.find(v => v.id === aberta.id);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState({});
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e?.target ? e.target.value : e }));

  const catGrupo = useMemo(() => Object.fromEntries(categorias.map(c => [c.id, c.nome])), [categorias]);
  const tecNome = useMemo(() => Object.fromEntries(tecnicos.map(t => [String(t.id), t.nome])), [tecnicos]);
  const empNome = useMemo(() => Object.fromEntries(empresas.map(e => [String(e.id), e.nome])), [empresas]);

  // Total e principais categorias de cada viagem
  const numeros = useMemo(() => {
    const m = {};
    despesas.forEach(d => {
      if (!d.viagem_id) return;
      const x = m[d.viagem_id] || (m[d.viagem_id] = { total: 0, porCat: {} });
      x.total += Number(d.valor_total) || 0;
      (d.fin_despesa_itens || []).forEach(l => {
        const c = catGrupo[l.categoria_id] || 'Sem categoria';
        x.porCat[c] = (x.porCat[c] || 0) + (Number(l.valor_total) || 0);
      });
    });
    return m;
  }, [despesas, catGrupo]);

  const lista = useMemo(() => {
    const q = norm(busca);
    return viagens.filter(v => !q || norm(`${v.titulo} ${v.destino} ${tecNome[String(v.tecnico_id)] || ''} ${empNome[String(v.empresa_id)] || ''}`).includes(q));
  }, [viagens, busca, tecNome, empNome]);

  const abrir = (v) => {
    setForm({
      titulo: v?.titulo || '', destino: v?.destino || '', data_ida: v?.data_ida || hojeIso(), data_volta: v?.data_volta || '',
      tecnico_id: v?.tecnico_id != null ? String(v.tecnico_id) : '', empresa_id: v?.empresa_id != null ? String(v.empresa_id) : '',
      km: v?.km ?? '', observacao: v?.observacao || '',
    });
    cad.abrir(v);
  };
  const salvar = () => {
    if (!form.titulo.trim()) { cad.setErro('Dê um nome para a viagem (ex.: Instalação frota XPTO em Campinas).'); return; }
    cad.salvar({
      ...form, titulo: form.titulo.trim(),
      data_ida: form.data_ida || null, data_volta: form.data_volta || null,
      tecnico_id: form.tecnico_id || null, empresa_id: form.empresa_id || null,
      km: form.km === '' ? null : lerNumero(form.km),
    });
  };

  return (
    <SectionCard title="Viagens" action={<PrimaryButton onClick={() => abrir(null)}>Nova viagem</PrimaryButton>}>
      <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por viagem, destino, técnico ou cliente" />
      <div className={tableWrap}>
        <table className="w-full text-sm">
          <thead className={theadClass}>
            <tr><Th>Viagem</Th><Th>Datas</Th><Th>Técnico</Th><Th>Cliente</Th><Th>Principais gastos</Th><Th align="right">Total</Th><Th align="right">R$/km</Th><Th align="right">Ações</Th></tr>
          </thead>
          <tbody className={tbodyClass}>
            {lista.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Nenhuma viagem cadastrada.</td></tr>}
            {lista.map(v => {
              const n = numeros[v.id] || { total: 0, porCat: {} };
              const top = Object.entries(n.porCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
              return (
                <tr key={v.id} className={rowClass}>
                  <td className="px-4 py-3"><button type="button" onClick={() => setAberta({ id: v.id, aba: 'gastos' })} className="text-left text-white font-medium hover:text-blue-300">{v.titulo}</button>{v.destino && <div className="text-xs text-gray-500">{v.destino}</div>}</td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{dataBR(v.data_ida)}{v.data_volta && v.data_volta !== v.data_ida ? ` a ${dataBR(v.data_volta)}` : ''}</td>
                  <td className="px-4 py-3 text-gray-300">{tecNome[String(v.tecnico_id)] || <Dash />}</td>
                  <td className="px-4 py-3 text-gray-300">{empNome[String(v.empresa_id)] || <Dash />}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{top.length ? top.map(([c, val]) => `${c} ${reais(val)}`).join(' · ') : <Dash />}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-white whitespace-nowrap">{reais(n.total)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-300 whitespace-nowrap">{v.km ? reais(n.total / v.km) : <Dash />}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setAberta({ id: v.id, aba: 'gastos' })} className="text-xs text-blue-400 hover:text-blue-300 px-2 whitespace-nowrap">+ gasto</button>
                      <ActionButton title="Inventário (itens do estoque)" onClick={() => setAberta({ id: v.id, aba: 'inventario' })}><FaBoxOpen size={12} /></ActionButton>
                      <ActionButton title="Ver gastos da viagem" onClick={() => onVerGastos(v.id)}><FaListUl size={12} /></ActionButton>
                      <ActionButton title="Editar" onClick={() => abrir(v)}><FaEdit size={12} /></ActionButton>
                      <ActionButton title="Excluir" hover="hover:text-red-400" onClick={() => cad.excluir(v.id, askConfirm, 'Excluir esta viagem? Os gastos dela continuam lançados, só perdem o vínculo.')}><FaTrashAlt size={12} /></ActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {viagemAberta && (
        <ViagemDetalhe
          key={viagemAberta.id}
          viagem={viagemAberta} abaInicial={aberta.aba}
          tecnicos={tecnicos} empresas={empresas} categorias={categorias} despesas={despesas}
          recarregar={recarregar} showToast={showToast} askConfirm={askConfirm}
          onAbrirGasto={onAbrirGasto}
          onClose={() => setAberta(null)}
        />
      )}

      {cad.aberto && (
        <Modal titulo={cad.aberto.id ? 'Editar viagem' : 'Nova viagem'} onClose={cad.fechar} onSalvar={salvar} salvando={cad.salvando} erro={cad.erro}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="sm:col-span-2"><span className={rotuloCls}>Nome da viagem *</span><input value={form.titulo} onChange={set('titulo')} className={campo} placeholder="Ex.: Instalação frota Transportadora X" /></label>
            <label className="sm:col-span-2"><span className={rotuloCls}>Destino</span><input value={form.destino} onChange={set('destino')} className={campo} placeholder="Cidade / UF" /></label>
            <label><span className={rotuloCls}>Ida</span><DateInput value={form.data_ida} onChange={set('data_ida')} className={campo} /></label>
            <label><span className={rotuloCls}>Volta</span><DateInput value={form.data_volta} onChange={set('data_volta')} className={campo} /></label>
            <label><span className={rotuloCls}>Técnico</span>
              <Select value={form.tecnico_id} onChange={set('tecnico_id')} options={[{ value: '', label: '—' }, ...tecnicos.map(t => ({ value: String(t.id), label: t.nome }))]} searchable className={campo} />
            </label>
            <label><span className={rotuloCls}>Cliente</span>
              <Select value={form.empresa_id} onChange={set('empresa_id')} options={[{ value: '', label: '—' }, ...empresas.map(e => ({ value: String(e.id), label: e.nome }))]} searchable className={campo} />
            </label>
            <label><span className={rotuloCls}>Km rodados</span><input inputMode="decimal" value={form.km} onChange={set('km')} className={campo} /></label>
            <label className="sm:col-span-2"><span className={rotuloCls}>Observação</span><textarea rows={2} value={form.observacao} onChange={set('observacao')} className={campo} /></label>
          </div>
        </Modal>
      )}
    </SectionCard>
  );
}

// =====================================================================
// ITENS e CATEGORIAS
// =====================================================================
export function ItensPanel({ itens, categorias, produtosEstoque, despesas, recarregar, showToast, askConfirm, onVerGastosItem }) {
  const cadItem = useCadastro('fin_itens', recarregar, showToast);
  const cadCat = useCadastro('fin_categorias', recarregar, showToast);
  const [busca, setBusca] = useState('');
  const [formItem, setFormItem] = useState({});
  const [formCat, setFormCat] = useState({});

  const catPorId = useMemo(() => Object.fromEntries(categorias.map(c => [c.id, c])), [categorias]);
  const prodPorId = useMemo(() => Object.fromEntries(produtosEstoque.map(p => [p.id, p])), [produtosEstoque]);

  // Quanto já se comprou de cada item e o último preço pago
  const numeros = useMemo(() => {
    const m = {};
    const porData = despesas.slice().sort((a, b) => (a.data < b.data ? -1 : 1));
    porData.forEach(d => (d.fin_despesa_itens || []).forEach(l => {
      if (!l.item_id) return;
      const x = m[l.item_id] || (m[l.item_id] = { qtd: 0, total: 0, ultimoPreco: 0, ultimaData: '' });
      x.qtd += Number(l.quantidade) || 0;
      x.total += Number(l.valor_total) || 0;
      x.ultimoPreco = Number(l.valor_unitario) || 0;
      x.ultimaData = d.data;
    }));
    return m;
  }, [despesas]);
  const totalPorCategoria = useMemo(() => {
    const m = {};
    despesas.forEach(d => (d.fin_despesa_itens || []).forEach(l => { m[l.categoria_id] = (m[l.categoria_id] || 0) + (Number(l.valor_total) || 0); }));
    return m;
  }, [despesas]);

  const listaItens = useMemo(() => {
    const q = norm(busca);
    return itens.filter(i => !q || norm(`${i.nome} ${catPorId[i.categoria_id]?.nome || ''}`).includes(q))
      .sort((a, b) => (catPorId[a.categoria_id]?.ordem ?? 999) - (catPorId[b.categoria_id]?.ordem ?? 999) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [itens, busca, catPorId]);

  const abrirItem = (i) => {
    setFormItem({ nome: i?.nome || '', categoria_id: i?.categoria_id || '', unidade: i?.unidade || 'UN', produto_id: i?.produto_id || '', ativo: i?.ativo !== false });
    cadItem.abrir(i);
  };
  const salvarItem = () => {
    if (!formItem.nome.trim()) { cadItem.setErro('Informe o nome do item.'); return; }
    if (!formItem.categoria_id) { cadItem.setErro('Escolha a categoria.'); return; }
    cadItem.salvar({ ...formItem, nome: formItem.nome.trim(), produto_id: formItem.produto_id || null });
  };
  const abrirCat = (c) => {
    setFormCat({ nome: c?.nome || '', grupo: c?.grupo || 'Outros', ordem: c?.ordem ?? 500, ativo: c?.ativo !== false });
    cadCat.abrir(c);
  };
  const salvarCat = () => {
    if (!formCat.nome.trim()) { cadCat.setErro('Informe o nome da categoria.'); return; }
    cadCat.salvar({ ...formCat, nome: formCat.nome.trim(), ordem: Number(formCat.ordem) || 0 });
  };

  const gruposCat = useMemo(() => {
    const g = {};
    categorias.forEach(c => { (g[c.grupo || 'Outros'] = g[c.grupo || 'Outros'] || []).push(c); });
    return GRUPOS_CATEGORIA.filter(n => g[n]).map(n => [n, g[n]]).concat(Object.entries(g).filter(([n]) => !GRUPOS_CATEGORIA.includes(n)));
  }, [categorias]);

  return (
    <div className="space-y-8">
      <SectionCard title="Itens" action={<PrimaryButton onClick={() => abrirItem(null)}>Novo item</PrimaryButton>}>
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar item ou categoria" />
        <div className={tableWrap}>
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr><Th>Item</Th><Th>Categoria</Th><Th>Un.</Th><Th>Estoque</Th><Th align="right">Qtd comprada</Th><Th align="right">Total gasto</Th><Th align="right">Último preço</Th><Th align="right">Ações</Th></tr>
            </thead>
            <tbody className={tbodyClass}>
              {listaItens.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Nenhum item.</td></tr>}
              {listaItens.map(i => {
                const n = numeros[i.id] || {};
                return (
                  <tr key={i.id} className={`${rowClass} ${i.ativo === false ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 text-white">{i.nome}</td>
                    <td className="px-4 py-3 text-gray-300">{catPorId[i.categoria_id]?.nome || <Dash />}</td>
                    <td className="px-4 py-3 text-gray-400">{i.unidade}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{prodPorId[i.produto_id]?.codigo || <Dash />}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-300">{n.qtd ? Number(n.qtd).toLocaleString('pt-BR') : <Dash />}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-white whitespace-nowrap">{reais(n.total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-300 whitespace-nowrap" title={n.ultimaData ? `em ${dataBR(n.ultimaData)}` : ''}>{n.ultimoPreco ? reais(n.ultimoPreco) : <Dash />}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <ActionButton title="Ver compras deste item" onClick={() => onVerGastosItem(i.id)}><FaListUl size={12} /></ActionButton>
                        <ActionButton title="Editar" onClick={() => abrirItem(i)}><FaEdit size={12} /></ActionButton>
                        <ActionButton title="Excluir" hover="hover:text-red-400" onClick={() => cadItem.excluir(i.id, askConfirm, 'Excluir este item do catálogo? Os gastos já lançados continuam.')}><FaTrashAlt size={12} /></ActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Categorias" action={<PrimaryButton onClick={() => abrirCat(null)}>Nova categoria</PrimaryButton>}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gruposCat.map(([grupo, cats]) => (
            <div key={grupo} className="border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-gray-900/80 text-xs font-semibold uppercase tracking-wide text-gray-400">{grupo}</div>
              <ul className="divide-y divide-gray-800/70">
                {cats.sort((a, b) => a.ordem - b.ordem).map(c => (
                  <li key={c.id} className={`flex items-center justify-between gap-2 px-4 py-2 text-sm ${c.ativo === false ? 'opacity-50' : ''}`}>
                    <span className="text-gray-200">{c.nome}</span>
                    <span className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 tabular-nums mr-1">{reais(totalPorCategoria[c.id])}</span>
                      <ActionButton title="Editar" onClick={() => abrirCat(c)}><FaEdit size={11} /></ActionButton>
                      <ActionButton title="Excluir" hover="hover:text-red-400" onClick={() => cadCat.excluir(c.id, askConfirm, 'Excluir esta categoria? As linhas de gasto dela ficam sem categoria. Para só esconder, desmarque "Ativa".')}><FaTrashAlt size={11} /></ActionButton>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      {cadItem.aberto && (
        <Modal titulo={cadItem.aberto.id ? 'Editar item' : 'Novo item'} onClose={cadItem.fechar} onSalvar={salvarItem} salvando={cadItem.salvando} erro={cadItem.erro} largura="max-w-lg">
          <label className="block"><span className={rotuloCls}>Nome *</span><input value={formItem.nome} onChange={e => setFormItem(p => ({ ...p, nome: e.target.value }))} className={campo} placeholder="Ex.: Fita isolante 3M 19mm" /></label>
          <label className="block"><span className={rotuloCls}>Categoria *</span>
            <Select value={formItem.categoria_id} onChange={e => setFormItem(p => ({ ...p, categoria_id: e.target.value }))} options={[{ value: '', label: 'Escolha...' }, ...categorias.map(c => ({ value: c.id, label: `${c.nome} · ${c.grupo}` }))]} searchable className={campo} />
          </label>
          <label className="block"><span className={rotuloCls}>Unidade</span>
            <Select value={formItem.unidade} onChange={e => setFormItem(p => ({ ...p, unidade: e.target.value }))} options={UNIDADES.map(u => ({ value: u, label: u }))} className={campo} />
          </label>
          <label className="block"><span className={rotuloCls}>Produto do estoque (para rastreador, sensor, atuador)</span>
            <Select value={formItem.produto_id} onChange={e => setFormItem(p => ({ ...p, produto_id: e.target.value }))} options={[{ value: '', label: '— não é item de estoque —' }, ...produtosEstoque.map(p => ({ value: p.id, label: `${p.codigo} · ${p.nome}` }))]} searchable className={campo} />
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={formItem.ativo} onChange={e => setFormItem(p => ({ ...p, ativo: e.target.checked }))} /> Ativo</label>
        </Modal>
      )}
      {cadCat.aberto && (
        <Modal titulo={cadCat.aberto.id ? 'Editar categoria' : 'Nova categoria'} onClose={cadCat.fechar} onSalvar={salvarCat} salvando={cadCat.salvando} erro={cadCat.erro} largura="max-w-lg">
          <label className="block"><span className={rotuloCls}>Nome *</span><input value={formCat.nome} onChange={e => setFormCat(p => ({ ...p, nome: e.target.value }))} className={campo} /></label>
          <label className="block"><span className={rotuloCls}>Grupo</span>
            <Select value={formCat.grupo} onChange={e => setFormCat(p => ({ ...p, grupo: e.target.value }))} options={GRUPOS_CATEGORIA.map(g => ({ value: g, label: g }))} className={campo} />
          </label>
          <label className="block"><span className={rotuloCls}>Ordem (menor aparece primeiro)</span><input inputMode="numeric" value={formCat.ordem} onChange={e => setFormCat(p => ({ ...p, ordem: e.target.value }))} className={campo} /></label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={formCat.ativo} onChange={e => setFormCat(p => ({ ...p, ativo: e.target.checked }))} /> Ativa</label>
        </Modal>
      )}
    </div>
  );
}
