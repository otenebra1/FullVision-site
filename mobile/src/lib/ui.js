// Componentes simples reaproveitados nas telas
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { cor, raio } from './tema';

export function Botao({ titulo, onPress, tipo = 'primario', desativado, carregando, icone, style }) {
  const estilos = {
    primario: { bg: cor.azul, fg: '#fff', borda: cor.azul },
    secundario: { bg: 'transparent', fg: cor.texto2, borda: cor.borda2 },
    perigo: { bg: 'transparent', fg: cor.vermelho, borda: cor.borda2 },
    sucesso: { bg: cor.verde, fg: '#fff', borda: cor.verde },
  }[tipo];
  return (
    <Pressable
      onPress={onPress}
      disabled={desativado || carregando}
      style={({ pressed }) => [s.botao, { backgroundColor: estilos.bg, borderColor: estilos.borda, opacity: desativado ? 0.45 : pressed ? 0.8 : 1 }, style]}
    >
      {carregando ? <ActivityIndicator color={estilos.fg} /> : (
        <View style={s.linha}>
          {icone}
          <Text style={[s.botaoTxt, { color: estilos.fg }]}>{titulo}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Campo({ rotulo, dica, style, direita, ...props }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {rotulo ? <Text style={s.rotulo}>{rotulo}</Text> : null}
      <View style={s.linha}>
        <TextInput placeholderTextColor={cor.apagado} style={[s.input, { flex: 1 }, props.multiline && { minHeight: 80, textAlignVertical: 'top' }]} {...props} />
        {direita}
      </View>
      {dica ? <Text style={s.dica}>{dica}</Text> : null}
    </View>
  );
}

export function Chip({ texto, ativo, onPress, aviso }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, ativo && s.chipAtivo]}>
      <Text style={[s.chipTxt, ativo && { color: '#fff' }]}>{texto}</Text>
      {aviso ? <Text style={s.chipAviso}>{aviso}</Text> : null}
    </Pressable>
  );
}

export function Cartao({ children, style }) {
  return <View style={[s.cartao, style]}>{children}</View>;
}

export function Titulo({ children, style }) {
  return <Text style={[s.titulo, style]}>{children}</Text>;
}

export function Vazio({ texto }) {
  return <Text style={s.vazio}>{texto}</Text>;
}

export function Carregando({ texto = 'Carregando...' }) {
  return (
    <View style={s.centro}>
      <ActivityIndicator color={cor.azulClaro} />
      <Text style={[s.dica, { marginTop: 8 }]}>{texto}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: cor.fundo },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  botao: { minHeight: 48, borderRadius: raio.m, borderWidth: 1, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  botaoTxt: { fontSize: 16, fontWeight: '600' },
  rotulo: { color: cor.suave, fontSize: 13, marginBottom: 6 },
  dica: { color: cor.apagado, fontSize: 12, marginTop: 4 },
  input: { backgroundColor: cor.cartao2, borderColor: cor.borda2, borderWidth: 1, borderRadius: raio.m, color: cor.texto, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: cor.borda2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  chipAtivo: { backgroundColor: 'rgba(37,99,235,0.18)', borderColor: cor.azul },
  chipTxt: { color: cor.texto2, fontSize: 14 },
  chipAviso: { color: cor.ambar, fontSize: 10, fontWeight: '700' },
  cartao: { backgroundColor: cor.cartao, borderColor: cor.borda, borderWidth: 1, borderRadius: raio.g, padding: 16 },
  titulo: { color: cor.texto, fontSize: 17, fontWeight: '700' },
  vazio: { color: cor.apagado, textAlign: 'center', paddingVertical: 48, fontSize: 14 },
});
