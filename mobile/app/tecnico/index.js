// Técnico: lista das OS dele (abertas e finalizadas), vindas de /api/tecnico/dados
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { setDadosTecnico } from '../../src/lib/dadosTecnico';
import { enviarPosicao } from '../../src/lib/localizacao';
import { osCodigo } from '../../src/lib/osConstants';
import { dataBR, horaBR, ehHoje, soDigitos } from '../../src/lib/formato';
import { Botao, Cartao, Carregando, Chip, Vazio, s } from '../../src/lib/ui';
import { cor } from '../../src/lib/tema';

const MINUTOS_POSICAO = 3;

function CartaoOS({ os }) {
  const aberta = os.status === 'aberta';
  const tel = soDigitos(os.telefone_contato);
  const placa = os.veiculos?.placa || os.placa_texto || 'Placa nova';
  return (
    <Cartao style={{ marginBottom: 12 }}>
      <View style={[s.linha, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: cor.apagado, fontSize: 12 }}>{osCodigo(os.id)}</Text>
          <Text style={{ color: cor.texto, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>{os.empresas?.nome || 'Cliente'}</Text>
        </View>
        <Text style={{ color: aberta ? (ehHoje(os.data) ? cor.ambar : cor.azulClaro) : cor.verde, fontWeight: '700', fontSize: 13 }}>
          {aberta ? `${ehHoje(os.data) ? 'Hoje' : dataBR(os.data)}${os.horario_previsto ? ` · ${horaBR(os.horario_previsto)}` : ''}` : `Finalizada ${dataBR(os.data)}`}
        </Text>
      </View>
      <Text style={{ color: cor.texto2, marginTop: 8, fontSize: 15, letterSpacing: 1 }}>{placa}{os.veiculos?.modelo ? `  ·  ${os.veiculos.modelo}` : ''}</Text>
      {os.servico_realizado ? <Text style={{ color: cor.suave, marginTop: 4 }}>{os.servico_realizado}</Text> : null}
      {aberta && os.observacoes ? <Text style={{ color: cor.suave, marginTop: 8, backgroundColor: cor.cartao2, padding: 10, borderRadius: 10 }}>{os.observacoes}</Text> : null}
      {aberta && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {os.local_instalacao ? <Chip texto={`📍 ${os.local_instalacao}`} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(os.local_instalacao)}`)} /> : null}
          {tel ? <Chip texto="📞 Ligar" onPress={() => Linking.openURL(`tel:${tel}`)} /> : null}
          {tel ? <Chip texto="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${tel.length <= 11 ? `55${tel}` : tel}`)} /> : null}
        </View>
      )}
      {aberta && <Botao titulo="Iniciar atendimento" style={{ marginTop: 12 }} onPress={() => router.push(`/tecnico/os/${os.id}`)} />}
    </Cartao>
  );
}

export default function MinhasOS() {
  const { sair } = useAuth();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [atualizando, setAtualizando] = useState(false);
  const [aba, setAba] = useState('abertas');

  const carregar = useCallback(async () => {
    setAtualizando(true);
    try {
      const d = await api('/api/tecnico/dados');
      setDados(d); setDadosTecnico(d); setErro('');
    } catch (e) { setErro(e.message); }
    setAtualizando(false);
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  // Posição para o mapa da equipe, enquanto o app está aberto
  useEffect(() => {
    enviarPosicao();
    const t = setInterval(enviarPosicao, MINUTOS_POSICAO * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const abertas = (dados?.ordens || []).filter(o => o.status === 'aberta');
  const finalizadas = (dados?.ordens || []).filter(o => o.status !== 'aberta');
  const lista = aba === 'abertas' ? abertas : finalizadas;

  return (
    <View style={s.tela}>
      <Stack.Screen options={{ title: dados?.tecnico?.nome || 'Minhas OS', headerRight: () => <Pressable onPress={sair} hitSlop={10}><Text style={{ color: cor.suave }}>Sair</Text></Pressable> }} />
      {!dados && !erro ? <Carregando texto="Buscando suas OS..." /> : (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={lista}
          keyExtractor={o => String(o.id)}
          refreshControl={<RefreshControl refreshing={atualizando} onRefresh={carregar} tintColor={cor.azulClaro} />}
          ListHeaderComponent={(
            <View style={{ marginBottom: 12 }}>
              {erro ? <Text style={{ color: cor.vermelho, marginBottom: 12 }}>{erro}</Text> : null}
              <View style={[s.linha, { gap: 8 }]}>
                <Chip texto={`Abertas (${abertas.length})`} ativo={aba === 'abertas'} onPress={() => setAba('abertas')} />
                <Chip texto={`Finalizadas (${finalizadas.length})`} ativo={aba === 'finalizadas'} onPress={() => setAba('finalizadas')} />
              </View>
            </View>
          )}
          ListEmptyComponent={<Vazio texto={aba === 'abertas' ? 'Nenhuma OS aberta para você agora.' : 'Nenhuma OS finalizada nos últimos 45 dias.'} />}
          renderItem={({ item }) => <CartaoOS os={item} />}
        />
      )}
    </View>
  );
}
