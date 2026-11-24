import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { Botao, Campo, s } from '../src/lib/ui';
import { cor } from '../src/lib/tema';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  const entrar = async () => {
    setErro('');
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEntrando(false);
    if (error) { setErro('E-mail ou senha incorretos.'); return; }
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.centro, { alignItems: 'stretch' }]}>
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <Image source={require('../assets/splash-icon.png')} style={{ width: 200, height: 120 }} resizeMode="contain" />
        <Text style={{ color: cor.suave, marginTop: 8 }}>Técnicos e equipe</Text>
      </View>
      <Campo rotulo="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Campo rotulo="Senha" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="password" onSubmitEditing={entrar} />
      {erro ? <Text style={{ color: cor.vermelho, marginBottom: 12 }}>{erro}</Text> : null}
      <Botao titulo="Entrar" onPress={entrar} carregando={entrando} desativado={!email || !senha} />
    </KeyboardAvoidingView>
  );
}
