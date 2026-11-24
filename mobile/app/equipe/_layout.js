import React from 'react';
import { Pressable, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { cor } from '../../src/lib/tema';

const icone = (txt) => {
  function IconeAba({ color }) { return <Text style={{ color, fontSize: 18 }}>{txt}</Text>; }
  return IconeAba;
};

export default function EquipeLayout() {
  const { sair, perfil } = useAuth();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: cor.fundo },
        headerTintColor: cor.texto,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: { backgroundColor: cor.cartao, borderTopColor: cor.borda },
        tabBarActiveTintColor: cor.azulClaro,
        tabBarInactiveTintColor: cor.apagado,
        sceneStyle: { backgroundColor: cor.fundo },
        headerRight: () => (
          <Pressable onPress={sair} hitSlop={10} style={{ marginRight: 16 }}>
            <Text style={{ color: cor.suave }}>{perfil?.username ? `${perfil.username} · ` : ''}Sair</Text>
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen name="hoje" options={{ title: 'OS de hoje', tabBarLabel: 'Hoje', tabBarIcon: icone('🗓') }} />
      <Tabs.Screen name="mapa" options={{ title: 'Técnicos no mapa', tabBarLabel: 'Mapa', tabBarIcon: icone('📍') }} />
      <Tabs.Screen name="consulta" options={{ title: 'Consultar veículo', tabBarLabel: 'Consulta', tabBarIcon: icone('🔎') }} />
      <Tabs.Screen name="cadastro" options={{ title: 'Cadastro', tabBarLabel: 'Cadastro', tabBarIcon: icone('＋') }} />
    </Tabs>
  );
}
