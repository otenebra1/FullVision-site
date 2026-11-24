import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/lib/auth';
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

export default function Layout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Raiz />
    </AuthProvider>
  );
}
