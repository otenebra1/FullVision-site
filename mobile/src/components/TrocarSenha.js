// Primeiro acesso: o login veio com senha inicial e precisa de uma senha própria
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Botao, Campo, s } from '../lib/ui';
import { cor } from '../lib/tema';

export default function TrocarSenha() {
  const { sair } = useAuth();
  const [senha, setSenha] = useState('');
  const [repete, setRepete] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setErro('');
    if (senha.length < 8) { setErro('A nova senha precisa ter pelo menos 8 caracteres.'); return; }
    if (senha.toLowerCase().includes('fullvision')) { setErro('Escolha uma senha diferente da senha inicial.'); return; }
    if (senha !== repete) { setErro('As duas senhas não são iguais.'); return; }
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha, data: { trocar_senha: false } });
    setSalvando(false);
    if (error) setErro(error.message);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.centro, { alignItems: 'stretch' }]}>
      <Text style={{ color: cor.texto, fontSize: 22, fontWeight: '700' }}>Crie sua senha</Text>
      <Text style={{ color: cor.suave, marginTop: 6, marginBottom: 24 }}>Este é seu primeiro acesso. Troque a senha inicial por uma só sua.</Text>
      <Campo rotulo="Nova senha" value={senha} onChangeText={setSenha} secureTextEntry />
      <Campo rotulo="Repita a nova senha" value={repete} onChangeText={setRepete} secureTextEntry />
      {erro ? <Text style={{ color: cor.vermelho, marginBottom: 12 }}>{erro}</Text> : null}
      <Botao titulo="Salvar senha" onPress={salvar} carregando={salvando} />
      <Botao titulo="Sair" tipo="secundario" onPress={sair} style={{ marginTop: 12 }} />
    </KeyboardAvoidingView>
  );
}
