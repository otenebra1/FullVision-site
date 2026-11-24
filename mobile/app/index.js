// Decide a tela inicial pelo perfil do login
import React from 'react';
import { Redirect } from 'expo-router';
import { Text, View } from 'react-native';
import { useAuth, ehEquipe } from '../src/lib/auth';
import { Botao, Carregando, s } from '../src/lib/ui';
import { cor } from '../src/lib/tema';

export default function Inicio() {
  const { session, perfil, role, sair } = useAuth();
  if (!session) return <Redirect href="/login" />;
  if (!perfil) return <Carregando texto="Carregando seu perfil..." />;
  if (role === 'tecnico') return <Redirect href="/tecnico" />;
  if (ehEquipe(role)) return <Redirect href="/equipe/hoje" />;
  return (
    <View style={s.centro}>
      <Text style={{ color: cor.texto, fontSize: 17, textAlign: 'center', marginBottom: 16 }}>
        Este app é para a equipe e os técnicos da Full Vision. Clientes acessam pelo site, na Área do Cliente.
      </Text>
      <Botao titulo="Sair" tipo="secundario" onPress={sair} />
    </View>
  );
}
