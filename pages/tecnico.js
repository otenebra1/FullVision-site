// pages/tecnico.js
// App do técnico (PWA): só as OS atribuídas a ele, para finalizar no local do serviço.
// Nada de valores em R$: os dados vêm filtrados das rotas /api/tecnico/*.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  FaSpinner, FaSyncAlt, FaSignOutAlt, FaMapMarkerAlt, FaPhoneAlt, FaWhatsapp, FaClock, FaCar, FaPlay, FaCheckCircle, FaDownload, FaTimes,
} from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { reduzirImagem } from '../lib/osSalvar';
import { osCodigo, FOTO_TIPOS } from '../lib/osConstants';
import { ehEquipe } from '../lib/perfis';
import OsWizard from '../components/os/OsWizard';

const dataBR = (iso) => {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};
const horaBR = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const soDigitos = (s) => String(s || '').replace(/\D/g, '');
const ehHoje = (iso) => iso && String(iso).slice(0, 10) === new Date().toLocaleDateString('en-CA');

async function token() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function api(caminho, opcoes = {}) {
  const t = await token();
  const res = await fetch(caminho, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opcoes.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
  return json;
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className="fixed left-4 right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[90] flex justify-center">
      <div className={`max-w-md w-full rounded-xl px-4 py-3 text-sm shadow-2xl flex items-start gap-3 ${toast.tipo === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`} role="status">
        <span className="flex-1">{toast.msg}</span>
        <button type="button" onClick={onClose} aria-label="Fechar aviso" className="opacity-80 hover:opacity-100 p-1 -m-1"><FaTimes /></button>
      </div>
    </div>
  );
}

// Convite para instalar o app (Android/Chrome mostra o botão; no iPhone, a dica do Safari)
function InstalarApp() {
  const [evento, setEvento] = useState(null);
  const [ios, setIos] = useState(false);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    const instalado = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
    if (instalado) return undefined;
    try { if (localStorage.getItem('fv-instalar-fechado') === '1') { setFechado(true); return undefined; } } catch { /* sem storage */ }
    const ua = window.navigator.userAgent || '';
    setIos(/iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua));
    const pega = (e) => { e.preventDefault(); setEvento(e); };
    window.addEventListener('beforeinstallprompt', pega);
    return () => window.removeEventListener('beforeinstallprompt', pega);
  }, []);

  const fechar = () => { setFechado(true); try { localStorage.setItem('fv-instalar-fechado', '1'); } catch { /* sem storage */ } };
  if (fechado || (!evento && !ios)) return null;

  return (
    <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 flex items-start gap-3">
      <FaDownload className="text-blue-400 mt-0.5 shrink-0" />
      <div className="flex-1 text-sm">
        <div className="text-white font-medium">Instale o app no celular</div>
        {evento ? (
          <button type="button" onClick={async () => { evento.prompt(); await evento.userChoice.catch(() => {}); setEvento(null); fechar(); }} className="mt-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg px-3 py-2 text-sm">
            Instalar
          </button>
        ) : (
          <p className="text-gray-300 mt-1">No Safari, toque em Compartilhar e depois em <span className="text-white">Adicionar à Tela de Início</span>.</p>
        )}
      </div>
      <button type="button" onClick={fechar} aria-label="Dispensar" className="text-gray-400 hover:text-white p-1 -m-1"><FaTimes /></button>
    </div>
  );
}

function CartaoOS({ os, onIniciar }) {
  const aberta = os.status === 'aberta';
  const placa = os.veiculos?.placa || os.placa_texto || 'Placa nova';
  const tel = soDigitos(os.telefone_contato);
  const mapa = os.local_instalacao ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(os.local_instalacao)}` : null;

  return (
    <article className="rounded-2xl border border-gray-800 bg-gray-900 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-gray-500 tabular-nums">{osCodigo(os.id)}</div>
          <h3 className="text-white font-semibold text-base truncate">{os.empresas?.nome || 'Cliente'}</h3>
        </div>
        {aberta ? (
          <span className={`shrink-0 text-xs font-semibold rounded-full px-2.5 py-1 ${ehHoje(os.data) ? 'bg-amber-500/15 text-amber-300' : 'bg-blue-500/15 text-blue-300'}`}>
            {ehHoje(os.data) ? 'Hoje' : dataBR(os.data)}{os.horario_previsto ? ` · ${horaBR(os.horario_previsto)}` : ''}
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 bg-emerald-500/15 text-emerald-300"><FaCheckCircle size={10} /> {dataBR(os.data)}</span>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-200">
        <FaCar className="text-gray-500 shrink-0" />
        <span className="font-mono tracking-wide">{placa}</span>
        {os.veiculos?.modelo && <span className="text-gray-500 truncate">· {os.veiculos.modelo}</span>}
      </div>
      {os.servico_realizado && <div className="text-sm text-gray-300">{os.servico_realizado}</div>}
      {os.observacoes && aberta && <p className="text-sm text-gray-400 bg-gray-950/60 rounded-xl p-3 whitespace-pre-wrap">{os.observacoes}</p>}

      {aberta && (mapa || tel) && (
        <div className="flex flex-wrap gap-2">
          {mapa && (
            <a href={mapa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-gray-200 border border-gray-700 rounded-xl px-3 py-2 max-w-full">
              <FaMapMarkerAlt className="text-red-400 shrink-0" /><span className="truncate">{os.local_instalacao}</span>
            </a>
          )}
          {tel && (
            <>
              <a href={`tel:${tel}`} className="inline-flex items-center gap-2 text-sm text-gray-200 border border-gray-700 rounded-xl px-3 py-2"><FaPhoneAlt className="text-blue-400" /> Ligar</a>
              <a href={`https://wa.me/${tel.length <= 11 ? `55${tel}` : tel}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-gray-200 border border-gray-700 rounded-xl px-3 py-2"><FaWhatsapp className="text-emerald-400" /> WhatsApp</a>
            </>
          )}
        </div>
      )}

      {aberta && (
        <button type="button" onClick={() => onIniciar(os)} className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-xl py-3 text-base">
          <FaPlay size={12} /> Iniciar atendimento
        </button>
      )}
    </article>
  );
}

export default function AppTecnico() {
  const router = useRouter();
  const [estado, setEstado] = useState('verificando'); // verificando | pronto | erro
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [aba, setAba] = useState('abertas');
  const [osEmAndamento, setOsEmAndamento] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, tipo = 'success') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(t => (t && t.msg === msg ? null : t)), tipo === 'error' ? 7000 : 3500);
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setDados(await api('/api/tecnico/dados'));
      setEstado('pronto');
    } catch (e) {
      setErro(e.message);
      setEstado('erro');
    } finally {
      setCarregando(false);
    }
  }, []);

  // Só técnico entra aqui; equipe vai para o painel, cliente para a área do cliente
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/area-cliente'); return; }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile?.role !== 'tecnico') { router.replace(ehEquipe(profile?.role) ? '/painel-admin' : '/area-cliente'); return; }
      carregar();
    })();
  }, [router, carregar]);

  // Volta a buscar quando o app volta para a frente (o ADM pode ter atribuído OS nova)
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === 'visible' && estado === 'pronto' && !osEmAndamento) carregar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [estado, osEmAndamento, carregar]);

  const sair = async () => { await supabase.auth.signOut(); router.replace('/area-cliente'); };

  const abertas = useMemo(() => (dados?.ordens || []).filter(o => o.status === 'aberta'), [dados]);
  const finalizadas = useMemo(() => (dados?.ordens || []).filter(o => o.status !== 'aberta'), [dados]);

  // Catálogo sem preços para o assistente; o servidor calcula os valores ao salvar
  const tabelasProntas = useMemo(() => (dados ? {
    servicos: dados.servicos, faixas: [], faixaPrecos: [], tecnicos: [dados.tecnico], tecnicoPrecos: [],
    clientePadrao: [], clienteEmpresa: [], config: null,
  } : null), [dados]);

  // Envia fotos/assinatura pelo link assinado e grava a OS pelo servidor
  const salvarPeloServidor = useCallback(async (d, onProgress) => {
    const osId = d.osExistenteId;
    const fotos = [];
    for (const ft of FOTO_TIPOS) {
      if (!d.fotos[ft.key]) continue;
      onProgress(`Preparando foto: ${ft.curto || ft.label}...`);
      fotos.push({ tipo: ft.key, nome: ft.curto || ft.label, file: await reduzirImagem(d.fotos[ft.key]) });
    }
    const arquivos = [
      ...fotos.map(f => ({ chave: f.tipo, ext: (f.file.name.split('.').pop() || 'jpg').toLowerCase() })),
      ...(d.assinatura ? [{ chave: 'assinatura', ext: 'png' }] : []),
    ];
    const falhas = [];
    const enviadas = [];
    let assinaturaPath = null;
    if (arquivos.length) {
      onProgress('Preparando envio...');
      const { urls } = await api('/api/tecnico/upload-urls', { method: 'POST', body: JSON.stringify({ osId, arquivos }) });
      for (let i = 0; i < fotos.length; i += 1) {
        onProgress(`Enviando foto ${i + 1} de ${fotos.length}...`);
        const u = urls[i];
        const { error } = await supabase.storage.from('os-fotos').uploadToSignedUrl(u.path, u.token, fotos[i].file, { contentType: fotos[i].file.type || 'image/jpeg' });
        if (error) falhas.push(fotos[i].nome); else enviadas.push({ tipo: fotos[i].tipo, path: u.path });
      }
      if (d.assinatura) {
        onProgress('Enviando assinatura...');
        const u = urls[urls.length - 1];
        const { error } = await supabase.storage.from('os-fotos').uploadToSignedUrl(u.path, u.token, d.assinatura, { contentType: 'image/png' });
        if (error) falhas.push('assinatura'); else assinaturaPath = u.path;
      }
    }

    onProgress('Salvando ordem de serviço...');
    const { fotos: _f, assinatura: _a, fotoTipos: _t, calculo: _c, totaisManuais: _m, ...resto } = d;
    const r = await api('/api/tecnico/salvar-os', { method: 'POST', body: JSON.stringify({ osId, dados: resto, fotos: enviadas, assinaturaPath }) });
    return { falhas: [...falhas, ...(r.falhas || [])] };
  }, []);

  const lista = aba === 'abertas' ? abertas : finalizadas;

  return (
    <>
      <Head>
        <title>Minhas OS · Full Vision</title>
      </Head>
      <main className="min-h-[100dvh] bg-gray-950 text-gray-100">
        <header className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800 pt-[env(safe-area-inset-top)]">
          <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="" className="w-9 h-9 rounded-xl" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500">Técnico</div>
              <div className="text-white font-semibold truncate">{dados?.tecnico?.nome || 'Minhas OS'}</div>
            </div>
            <button type="button" onClick={carregar} disabled={carregando} aria-label="Atualizar" className="p-2.5 rounded-xl text-gray-300 hover:bg-gray-800 disabled:opacity-50">
              <FaSyncAlt className={carregando ? 'animate-spin' : ''} />
            </button>
            <button type="button" onClick={sair} aria-label="Sair" className="p-2.5 rounded-xl text-gray-300 hover:bg-gray-800"><FaSignOutAlt /></button>
          </div>
          {estado === 'pronto' && (
            <div className="max-w-xl mx-auto px-4 pb-3 flex gap-2" role="tablist">
              {[{ k: 'abertas', l: 'Abertas', n: abertas.length }, { k: 'finalizadas', l: 'Finalizadas', n: finalizadas.length }].map(t => (
                <button key={t.k} type="button" role="tab" aria-selected={aba === t.k} onClick={() => setAba(t.k)}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium border ${aba === t.k ? 'bg-blue-600/15 border-blue-500 text-white' : 'border-gray-800 text-gray-400'}`}>
                  {t.l} <span className="tabular-nums text-gray-500">({t.n})</span>
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="max-w-xl mx-auto px-4 py-4 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-3">
          {estado === 'verificando' && (
            <div className="flex items-center justify-center gap-2 text-gray-400 py-20"><FaSpinner className="animate-spin" /> Carregando suas OS...</div>
          )}

          {estado === 'erro' && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 space-y-3">
              <p>{erro}</p>
              <button type="button" onClick={carregar} className="bg-gray-800 text-white rounded-lg px-3 py-2">Tentar de novo</button>
            </div>
          )}

          {estado === 'pronto' && (
            <>
              <InstalarApp />
              {lista.length === 0 ? (
                <div className="text-center text-gray-500 py-16 text-sm">
                  {aba === 'abertas' ? 'Nenhuma OS aberta para você agora.' : 'Nenhuma OS finalizada nos últimos 45 dias.'}
                </div>
              ) : lista.map(os => <CartaoOS key={os.id} os={os} onIniciar={setOsEmAndamento} />)}
            </>
          )}
        </div>
      </main>

      {osEmAndamento && dados && (
        <OsWizard
          mode="tecnico"
          empresas={dados.empresas}
          veiculos={dados.veiculos}
          rastreadores={dados.rastreadores}
          osAberta={osEmAndamento}
          tabelasProntas={tabelasProntas}
          salvar={salvarPeloServidor}
          mostrarValores={false}
          showToast={showToast}
          onSaved={() => {}}
          onClose={(salvou) => { setOsEmAndamento(null); if (salvou) { setAba('abertas'); carregar(); } }}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
