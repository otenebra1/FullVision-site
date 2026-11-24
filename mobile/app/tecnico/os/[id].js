// Técnico finaliza a OS no local: serviço, veículo, fotos, estado do veículo e assinatura.
// Fotos e assinatura sobem por link assinado; a OS é gravada por /api/tecnico/salvar-os,
// que confere tudo e calcula os valores no servidor.
import React, { useMemo, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import SignatureScreen from 'react-native-signature-canvas';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../src/lib/supabase';
import { api } from '../../../src/lib/api';
import { getDadosTecnico } from '../../../src/lib/dadosTecnico';
import { lerComCamera } from '../../../src/lib/leitor';
import { posicaoAtual } from '../../../src/lib/localizacao';
import {
  SERVICOS_PRIMARIOS, FOTO_TIPOS, CHECKLIST_ITENS, CHECKLIST_RESPOSTAS, REGIOES,
  TAGS_QUE_RETIRAM, TAGS_QUE_INSTALAM, normalizaPlaca, rotuloOpcao, osCodigo,
} from '../../../src/lib/osConstants';
import { hojeISO } from '../../../src/lib/formato';
import { Botao, Campo, Cartao, Chip, s } from '../../../src/lib/ui';
import { cor } from '../../../src/lib/tema';

const ETAPAS = ['Serviço', 'Veículo', 'Fotos', 'Estado do veículo', 'Assinatura'];
const PRIMARIOS = SERVICOS_PRIMARIOS.filter(p => !p.adminOnly);
const DESTINOS = [
  { key: 'estoque_tecnico', label: 'Fica comigo' },
  { key: 'estoque_central', label: 'Estoque central' },
  { key: 'aguardando_manutencao', label: 'Manutenção' },
];

const base64ParaBytes = (b64) => {
  const bin = global.atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

async function reduzirFoto(uri) {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1600 });
  const img = await ctx.renderAsync();
  const r = await img.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  return r.uri;
}

function Secao({ titulo, children, dica }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: cor.texto, fontSize: 15, fontWeight: '700', marginBottom: dica ? 2 : 10 }}>{titulo}</Text>
      {dica ? <Text style={{ color: cor.apagado, fontSize: 12, marginBottom: 10 }}>{dica}</Text> : null}
      {children}
    </View>
  );
}

const Chips = ({ children }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;

export default function FinalizarOS() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [dados] = useState(getDadosTecnico);
  const os = dados?.ordens?.find(o => String(o.id) === String(id));

  const [etapa, setEtapa] = useState(0);
  const [servicos, setServicos] = useState({});
  const [aberto, setAberto] = useState(null);
  const [placa, setPlaca] = useState(os?.veiculos?.placa || os?.placa_texto || '');
  const [rastreadorId, setRastreadorId] = useState('');
  const [destino, setDestino] = useState('estoque_tecnico');
  const [local, setLocal] = useState(os?.local_instalacao || '');
  const [km, setKm] = useState('');
  const [atendimentos, setAtendimentos] = useState(1);
  const [fotos, setFotos] = useState({});
  const [checklist, setChecklist] = useState({});
  const [regioes, setRegioes] = useState([]);
  const [problemas, setProblemas] = useState('');
  const [observacoes, setObservacoes] = useState(os?.observacoes || '');
  const [assinante, setAssinante] = useState('');
  const [assinatura, setAssinatura] = useState(null); // data URL png
  const [assinando, setAssinando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState('');
  const scrollRef = useRef(null);
  const assRef = useRef(null);

  const veiculos = dados?.veiculos;
  const rastreadores = dados?.rastreadores || [];
  const veiculo = useMemo(() => {
    const alvo = normalizaPlaca(placa);
    return alvo.length >= 5 ? (veiculos || []).find(v => normalizaPlaca(v.placa) === alvo) || null : null;
  }, [placa, veiculos]);
  const nomes = Object.keys(servicos);
  const cobraKm = nomes.includes('KM');
  const precisaRetirada = nomes.some(n => TAGS_QUE_RETIRAM.includes(n));
  const mostraInstalado = nomes.some(n => TAGS_QUE_INSTALAM.includes(n) || n.startsWith('INSTALAÇÃO'));
  const naPlaca = veiculo ? rastreadores.find(r => r.status === 'instalado' && r.veiculo_id === veiculo.id) : null;
  const disponiveis = rastreadores.filter(r => r.status === 'estoque_central' || r.status === 'estoque_tecnico');
  const rastreadorSel = disponiveis.find(r => r.id === rastreadorId) || null;

  if (!os) {
    return (
      <View style={s.centro}>
        <Text style={{ color: cor.texto, marginBottom: 16 }}>Esta OS não está mais aberta para você.</Text>
        <Botao titulo="Voltar" onPress={() => router.back()} />
      </View>
    );
  }

  const alterna = (nome) => setServicos(prev => {
    const n = { ...prev };
    if (n[nome]) delete n[nome]; else n[nome] = { quantidade: 1 };
    return n;
  });
  const qtd = (nome, d) => setServicos(prev => ({ ...prev, [nome]: { quantidade: Math.min(9, Math.max(1, prev[nome].quantidade + d)) } }));

  const lerPlaca = async () => { const v = await lerComCamera(router, 'placa'); setPlaca(normalizaPlaca(v)); };
  const lerRastreador = async () => {
    const v = normalizaPlaca(await lerComCamera(router, 'serial'));
    const r = disponiveis.find(x => normalizaPlaca(x.serial) === v || normalizaPlaca(x.serial).endsWith(v) || v.endsWith(normalizaPlaca(x.serial)));
    if (r) setRastreadorId(r.id);
    else Alert.alert('Rastreador não encontrado', `O serial ${v} não está no estoque disponível. Confira com o escritório.`);
  };

  const tirarFoto = async (tipo) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Câmera', 'Permita o uso da câmera para tirar as fotos da OS.'); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (r.canceled || !r.assets?.[0]) return;
    try {
      const uri = await reduzirFoto(r.assets[0].uri);
      setFotos(prev => ({ ...prev, [tipo]: uri }));
    } catch {
      setFotos(prev => ({ ...prev, [tipo]: r.assets[0].uri }));
    }
  };

  const erroDaEtapa = (i) => {
    if (i === 0 && nomes.length === 0) return 'Marque ao menos um serviço';
    if (i === 1 && normalizaPlaca(placa).length < 5) return 'Informe a placa';
    if (i === 1 && cobraKm && !(Number(String(km).replace(',', '.')) > 0)) return 'Informe os KM percorridos';
    if (i === 2) { const f = FOTO_TIPOS.filter(t => !fotos[t.key]).length; if (f) return `Faltam ${f} ${f === 1 ? 'foto' : 'fotos'}`; }
    if (i === 3 && CHECKLIST_ITENS.some(it => !checklist[it.key])) return 'Responda todos os itens do estado do veículo';
    if (i === 4 && !assinante.trim()) return 'Informe o nome de quem assinou';
    if (i === 4 && !assinatura) return 'Falta a assinatura do responsável';
    return null;
  };
  const erro = erroDaEtapa(etapa);
  const ultima = etapa === ETAPAS.length - 1;

  const avancar = () => {
    if (erro) return;
    if (!ultima) { setEtapa(etapa + 1); scrollRef.current?.scrollTo({ y: 0, animated: false }); return; }
    finalizar();
  };

  const finalizar = async () => {
    setSalvando(true);
    try {
      setProgresso('Pegando a localização...');
      const geo = await posicaoAtual();

      const tipos = FOTO_TIPOS.filter(t => fotos[t.key]);
      const arquivos = [...tipos.map(t => ({ chave: t.key, ext: 'jpg' })), { chave: 'assinatura', ext: 'png' }];
      setProgresso('Preparando envio...');
      const { urls } = await api('/api/tecnico/upload-urls', { method: 'POST', body: JSON.stringify({ osId: os.id, arquivos }) });

      const enviadas = [];
      const falhas = [];
      for (let i = 0; i < tipos.length; i += 1) {
        setProgresso(`Enviando foto ${i + 1} de ${tipos.length}...`);
        const bytes = await (await fetch(fotos[tipos[i].key])).arrayBuffer();
        const { error } = await supabase.storage.from('os-fotos').uploadToSignedUrl(urls[i].path, urls[i].token, bytes, { contentType: 'image/jpeg' });
        if (error) falhas.push(tipos[i].curto); else enviadas.push({ tipo: tipos[i].key, path: urls[i].path });
      }
      setProgresso('Enviando assinatura...');
      let assinaturaPath = null;
      const ua = urls[urls.length - 1];
      const { error: eAss } = await supabase.storage.from('os-fotos').uploadToSignedUrl(ua.path, ua.token, base64ParaBytes(assinatura.split(',')[1]), { contentType: 'image/png' });
      if (eAss) falhas.push('assinatura'); else assinaturaPath = ua.path;

      setProgresso('Salvando a OS...');
      const r = await api('/api/tecnico/salvar-os', {
        method: 'POST',
        body: JSON.stringify({
          osId: os.id,
          fotos: enviadas,
          assinaturaPath,
          dados: {
            data: hojeISO(),
            servicos: nomes.map(n => ({ nome: n, quantidade: servicos[n].quantidade })),
            placaTexto: placa,
            rastreadorInstaladoId: mostraInstalado ? rastreadorId || null : null,
            rastreadorRetiradoDestino: destino,
            local, km: cobraKm ? String(km).replace(',', '.') : '', atendimentos,
            observacoes, problemas, checklist, regioes,
            assinanteNome: assinante.trim(),
            geo,
          },
        }),
      });
      const todas = [...falhas, ...(r.falhas || [])];
      Alert.alert('OS finalizada', todas.length ? `Salva, mas não consegui enviar: ${todas.join(', ')}. Avise o escritório.` : 'Tudo enviado. Bom trabalho!');
      router.back();
    } catch (e) {
      Alert.alert('Não consegui salvar', `${e.message}\n\nConfira a internet e tente de novo. Nada foi perdido nesta tela.`);
    } finally {
      setSalvando(false);
      setProgresso('');
    }
  };

  return (
    <KeyboardAvoidingView style={s.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: osCodigo(os.id) }} />
      {/* Etapas */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderColor: cor.borda }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {ETAPAS.map((t, i) => (
            <Pressable key={t} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= etapa ? cor.azul : cor.borda }} onPress={() => { if (i < etapa && !salvando) setEtapa(i); }} />
          ))}
        </View>
        <Text style={{ color: cor.suave, marginTop: 8 }}>Etapa {etapa + 1} de {ETAPAS.length}: <Text style={{ color: cor.texto, fontWeight: '700' }}>{ETAPAS[etapa]}</Text></Text>
        <Text style={{ color: cor.apagado, marginTop: 2 }} numberOfLines={1}>{os.empresas?.nome}</Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {etapa === 0 && (
          <>
            <Secao titulo="O que foi feito">
              <Chips>
                {PRIMARIOS.map(p => {
                  const sel = p.opcoes.filter(o => servicos[o]).length;
                  const unico = p.opcoes.length === 1;
                  return <Chip key={p.key} texto={`${p.label}${!unico && sel ? ` (${sel})` : ''}${unico ? '' : ' ▾'}`} ativo={sel > 0 || aberto === p.key} onPress={() => (unico ? alterna(p.opcoes[0]) : setAberto(aberto === p.key ? null : p.key))} />;
                })}
              </Chips>
              {PRIMARIOS.filter(p => p.key === aberto).map(p => (
                <Cartao key={p.key} style={{ marginTop: 12, padding: 12 }}>
                  <Text style={{ color: cor.suave, marginBottom: 8 }}>{p.label}: escolha o que foi feito</Text>
                  <Chips>{p.opcoes.map(o => <Chip key={o} texto={rotuloOpcao(o, p.prefixo)} ativo={Boolean(servicos[o])} onPress={() => alterna(o)} />)}</Chips>
                </Cartao>
              ))}
            </Secao>
            {nomes.length > 0 && (
              <Secao titulo="Selecionados">
                {nomes.map(n => (
                  <View key={n} style={[s.linha, { justifyContent: 'space-between', paddingVertical: 6 }]}>
                    <Text style={{ color: cor.texto2, flex: 1 }}>{n}</Text>
                    {n !== 'KM' && (
                      <View style={s.linha}>
                        <Chip texto="−" onPress={() => qtd(n, -1)} />
                        <Text style={{ color: cor.texto, width: 20, textAlign: 'center' }}>{servicos[n].quantidade}</Text>
                        <Chip texto="+" onPress={() => qtd(n, 1)} />
                      </View>
                    )}
                  </View>
                ))}
              </Secao>
            )}
          </>
        )}

        {etapa === 1 && (
          <>
            <Campo
              rotulo="Placa" value={placa} autoCapitalize="characters" onChangeText={t => setPlaca(t.toUpperCase())}
              dica={veiculo ? `Placa cadastrada${veiculo.modelo ? `: ${veiculo.modelo}` : ''}.` : normalizaPlaca(placa).length >= 5 ? 'Placa não cadastrada: a OS sai como placa nova.' : ''}
              direita={<Botao titulo="Ler" tipo="secundario" onPress={lerPlaca} />}
            />
            {mostraInstalado && (
              <Secao titulo="Rastreador instalado" dica="Leia o código de barras da etiqueta ou escolha na lista.">
                <View style={[s.linha, { marginBottom: 10 }]}>
                  <Botao titulo="Ler serial" onPress={lerRastreador} style={{ flex: 1 }} />
                  {rastreadorSel && <Botao titulo="Limpar" tipo="secundario" onPress={() => setRastreadorId('')} />}
                </View>
                {rastreadorSel ? (
                  <Text style={{ color: cor.verde, fontSize: 16, fontWeight: '700' }}>✓ {rastreadorSel.serial}{rastreadorSel.modelo ? `, ${rastreadorSel.modelo}` : ''}</Text>
                ) : (
                  <Chips>{disponiveis.slice(0, 30).map(r => <Chip key={r.id} texto={r.serial} onPress={() => setRastreadorId(r.id)} />)}</Chips>
                )}
              </Secao>
            )}
            {precisaRetirada && (
              <Secao titulo="Rastreador retirado">
                {naPlaca ? (
                  <>
                    <Text style={{ color: cor.texto2, marginBottom: 8 }}>{naPlaca.serial}{naPlaca.modelo ? `, ${naPlaca.modelo}` : ''} (o que está nesta placa)</Text>
                    <Text style={{ color: cor.suave, marginBottom: 8 }}>Para onde vai:</Text>
                    <Chips>{DESTINOS.map(d => <Chip key={d.key} texto={d.label} ativo={destino === d.key} onPress={() => setDestino(d.key)} />)}</Chips>
                  </>
                ) : <Text style={{ color: cor.apagado }}>{veiculo ? 'Nenhum rastreador vinculado a esta placa.' : 'Informe uma placa cadastrada para ver o rastreador dela.'}</Text>}
              </Secao>
            )}
            <Campo rotulo="Local do serviço" value={local} onChangeText={setLocal} placeholder="Endereço ou nome do pátio" />
            {cobraKm && <Campo rotulo="KM percorridos" value={km} onChangeText={setKm} keyboardType="decimal-pad" />}
            <Secao titulo="Atendimentos no mesmo local">
              <View style={s.linha}>
                <Chip texto="−" onPress={() => setAtendimentos(Math.max(1, atendimentos - 1))} />
                <Text style={{ color: cor.texto, width: 28, textAlign: 'center', fontSize: 16 }}>{atendimentos}</Text>
                <Chip texto="+" onPress={() => setAtendimentos(Math.min(50, atendimentos + 1))} />
              </View>
            </Secao>
          </>
        )}

        {etapa === 2 && (
          <View style={{ gap: 12 }}>
            {FOTO_TIPOS.map(t => (
              <Pressable key={t.key} onPress={() => tirarFoto(t.key)}>
                <Cartao style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderColor: fotos[t.key] ? cor.verde : cor.borda }}>
                  {fotos[t.key]
                    ? <Image source={{ uri: fotos[t.key] }} style={{ width: 72, height: 72, borderRadius: 10 }} />
                    : <View style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: cor.cartao2, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 26 }}>📷</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: cor.texto, fontWeight: '600' }}>{t.curto}</Text>
                    <Text style={{ color: cor.apagado, fontSize: 12, marginTop: 2 }}>{t.label}</Text>
                    <Text style={{ color: fotos[t.key] ? cor.verde : cor.azulClaro, fontSize: 12, marginTop: 4 }}>{fotos[t.key] ? 'Tirada (toque para refazer)' : 'Toque para fotografar'}</Text>
                  </View>
                </Cartao>
              </Pressable>
            ))}
          </View>
        )}

        {etapa === 3 && (
          <>
            <View style={[s.linha, { justifyContent: 'space-between', marginBottom: 10 }]}>
              <Text style={{ color: cor.texto, fontWeight: '700' }}>Como o veículo estava antes</Text>
              <Chip texto="Tudo funciona" onPress={() => setChecklist(Object.fromEntries(CHECKLIST_ITENS.map(i => [i.key, 'ok'])))} />
            </View>
            {CHECKLIST_ITENS.map(it => (
              <View key={it.key} style={{ marginBottom: 14 }}>
                <Text style={{ color: cor.texto2, marginBottom: 6 }}>{it.label}</Text>
                <Chips>{CHECKLIST_RESPOSTAS.map(r => <Chip key={r.key} texto={r.label} ativo={checklist[it.key] === r.key} onPress={() => setChecklist(p => ({ ...p, [it.key]: r.key }))} />)}</Chips>
              </View>
            ))}
            <Secao titulo="Regiões mexidas">
              <Chips>{REGIOES.map(r => <Chip key={r} texto={r} ativo={regioes.includes(r)} onPress={() => setRegioes(p => (p.includes(r) ? p.filter(x => x !== r) : [...p, r]))} />)}</Chips>
            </Secao>
            <Campo rotulo="Problemas encontrados" value={problemas} onChangeText={setProblemas} multiline />
          </>
        )}

        {etapa === 4 && (
          <>
            <Campo rotulo="Observações" value={observacoes} onChangeText={setObservacoes} multiline />
            <Campo rotulo="Nome de quem assina" value={assinante} onChangeText={setAssinante} placeholder="Responsável pelo veículo" />
            <Text style={s.rotulo}>Assinatura do responsável</Text>
            <Pressable onPress={() => setAssinando(true)}>
              <View style={{ height: 160, borderRadius: 12, borderWidth: 1, borderColor: assinatura ? cor.verde : cor.borda2, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {assinatura ? <Image source={{ uri: assinatura }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Text style={{ color: '#6b7280' }}>Toque para assinar</Text>}
              </View>
            </Pressable>
            <Text style={s.dica}>A localização é registrada ao finalizar.</Text>
          </>
        )}
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderColor: cor.borda, gap: 8 }}>
        {(erro || progresso) ? <Text style={{ color: progresso ? cor.azulClaro : cor.apagado, textAlign: 'center' }}>{progresso || erro}</Text> : null}
        <View style={s.linha}>
          {etapa > 0 && <Botao titulo="Voltar" tipo="secundario" onPress={() => setEtapa(etapa - 1)} desativado={salvando} />}
          <Botao titulo={ultima ? 'Finalizar OS' : 'Continuar'} tipo={ultima ? 'sucesso' : 'primario'} onPress={avancar} desativado={Boolean(erro)} carregando={salvando} style={{ flex: 1 }} />
        </View>
      </View>

      <Modal visible={assinando} animationType="slide" onRequestClose={() => setAssinando(false)}>
        <View style={{ flex: 1, backgroundColor: cor.fundo, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <Text style={{ color: cor.texto, fontSize: 17, fontWeight: '700', padding: 16 }}>Assinatura do responsável</Text>
          <View style={{ flex: 1, marginHorizontal: 12, borderRadius: 12, overflow: 'hidden' }}>
            <SignatureScreen
              ref={assRef}
              onOK={(img) => { setAssinatura(img); setAssinando(false); }}
              onEmpty={() => Alert.alert('Assinatura', 'Assine no quadro antes de confirmar.')}
              descriptionText=""
              clearText="Limpar"
              confirmText="Confirmar"
              imageType="image/png"
              backgroundColor="#ffffff"
              penColor="#111827"
              webStyle=".m-signature-pad--footer .button { background-color: #2563eb; color: #fff; font-size: 16px; padding: 10px 18px; } .m-signature-pad { box-shadow: none; border: none; }"
            />
          </View>
          <Botao titulo="Cancelar" tipo="secundario" onPress={() => setAssinando(false)} style={{ margin: 16 }} />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
