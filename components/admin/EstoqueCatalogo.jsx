import React, { useMemo, useState } from 'react';
import { FaTimes, FaPlus, FaTags } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { inputBase } from './ui';

const proximoCodigo = (prefixo, existentes) => {
  const nums = existentes
    .map(c => new RegExp(`^${prefixo}-(\\d+)$`).exec(c || ''))
    .filter(Boolean)
    .map(m => Number(m[1]));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefixo}-${String(n).padStart(3, '0')}`;
};

function Toggle({ on, onClick, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-gray-700'}`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

// Cadastro de categorias (LOC, SEN, ATU...) e produtos (LOC-001 FT4G...) do estoque
export default function EstoqueCatalogo({ categorias, produtos, onClose, onChanged, showToast }) {
  const [catId, setCatId] = useState(categorias[0]?.id || null);
  const [novaCat, setNovaCat] = useState({ codigo: '', nome: '' });
  const [novoProd, setNovoProd] = useState({ nome: '' });
  const [salvando, setSalvando] = useState(false);

  const cat = categorias.find(c => c.id === catId) || null;
  const produtosDaCat = useMemo(() => produtos.filter(p => p.categoria_id === catId), [produtos, catId]);
  const codigoSugerido = cat ? proximoCodigo(cat.codigo, produtos.map(p => p.codigo)) : '';

  const run = async (promise, okMsg) => {
    setSalvando(true);
    const { error } = await promise;
    setSalvando(false);
    if (error) { showToast('Erro: ' + error.message, 'error'); return false; }
    if (okMsg) showToast(okMsg);
    await onChanged();
    return true;
  };

  const criarCategoria = async (e) => {
    e.preventDefault();
    const codigo = novaCat.codigo.trim().toUpperCase();
    const nome = novaCat.nome.trim();
    if (!codigo || !nome) { showToast('Informe código e nome da categoria.', 'error'); return; }
    const ok = await run(supabase.from('estoque_categorias').insert([{ codigo, nome, ordem: (categorias.length + 1) * 10 }]), 'Categoria criada');
    if (ok) setNovaCat({ codigo: '', nome: '' });
  };

  const criarProduto = async (e) => {
    e.preventDefault();
    if (!cat) return;
    // Código sempre automático (o banco também gera, para não repetir nem pular número)
    const codigo = codigoSugerido;
    const nome = novoProd.nome.trim().toUpperCase();
    if (!nome) { showToast('Informe o nome do produto.', 'error'); return; }
    const ok = await run(supabase.from('estoque_produtos').insert([{ categoria_id: cat.id, codigo, nome, ordem: (produtosDaCat.length + 1) * 10 }]), 'Produto criado');
    if (ok) setNovoProd({ nome: '' });
  };

  const renomear = (tabela, id, campo, atual) => async (e) => {
    const v = e.target.value.trim();
    const valor = campo === 'nome' && tabela === 'estoque_produtos' ? v.toUpperCase() : (campo === 'codigo' ? v.toUpperCase() : v);
    if (!valor || valor === atual) { e.target.value = atual; return; }
    await run(supabase.from(tabela).update({ [campo]: valor }).eq('id', id), 'Salvo');
  };

  const campo = `px-3 py-2 ${inputBase}`;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm overflow-y-auto p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl mx-auto my-8" role="dialog" aria-modal="true" aria-label="Categorias e produtos">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaTags className="text-cyan-400" /> Categorias e produtos</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-white p-1"><FaTimes /></button>
        </div>

        <div className="grid md:grid-cols-[280px_1fr] gap-0 md:divide-x divide-gray-800">
          {/* Categorias */}
          <div className="p-5 space-y-3">
            <div className="text-xs font-medium text-gray-400">Categorias</div>
            <ul className="space-y-1">
              {categorias.map(c => (
                <li key={c.id}>
                  <button type="button" onClick={() => setCatId(c.id)}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors ${c.id === catId ? 'bg-blue-500/10 border border-blue-500/50 text-white' : 'border border-transparent text-gray-300 hover:bg-gray-800'} ${c.ativo ? '' : 'opacity-50'}`}>
                    <span className="truncate">{c.nome}</span>
                    <span className="text-xs font-mono text-gray-500">{c.codigo}</span>
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={criarCategoria} className="pt-3 border-t border-gray-800 space-y-2">
              <div className="text-xs text-gray-400">Nova categoria</div>
              <div className="flex gap-2">
                <input value={novaCat.codigo} onChange={e => setNovaCat(p => ({ ...p, codigo: e.target.value.toUpperCase().slice(0, 6) }))} placeholder="Código" aria-label="Código da categoria" className={`w-20 font-mono ${campo}`} />
                <input value={novaCat.nome} onChange={e => setNovaCat(p => ({ ...p, nome: e.target.value }))} placeholder="Nome" aria-label="Nome da categoria" className={`min-w-0 flex-1 ${campo}`} />
              </div>
              <button type="submit" disabled={salvando} className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50"><FaPlus size={10} /> Adicionar categoria</button>
            </form>
          </div>

          {/* Produtos da categoria */}
          <div className="p-5 space-y-4">
            {!cat ? (
              <p className="text-sm text-gray-500">Crie uma categoria para começar.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="text-xs text-gray-400">Código
                    <div title="O código da categoria não muda depois de criado" className="mt-1 w-24 px-3 py-2 rounded-lg border border-gray-800 bg-gray-950/50 text-sm font-mono text-gray-400 select-all">{cat.codigo}</div>
                  </div>
                  <label className="text-xs text-gray-400 flex-1 min-w-[160px]">Nome da categoria
                    <input key={`n-${cat.id}-${cat.nome}`} defaultValue={cat.nome} onBlur={renomear('estoque_categorias', cat.id, 'nome', cat.nome)} className={`mt-1 block w-full ${campo}`} />
                  </label>
                  <label className="text-xs text-gray-400 flex items-center gap-2 pb-2">
                    Ativa <Toggle on={cat.ativo} label="Categoria ativa" onClick={() => run(supabase.from('estoque_categorias').update({ ativo: !cat.ativo }).eq('id', cat.id))} />
                  </label>
                </div>

                <div className="rounded-xl border border-gray-800 overflow-hidden">
                  <div className="grid grid-cols-[110px_1fr_60px] gap-3 px-4 py-2 bg-gray-900/80 border-b border-gray-800 text-xs font-medium text-gray-400">
                    <div>Código</div><div>Produto</div><div className="text-right">Ativo</div>
                  </div>
                  <div className="divide-y divide-gray-800/70">
                    {produtosDaCat.map(p => (
                      <div key={p.id} className={`grid grid-cols-[110px_1fr_60px] gap-3 items-center px-4 py-1.5 ${p.ativo ? '' : 'opacity-50'}`}>
                        <div title="Código automático, não pode ser editado" className="px-2 py-1 text-sm font-mono text-gray-400 select-all">{p.codigo}</div>
                        <input key={`pn-${p.id}-${p.nome}`} defaultValue={p.nome} aria-label="Nome do produto" onBlur={renomear('estoque_produtos', p.id, 'nome', p.nome)} className="bg-transparent border border-transparent hover:border-gray-800 focus:border-blue-500 rounded-md px-2 py-1 text-sm text-white outline-none" />
                        <div className="flex justify-end"><Toggle on={p.ativo} label={`${p.nome} ativo`} onClick={() => run(supabase.from('estoque_produtos').update({ ativo: !p.ativo }).eq('id', p.id))} /></div>
                      </div>
                    ))}
                    {produtosDaCat.length === 0 && <div className="px-4 py-6 text-sm text-gray-500 text-center">Nenhum produto nesta categoria.</div>}
                  </div>
                </div>

                <form onSubmit={criarProduto} className="flex flex-wrap items-end gap-2">
                  <div className="text-xs text-gray-400">Código
                    <div title="Gerado automaticamente" className="mt-1 w-28 px-3 py-2 rounded-lg border border-gray-800 bg-gray-950/50 text-sm font-mono text-gray-400">{codigoSugerido}</div>
                  </div>
                  <label className="text-xs text-gray-400 flex-1 min-w-[180px]">Novo produto em {cat.nome}
                    <input value={novoProd.nome} onChange={e => setNovoProd(p => ({ ...p, nome: e.target.value }))} placeholder="Ex.: SENSOR DE UMIDADE" className={`mt-1 block w-full uppercase ${campo}`} />
                  </label>
                  <button type="submit" disabled={salvando} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold"><FaPlus size={11} /> Adicionar</button>
                </form>
                <p className="text-xs text-gray-500">O código é gerado sozinho, na sequência da categoria ({codigoSugerido}), e não pode ser editado. Desativar um produto tira ele da lista do formulário, sem apagar os itens que já usam.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
