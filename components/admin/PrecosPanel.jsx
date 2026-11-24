import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaSpinner, FaTimes, FaPlus } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { carregarTabelas } from '../../lib/precos';
import {
  BRL, SectionCard, SegmentedControl, inputBase, tableWrap, theadClass, tbodyClass, rowClass, Th, Dash,
} from './ui';
import { Select } from '../ui/FormControls';

const fmt = (n) => (n == null ? '' : Number(n).toFixed(2).replace('.', ','));
const parseValor = (txt) => {
  const t = String(txt).trim();
  if (t === '') return null;
  const n = parseFloat(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : undefined; // undefined = inválido
};

// Campo de preço: salva ao sair do campo; vazio = remove o preço
function PriceInput({ value, placeholder, onCommit, ariaLabel, width = 'w-32' }) {
  const [text, setText] = useState(fmt(value));
  const ultimo = useRef(value);
  // só volta a sincronizar quando o valor salvo muda de fato (não apaga o que a pessoa está digitando)
  useEffect(() => {
    if (ultimo.current !== value) { ultimo.current = value; setText(fmt(value)); }
  }, [value]);
  const commit = () => {
    const parsed = parseValor(text);
    if (parsed === undefined) { setText(fmt(value)); return; }
    if (parsed === (value ?? null)) { setText(fmt(value)); return; }
    onCommit(parsed);
  };
  return (
    <div className={`relative ${width}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">R$</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className={`w-full pl-9 pr-3 py-1.5 text-right tabular-nums ${inputBase}`}
      />
    </div>
  );
}

function TextInput({ value, onCommit, ariaLabel, placeholder, className = '' }) {
  const [text, setText] = useState(value ?? '');
  const ultimo = useRef(value);
  useEffect(() => {
    if (ultimo.current !== value) { ultimo.current = value; setText(value ?? ''); }
  }, [value]);
  return (
    <input
      type="text"
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={e => setText(e.target.value)}
      onBlur={() => { if (text.trim() !== (value ?? '')) onCommit(text.trim()); else setText(value ?? ''); }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className={`px-3 py-1.5 ${inputBase} ${className}`}
    />
  );
}

// Serviço por linha, com o valor ao lado (e, se houver, a referência de onde o valor vem quando o campo fica vazio)
function PriceGrid({ servicos, valores, referencia, referenciaLabel, onCommit }) {
  return (
    <div className={tableWrap}>
      <table className="w-full min-w-[480px] text-sm">
        <thead className={theadClass}>
          <tr>
            <Th>Serviço</Th>
            <Th align="right">Valor</Th>
            {referencia && <Th align="right">{referenciaLabel}</Th>}
          </tr>
        </thead>
        <tbody className={tbodyClass}>
          {servicos.map(s => (
            <tr key={s.id} className={rowClass}>
              <td className="px-4 py-2 text-gray-200">{s.nome}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end">
                  <PriceInput
                    value={valores.get(s.id) ?? null}
                    placeholder={referencia && referencia.has(s.id) ? fmt(referencia.get(s.id)) : '—'}
                    ariaLabel={`Valor de ${s.nome}`}
                    onCommit={(v) => onCommit(s.id, v)}
                  />
                </div>
              </td>
              {referencia && (
                <td className="px-4 py-2 text-right tabular-nums text-gray-500">
                  {referencia.has(s.id) ? BRL(referencia.get(s.id)) : <Dash />}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const mapa = (rows, filtro, chave = 'servico_id') => new Map((rows || []).filter(filtro).map(r => [r[chave], Number(r.valor)]));

export default function PrecosPanel({ empresas = [], showToast = () => {}, modo = 'tecnico' }) {
  const titulo = modo === 'cliente' ? 'Tabela de preço cliente' : 'Tabela de preço técnico';
  const [tabelas, setTabelas] = useState(null);
  const [erro, setErro] = useState(null);
  const [secao, setSecao] = useState(modo === 'cliente' ? 'cliente' : 'faixas');
  useEffect(() => { setSecao(modo === 'cliente' ? 'cliente' : 'faixas'); }, [modo]);
  const [faixaId, setFaixaId] = useState(null);
  const [tecnicoPrecosId, setTecnicoPrecosId] = useState(null);
  const [clienteEscopo, setClienteEscopo] = useState('padrao');
  const [novoTecnico, setNovoTecnico] = useState({ nome: '', email: '' });
  const [novoServico, setNovoServico] = useState('');

  const reload = async () => {
    try { setTabelas(await carregarTabelas(supabase)); setErro(null); } catch (e) { setErro(e.message); }
  };
  useEffect(() => { reload(); }, []);

  useEffect(() => {
    if (tabelas && !faixaId && tabelas.faixas.length) setFaixaId(tabelas.faixas[0].id);
  }, [tabelas, faixaId]);

  const run = async (promise, okMsg = 'Salvo') => {
    const { error } = await promise;
    if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); return false; }
    await reload();
    if (okMsg) showToast(okMsg);
    return true;
  };

  const servicos = useMemo(() => (tabelas?.servicos || []).filter(s => s.tipo === 'servico' && s.ativo), [tabelas]);
  const todosServicos = useMemo(() => (tabelas?.servicos || []).filter(s => s.tipo === 'servico'), [tabelas]);
  const empresasOrdenadas = useMemo(() => [...empresas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [empresas]);

  if (erro) {
    return (
      <SectionCard title={titulo}>
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          Não consegui carregar as tabelas de preço: {erro}. Se as tabelas ainda não existem, rode o arquivo <span className="font-mono">migration_os_v2.sql</span> no SQL Editor do Supabase.
        </div>
      </SectionCard>
    );
  }
  if (!tabelas) {
    return <div className="flex items-center justify-center py-16 text-gray-500"><FaSpinner className="animate-spin mr-3" /> Carregando preços...</div>;
  }

  const faixa = tabelas.faixas.find(f => f.id === faixaId) || null;
  const faixaPrecos = faixa ? mapa(tabelas.faixaPrecos, p => p.faixa_id === faixa.id) : new Map();

  const salvarPrecoFaixa = (servicoId, valor) => run(
    valor == null
      ? supabase.from('faixa_tecnico_precos').delete().eq('faixa_id', faixa.id).eq('servico_id', servicoId)
      : supabase.from('faixa_tecnico_precos').upsert([{ faixa_id: faixa.id, servico_id: servicoId, valor }], { onConflict: 'faixa_id,servico_id' }),
  );

  const duplicarFaixa = async () => {
    const nome = `Cópia de ${faixa.nome}`;
    const { data, error } = await supabase.from('faixas_tecnico')
      .insert([{ nome, valor_km: faixa.valor_km, ordem: (tabelas.faixas.length + 1) * 10 }]).select().single();
    if (error) { showToast('Erro ao duplicar: ' + error.message, 'error'); return; }
    const copias = tabelas.faixaPrecos.filter(p => p.faixa_id === faixa.id).map(p => ({ faixa_id: data.id, servico_id: p.servico_id, valor: p.valor }));
    if (copias.length) await supabase.from('faixa_tecnico_precos').insert(copias);
    await reload();
    setFaixaId(data.id);
    showToast('Faixa duplicada. Renomeie e ajuste os valores.');
  };

  // ---- Técnicos ----
  const tecnicoSel = tabelas.tecnicos.find(t => t.id === tecnicoPrecosId) || null;
  const faixaDoTecnico = tecnicoSel ? tabelas.faixas.find(f => f.id === tecnicoSel.faixa_id) : null;
  const precosIndividuais = tecnicoSel ? mapa(tabelas.tecnicoPrecos, p => p.tecnico_id === tecnicoSel.id) : new Map();
  const precosDaFaixaDele = faixaDoTecnico ? mapa(tabelas.faixaPrecos, p => p.faixa_id === faixaDoTecnico.id) : new Map();

  const salvarPrecoTecnico = (servicoId, valor) => run(
    valor == null
      ? supabase.from('tecnico_precos').delete().eq('tecnico_id', tecnicoSel.id).eq('servico_id', servicoId)
      : supabase.from('tecnico_precos').upsert([{ tecnico_id: tecnicoSel.id, servico_id: servicoId, valor }], { onConflict: 'tecnico_id,servico_id' }),
  );

  const atualizaTecnico = (id, campos) => run(supabase.from('tecnicos').update(campos).eq('id', id));

  const adicionarTecnico = async (e) => {
    e.preventDefault();
    if (!novoTecnico.nome.trim()) return;
    const ok = await run(supabase.from('tecnicos').insert([{ nome: novoTecnico.nome.trim(), email: novoTecnico.email.trim() || null }]), 'Técnico adicionado');
    if (ok) setNovoTecnico({ nome: '', email: '' });
  };

  // ---- Cliente ----
  const precosPadrao = mapa(tabelas.clientePadrao, () => true);
  const precosEmpresa = clienteEscopo === 'padrao' ? new Map() : mapa(tabelas.clienteEmpresa, p => String(p.empresa_id) === String(clienteEscopo));
  const salvarPrecoCliente = (servicoId, valor) => {
    if (clienteEscopo === 'padrao') {
      return run(valor == null
        ? supabase.from('precos_cliente_padrao').delete().eq('servico_id', servicoId)
        : supabase.from('precos_cliente_padrao').upsert([{ servico_id: servicoId, valor }], { onConflict: 'servico_id' }));
    }
    return run(valor == null
      ? supabase.from('precos_cliente_empresa').delete().eq('empresa_id', clienteEscopo).eq('servico_id', servicoId)
      : supabase.from('precos_cliente_empresa').upsert([{ empresa_id: clienteEscopo, servico_id: servicoId, valor }], { onConflict: 'empresa_id,servico_id' }));
  };

  // ---- Regras e serviços ----
  const cfg = tabelas.config || { km_limite: 30, atendimentos_isencao: 3, km_cliente: 0 };
  const salvarConfig = (campos) => run(supabase.from('financeiro_config').update(campos).eq('id', 1));

  const adicionarServico = async (e) => {
    e.preventDefault();
    const nome = novoServico.trim().toUpperCase();
    if (!nome) return;
    const ok = await run(supabase.from('servicos_catalogo').insert([{ nome, tipo: 'servico', ordem: (tabelas.servicos.length + 1) * 10 }]), 'Serviço adicionado');
    if (ok) setNovoServico('');
  };

  return (
    <SectionCard title={titulo}>
      <SegmentedControl
        value={secao}
        onChange={setSecao}
        options={modo === 'cliente' ? [
          { key: 'cliente', label: 'Preços do cliente' },
          { key: 'regras', label: 'Regras e serviços' },
        ] : [
          { key: 'faixas', label: 'Faixas dos técnicos' },
          { key: 'tecnicos', label: 'Técnicos' },
          { key: 'regras', label: 'Regras e serviços' },
        ]}
      />

      {/* ---------- Faixas ---------- */}
      {secao === 'faixas' && (
        <div className="space-y-5">
          <p className="text-sm text-gray-400">Cada técnico fica ligado a uma faixa. Um valor em branco significa que o serviço não tem preço nessa faixa.</p>
          <div className="flex flex-wrap items-center gap-2" role="tablist">
            {tabelas.faixas.map(f => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={f.id === faixaId}
                onClick={() => setFaixaId(f.id)}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${f.id === faixaId ? 'border-blue-500/60 bg-blue-500/10 text-white' : 'border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'}`}
              >
                {f.nome}
              </button>
            ))}
          </div>
          {faixa && (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <label className="text-xs text-gray-400">Nome da faixa
                  <TextInput value={faixa.nome} ariaLabel="Nome da faixa" className="mt-1 block w-72 max-w-full" onCommit={(nome) => nome && run(supabase.from('faixas_tecnico').update({ nome }).eq('id', faixa.id))} />
                </label>
                <label className="text-xs text-gray-400">Valor do km (R$)
                  <div className="mt-1"><PriceInput value={faixa.valor_km} ariaLabel="Valor do km da faixa" onCommit={(v) => run(supabase.from('faixas_tecnico').update({ valor_km: v ?? 0 }).eq('id', faixa.id))} /></div>
                </label>
                <button type="button" onClick={duplicarFaixa} className="text-sm text-blue-400 hover:text-blue-300 pb-2">Duplicar faixa</button>
              </div>
              <PriceGrid servicos={servicos} valores={faixaPrecos} onCommit={salvarPrecoFaixa} />
              <p className="text-xs text-gray-500">
                Técnicos nesta faixa: {tabelas.tecnicos.filter(t => t.faixa_id === faixa.id).map(t => t.nome).join(', ') || 'nenhum ainda'}
              </p>
            </>
          )}
        </div>
      )}

      {/* ---------- Técnicos ---------- */}
      {secao === 'tecnicos' && (
        <div className="space-y-5">
          <p className="text-sm text-gray-400">Escolha a faixa de cada técnico. Para um acordo diferente, abra os preços individuais e preencha só os serviços que mudam.</p>
          <div className={tableWrap}>
            <table className="w-full min-w-[820px] text-sm">
              <thead className={theadClass}>
                <tr><Th>Técnico</Th><Th>E-mail</Th><Th>Faixa</Th><Th align="right">Km próprio</Th><Th>Ativo</Th><Th align="right">Preços</Th></tr>
              </thead>
              <tbody className={tbodyClass}>
                {tabelas.tecnicos.map(t => {
                  const qtdIndividuais = tabelas.tecnicoPrecos.filter(p => p.tecnico_id === t.id).length;
                  return (
                    <tr key={t.id} className={`${rowClass} ${t.ativo ? '' : 'opacity-50'}`}>
                      <td className="px-4 py-2 text-white font-medium">{t.nome}</td>
                      <td className="px-4 py-2 text-gray-400">{t.email || <Dash />}</td>
                      <td className="px-4 py-2">
                        <Select
                          aria-label={`Faixa de ${t.nome}`}
                          value={t.faixa_id || ''}
                          onChange={e => atualizaTecnico(t.id, { faixa_id: e.target.value || null })}
                          className={`px-3 py-1.5 ${inputBase} ${t.faixa_id ? '' : 'border-amber-500/50'}`}
                        >
                          <option value="">Sem faixa</option>
                          {tabelas.faixas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                        </Select>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end">
                          <PriceInput value={t.valor_km} placeholder={fmt(tabelas.faixas.find(f => f.id === t.faixa_id)?.valor_km)} ariaLabel={`Km próprio de ${t.nome}`} width="w-28"
                            onCommit={(v) => atualizaTecnico(t.id, { valor_km: v })} />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <input type="checkbox" checked={t.ativo} aria-label={`${t.nome} ativo`} onChange={e => atualizaTecnico(t.id, { ativo: e.target.checked })} className="accent-blue-500" />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button type="button" onClick={() => setTecnicoPrecosId(t.id)} className="text-blue-400 hover:text-blue-300">
                          {qtdIndividuais > 0 ? `Individuais (${qtdIndividuais})` : 'Definir'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {tabelas.tecnicos.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">Nenhum técnico cadastrado.</td></tr>}
              </tbody>
            </table>
          </div>

          <form onSubmit={adicionarTecnico} className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-gray-400">Novo técnico
              <input value={novoTecnico.nome} onChange={e => setNovoTecnico(p => ({ ...p, nome: e.target.value }))} placeholder="Nome" className={`mt-1 block w-64 px-3 py-2 ${inputBase}`} />
            </label>
            <label className="text-xs text-gray-400">E-mail (opcional)
              <input value={novoTecnico.email} onChange={e => setNovoTecnico(p => ({ ...p, email: e.target.value }))} placeholder="nome@email.com" className={`mt-1 block w-64 px-3 py-2 ${inputBase}`} />
            </label>
            <button type="submit" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold"><FaPlus size={11} /> Adicionar</button>
          </form>

          {tecnicoSel && (
            <div className="fixed inset-0 z-[70] bg-black/70 overflow-y-auto p-4" onMouseDown={e => { if (e.target === e.currentTarget) setTecnicoPrecosId(null); }}>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl mx-auto my-8 p-6 space-y-4" role="dialog" aria-modal="true" aria-label={`Preços individuais de ${tecnicoSel.nome}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Preços individuais de {tecnicoSel.nome}</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {faixaDoTecnico ? `Campo vazio = vale a ${faixaDoTecnico.nome}.` : 'Este técnico ainda não tem faixa: escolha uma na tabela ou preencha todos os serviços aqui.'}
                    </p>
                  </div>
                  <button type="button" onClick={() => setTecnicoPrecosId(null)} aria-label="Fechar" className="text-gray-500 hover:text-white p-2"><FaTimes /></button>
                </div>
                <PriceGrid servicos={servicos} valores={precosIndividuais} referencia={precosDaFaixaDele} referenciaLabel="Na faixa" onCommit={salvarPrecoTecnico} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------- Preços do cliente ---------- */}
      {secao === 'cliente' && (
        <div className="space-y-5">
          <p className="text-sm text-gray-400">A tabela padrão vale para todos os clientes. Para um cliente com preço diferente, escolha-o abaixo e preencha só o que muda.</p>
          <label className="block text-xs text-gray-400">Tabela
            <Select value={clienteEscopo} onChange={e => setClienteEscopo(e.target.value)} aria-label="Tabela de preços do cliente" className={`mt-1 block w-80 max-w-full px-3 py-2 ${inputBase}`}>
              <option value="padrao">Padrão (todos os clientes)</option>
              {empresasOrdenadas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Select>
          </label>
          <PriceGrid
            servicos={servicos}
            valores={clienteEscopo === 'padrao' ? precosPadrao : precosEmpresa}
            referencia={clienteEscopo === 'padrao' ? null : precosPadrao}
            referenciaLabel="Padrão"
            onCommit={salvarPrecoCliente}
          />
          {clienteEscopo === 'padrao' && precosPadrao.size === 0 && (
            <p className="text-sm text-amber-400">A tabela de preços do cliente ainda está vazia. Enquanto isso, o valor cobrado de cada OS fica R$ 0,00 e você pode digitá-lo na própria OS.</p>
          )}
        </div>
      )}

      {/* ---------- Regras e serviços ---------- */}
      {secao === 'regras' && (
        <div className="space-y-8">
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-white">Regras de deslocamento</h3>
            <p className="text-sm text-gray-400">
              Com {cfg.atendimentos_isencao} ou mais atendimentos no mesmo local não há deslocamento. Nos demais casos, acima de {Number(cfg.km_limite)} km paga o total de km.
            </p>
            <div className="flex flex-wrap gap-5">
              <label className="text-xs text-gray-400">Paga acima de (km)
                <div className="mt-1"><PriceInput value={cfg.km_limite} ariaLabel="Km limite" width="w-28" onCommit={(v) => v != null && salvarConfig({ km_limite: v })} /></div>
              </label>
              <label className="text-xs text-gray-400">Atendimentos para isenção
                <input
                  type="number" min="1" defaultValue={cfg.atendimentos_isencao} aria-label="Atendimentos para isenção" key={cfg.atendimentos_isencao}
                  onBlur={e => { const n = parseInt(e.target.value, 10); if (n >= 1 && n !== cfg.atendimentos_isencao) salvarConfig({ atendimentos_isencao: n }); }}
                  className={`mt-1 block w-28 px-3 py-1.5 ${inputBase}`}
                />
              </label>
              <label className="text-xs text-gray-400">Km cobrado do cliente (R$)
                <div className="mt-1"><PriceInput value={cfg.km_cliente} ariaLabel="Km cobrado do cliente" width="w-28" onCommit={(v) => salvarConfig({ km_cliente: v ?? 0 })} /></div>
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-white">Serviços</h3>
            <div className={tableWrap}>
              <table className="w-full min-w-[420px] text-sm">
                <thead className={theadClass}><tr><Th>Nome</Th><Th>Aparece na OS</Th></tr></thead>
                <tbody className={tbodyClass}>
                  {todosServicos.map(s => (
                    <tr key={s.id} className={`${rowClass} ${s.ativo ? '' : 'opacity-50'}`}>
                      <td className="px-4 py-2"><TextInput value={s.nome} ariaLabel={`Nome do serviço ${s.nome}`} className="w-full max-w-md" onCommit={(nome) => nome && run(supabase.from('servicos_catalogo').update({ nome: nome.toUpperCase() }).eq('id', s.id))} /></td>
                      <td className="px-4 py-2"><input type="checkbox" checked={s.ativo} aria-label={`${s.nome} aparece na OS`} onChange={e => run(supabase.from('servicos_catalogo').update({ ativo: e.target.checked }).eq('id', s.id))} className="accent-blue-500" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form onSubmit={adicionarServico} className="flex items-center gap-3">
              <input value={novoServico} onChange={e => setNovoServico(e.target.value)} placeholder="Novo serviço" aria-label="Novo serviço" className={`w-72 max-w-full px-3 py-2 ${inputBase}`} />
              <button type="submit" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold"><FaPlus size={11} /> Adicionar</button>
            </form>
            <p className="text-xs text-gray-500">Mudar o nome de um serviço não altera as OS antigas, que guardam o nome da época.</p>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
