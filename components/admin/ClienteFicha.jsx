import React from 'react';
import { FaTimes, FaPen, FaPhone, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa';
import { BRL, formatDateBR } from './ui';
import { formatCNPJ, enderecoTexto } from '../../lib/cliente';

function Item({ label, children, className = '' }) {
  const vazio = children === null || children === undefined || children === '' || children === false;
  return (
    <div className={className}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm mt-0.5 break-words ${vazio ? 'text-gray-600' : 'text-gray-200'}`}>{vazio ? 'Não informado' : children}</div>
    </div>
  );
}

function Bloco({ titulo, children }) {
  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-400">{titulo}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">{children}</div>
    </section>
  );
}

const Tel = ({ v }) => (v ? <a href={`tel:${v.replace(/\D/g, '')}`} className="inline-flex items-center gap-1.5 hover:text-blue-400"><FaPhone size={10} />{v}</a> : null);
const Mail = ({ v }) => (v ? <a href={`mailto:${v}`} className="inline-flex items-center gap-1.5 hover:text-blue-400"><FaEnvelope size={10} />{v}</a> : null);

function statusContrato(fim) {
  if (!fim) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((new Date(fim + 'T00:00:00') - hoje) / 86400000);
  if (dias < 0) return { txt: `Vencido há ${-dias} dia(s)`, cls: 'bg-red-500/10 text-red-400 border-red-500/30' };
  if (dias <= 30) return { txt: `Vence em ${dias} dia(s)`, cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
  return { txt: 'Em vigor', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
}

// Ficha do cliente: todos os dados do cadastro, com atalho para editar
export default function ClienteFicha({ empresa, grupoNome, associados = [], resumo, onEditar, onClose }) {
  const e = empresa;
  const endereco = enderecoTexto(e);
  const status = statusContrato(e.contrato_fim);
  const mapa = endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco.replace(/ · /g, ', '))}` : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col" onClick={ev => ev.stopPropagation()}>
        <div className="flex justify-between items-start gap-4 border-b border-gray-800 px-6 py-4">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-white truncate">{e.nome}</h3>
            <p className="text-sm text-gray-400 truncate">
              {[e.razao_social, e.cnpj ? `CNPJ ${formatCNPJ(e.cnpj)}` : null].filter(Boolean).join(' · ') || 'Sem CNPJ cadastrado'}
            </p>
            {grupoNome && <p className="text-xs text-gray-500 mt-1">Associado de {grupoNome}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={onEditar} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-sm font-semibold text-white">
              <FaPen size={11} /> Editar
            </button>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white p-1" aria-label="Fechar"><FaTimes /></button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {resumo && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Placas', resumo.total],
                ['Ativas', resumo.ativos],
                ['Mensalidade ativa', BRL(resumo.mensalidade)],
                ['Faturamento', BRL(resumo.faturamento)],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-gray-800 bg-gray-950/50 px-3 py-2">
                  <div className="text-xs text-gray-500">{l}</div>
                  <div className="text-base font-semibold text-white tabular-nums">{v}</div>
                </div>
              ))}
            </div>
          )}

          <Bloco titulo="Endereço">
            <Item label="Endereço" className="sm:col-span-2">
              {endereco && (
                <span className="inline-flex items-start gap-1.5">
                  <FaMapMarkerAlt size={11} className="mt-1 shrink-0 text-gray-500" />
                  <span>{endereco}{mapa && <> · <a href={mapa} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">ver no mapa</a></>}</span>
                </span>
              )}
            </Item>
          </Bloco>

          <Bloco titulo="Contatos">
            <Item label="Responsável comercial">{e.responsavel_comercial}</Item>
            <Item label="Contato comercial">
              {(e.contato_comercial_telefone || e.contato_comercial_email) && (
                <span className="flex flex-col gap-1"><Tel v={e.contato_comercial_telefone} /><Mail v={e.contato_comercial_email} /></span>
              )}
            </Item>
            <Item label="Contato financeiro">{e.contato_financeiro_nome}</Item>
            <Item label="Telefone / e-mail financeiro">
              {(e.contato_financeiro_telefone || e.contato_financeiro_email) && (
                <span className="flex flex-col gap-1"><Tel v={e.contato_financeiro_telefone} /><Mail v={e.contato_financeiro_email} /></span>
              )}
            </Item>
          </Bloco>

          <Bloco titulo="Contrato">
            <Item label="Início do contrato">{formatDateBR(e.contrato_inicio)}</Item>
            <Item label="Duração">{e.contrato_duracao_meses ? `${e.contrato_duracao_meses} ${e.contrato_duracao_meses === 1 ? 'mês' : 'meses'}` : null}</Item>
            <Item label="Fim do contrato (deadline)">
              {e.contrato_fim && (
                <span className="inline-flex items-center gap-2">
                  {formatDateBR(e.contrato_fim)}
                  {status && <span className={`text-xs border rounded-md px-1.5 py-0.5 ${status.cls}`}>{status.txt}</span>}
                </span>
              )}
            </Item>
            <Item label="Vencimento do boleto">{e.dia_vencimento_boleto ? `Todo dia ${e.dia_vencimento_boleto}` : null}</Item>
          </Bloco>

          {associados.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-400">Associados ({associados.length})</h4>
              <div className="flex flex-wrap gap-2">
                {associados.map(a => <span key={a.id} className="text-xs bg-gray-800 text-gray-300 rounded-md px-2 py-1">{a.nome}</span>)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
