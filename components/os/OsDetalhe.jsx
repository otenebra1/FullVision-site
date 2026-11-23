import React, { useEffect, useState } from 'react';
import { FaTimes, FaCamera, FaSpinner, FaTrashAlt } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { BRL, formatDateBR, StatusDot } from '../admin/ui';
import { FOTO_TIPOS, FOTO_GRUPOS, CHECKLIST_ITENS, CHECKLIST_RESPOSTAS, REGIOES, osCodigo, splitServicos } from '../../lib/osConstants';

function Campo({ label, children, className = '' }) {
  return (
    <div className={className}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm text-white">{children}</div>
    </div>
  );
}

// Detalhe de uma OS já feita: dados, equipamento, fotos por etapa (prova do estado do veículo) e financeiro
export default function OsDetalhe({ os, rastreadores = [], onClose, onDelete }) {
  const [fotos, setFotos] = useState([]);
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('ordens_servico_fotos').select('*').eq('ordem_servico_id', os.id);
      if (cancelled) return;
      setFotos((data || []).map(f => ({
        ...f,
        url: supabase.storage.from('os-fotos').getPublicUrl(f.storage_path).data.publicUrl,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [os.id]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data } = await supabase.from('ordens_servico_itens').select('*').eq('ordem_servico_id', os.id);
      if (!cancelado) setItens(data || []);
    })();
    return () => { cancelado = true; };
  }, [os.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (zoom) setZoom(null); else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom, onClose]);

  const placa = os.veiculos?.placa || os.placa_texto || '—';
  const servicos = splitServicos(os.servico_realizado);
  const serialDe = (id) => rastreadores.find(r => r.id === id)?.serial;
  const serialInstalado = serialDe(os.rastreador_instalado_id);
  const serialRetirado = serialDe(os.rastreador_retirado_id);
  const faturado = Number(os.faturamento_cliente) || 0;
  const custo = Number(os.custo_tecnico) || 0;
  const lucro = faturado - custo;

  const porTipo = (key) => fotos.find(f => f.tipo === key);
  const tiposConhecidos = FOTO_TIPOS.map(t => t.key);
  const outras = fotos.filter(f => !tiposConhecidos.includes(f.tipo));
  const enviadas = FOTO_TIPOS.filter(t => porTipo(t.key)).length;
  const legado = Boolean(os.fotos_legado_nota);
  const checklist = os.checklist_estado || null;
  const regioesMexidas = os.regioes_mexidas || null;
  const regioesIntactas = regioesMexidas ? REGIOES.filter(r => !regioesMexidas.includes(r)) : [];
  const respostaLabel = (k) => CHECKLIST_RESPOSTAS.find(r => r.key === k)?.label || '—';
  const temEvidencias = Boolean(checklist || regioesMexidas || os.problemas_relatados);
  const temAssinatura = Boolean(os.assinatura_url || os.assinante_nome || os.geo_lat != null);

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 overflow-y-auto p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl mx-auto my-8" role="dialog" aria-modal="true" aria-label={`Detalhes da ${osCodigo(os.id)}`}>
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-gray-800">
          <div>
            <div className="text-xs text-gray-500 tabular-nums">{osCodigo(os.id)}</div>
            <h3 className="text-xl font-semibold text-white mt-0.5">{placa}</h3>
            <div className="text-sm text-gray-400 mt-1">{os.empresas?.nome || 'Sem empresa'} · {formatDateBR(os.data)}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-gray-500 hover:text-white p-2 rounded-md hover:bg-gray-800">
            <FaTimes />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-7">
          {/* Dados do serviço */}
          <section className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <Campo label="Técnico">{os.tecnico_nome || '—'}</Campo>
              <Campo label="Local da instalação">{os.local_instalacao || '—'}</Campo>
              {os.km_percorrido != null && <Campo label="KM percorrido"><span className="tabular-nums">{os.km_percorrido} km</span></Campo>}
              {serialInstalado && <Campo label="Rastreador instalado"><span className="tabular-nums">{serialInstalado}</span></Campo>}
              {serialRetirado && <Campo label="Rastreador retirado"><span className="tabular-nums">{serialRetirado}</span></Campo>}
            </div>
            <div>
              <div className="text-xs text-gray-500">Serviços realizados</div>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {servicos.length === 0 && <span className="text-sm text-gray-500">—</span>}
                {servicos.map(s => (
                  <span key={s} className="text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded-full px-3 py-1">{s}</span>
                ))}
              </div>
            </div>
            {os.observacoes && (
              <div>
                <div className="text-xs text-gray-500">Observações</div>
                <p className="mt-1 text-sm text-gray-200 whitespace-pre-wrap">{os.observacoes}</p>
              </div>
            )}
          </section>

          {/* Fotos: prova do estado do veículo antes e depois */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-base font-semibold text-white flex items-center gap-2"><FaCamera className="text-gray-500" size={14} /> Fotos do serviço</h4>
              {!loading && !legado && (
                <StatusDot tone={enviadas === FOTO_TIPOS.length ? 'ok' : 'warn'}>
                  <span className="text-sm text-gray-300 tabular-nums">{enviadas}/{FOTO_TIPOS.length} enviadas</span>
                </StatusDot>
              )}
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm py-6"><FaSpinner className="animate-spin" /> Carregando fotos...</div>
            ) : legado && fotos.length === 0 ? (
              <div className="text-sm text-gray-400 bg-gray-800/50 border border-gray-800 rounded-xl p-4">
                OS importada da planilha original. Arquivos referenciados: <span className="text-gray-200">{os.fotos_legado_nota}</span>
              </div>
            ) : (
              <>
                {FOTO_GRUPOS.map(grupo => (
                  <div key={grupo.titulo} className="space-y-2">
                    <div className="text-sm text-gray-400">{grupo.titulo}</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {grupo.keys.map(key => {
                        const label = FOTO_TIPOS.find(t => t.key === key)?.label;
                        const foto = porTipo(key);
                        return foto ? (
                          <button key={key} type="button" onClick={() => setZoom({ url: foto.url, label })} className="text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded-lg">
                            <img src={foto.url} alt={label} loading="lazy" className="w-full aspect-[4/3] object-cover rounded-lg border border-gray-800 group-hover:border-blue-500/60 transition-colors" />
                            <div className="mt-1.5 text-xs text-gray-400">{label}</div>
                          </button>
                        ) : (
                          <div key={key}>
                            <div className="w-full aspect-[4/3] rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 flex items-center justify-center text-xs text-amber-400">Foto não enviada</div>
                            <div className="mt-1.5 text-xs text-gray-500">{label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {outras.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-400">Outras fotos</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {outras.map(f => (
                        <button key={f.id} type="button" onClick={() => setZoom({ url: f.url, label: f.tipo })} className="text-left">
                          <img src={f.url} alt={f.tipo} loading="lazy" className="w-full aspect-[4/3] object-cover rounded-lg border border-gray-800" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Estado do veículo e regiões: o que provamos ao cliente */}
          {temEvidencias && (
            <section className="space-y-4">
              <h4 className="text-base font-semibold text-white">Estado do veículo antes do serviço</h4>
              {checklist && (
                <div className="divide-y divide-gray-800/70 border border-gray-800 rounded-xl">
                  {CHECKLIST_ITENS.map(item => {
                    const r = checklist[item.key];
                    return (
                      <div key={item.key} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                        <span className="text-gray-300">{item.label}</span>
                        <span className={r === 'defeito' ? 'text-red-400 font-medium' : 'text-gray-400'}>{r === 'defeito' ? 'Com defeito (já existia)' : respostaLabel(r)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {os.problemas_relatados && (
                <div>
                  <div className="text-xs text-gray-500">Problemas relatados pelo motorista</div>
                  <p className="mt-1 text-sm text-gray-200 whitespace-pre-wrap">{os.problemas_relatados}</p>
                </div>
              )}
              {regioesMexidas && (
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-gray-500">Regiões em que mexemos</div>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {regioesMexidas.length === 0 && <span className="text-sm text-gray-500">Nenhuma região informada</span>}
                      {regioesMexidas.map(r => <span key={r} className="text-xs bg-blue-500/10 border border-blue-500/40 text-blue-200 rounded-full px-3 py-1">{r}</span>)}
                    </div>
                  </div>
                  {regioesIntactas.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500">Regiões não alteradas</div>
                      <p className="mt-1 text-sm text-gray-400">{regioesIntactas.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Assinatura e local */}
          {temAssinatura && (
            <section className="space-y-3">
              <h4 className="text-base font-semibold text-white">Assinatura e local</h4>
              <div className="flex flex-wrap items-start gap-6">
                {os.assinatura_url && (
                  <div>
                    <div className="rounded-lg bg-white p-2 inline-block"><img src={os.assinatura_url} alt="Assinatura do responsável" className="h-20 w-auto" /></div>
                  </div>
                )}
                <div className="space-y-2 text-sm">
                  {os.assinante_nome && <div><div className="text-xs text-gray-500">Assinado por</div><div className="text-white">{os.assinante_nome}</div></div>}
                  {os.finalizada_em && <div><div className="text-xs text-gray-500">Finalizada em</div><div className="text-white tabular-nums">{new Date(os.finalizada_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div></div>}
                  {os.geo_lat != null && (
                    <div>
                      <div className="text-xs text-gray-500">Localização registrada</div>
                      <a href={`https://www.google.com/maps?q=${os.geo_lat},${os.geo_lng}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">
                        Ver no mapa{os.geo_precisao != null ? ` (precisão de ${Math.round(os.geo_precisao)} m)` : ''}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Financeiro */}
          <section className="space-y-3">
            <h4 className="text-base font-semibold text-white">Financeiro</h4>
            {itens.length > 0 && (
              <div className="rounded-xl border border-gray-800 divide-y divide-gray-800/70 text-sm">
                {itens.map(i => (
                  <div key={i.id} className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2">
                    <span className="text-gray-200">{i.servico_nome}{i.quantidade > 1 ? ` (${i.quantidade}x)` : ''}</span>
                    <span className="tabular-nums text-amber-400 w-24 text-right">{BRL(i.valor_tecnico)}</span>
                    <span className="tabular-nums text-emerald-400 w-24 text-right">{BRL(i.valor_cliente)}</span>
                  </div>
                ))}
                {(Number(os.deslocamento_tecnico) > 0 || Number(os.deslocamento_cliente) > 0) && (
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2">
                    <span className="text-gray-200">Deslocamento{os.km_percorrido != null ? ` (${os.km_percorrido} km)` : ''}</span>
                    <span className="tabular-nums text-amber-400 w-24 text-right">{BRL(os.deslocamento_tecnico)}</span>
                    <span className="tabular-nums text-emerald-400 w-24 text-right">{BRL(os.deslocamento_cliente)}</span>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-px bg-gray-800 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-gray-900 px-4 py-3"><div className="text-xs text-gray-500">Cobrado do cliente</div><div className="mt-1 text-lg font-semibold tabular-nums text-emerald-400">{BRL(faturado)}</div></div>
              <div className="bg-gray-900 px-4 py-3"><div className="text-xs text-gray-500">Pago ao técnico</div><div className="mt-1 text-lg font-semibold tabular-nums text-amber-400">{BRL(custo)}</div></div>
              <div className="bg-gray-900 px-4 py-3"><div className="text-xs text-gray-500">Lucro</div><div className={`mt-1 text-lg font-semibold tabular-nums ${lucro >= 0 ? 'text-white' : 'text-red-400'}`}>{BRL(lucro)}</div></div>
            </div>
          </section>
        </div>

        {onDelete && (
          <div className="flex justify-end p-5 sm:px-6 border-t border-gray-800">
            <button type="button" onClick={() => onDelete(os.id)} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors">
              <FaTrashAlt size={12} /> Excluir OS
            </button>
          </div>
        )}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center p-4" onClick={() => setZoom(null)}>
          <img src={zoom.url} alt={zoom.label} className="max-h-[85vh] max-w-full object-contain rounded-lg" />
          <div className="mt-3 text-sm text-gray-300">{zoom.label}</div>
          <button type="button" aria-label="Fechar foto" className="absolute top-4 right-4 text-gray-300 hover:text-white p-2"><FaTimes size={20} /></button>
        </div>
      )}
    </div>
  );
}
