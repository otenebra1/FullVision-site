import React from 'react';
import { FaTruck, FaTimes, FaEdit, FaTrashAlt, FaCamera } from 'react-icons/fa';
import { BRL, Dash, StatusDot, formatDateBR } from './ui';
import { SERVICOS_VEICULO } from '../../lib/veiculos';
import { osCodigo } from '../../lib/osConstants';

function Campo({ label, children }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-200 mt-0.5 break-words">{children}</div>
    </div>
  );
}

function LinhaDre({ label, valor, sinal, forte, detalhe }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${forte ? 'pt-2 mt-1 border-t border-gray-800' : ''}`}>
      <span className={forte ? 'text-white font-semibold' : 'text-gray-400'}>
        {label}{detalhe && <span className="text-gray-600 text-xs"> {detalhe}</span>}
      </span>
      <span className={`tabular-nums whitespace-nowrap ${forte ? (valor < 0 ? 'text-red-400 font-semibold' : 'text-emerald-400 font-semibold') : 'text-gray-200'}`}>
        {sinal}{BRL(Math.abs(valor))}
      </span>
    </div>
  );
}

// Janela com todas as informações do veículo; editar e excluir ficam aqui dentro
export default function VeiculoDetalhe({ veiculo: v, empresaNome, clienteNome, dre, ordens = [], onClose, onEdit, onDelete }) {
  if (!v) return null;
  // Histórico de OS da placa, da mais recente para a mais antiga
  const historico = [...ordens].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  const servicos = v.servicos || [];
  const associado = empresaNome && clienteNome && empresaNome !== clienteNome ? empresaNome : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center gap-3 border-b border-gray-800 px-6 py-4 sticky top-0 bg-gray-900 z-10">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 min-w-0">
            <FaTruck className="text-emerald-400 shrink-0" />
            <span className="tracking-wide truncate">{v.placa}</span>
            <StatusDot tone={v.status === 'Ativo' ? 'ok' : 'bad'}>{v.status || '—'}</StatusDot>
          </h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-white p-1"><FaTimes /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid sm:grid-cols-[200px_1fr] gap-5">
            <div className="aspect-[4/3] rounded-xl border border-gray-800 bg-gray-950 overflow-hidden flex items-center justify-center">
              {v.foto_placa_url ? (
                <a href={v.foto_placa_url} target="_blank" rel="noreferrer" className="block w-full h-full">
                  <img src={v.foto_placa_url} alt={`Foto da placa ${v.placa}`} className="w-full h-full object-cover" />
                </a>
              ) : (
                <span className="text-gray-600 text-xs flex flex-col items-center gap-2"><FaCamera size={20} /> Sem foto da placa</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 content-start">
              <Campo label="Cliente">{clienteNome || <Dash />}</Campo>
              <Campo label="Cliente associado">{associado || <Dash />}</Campo>
              <Campo label="Operação">{v.operacao || <Dash />}</Campo>
              <Campo label="Modelo">{v.modelo || <Dash />}</Campo>
              <Campo label="ID instalado">{v.id_instalado || <Dash />}</Campo>
              <Campo label="Mensalidade">{v.mensalidade != null ? BRL(v.mensalidade) : <Dash />}</Campo>
              <Campo label="Instalação">{v.data_inst ? formatDateBR(v.data_inst) : <Dash />}</Campo>
              <Campo label="Desinstalação">{v.data_desinst ? formatDateBR(v.data_desinst) : <Dash />}</Campo>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-2">Serviços</div>
            <div className="flex flex-wrap gap-2">
              {SERVICOS_VEICULO.map(s => {
                const on = servicos.includes(s.key);
                return (
                  <span key={s.key} className={`text-xs rounded-md px-2.5 py-1 border ${on ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-gray-800 text-gray-600 line-through'}`}>
                    {s.label}
                  </span>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-2">Observação</div>
            {v.observacao
              ? <p className="text-sm text-gray-200 whitespace-pre-wrap break-words rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2">{v.observacao}</p>
              : <p className="text-sm text-gray-600">Nenhuma observação. Use Editar para adicionar.</p>}
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-2">Histórico de OS {historico.length > 0 && <span className="tabular-nums">({historico.length})</span>}</div>
            {historico.length === 0 ? (
              <p className="text-sm text-gray-600">Nenhuma OS registrada nesta placa.</p>
            ) : (
              <div className="rounded-xl border border-gray-800 overflow-hidden">
                <div className="grid grid-cols-[100px_1fr_90px] gap-3 px-4 py-2 bg-gray-900/80 border-b border-gray-800 text-xs font-medium text-gray-400">
                  <div>Nº da OS</div><div>Serviço realizado</div><div className="text-right">Data</div>
                </div>
                <div className="divide-y divide-gray-800/70 max-h-60 overflow-y-auto">
                  {historico.map(o => (
                    <div key={o.id} className="grid grid-cols-[100px_1fr_90px] gap-3 items-start px-4 py-2 text-sm">
                      <div className="font-mono text-gray-300 tabular-nums">{osCodigo(o.id)}</div>
                      <div className="text-gray-200 break-words">{o.servico_realizado || <Dash />}{o.status === 'aberta' && <span className="ml-2 text-xs text-amber-400">em aberto</span>}</div>
                      <div className="text-right text-gray-400 tabular-nums">{o.data ? formatDateBR(String(o.data).slice(0, 10)) : <Dash />}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {dre && (
            <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 text-sm space-y-1.5">
              <div className="text-xs text-gray-500 mb-1">DRE da placa</div>
              <LinhaDre label="Valor faturado" valor={dre.faturado} sinal="" detalhe={`(${dre.meses} ${dre.meses === 1 ? 'mês' : 'meses'} de mensalidade${dre.faturadoOs ? ` + ${BRL(dre.faturadoOs)} em OS` : ''})`} />
              <LinhaDre label="Serviços realizados" valor={dre.servicos} sinal="− " detalhe={dre.qtdOs ? `(${dre.qtdOs} OS)` : ''} />
              <LinhaDre label="Equipamento e acessórios" valor={dre.equipamento} sinal="− " detalhe={`(rastreador ${dre.rastreadorSerial ? BRL(dre.custoRastreador) : 'não vinculado'} + acessórios ${BRL(dre.acessorios)})`} />
              <LinhaDre label="Resultado" valor={dre.dre} sinal={dre.dre < 0 ? '− ' : ''} forte />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-800 px-6 py-4">
          {onDelete && (
            <button type="button" onClick={() => onDelete(v.id)} className="inline-flex items-center gap-2 text-sm text-red-400 hover:text-red-300 border border-gray-800 hover:border-red-500/40 rounded-lg px-3.5 py-2 transition-colors">
              <FaTrashAlt size={12} /> Excluir
            </button>
          )}
          <button type="button" onClick={() => onEdit(v)} className="inline-flex items-center gap-2 text-sm text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 font-semibold transition-colors">
            <FaEdit size={12} /> Editar
          </button>
        </div>
      </div>
    </div>
  );
}
