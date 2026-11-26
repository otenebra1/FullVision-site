import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaTimes, FaCamera, FaCheck, FaSpinner, FaMinus, FaPlus, FaMapMarkerAlt, FaChevronDown } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { carregarTabelas, montarContexto, calcularOS } from '../../lib/precos';
import { salvarOS } from '../../lib/osSalvar';
import { BRL, inputBase } from '../admin/ui';
import SignaturePad from './SignaturePad';
import {
  SERVICO_TAGS, FOTO_TIPOS, FOTOS_ANTES, FOTOS_DEPOIS, CHECKLIST_ITENS, CHECKLIST_RESPOSTAS, REGIOES,
  TAGS_QUE_RETIRAM, normalizaPlaca, SERVICOS_PRIMARIOS, rotuloOpcao,
  categoriaInstalada, ehDaCategoria, itemInstaladoNaPlaca, SERVICOS_INSTALACAO_UNICA,
  CAT_LOCALIZADOR, CAT_ATUADOR, CAT_SENSOR,
} from '../../lib/osConstants';
import { Select, DateInput, Combobox } from '../ui/FormControls';

const STEPS = [
  { key: 'fotosAntes', titulo: 'Fotos antes do serviço' },
  { key: 'servico', titulo: 'Serviço' },
  { key: 'veiculo', titulo: 'Veículo' },
  { key: 'fotosDepois', titulo: 'Fotos depois do serviço' },
  { key: 'estado', titulo: 'Estado do veículo' },
  { key: 'revisao', titulo: 'Revisão' },
];
// Número de cada etapa pelo nome (assim dá para mudar a ordem sem caçar números no código)
const E = Object.fromEntries(STEPS.map((s, i) => [s.key, i]));

const campo = `w-full px-3.5 py-2.5 text-base sm:text-sm ${inputBase}`;
const hoje = () => new Date().toLocaleDateString('en-CA');
const numOuNull = (t) => {
  const s = String(t ?? '').trim();
  if (s === '') return null;
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const SERVICOS_RETIRAM_ATUADOR = ['RETIRADA BLOQUEIO', 'RETIRADA IMOBILIZADOR SEM FIO'];
const rotuloItem = (r) => `${r.serial}${r.modelo ? ` · ${r.modelo}` : ''}`;
const SEM_BARRA = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

function Rotulo({ children, className = '' }) {
  return <div className={`text-sm text-gray-400 mb-1.5 ${className}`}>{children}</div>;
}

function Passo({ children }) {
  return <div className="space-y-6">{children}</div>;
}

function Stepper({ step, onGo }) {
  return (
    <div className="px-6 pt-4 pb-3 border-b border-gray-800">
      <div className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            disabled={i >= step}
            onClick={() => onGo(i)}
            aria-label={`Etapa ${i + 1}: ${s.titulo}`}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-blue-500' : 'bg-gray-800'} ${i < step ? 'hover:bg-blue-400 cursor-pointer' : 'cursor-default'}`}
          />
        ))}
      </div>
      <div className="mt-2.5 text-sm text-gray-400">
        Etapa {step + 1} de {STEPS.length}: <span className="text-white font-medium">{STEPS[step].titulo}</span>
      </div>
    </div>
  );
}

function ValorMini({ valor, placeholder, onChange, ariaLabel }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={valor ?? ''}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={e => onChange(e.target.value)}
      className={`w-24 px-2.5 py-1.5 text-right tabular-nums ${inputBase}`}
    />
  );
}

// Nova OS em etapas. mode: 'escritorio' (você lança o que o técnico mandou) ou 'tecnico' (celular, no local do serviço)
// App do técnico: tabelasProntas (catálogo sem preços, vindo do servidor) e salvar (grava pela API, que calcula os valores).
// mostrarValores=false esconde os R$ (perfil funcionário).
export default function OsWizard({
  mode = 'escritorio', empresas, veiculos, rastreadores, onClose, onSaved, showToast = () => {}, osAberta = null,
  tabelasProntas = null, salvar = null, mostrarValores = true,
}) {
  const exigeEvidencias = mode === 'tecnico';
  const mostraFinanceiro = mode === 'escritorio' && mostrarValores;
  const travaOsAberta = exigeEvidencias && Boolean(osAberta); // técnico e cliente já vêm da OS

  const [tabelas, setTabelas] = useState(null);
  const [tabelasCarregadas, setTabelasCarregadas] = useState(false);
  const [step, setStep] = useState(0);
  const [f, setF] = useState(() => ({
    data: hoje(), tecnicoId: '', tecnicoNome: '', tecnicoEmail: '', empresaId: '', servicos: {}, placaTexto: '',
    rastreadorInstaladoId: '', atuadorInstaladoId: '', sensoresInstaladosIds: [], rastreadorRetiradoDestino: 'estoque_tecnico', local: '', km: '', atendimentos: 1,
    checklist: {}, regioes: [], problemas: '', observacoes: '', assinanteNome: '',
    manuais: {}, deslocT: '', deslocC: '', totalTecnicoManual: '', totalClienteManual: '',
    // OS aberta (criada a partir de uma solicitação): já vem com os dados que o cliente informou
    ...(osAberta ? {
      data: osAberta.data || hoje(),
      tecnicoId: osAberta.tecnico_id ? String(osAberta.tecnico_id) : '',
      tecnicoNome: osAberta.tecnico_nome || '',
      tecnicoEmail: osAberta.tecnico_email || '',
      empresaId: osAberta.empresa_id ? String(osAberta.empresa_id) : '',
      placaTexto: osAberta.veiculos?.placa || osAberta.placa_texto || (veiculos.find(v => v.id === osAberta.veiculo_id)?.placa) || '',
      local: osAberta.local_instalacao || '',
      observacoes: osAberta.observacoes || '',
    } : {}),
  }));
  const [fotos, setFotos] = useState({});
  const [previews, setPreviews] = useState({});
  const [assinatura, setAssinatura] = useState(null);
  const [geo, setGeo] = useState(null);
  const [geoStatus, setGeoStatus] = useState('idle');
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [primarioAberto, setPrimarioAberto] = useState(null);
  const bodyRef = useRef(null);
  const previewsRef = useRef({});

  const set = (campoNome, valor) => { setF(prev => ({ ...prev, [campoNome]: valor })); setDirty(true); };

  // Tabelas de preço (se a migração ainda não rodou, a OS funciona com valores digitados)
  useEffect(() => {
    if (tabelasProntas) { setTabelas(tabelasProntas); setTabelasCarregadas(true); return undefined; }
    let cancelado = false;
    carregarTabelas(supabase)
      .then(t => { if (!cancelado) { setTabelas(t); setTabelasCarregadas(true); } })
      .catch(() => { if (!cancelado) { setTabelas(null); setTabelasCarregadas(true); } });
    return () => { cancelado = true; };
  }, []);

  useEffect(() => () => {
    Object.values(previewsRef.current).forEach(u => { if (u && URL.revokeObjectURL) URL.revokeObjectURL(u); });
  }, []);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [step]);

  // Localização: só no modo técnico (no escritório ela não prova nada sobre onde o serviço foi feito)
  useEffect(() => {
    if (!(exigeEvidencias && step === E.revisao) || geoStatus !== 'idle') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGeoStatus('indisponivel'); return; }
    setGeoStatus('buscando');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, precisao: pos.coords.accuracy }); setGeoStatus('ok'); },
      () => setGeoStatus('negado'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }, [exigeEvidencias, step, geoStatus]);

  // ---------------- dados derivados ----------------
  const catalogo = useMemo(() => (
    tabelas
      ? tabelas.servicos.filter(s => s.tipo === 'servico' && s.ativo).map(s => ({ id: s.id, nome: s.nome }))
      : SERVICO_TAGS.filter(t => t !== 'KM').map(nome => ({ id: null, nome }))
  ), [tabelas]);
  const tecnicosAtivos = useMemo(() => (tabelas ? tabelas.tecnicos.filter(t => t.ativo) : []), [tabelas]);
  const empresasOrdenadas = useMemo(() => [...empresas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [empresas]);

  const nomesSel = Object.keys(f.servicos);
  const servicosSel = nomesSel.map(nome => ({ servicoId: f.servicos[nome].servicoId, nome, quantidade: f.servicos[nome].quantidade }));

  const tecnico = tabelas
    ? (tecnicosAtivos.find(t => String(t.id) === String(f.tecnicoId)) || null)
    : (f.tecnicoNome.trim() ? { id: null, nome: f.tecnicoNome.trim(), email: f.tecnicoEmail } : null);

  const veiculosDoCliente = useMemo(() => veiculos.filter(v => String(v.empresa_id) === String(f.empresaId)), [veiculos, f.empresaId]);
  const veiculoMatch = useMemo(() => {
    const alvo = normalizaPlaca(f.placaTexto);
    return alvo.length >= 3 ? veiculos.find(v => normalizaPlaca(v.placa) === alvo) || null : null;
  }, [veiculos, f.placaTexto]);
  const veiculoId = veiculoMatch ? veiculoMatch.id : null;
  const placaNova = !veiculoMatch && normalizaPlaca(f.placaTexto).length >= 5;
  const placaDeOutroCliente = veiculoMatch && f.empresaId && String(veiculoMatch.empresa_id) !== String(f.empresaId);

  // Equipamentos da placa: no máximo 1 rastreador (localizador) e 1 atuador por veículo
  const rastreadorNaPlaca = itemInstaladoNaPlaca(rastreadores, veiculoId, CAT_LOCALIZADOR);
  const atuadorNaPlaca = itemInstaladoNaPlaca(rastreadores, veiculoId, CAT_ATUADOR);
  const precisaRetirada = nomesSel.some(n => TAGS_QUE_RETIRAM.includes(n));
  const retiraAtuador = nomesSel.some(n => SERVICOS_RETIRAM_ATUADOR.includes(n));
  const ehExtravio = nomesSel.includes('EXTRAVIO LOCALIZADOR');
  // O que os serviços marcados instalam: o dropdown de serial só mostra itens dessa categoria
  const instalaLocalizador = nomesSel.some(n => categoriaInstalada(n) === CAT_LOCALIZADOR);
  const instalaAtuador = nomesSel.some(n => categoriaInstalada(n) === CAT_ATUADOR);
  const qtdSensores = nomesSel.filter(n => categoriaInstalada(n) === CAT_SENSOR).reduce((t, n) => t + (f.servicos[n]?.quantidade || 1), 0);
  const retiradoId = precisaRetirada && rastreadorNaPlaca ? rastreadorNaPlaca.id : '';
  const atuadorRetiradoId = retiraAtuador && atuadorNaPlaca ? atuadorNaPlaca.id : '';
  const destinoRetirado = ehExtravio ? 'baixado' : f.rastreadorRetiradoDestino;
  const emEstoque = useMemo(
    () => rastreadores
      .filter(r => r.status === 'estoque_central' || r.status === 'estoque_tecnico')
      .sort((a, b) => String(a.serial || '').localeCompare(String(b.serial || ''), 'pt-BR', { numeric: true })),
    [rastreadores],
  );
  const disponiveisDa = (cat) => emEstoque.filter(r => ehDaCategoria(r, cat));
  const sensoresEscolhidos = f.sensoresInstaladosIds.slice(0, qtdSensores);

  const ctx = useMemo(
    () => (tabelas ? montarContexto(tabelas, { tecnicoId: f.tecnicoId, empresaId: f.empresaId }) : null),
    [tabelas, f.tecnicoId, f.empresaId],
  );
  const calculo = useMemo(() => {
    if (!ctx) return null;
    return calcularOS(ctx, {
      itens: servicosSel.map(s => ({
        servicoId: s.servicoId, nome: s.nome, quantidade: s.quantidade,
        tecnicoManual: numOuNull(f.manuais[s.nome]?.t), clienteManual: numOuNull(f.manuais[s.nome]?.c),
      })),
      km: f.km,
      atendimentosMesmoLocal: f.atendimentos,
      deslocamentoTecnicoManual: numOuNull(f.deslocT),
      deslocamentoClienteManual: numOuNull(f.deslocC),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, f.servicos, f.manuais, f.km, f.atendimentos, f.deslocT, f.deslocC]);

  // ---------------- ações ----------------
  // Serviços agrupados em primários; o que estiver no catálogo e não couber em nenhum vai para "Outros" (só admin)
  const primarios = useMemo(() => {
    const porNome = new Map(catalogo.map(s => [s.nome, s]));
    const usados = new Set();
    const lista = SERVICOS_PRIMARIOS
      .filter(p => !(exigeEvidencias && p.adminOnly))
      .map(p => ({
        ...p,
        itens: p.opcoes.map(nome => { usados.add(nome); return porNome.get(nome) || { id: null, nome }; }),
      }));
    const outros = catalogo.filter(s => !usados.has(s.nome) && !SERVICOS_PRIMARIOS.some(p => p.opcoes.includes(s.nome)));
    if (!exigeEvidencias && outros.length) lista.push({ key: 'OUTROS', label: 'Outros', adminOnly: true, itens: outros });
    return lista;
  }, [catalogo, exigeEvidencias]);

  // KM: se não existe como serviço com preço, marca que a OS cobra deslocamento (KM informado na etapa Veículo)
  const kmEhFlag = (p) => p.key === 'KM' && !p.itens[0].id;
  const clicaPrimario = (p) => {
    if (kmEhFlag(p)) { set('cobraKm', !f.cobraKm); return; }
    if (p.itens.length === 1) { toggleServico(p.itens[0]); return; }
    setPrimarioAberto(atual => (atual === p.key ? null : p.key));
  };

  const toggleServico = (s) => {
    setF(prev => {
      const novo = { ...prev.servicos };
      if (novo[s.nome]) delete novo[s.nome];
      else {
        // 1 atuador por veículo: marcar um tira o outro da mesma categoria (ex.: bloqueio x imobilizador)
        const cat = categoriaInstalada(s.nome);
        if (SERVICOS_INSTALACAO_UNICA.includes(s.nome)) {
          Object.keys(novo).forEach(n => { if (n !== s.nome && SERVICOS_INSTALACAO_UNICA.includes(n) && categoriaInstalada(n) === cat) delete novo[n]; });
        }
        novo[s.nome] = { servicoId: s.id, quantidade: 1 };
      }
      return { ...prev, servicos: novo };
    });
    setDirty(true);
  };
  const maxQtd = (nome) => (SERVICOS_INSTALACAO_UNICA.includes(nome) ? 1 : 9);
  const mudaQtd = (nome, delta) => {
    setF(prev => ({ ...prev, servicos: { ...prev.servicos, [nome]: { ...prev.servicos[nome], quantidade: Math.min(maxQtd(nome), Math.max(1, prev.servicos[nome].quantidade + delta)) } } }));
  };
  const setSensor = (i, id) => {
    setF(prev => {
      const lista = [...prev.sensoresInstaladosIds];
      lista[i] = id;
      return { ...prev, sensoresInstaladosIds: lista };
    });
    setDirty(true);
  };
  const escolheFoto = (tipo, file) => {
    if (!file) return;
    setFotos(prev => ({ ...prev, [tipo]: file }));
    const antigo = previewsRef.current[tipo];
    if (antigo && URL.revokeObjectURL) URL.revokeObjectURL(antigo);
    const url = URL.createObjectURL ? URL.createObjectURL(file) : '';
    previewsRef.current[tipo] = url;
    setPreviews(prev => ({ ...prev, [tipo]: url }));
    setDirty(true);
  };
  const responde = (key, resposta) => { setF(prev => ({ ...prev, checklist: { ...prev.checklist, [key]: resposta } })); setDirty(true); };
  const tudoFunciona = () => { setF(prev => ({ ...prev, checklist: Object.fromEntries(CHECKLIST_ITENS.map(i => [i.key, 'ok'])) })); setDirty(true); };
  const toggleRegiao = (r) => { setF(prev => ({ ...prev, regioes: prev.regioes.includes(r) ? prev.regioes.filter(x => x !== r) : [...prev.regioes, r] })); setDirty(true); };
  const setManual = (nome, lado, valor) => setF(prev => ({ ...prev, manuais: { ...prev.manuais, [nome]: { ...prev.manuais[nome], [lado]: valor } } }));

  // ---------------- validação de cada etapa ----------------
  const erroDaEtapa = (i) => {
    if (i === E.servico) {
      if (!f.data) return 'Informe a data';
      if (!tecnico) return 'Escolha o técnico';
      if (!f.empresaId) return 'Escolha o cliente';
      if (nomesSel.length === 0 && !f.cobraKm) return 'Marque ao menos um serviço';
    }
    if (i === E.veiculo && normalizaPlaca(f.placaTexto).length < 5) return 'Informe a placa';
    if (i === E.veiculo && nomesSel.includes('INSTALAÇÃO LOCALIZADOR') && rastreadorNaPlaca && !precisaRetirada) {
      return `Esta placa já tem o rastreador ${rastreadorNaPlaca.serial}. Só cabe 1 por veículo: use Troca de equipamento ou Upgrade`;
    }
    if (i === E.veiculo && instalaAtuador && atuadorNaPlaca && !retiraAtuador) {
      return `Esta placa já tem o atuador ${atuadorNaPlaca.serial}. Só cabe 1 por veículo: marque a retirada dele antes`;
    }
    if (i === E.veiculo && f.cobraKm && !(Number(String(f.km).replace(',', '.')) > 0)) return 'Informe os KM percorridos';
    if (i === E.fotosAntes || i === E.fotosDepois) {
      const falta = (i === E.fotosAntes ? FOTOS_ANTES : FOTOS_DEPOIS).filter(ft => !fotos[ft.key]).length;
      if (falta > 0) return `Faltam ${falta} ${falta === 1 ? 'foto' : 'fotos'}`;
    }
    if (i === E.estado && exigeEvidencias && CHECKLIST_ITENS.some(it => !f.checklist[it.key])) return 'Responda todos os itens do estado do veículo';
    if (i === E.revisao && exigeEvidencias) {
      if (!f.assinanteNome.trim()) return 'Informe o nome de quem assinou';
      if (!assinatura) return 'Falta a assinatura do responsável';
    }
    return null;
  };
  // Grade de fotos (usada nas etapas de fotos antes e depois)
  const gradeFotos = (tipos) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {tipos.map(ft => {
        const tem = Boolean(fotos[ft.key]);
        return (
          <label key={ft.key} className={`relative aspect-[4/3] rounded-xl border overflow-hidden cursor-pointer flex flex-col items-center justify-center text-center p-2 transition-colors focus-within:ring-2 focus-within:ring-blue-500/60 ${tem ? 'border-emerald-500/50' : 'border-dashed border-gray-700 hover:border-gray-500'}`}>
            <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label={ft.label} onChange={e => escolheFoto(ft.key, e.target.files && e.target.files[0])} />
            {tem && previews[ft.key] && <img src={previews[ft.key]} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            {tem ? (
              <span className="absolute bottom-0 inset-x-0 bg-black/65 text-[11px] text-white py-1 px-2 flex items-center justify-center gap-1.5"><FaCheck size={9} className="text-emerald-400" /> {ft.curto}</span>
            ) : (
              <>
                <FaCamera className="text-gray-500 mb-2" size={18} />
                <span className="text-xs text-gray-300 leading-tight">{ft.curto}</span>
              </>
            )}
          </label>
        );
      })}
    </div>
  );

  const erroAtual = erroDaEtapa(step);
  const ultima = step === STEPS.length - 1;

  const pedirSaida = () => { if (salvando) return; if (dirty) setConfirmandoSaida(true); else onClose(false); };

  const finalizar = async () => {
    if (erroAtual) return;
    // A regra de 1 rastreador / 1 atuador por placa vale mesmo pulando etapas
    const erroVeiculo = erroDaEtapa(E.veiculo);
    if (erroVeiculo) { showToast(erroVeiculo, 'error'); setStep(E.veiculo); return; }
    setSalvando(true);
    try {
      const dados = {
        data: f.data,
        tecnico: { id: tecnico.id, nome: tecnico.nome, email: tecnico.email },
        empresaId: f.empresaId,
        servicos: servicosSel,
        veiculoId,
        placaTexto: f.placaTexto,
        placaDoVeiculo: veiculoMatch?.placa || null,
        rastreadorInstaladoId: instalaLocalizador ? f.rastreadorInstaladoId : '',
        rastreadorInstaladoSerial: instalaLocalizador ? (rastreadores.find(r => r.id === f.rastreadorInstaladoId)?.serial || null) : null,
        // Atuador e sensores: só vinculam o item à placa no estoque
        equipamentosInstaladosIds: [
          ...(instalaAtuador && f.atuadorInstaladoId ? [f.atuadorInstaladoId] : []),
          ...sensoresEscolhidos.filter(Boolean),
        ],
        atuadorRetiradoId,
        rastreadorRetiradoId: retiradoId,
        rastreadorRetiradoDestino: destinoRetirado,
        local: f.local,
        km: f.km,
        atendimentos: f.atendimentos,
        observacoes: f.observacoes,
        problemas: f.problemas,
        checklist: f.checklist,
        regioes: f.regioes,
        calculo,
        totaisManuais: { tecnico: numOuNull(f.totalTecnicoManual), cliente: numOuNull(f.totalClienteManual) },
        fotos,
        fotoTipos: FOTO_TIPOS,
        assinatura,
        assinanteNome: f.assinanteNome.trim(),
        geo,
        osExistenteId: osAberta?.id || null,
      };
      const res = salvar ? await salvar(dados, setProgresso) : await salvarOS(supabase, dados, setProgresso);
      onSaved(res);
      if (res.falhas.length) showToast(`OS salva, mas não consegui enviar: ${res.falhas.join(', ')}. Tente reenviar depois.`, 'error');
      else showToast('Ordem de serviço salva!');
      onClose(true);
    } catch (e) {
      const dica = /column|relation|does not exist/i.test(e.message) ? ' Rode o arquivo migration_os_v2.sql no Supabase.' : '';
      showToast(`Erro ao salvar a OS: ${e.message}.${dica}`, 'error');
      setSalvando(false);
      setProgresso('');
    }
  };

  const regras = ctx?.regras;
  const kmNum = Number(f.km) || 0;
  const dicaKm = !mostraFinanceiro || !calculo || kmNum <= 0 ? null
    : calculo.motivoDeslocamento === 'pago' ? `Deslocamento pago: ${kmNum} km.`
      : calculo.motivoDeslocamento === 'isento_atendimentos' ? `Sem deslocamento: ${regras.atendimentosIsencao} ou mais atendimentos no mesmo local.`
        : `Sem deslocamento: até ${regras.kmLimite} km.`;

  // ---------------- tela ----------------
  return (
    <div className="fixed inset-0 z-[70] bg-black/75 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Nova ordem de serviço">
      <div className="bg-gray-900 border border-gray-800 sm:rounded-2xl w-full max-w-xl h-[100dvh] sm:h-[min(90vh,720px)] flex flex-col overflow-hidden relative">
        {/* Topo */}
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-lg font-semibold text-white">{travaOsAberta ? 'Finalizar OS' : 'Nova OS'}</h2>
          <button type="button" onClick={pedirSaida} aria-label="Fechar" className="text-gray-500 hover:text-white p-2 -mr-2 rounded-md hover:bg-gray-800"><FaTimes /></button>
        </div>
        <Stepper step={step} onGo={(i) => { if (!salvando) setStep(i); }} />

        {/* Conteúdo (sem barra de rolagem aparente) */}
        <div ref={bodyRef} className={`flex-1 overflow-y-auto px-6 py-6 ${SEM_BARRA}`}>
          {/* ===== 1. Serviço ===== */}
          {step === E.servico && (
            <Passo>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Rotulo>Data</Rotulo>
                  <DateInput value={f.data} onChange={e => set('data', e.target.value)} aria-label="Data" className={campo} />
                </div>
                <div>
                  <Rotulo>Técnico</Rotulo>
                  {tabelas ? (
                    <Select value={f.tecnicoId} onChange={e => set('tecnicoId', e.target.value)} disabled={travaOsAberta} aria-label="Técnico" className={campo}>
                      <option value="">Escolha...</option>
                      {tecnicosAtivos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                    </Select>
                  ) : (
                    <input type="text" value={f.tecnicoNome} onChange={e => set('tecnicoNome', e.target.value)} placeholder="Nome do técnico" aria-label="Técnico" className={campo} />
                  )}
                </div>
              </div>
              <div>
                <Rotulo>Cliente</Rotulo>
                <Select value={f.empresaId} onChange={e => set('empresaId', e.target.value)} disabled={travaOsAberta} aria-label="Cliente" className={campo}>
                  <option value="">Escolha...</option>
                  {empresasOrdenadas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </Select>
              </div>
              <div>
                <Rotulo>O que foi feito</Rotulo>
                <div className="flex flex-wrap gap-2">
                  {primarios.map(p => {
                    const qtdSel = kmEhFlag(p) ? (f.cobraKm ? 1 : 0) : p.itens.filter(s => f.servicos[s.nome]).length;
                    const unico = p.itens.length === 1;
                    const aberto = primarioAberto === p.key;
                    const ativo = qtdSel > 0 || aberto;
                    return (
                      <button
                        key={p.key} type="button" onClick={() => clicaPrimario(p)} aria-expanded={unico ? undefined : aberto} aria-pressed={unico ? qtdSel > 0 : undefined}
                        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors ${ativo ? 'bg-blue-600/15 border-blue-500 text-white' : 'border-gray-700 text-gray-300 hover:border-gray-500'}`}
                      >
                        {p.label}
                        {p.adminOnly && <span className="text-[10px] uppercase tracking-wide text-amber-400/80">adm</span>}
                        {!unico && qtdSel > 0 && <span className="bg-blue-600 text-white text-[11px] font-semibold rounded-full min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center tabular-nums">{qtdSel}</span>}
                        {!unico && <FaChevronDown size={9} className={`text-gray-500 transition-transform ${aberto ? 'rotate-180' : ''}`} />}
                      </button>
                    );
                  })}
                </div>

                {primarios.filter(p => p.key === primarioAberto && p.itens.length > 1).map(p => (
                  <div key={p.key} className="mt-3 rounded-xl border border-gray-800 bg-gray-950/60 p-3">
                    <div className="text-xs text-gray-400 mb-2">{p.label}: escolha o que foi feito</div>
                    <div className="flex flex-wrap gap-2">
                      {p.itens.map(s => {
                        const sel = f.servicos[s.nome];
                        return (
                          <div key={s.nome} className={`inline-flex items-center rounded-full border text-sm transition-colors ${sel ? 'bg-blue-600/15 border-blue-500 text-white' : 'border-gray-700 text-gray-300 hover:border-gray-500'}`}>
                            <button type="button" aria-pressed={Boolean(sel)} onClick={() => toggleServico(s)} className={`py-1.5 ${sel && maxQtd(s.nome) > 1 ? 'pl-3 pr-2' : 'px-3'}`}>{rotuloOpcao(s.nome, p.prefixo)}</button>
                            {sel && maxQtd(s.nome) > 1 && (
                              <span className="flex items-center gap-1 pr-2">
                                <button type="button" aria-label={`Diminuir ${s.nome}`} onClick={() => mudaQtd(s.nome, -1)} className="p-1 text-gray-400 hover:text-white"><FaMinus size={9} /></button>
                                <span className="tabular-nums w-3 text-center">{sel.quantidade}</span>
                                <button type="button" aria-label={`Aumentar ${s.nome}`} onClick={() => mudaQtd(s.nome, 1)} className="p-1 text-gray-400 hover:text-white"><FaPlus size={9} /></button>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {nomesSel.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-gray-500">Selecionados:</span>
                    {nomesSel.map(n => (
                      <span key={n} className="inline-flex items-center gap-1.5 bg-gray-800 border border-gray-700 text-gray-200 rounded-full pl-2.5 pr-1.5 py-0.5">
                        {n}{f.servicos[n].quantidade > 1 ? ` ×${f.servicos[n].quantidade}` : ''}
                        <button type="button" aria-label={`Remover ${n}`} onClick={() => toggleServico({ nome: n, id: f.servicos[n].servicoId })} className="text-gray-500 hover:text-white"><FaTimes size={8} /></button>
                      </span>
                    ))}
                  </div>
                )}
                {f.cobraKm && <p className="mt-2 text-xs text-blue-300">KM: informe os quilômetros percorridos na etapa Veículo; o deslocamento é calculado pelas regras de preço.</p>}
                {nomesSel.includes('UPGRADE LOCALIZADOR') && (
                  <p className="mt-2 text-xs text-blue-300">Upgrade: o rastreador que está hoje na placa já entra como retirado na etapa do veículo.</p>
                )}
              </div>
              {tabelasCarregadas && !tabelas && mostraFinanceiro && (
                <p className="text-xs text-amber-400">As tabelas de preço ainda não estão no banco: os valores serão digitados na revisão. Rode o migration_os_v2.sql para automatizar.</p>
              )}
            </Passo>
          )}

          {/* ===== 2. Veículo ===== */}
          {step === E.veiculo && (
            <Passo>
              <div>
                <Rotulo>Placa</Rotulo>
                <Combobox
                  value={f.placaTexto} autoCapitalize="characters"
                  onChange={e => set('placaTexto', e.target.value.toUpperCase())} placeholder="Digite ou escolha" aria-label="Placa"
                  options={veiculosDoCliente.map(v => ({ value: v.placa, label: v.placa, hint: v.modelo || '' }))}
                  className={campo} inputClassName="uppercase tracking-wide"
                />
                <div className="mt-1.5 text-xs min-h-[1rem]">
                  {veiculoMatch && !placaDeOutroCliente && <span className="text-gray-500">Placa cadastrada.</span>}
                  {placaDeOutroCliente && <span className="text-amber-400">Esta placa está cadastrada em outro cliente. Confira se o cliente da etapa Serviço está certo, pois os preços dependem dele.</span>}
                  {placaNova && <span className="text-amber-400">Placa não cadastrada: a OS será salva como placa nova, sem vínculo com o cadastro de veículos.</span>}
                </div>
              </div>

              {instalaLocalizador && (
                <div>
                  <Rotulo>Rastreador instalado <span className="text-gray-600">(se houver)</span></Rotulo>
                  <Select value={f.rastreadorInstaladoId} onChange={e => set('rastreadorInstaladoId', e.target.value)} aria-label="Rastreador instalado" className={campo}>
                    <option value="">Nenhum</option>
                    {disponiveisDa(CAT_LOCALIZADOR).map(r => <option key={r.id} value={r.id}>{rotuloItem(r)}</option>)}
                  </Select>
                </div>
              )}

              {instalaAtuador && (
                <div>
                  <Rotulo>Atuador instalado <span className="text-gray-600">(se houver)</span></Rotulo>
                  <Select value={f.atuadorInstaladoId} onChange={e => set('atuadorInstaladoId', e.target.value)} aria-label="Atuador instalado" className={campo}>
                    <option value="">Nenhum</option>
                    {disponiveisDa(CAT_ATUADOR).map(r => <option key={r.id} value={r.id}>{rotuloItem(r)}</option>)}
                  </Select>
                </div>
              )}

              {Array.from({ length: qtdSensores }).map((_, i) => (
                <div key={`sensor-${i}`}>
                  <Rotulo>{qtdSensores > 1 ? `Sensor instalado ${i + 1}` : 'Sensor instalado'} <span className="text-gray-600">(se houver)</span></Rotulo>
                  <Select value={sensoresEscolhidos[i] || ''} onChange={e => setSensor(i, e.target.value)} aria-label={`Sensor instalado ${i + 1}`} className={campo}>
                    <option value="">Nenhum</option>
                    {disponiveisDa(CAT_SENSOR)
                      .filter(r => r.id === sensoresEscolhidos[i] || !sensoresEscolhidos.includes(r.id))
                      .map(r => <option key={r.id} value={r.id}>{rotuloItem(r)}</option>)}
                  </Select>
                </div>
              ))}

              {retiraAtuador && veiculoId && (
                <p className="text-xs text-gray-400">
                  {atuadorNaPlaca
                    ? `Atuador retirado: ${rotuloItem(atuadorNaPlaca)} (vai para o mesmo destino do rastreador retirado, ou estoque com o técnico).`
                    : 'Não há atuador instalado nesta placa no sistema.'}
                </p>
              )}

              {precisaRetirada && (
                <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 space-y-3">
                  <div className="text-sm font-medium text-gray-200">Rastreador retirado</div>
                  {!veiculoId ? (
                    <p className="text-xs text-gray-500">Informe uma placa cadastrada para ver o rastreador instalado nela.</p>
                  ) : rastreadorNaPlaca ? (
                    <>
                      <div className="text-sm text-white">{rastreadorNaPlaca.serial}{rastreadorNaPlaca.modelo ? `, ${rastreadorNaPlaca.modelo}` : ''}
                        <span className="block text-xs text-gray-500 mt-0.5">É o rastreador vinculado a esta placa, escolhido automaticamente.</span>
                      </div>
                      {ehExtravio ? (
                        <p className="text-xs text-red-400">Extravio: este rastreador será dado como baixado no estoque.</p>
                      ) : (
                        <div>
                          <Rotulo>Depois de retirado, vai para</Rotulo>
                          <Select value={f.rastreadorRetiradoDestino} onChange={e => set('rastreadorRetiradoDestino', e.target.value)} aria-label="Destino do rastreador retirado" className={campo}>
                            <option value="estoque_tecnico">Estoque com o técnico</option>
                            <option value="estoque_central">Estoque central</option>
                            <option value="aguardando_manutencao">Aguardando manutenção</option>
                          </Select>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-amber-400">Não há rastreador instalado nesta placa no sistema. A OS será salva sem vincular um retirado.</p>
                  )}
                </div>
              )}

              <div>
                <Rotulo>Endereço <span className="text-gray-600">(opcional)</span></Rotulo>
                <input type="text" value={f.local} onChange={e => set('local', e.target.value)} placeholder="Rua, número, bairro, cidade" aria-label="Endereço" className={campo} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Rotulo>KM percorridos{f.cobraKm && <span className="text-blue-400"> *</span>}</Rotulo>
                  <input type="text" inputMode="decimal" value={f.km} onChange={e => set('km', e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0" aria-label="KM percorridos" className={campo} />
                </div>
                <div>
                  <Rotulo>Atendimentos neste local</Rotulo>
                  <div className="flex items-center gap-3">
                    <button type="button" aria-label="Menos um atendimento" onClick={() => set('atendimentos', Math.max(1, f.atendimentos - 1))} className="w-11 h-11 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 flex items-center justify-center"><FaMinus size={11} /></button>
                    <span className="w-8 text-center text-lg tabular-nums text-white" aria-label="Quantidade de atendimentos">{f.atendimentos}</span>
                    <button type="button" aria-label="Mais um atendimento" onClick={() => set('atendimentos', Math.min(20, f.atendimentos + 1))} className="w-11 h-11 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 flex items-center justify-center"><FaPlus size={11} /></button>
                  </div>
                </div>
              </div>
              {dicaKm && <p className="text-xs text-gray-500 -mt-3">{dicaKm}</p>}
            </Passo>
          )}

          {/* ===== Fotos antes do serviço (primeira etapa: tiradas antes de mexer no veículo) ===== */}
          {step === E.fotosAntes && (
            <Passo>
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-gray-400">Antes de começar o serviço, tire estas {FOTOS_ANTES.length} fotos. Elas provam como o veículo estava quando chegamos.</p>
                <span className="text-sm text-white tabular-nums whitespace-nowrap ml-3">{FOTOS_ANTES.filter(ft => fotos[ft.key]).length} de {FOTOS_ANTES.length}</span>
              </div>
              {gradeFotos(FOTOS_ANTES)}
            </Passo>
          )}

          {/* ===== Fotos depois do serviço ===== */}
          {step === E.fotosDepois && (
            <Passo>
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-gray-400">Com o serviço pronto, tire as {FOTOS_DEPOIS.length} fotos finais. Todas são obrigatórias.</p>
                <span className="text-sm text-white tabular-nums whitespace-nowrap ml-3">{FOTOS_DEPOIS.filter(ft => fotos[ft.key]).length} de {FOTOS_DEPOIS.length}</span>
              </div>
              {gradeFotos(FOTOS_DEPOIS)}
            </Passo>
          )}

          {/* ===== 4. Estado do veículo ===== */}
          {step === E.estado && (
            <Passo>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">Como o veículo estava <span className="text-white">antes</span> de mexermos?</p>
                  <button type="button" onClick={tudoFunciona} className="text-sm text-blue-400 hover:text-blue-300 whitespace-nowrap ml-3">Tudo funcionando</button>
                </div>
                {!exigeEvidencias && <p className="text-xs text-gray-500 mb-2">Preencha se o técnico informou. Se não, pode continuar.</p>}
                <div className="divide-y divide-gray-800/70 border border-gray-800 rounded-xl">
                  {CHECKLIST_ITENS.map(item => (
                    <div key={item.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
                      <span className="text-sm text-gray-200">{item.label}</span>
                      <div className="inline-flex rounded-lg border border-gray-800 overflow-hidden" role="group" aria-label={item.label}>
                        {CHECKLIST_RESPOSTAS.map(r => (
                          <button
                            key={r.key} type="button" aria-pressed={f.checklist[item.key] === r.key} onClick={() => responde(item.key, r.key)}
                            className={`px-2.5 py-1.5 text-xs transition-colors ${f.checklist[item.key] === r.key ? (r.key === 'defeito' ? 'bg-red-500/20 text-red-300' : 'bg-gray-700 text-white') : 'text-gray-400 hover:text-white'}`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Rotulo>Em quais partes do veículo mexemos?</Rotulo>
                <div className="flex flex-wrap gap-2">
                  {REGIOES.map(r => (
                    <button key={r} type="button" aria-pressed={f.regioes.includes(r)} onClick={() => toggleRegiao(r)}
                      className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${f.regioes.includes(r) ? 'bg-blue-600/15 border-blue-500 text-white' : 'border-gray-700 text-gray-300 hover:border-gray-500'}`}>
                      {r}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">O que não for marcado aparece no laudo como “não alterado”.</p>
              </div>

              <div>
                <Rotulo>O motorista relatou algum problema? <span className="text-gray-600">(opcional)</span></Rotulo>
                <textarea rows={2} value={f.problemas} onChange={e => set('problemas', e.target.value)} aria-label="Problemas relatados" placeholder="Ex.: ar-condicionado fraco desde antes da instalação" className={`${campo} resize-none`} />
              </div>
            </Passo>
          )}

          {/* ===== 5. Revisão ===== */}
          {step === E.revisao && (
            <Passo>
              <dl className="rounded-xl border border-gray-800 divide-y divide-gray-800/70 text-sm">
                <div className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-gray-500">Cliente</dt><dd className="text-white text-right">{empresas.find(e => String(e.id) === String(f.empresaId))?.nome}</dd></div>
                <div className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-gray-500">Placa</dt><dd className="text-white text-right tracking-wide">{veiculoMatch?.placa || f.placaTexto}</dd></div>
                <div className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-gray-500">Técnico</dt><dd className="text-white text-right">{tecnico?.nome}</dd></div>
                <div className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-gray-500">Serviços</dt><dd className="text-white text-right">{servicosSel.map(s => (s.quantidade > 1 ? `${s.nome} (${s.quantidade}x)` : s.nome)).join(', ')}</dd></div>
              </dl>

              <div>
                <Rotulo>Observações <span className="text-gray-600">(opcional)</span></Rotulo>
                <textarea rows={2} value={f.observacoes} onChange={e => set('observacoes', e.target.value)} aria-label="Observações" className={`${campo} resize-none`} />
              </div>

              {mostraFinanceiro && (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-200">Valores</div>
                  {calculo ? (
                    <>
                      <div className="rounded-xl border border-gray-800 overflow-hidden">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-4 py-2 text-xs text-gray-500 bg-gray-900/80">
                          <span>Serviço</span><span className="w-24 text-right text-amber-400">Técnico</span><span className="w-24 text-right text-emerald-400">Cliente</span>
                        </div>
                        <div className="divide-y divide-gray-800/70">
                          {calculo.itens.map(i => (
                            <div key={i.nome} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-4 py-2">
                              <span className="text-sm text-gray-200">{i.nome}{i.quantidade > 1 ? ` (${i.quantidade}x)` : ''}</span>
                              <ValorMini valor={f.manuais[i.nome]?.t} placeholder={i.unitTecnico.toFixed(2).replace('.', ',')} ariaLabel={`Valor do técnico em ${i.nome}`} onChange={v => setManual(i.nome, 't', v)} />
                              <ValorMini valor={f.manuais[i.nome]?.c} placeholder={i.unitCliente.toFixed(2).replace('.', ',')} ariaLabel={`Valor do cliente em ${i.nome}`} onChange={v => setManual(i.nome, 'c', v)} />
                            </div>
                          ))}
                          {kmNum > 0 && (
                            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-4 py-2">
                              <span className="text-sm text-gray-200">Deslocamento ({kmNum} km)</span>
                              <ValorMini valor={f.deslocT} placeholder={calculo.deslocamentoTecnico.toFixed(2).replace('.', ',')} ariaLabel="Deslocamento do técnico" onChange={v => set('deslocT', v)} />
                              <ValorMini valor={f.deslocC} placeholder={calculo.deslocamentoCliente.toFixed(2).replace('.', ',')} ariaLabel="Deslocamento do cliente" onChange={v => set('deslocC', v)} />
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-4 py-3 bg-gray-900/80 text-sm font-semibold">
                          <span className="text-gray-300">Total</span>
                          <span className="w-24 text-right tabular-nums text-amber-400" aria-label="Total do técnico">{BRL(calculo.totalTecnico)}</span>
                          <span className="w-24 text-right tabular-nums text-emerald-400" aria-label="Total do cliente">{BRL(calculo.totalCliente)}</span>
                        </div>
                      </div>
                      {calculo.avisos.length > 0 && (
                        <ul className="space-y-1">{calculo.avisos.map(a => <li key={a} className="text-xs text-amber-400">{a}</li>)}</ul>
                      )}
                      <p className="text-xs text-gray-500">Os valores já vêm das tabelas de preço. Para um valor diferente nesta OS, digite no campo.</p>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Rotulo><span className="text-emerald-400">Cobrado do cliente</span> (R$)</Rotulo>
                        <input type="text" inputMode="decimal" value={f.totalClienteManual} onChange={e => set('totalClienteManual', e.target.value)} placeholder="0,00" aria-label="Valor cobrado do cliente" className={campo} />
                      </div>
                      <div>
                        <Rotulo><span className="text-amber-400">Pago ao técnico</span> (R$)</Rotulo>
                        <input type="text" inputMode="decimal" value={f.totalTecnicoManual} onChange={e => set('totalTecnicoManual', e.target.value)} placeholder="0,00" aria-label="Valor pago ao técnico" className={campo} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-200">Assinatura do responsável {!exigeEvidencias && <span className="text-gray-600 font-normal">(opcional)</span>}</div>
                <input type="text" value={f.assinanteNome} onChange={e => set('assinanteNome', e.target.value)} placeholder="Nome de quem assinou (motorista ou responsável)" aria-label="Nome de quem assinou" className={campo} />
                <SignaturePad onChange={setAssinatura} />
                {exigeEvidencias && (
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <FaMapMarkerAlt size={11} />
                    {geoStatus === 'ok' && 'Localização registrada.'}
                    {geoStatus === 'buscando' && 'Registrando localização...'}
                    {(geoStatus === 'negado' || geoStatus === 'indisponivel') && 'Localização não registrada. Permita o acesso no navegador para comprovar o local.'}
                  </p>
                )}
              </div>
            </Passo>
          )}
        </div>

        {/* Rodapé */}
        <div className="border-t border-gray-800 px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0 text-sm text-gray-500 truncate" aria-live="polite">
            {salvando ? <span className="inline-flex items-center gap-2 text-gray-300"><FaSpinner className="animate-spin" /> {progresso || 'Salvando...'}</span> : erroAtual}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {step > 0 && (
              <button type="button" disabled={salvando} onClick={() => setStep(step - 1)} className="px-4 py-2.5 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-800 disabled:opacity-40">Voltar</button>
            )}
            <button
              type="button"
              disabled={Boolean(erroAtual) || salvando}
              onClick={() => (ultima ? finalizar() : setStep(step + 1))}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors"
            >
              {ultima ? 'Finalizar OS' : 'Continuar'}
            </button>
          </div>
        </div>

        {confirmandoSaida && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-6">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full space-y-4">
              <h3 className="text-lg font-semibold text-white">Descartar esta OS?</h3>
              <p className="text-sm text-gray-400">O que você preencheu até agora será perdido.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmandoSaida(false)} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-800">Continuar editando</button>
                <button type="button" onClick={() => onClose(false)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white">Descartar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
