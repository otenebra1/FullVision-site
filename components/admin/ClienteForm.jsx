import React, { useMemo, useState } from 'react';
import { FaTimes, FaSearch, FaSpinner } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { Select, DateInput } from '../ui/FormControls';
import {
  CAMPOS_CLIENTE, soDigitos, formatCNPJ, formatCEP, formatTelefone, cnpjValido, buscarCNPJ, buscarCEP, somarMeses,
} from '../../lib/cliente';

const inputCls = 'w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 placeholder-gray-600';
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const DURACOES = [6, 12, 24, 36, 48, 60];

function Campo({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Bloco({ titulo, children }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-semibold uppercase tracking-wide text-blue-400 mb-2">{titulo}</legend>
      {children}
    </fieldset>
  );
}

function inicial(empresa) {
  const f = { nome: empresa?.nome || '', grupo_id: empresa?.grupo_id ? String(empresa.grupo_id) : '' };
  CAMPOS_CLIENTE.forEach(k => { f[k] = empresa?.[k] ?? ''; });
  f.cnpj = formatCNPJ(f.cnpj);
  f.cep = formatCEP(f.cep);
  ['contato_comercial_telefone', 'contato_financeiro_telefone'].forEach(k => { f[k] = formatTelefone(f[k]); });
  f.contrato_duracao_meses = f.contrato_duracao_meses === '' ? '' : String(f.contrato_duracao_meses);
  f.dia_vencimento_boleto = f.dia_vencimento_boleto === '' ? '' : String(f.dia_vencimento_boleto);
  return f;
}

// Criar/editar cliente com o cadastro completo. Preenche endereço pelo CNPJ (Receita) ou pelo CEP.
export default function ClienteForm({ empresa, empresas, onClose, onSaved, showToast }) {
  const [f, setF] = useState(() => inicial(empresa));
  const [salvando, setSalvando] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [avisoCnpj, setAvisoCnpj] = useState('');
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e?.target ? e.target.value : e }));

  // Quem pode ser "cliente principal" de um associado: empresas sem grupo (exceto a própria)
  const gruposPossiveis = useMemo(() => {
    const temFilhos = empresa && empresas.some(x => x.grupo_id === empresa.id);
    if (temFilhos) return [];
    return empresas.filter(x => !x.grupo_id && (!empresa || x.id !== empresa.id));
  }, [empresas, empresa]);

  const cnpjRepetido = useMemo(() => {
    const d = soDigitos(f.cnpj);
    if (d.length !== 14) return null;
    return empresas.find(x => soDigitos(x.cnpj) === d && (!empresa || x.id !== empresa.id)) || null;
  }, [f.cnpj, empresas, empresa]);

  // Fim calculado pelo início + duração (o usuário ainda pode ajustar a data à mão)
  const atualizarContrato = (mudanca) => setF(p => {
    const n = { ...p, ...mudanca };
    const fim = somarMeses(n.contrato_inicio, n.contrato_duracao_meses);
    if (fim) n.contrato_fim = fim;
    return n;
  });

  const consultarCNPJ = async () => {
    setAvisoCnpj('');
    if (!cnpjValido(f.cnpj)) { setAvisoCnpj('CNPJ inválido. Confira os números.'); return; }
    setBuscandoCnpj(true);
    try {
      const d = await buscarCNPJ(f.cnpj);
      setF(p => ({
        ...p,
        nome: p.nome || (d.nome_fantasia || d.razao_social).toUpperCase(),
        razao_social: d.razao_social || p.razao_social,
        cep: d.cep || p.cep,
        logradouro: d.logradouro || p.logradouro,
        numero: d.numero || p.numero,
        complemento: d.complemento || p.complemento,
        bairro: d.bairro || p.bairro,
        cidade: d.cidade || p.cidade,
        uf: d.uf || p.uf,
        contato_comercial_telefone: p.contato_comercial_telefone || d.telefone,
        contato_comercial_email: p.contato_comercial_email || d.email,
      }));
      setAvisoCnpj(d.situacao && d.situacao.toUpperCase() !== 'ATIVA' ? `Atenção: situação na Receita = ${d.situacao}.` : '');
      showToast('Dados do CNPJ preenchidos. Confira antes de salvar.');
    } catch {
      setAvisoCnpj('Não achei esse CNPJ agora. Preencha à mão ou tente de novo.');
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const consultarCEP = async (cep) => {
    if (soDigitos(cep).length !== 8) return;
    setBuscandoCep(true);
    try {
      const d = await buscarCEP(cep);
      setF(p => ({
        ...p,
        logradouro: d.logradouro || p.logradouro,
        bairro: d.bairro || p.bairro,
        cidade: d.cidade || p.cidade,
        uf: d.uf || p.uf,
      }));
    } catch {
      showToast('CEP não encontrado. Preencha o endereço à mão.', 'error');
    } finally {
      setBuscandoCep(false);
    }
  };

  const salvar = async (e) => {
    e.preventDefault();
    const nome = f.nome.trim().toUpperCase();
    if (!nome) { showToast('Informe o nome do cliente.', 'error'); return; }
    const cnpj = soDigitos(f.cnpj);
    if (cnpj && !cnpjValido(cnpj)) { showToast('CNPJ inválido.', 'error'); return; }
    const dia = f.dia_vencimento_boleto === '' ? null : Number(f.dia_vencimento_boleto);
    if (dia !== null && (dia < 1 || dia > 31)) { showToast('Dia de vencimento do boleto deve ser de 1 a 31.', 'error'); return; }

    const txt = (v) => (String(v ?? '').trim() || null);
    const grupo = empresas.find(x => String(x.id) === f.grupo_id);
    const payload = {
      nome,
      grupo_id: grupo ? grupo.id : null,
      cnpj: cnpj || null,
      razao_social: txt(f.razao_social),
      cep: soDigitos(f.cep) || null,
      logradouro: txt(f.logradouro),
      numero: txt(f.numero),
      complemento: txt(f.complemento),
      bairro: txt(f.bairro),
      cidade: txt(f.cidade),
      uf: txt(f.uf),
      responsavel_comercial: txt(f.responsavel_comercial),
      contato_comercial_telefone: txt(f.contato_comercial_telefone),
      contato_comercial_email: txt(f.contato_comercial_email)?.toLowerCase() || null,
      contato_financeiro_nome: txt(f.contato_financeiro_nome),
      contato_financeiro_telefone: txt(f.contato_financeiro_telefone),
      contato_financeiro_email: txt(f.contato_financeiro_email)?.toLowerCase() || null,
      contrato_inicio: f.contrato_inicio || null,
      contrato_duracao_meses: f.contrato_duracao_meses === '' ? null : Number(f.contrato_duracao_meses),
      contrato_fim: f.contrato_fim || null,
      dia_vencimento_boleto: dia,
    };

    setSalvando(true);
    const result = empresa
      ? await supabase.from('empresas').update(payload).eq('id', empresa.id).select().single()
      : await supabase.from('empresas').insert([payload]).select().single();
    setSalvando(false);
    if (result.error) {
      const faltaColuna = /column .* does not exist|Could not find the .* column/i.test(result.error.message);
      showToast(faltaColuna
        ? 'Falta rodar o SQL do cadastro completo de clientes no Supabase.'
        : 'Erro ao salvar cliente: ' + result.error.message, 'error');
      return;
    }
    onSaved(result.data, Boolean(empresa));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <form onSubmit={salvar} className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-gray-800 px-6 py-4">
          <h3 className="text-lg font-bold text-white">{empresa ? 'Editar cliente' : 'Novo cliente'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Fechar"><FaTimes /></button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-6">
          <Bloco titulo="Empresa">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Campo label="CNPJ">
                <div className="flex gap-2">
                  <input type="text" inputMode="numeric" value={f.cnpj} onChange={e => { setAvisoCnpj(''); set('cnpj')(formatCNPJ(e.target.value)); }} placeholder="00.000.000/0000-00" className={inputCls} />
                  <button type="button" onClick={consultarCNPJ} disabled={buscandoCnpj || soDigitos(f.cnpj).length !== 14} title="Buscar dados na Receita"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 text-sm text-gray-200 hover:border-blue-500 hover:text-white disabled:opacity-40">
                    {buscandoCnpj ? <FaSpinner className="animate-spin" size={12} /> : <FaSearch size={12} />} Buscar
                  </button>
                </div>
                {avisoCnpj && <p className="text-xs text-amber-400 mt-1">{avisoCnpj}</p>}
                {cnpjRepetido && <p className="text-xs text-amber-400 mt-1">Esse CNPJ já está em {cnpjRepetido.nome}.</p>}
              </Campo>
              <Campo label="Nome (como aparece no painel)">
                <input type="text" required autoFocus value={f.nome} onChange={set('nome')} className={`${inputCls} uppercase`} />
              </Campo>
              <Campo label="Razão social" className="sm:col-span-2">
                <input type="text" value={f.razao_social} onChange={set('razao_social')} className={inputCls} />
              </Campo>
              <Campo label="Associado a" className="sm:col-span-2">
                <Select value={f.grupo_id} onChange={set('grupo_id')} disabled={gruposPossiveis.length === 0 && !f.grupo_id} className={inputCls}>
                  <option value="">Nenhum (cliente principal)</option>
                  {gruposPossiveis.map(g => <option key={g.id} value={String(g.id)}>{g.nome}</option>)}
                </Select>
                <p className="text-xs text-gray-500 mt-1">Escolha um cliente aqui se este for uma unidade/associado dele (ex.: ADORO - FRANGO dentro de ADORO).</p>
              </Campo>
            </div>
          </Bloco>

          <Bloco titulo="Endereço">
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <Campo label="CEP" className="col-span-2 sm:col-span-2">
                <div className="relative">
                  <input type="text" inputMode="numeric" value={f.cep} placeholder="00000-000"
                    onChange={e => { const v = formatCEP(e.target.value); set('cep')(v); if (soDigitos(v).length === 8) consultarCEP(v); }}
                    className={inputCls} />
                  {buscandoCep && <FaSpinner className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={12} />}
                </div>
              </Campo>
              <Campo label="Rua / Avenida" className="col-span-2 sm:col-span-4">
                <input type="text" value={f.logradouro} onChange={set('logradouro')} className={inputCls} />
              </Campo>
              <Campo label="Número" className="col-span-1 sm:col-span-2">
                <input type="text" value={f.numero} onChange={set('numero')} className={inputCls} />
              </Campo>
              <Campo label="Complemento" className="col-span-1 sm:col-span-4">
                <input type="text" value={f.complemento} onChange={set('complemento')} className={inputCls} />
              </Campo>
              <Campo label="Bairro" className="col-span-2 sm:col-span-2">
                <input type="text" value={f.bairro} onChange={set('bairro')} className={inputCls} />
              </Campo>
              <Campo label="Cidade" className="col-span-1 sm:col-span-3">
                <input type="text" value={f.cidade} onChange={set('cidade')} className={inputCls} />
              </Campo>
              <Campo label="UF" className="col-span-1 sm:col-span-1">
                <Select value={f.uf} onChange={set('uf')} className={inputCls}>
                  <option value="">—</option>
                  {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                </Select>
              </Campo>
            </div>
          </Bloco>

          <Bloco titulo="Contatos">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Campo label="Responsável comercial">
                <input type="text" value={f.responsavel_comercial} onChange={set('responsavel_comercial')} placeholder="Nome" className={inputCls} />
              </Campo>
              <Campo label="Telefone comercial">
                <input type="tel" value={f.contato_comercial_telefone} onChange={e => set('contato_comercial_telefone')(formatTelefone(e.target.value))} placeholder="(00) 00000-0000" className={inputCls} />
              </Campo>
              <Campo label="E-mail comercial">
                <input type="email" value={f.contato_comercial_email} onChange={set('contato_comercial_email')} className={inputCls} />
              </Campo>
              <Campo label="Contato financeiro">
                <input type="text" value={f.contato_financeiro_nome} onChange={set('contato_financeiro_nome')} placeholder="Nome" className={inputCls} />
              </Campo>
              <Campo label="Telefone financeiro">
                <input type="tel" value={f.contato_financeiro_telefone} onChange={e => set('contato_financeiro_telefone')(formatTelefone(e.target.value))} placeholder="(00) 00000-0000" className={inputCls} />
              </Campo>
              <Campo label="E-mail financeiro">
                <input type="email" value={f.contato_financeiro_email} onChange={set('contato_financeiro_email')} className={inputCls} />
              </Campo>
            </div>
          </Bloco>

          <Bloco titulo="Contrato">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Campo label="Início do contrato">
                <DateInput value={f.contrato_inicio} onChange={e => atualizarContrato({ contrato_inicio: e.target.value })} className={inputCls} />
              </Campo>
              <Campo label="Duração (meses)">
                <input type="number" min="1" list="duracoes-contrato" value={f.contrato_duracao_meses}
                  onChange={e => atualizarContrato({ contrato_duracao_meses: e.target.value })} className={inputCls} />
                <datalist id="duracoes-contrato">{DURACOES.map(d => <option key={d} value={d} />)}</datalist>
              </Campo>
              <Campo label="Fim do contrato (deadline)">
                <DateInput value={f.contrato_fim} onChange={set('contrato_fim')} className={inputCls} />
              </Campo>
              <Campo label="Vencimento do boleto (dia)">
                <input type="number" min="1" max="31" value={f.dia_vencimento_boleto} onChange={set('dia_vencimento_boleto')} placeholder="Ex.: 10" className={inputCls} />
              </Campo>
            </div>
            <p className="text-xs text-gray-500">O fim é calculado pelo início e pela duração. Dá para ajustar a data à mão.</p>
          </Bloco>
        </div>

        <div className="flex gap-3 border-t border-gray-800 px-6 py-4">
          <button type="submit" disabled={salvando} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            {salvando ? 'Salvando...' : (empresa ? 'Salvar alterações' : 'Criar cliente')}
          </button>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
        </div>
      </form>
    </div>
  );
}
