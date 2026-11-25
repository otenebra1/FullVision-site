import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, Text } from 'react-native';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { CONFIG_FALTANDO } from '../src/lib/supabase';
import TrocarSenha from '../src/components/TrocarSenha';
import { cor } from '../src/lib/tema';
import { Carregando } from '../src/lib/ui';

function Raiz() {
  const { pronto, session, precisaTrocarSenha } = useAuth();
  if (!pronto) return <Carregando />;
  // Primeiro acesso com senha inicial: troca obrigatória antes de qualquer tela
  if (session && precisaTrocarSenha) return <TrocarSenha />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: cor.fundo },
        headerTintColor: cor.texto,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: cor.fundo },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="tecnico/index" options={{ title: 'Minhas OS' }} />
      <Stack.Screen name="tecnico/os/[id]" options={{ title: 'Finalizar OS' }} />
      <Stack.Screen name="equipe" options={{ headerShown: false }} />
      <Stack.Screen name="os/[id]" options={{ title: 'Ordem de serviço' }} />
      <Stack.Screen name="leitor" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
    </Stack>
  );
}

// Qualquer erro de tela aparece escrito em vez de fechar o app
export function ErrorBoundary({ error, retry }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: cor.fundo }} contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Text style={{ color: cor.texto, fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Algo deu errado</Text>
      <Text style={{ color: cor.suave, marginBottom: 16 }}>Tire um print desta tela e mande para o suporte.</Text>
      <Text selectable style={{ color: cor.vermelho, fontFamily: 'monospace', marginBottom: 24 }}>{String(error?.message || error)}</Text>
      <Text onPress={retry} style={{ color: cor.azulClaro, fontSize: 16 }}>Tentar de novo</Text>
    </ScrollView>
  );
}

function ConfigFaltando() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: cor.fundo }} contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Text style={{ color: cor.texto, fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Configuração faltando</Text>
      <Text style={{ color: cor.suave, marginBottom: 12 }}>Este APK foi gerado sem as variáveis abaixo. Cadastre no Expo (ambiente preview) e gere o APK de novo:</Text>
      {CONFIG_FALTANDO.map(v => <Text key={v} selectable style={{ color: cor.ambar, fontFamily: 'monospace', marginBottom: 6 }}>{v}</Text>)}
    </ScrollView>
  );
}

export default function Layout() {
  if (CONFIG_FALTANDO.length) return <><StatusBar style="light" /><ConfigFaltando /></>;
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Raiz />
    </AuthProvider>
  );
}
