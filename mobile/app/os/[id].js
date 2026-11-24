// Detalhe de uma OS para a equipe: dados, local, fotos, assinatura e onde foi finalizada
import React, { useEffect, useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { supabase, urlFoto } from '../../src/lib/supabase';
import { CAMPOS_OS } from '../../src/lib/osEquipe';
import { osCodigo, FOTO_TIPOS, CHECKLIST_ITENS, CHECKLIST_RESPOSTAS } from '../../src/lib/osConstants';
import { dataBR, horaBR } from '../../src/lib/formato';
import { Cartao, Carregando, Chip, s } from '../../src/lib/ui';
import { cor } from '../../src/lib/tema';

function Linha({ rotulo, valor }) {
  if (!valor) return null;
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: cor.apagado, fontSize: 12 }}>{rotulo}</Text>
      <Text style={{ color: cor.texto2, fontSize: 15, marginTop: 2 }}>{valor}</Text>
    </View>
  );
}

export default function DetalheOS() {
  const { id } = useLocalSearchParams();
  const [os, setOs] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [erro, setErro] = useState('');
  const [ampliada, setAmpliada] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data, error }, { data: f }] = await Promise.all([
        supabase.from('ordens_servico').select(CAMPOS_OS).eq('id', id).single(),
        supabase.from('ordens_servico_fotos').select('tipo, storage_path').eq('ordem_servico_id', id),
      ]);
      if (error) setErro(error.message); else setOs(data);
      setFotos(f || []);
    })();
  }, [id]);

  if (erro) return <View style={s.centro}><Text style={{ color: cor.vermelho }}>{erro}</Text></View>;
  if (!os) return <Carregando />;
  const rotuloFoto = (t) => FOTO_TIPOS.find(x => x.key === t)?.curto || t;
  const resposta = (k) => CHECKLIST_RESPOSTAS.find(r => r.key === k)?.label || k;

  return (
    <ScrollView style={s.tela} contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: osCodigo(os.id) }} />
      <Cartao style={{ marginBottom: 12 }}>
        <Text style={{ color: cor.texto, fontSize: 18, fontWeight: '700' }}>{os.empresas?.nome || 'Cliente'}</Text>
        <Text style={{ color: os.status === 'aberta' ? cor.ambar : cor.verde, fontWeight: '700', marginTop: 4, marginBottom: 12 }}>
          {os.status === 'aberta' ? 'Aberta' : `Finalizada${os.finalizada_em ? ` em ${dataBR(os.finalizada_em)} ${horaBR(os.finalizada_em)}` : ''}`}
        </Text>
        <Linha rotulo="Placa" valor={`${os.veiculos?.placa || os.placa_texto || 'Placa nova'}${os.veiculos?.modelo ? ` · ${os.veiculos.modelo}` : ''}`} />
        <Linha rotulo="Serviço" valor={os.servico_realizado} />
        <Linha rotulo="Técnico" valor={os.tecnico_nome} />
        <Linha rotulo="Data" valor={`${dataBR(os.data)}${os.horario_previsto ? ` às ${horaBR(os.horario_previsto)}` : ''}`} />
        <Linha rotulo="Local de instalação" valor={os.local_instalacao} />
        <Linha rotulo="Regiões mexidas" valor={os.regioes_mexidas?.join(', ')} />
        <Linha rotulo="Problemas encontrados" valor={os.problemas_relatados} />
        <Linha rotulo="Observações" valor={os.observacoes} />
        <Linha rotulo="Assinado por" valor={os.assinante_nome} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {os.geo_lat != null && <Chip texto="📍 Onde foi finalizada" onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${os.geo_lat},${os.geo_lng}`)} />}
          {os.telefone_contato ? <Chip texto="📞 Contato" onPress={() => Linking.openURL(`tel:${String(os.telefone_contato).replace(/\D/g, '')}`)} /> : null}
        </View>
      </Cartao>

      {os.checklist_estado && (
        <Cartao style={{ marginBottom: 12 }}>
          <Text style={{ color: cor.texto, fontWeight: '700', marginBottom: 8 }}>Estado do veículo antes</Text>
          {CHECKLIST_ITENS.map(it => (
            <View key={it.key} style={[s.linha, { justifyContent: 'space-between', paddingVertical: 4 }]}>
              <Text style={{ color: cor.texto2 }}>{it.label}</Text>
              <Text style={{ color: os.checklist_estado[it.key] === 'defeito' ? cor.vermelho : cor.suave }}>{resposta(os.checklist_estado[it.key]) || '—'}</Text>
            </View>
          ))}
        </Cartao>
      )}

      {fotos.length > 0 && (
        <>
          <Text style={{ color: cor.texto, fontWeight: '700', marginBottom: 8 }}>Fotos ({fotos.length})</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {fotos.map(f => (
              <Pressable key={f.storage_path} onPress={() => setAmpliada(urlFoto(f.storage_path))} style={{ width: '48%' }}>
                <Image source={{ uri: urlFoto(f.storage_path) }} style={{ width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: cor.cartao }} />
                <Text style={{ color: cor.apagado, fontSize: 11, marginTop: 4 }}>{rotuloFoto(f.tipo)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {os.assinatura_url ? (
        <>
          <Text style={{ color: cor.texto, fontWeight: '700', marginBottom: 8 }}>Assinatura</Text>
          <Image source={{ uri: os.assinatura_url }} style={{ width: '100%', height: 140, backgroundColor: '#fff', borderRadius: 10 }} resizeMode="contain" />
        </>
      ) : null}

      <Modal visible={Boolean(ampliada)} transparent onRequestClose={() => setAmpliada(null)}>
        <Pressable onPress={() => setAmpliada(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' }}>
          {ampliada && <Image source={{ uri: ampliada }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
