// Campo de escolha com busca (abre uma lista em tela cheia)
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { s } from '../lib/ui';
import { cor } from '../lib/tema';

const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Escolher({ rotulo, valor, opcoes, onChange, placeholder = 'Escolha...', vazio }) {
  const insets = useSafeAreaInsets();
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState('');
  const atual = opcoes.find(o => String(o.value) === String(valor));
  const filtradas = useMemo(() => opcoes.filter(o => norm(o.label).includes(norm(q))), [opcoes, q]);

  return (
    <View style={{ marginBottom: 14 }}>
      {rotulo ? <Text style={s.rotulo}>{rotulo}</Text> : null}
      <Pressable onPress={() => setAberto(true)} style={[s.input, { justifyContent: 'center' }]}>
        <Text style={{ color: atual ? cor.texto : cor.apagado, fontSize: 16 }}>{atual ? atual.label : placeholder}</Text>
      </Pressable>
      <Modal visible={aberto} animationType="slide" onRequestClose={() => setAberto(false)}>
        <View style={{ flex: 1, backgroundColor: cor.fundo, paddingTop: insets.top + 8, paddingBottom: insets.bottom }}>
          <View style={[s.linha, { paddingHorizontal: 16, marginBottom: 12 }]}>
            <TextInput autoFocus value={q} onChangeText={setQ} placeholder="Buscar..." placeholderTextColor={cor.apagado} style={[s.input, { flex: 1 }]} />
            <Pressable onPress={() => setAberto(false)} hitSlop={10}><Text style={{ color: cor.suave, fontSize: 16 }}>Fechar</Text></Pressable>
          </View>
          <FlatList
            data={filtradas}
            keyExtractor={o => String(o.value)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={{ color: cor.apagado, textAlign: 'center', padding: 24 }}>{vazio || 'Nada encontrado.'}</Text>}
            renderItem={({ item }) => (
              <Pressable onPress={() => { onChange(item.value); setAberto(false); setQ(''); }} style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: cor.borda }}>
                <Text style={{ color: String(item.value) === String(valor) ? cor.azulClaro : cor.texto, fontSize: 16 }}>{item.label}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
