// Leitor pela câmera.
//   modo=serial → lê código de barras/QR na hora; sem código, "Ler texto" usa OCR no próprio celular
//   modo=placa  → foto da placa + OCR, com filtro do formato de placa brasileira
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { entregarLeitura, cancelarLeitura, acharPlaca, acharSerial } from '../src/lib/leitor';
import { Botao, s } from '../src/lib/ui';
import { cor } from '../src/lib/tema';

let ocr = null;
try {
  // OCR (ML Kit) só existe no APK; no Expo Go o módulo não está disponível
  ocr = require('expo-text-extractor');
} catch {
  ocr = null;
}

const TIPOS_CODIGO = ['qr', 'code128', 'code39', 'code93', 'ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'codabar', 'datamatrix', 'pdf417'];

export default function Leitor() {
  const { modo = 'serial' } = useLocalSearchParams();
  const ehPlaca = modo === 'placa';
  const insets = useSafeAreaInsets();
  const [permissao, pedirPermissao] = useCameraPermissions();
  const camRef = useRef(null);
  const lidoRef = useRef(false);
  const [lendo, setLendo] = useState(false);
  const [opcoes, setOpcoes] = useState(null);
  const [aviso, setAviso] = useState('');

  const devolver = (valor) => {
    if (lidoRef.current) return;
    lidoRef.current = true;
    entregarLeitura(valor);
    router.back();
  };
  const fechar = () => { cancelarLeitura(); router.back(); };

  const lerTexto = async () => {
    if (!ocr?.extractTextFromImage || ocr.isSupported === false) {
      setAviso('A leitura de texto só funciona no app instalado (APK), não no Expo Go.');
      return;
    }
    setLendo(true); setAviso(''); setOpcoes(null);
    try {
      const foto = await camRef.current.takePictureAsync({ quality: 0.9 });
      const linhas = await ocr.extractTextFromImage(foto.uri);
      if (ehPlaca) {
        const placa = acharPlaca(linhas);
        if (placa) setOpcoes([placa]);
        else setAviso('Não achei uma placa. Aproxime e deixe a placa reta na tela.');
      } else {
        const lista = acharSerial(linhas).slice(0, 6);
        if (lista.length) setOpcoes(lista);
        else setAviso('Não achei um serial. Aproxime da etiqueta.');
      }
    } catch (e) {
      setAviso(`Não consegui ler: ${e.message}`);
    } finally {
      setLendo(false);
    }
  };

  if (!permissao) return <View style={s.tela} />;
  if (!permissao.granted) {
    return (
      <View style={s.centro}>
        <Text style={{ color: cor.texto, textAlign: 'center', marginBottom: 16 }}>Precisamos da câmera para ler {ehPlaca ? 'a placa' : 'o código'}.</Text>
        <Botao titulo="Permitir câmera" onPress={pedirPermissao} />
        <Botao titulo="Voltar" tipo="secundario" onPress={fechar} style={{ marginTop: 12 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        ref={camRef}
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={ehPlaca ? undefined : { barcodeTypes: TIPOS_CODIGO }}
        onBarcodeScanned={ehPlaca ? undefined : (r) => { if (r?.data) devolver(String(r.data).trim()); }}
      />

      {/* Moldura de mira */}
      <View pointerEvents="none" style={{ position: 'absolute', top: '32%', left: '8%', right: '8%', height: ehPlaca ? 110 : 160, borderColor: '#fff', borderWidth: 2, borderRadius: 12, opacity: 0.8 }} />

      <View style={{ position: 'absolute', top: insets.top + 12, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>{ehPlaca ? 'Ler placa' : 'Ler serial ou código'}</Text>
        <Pressable onPress={fechar} hitSlop={12}><Text style={{ color: '#fff', fontSize: 16 }}>Fechar</Text></Pressable>
      </View>

      <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 20, gap: 10 }}>
        {!ehPlaca && <Text style={{ color: '#e5e7eb', textAlign: 'center' }}>Aponte para o código de barras ou QR. Sem código, use “Ler texto”.</Text>}
        {aviso ? <Text style={{ color: cor.ambar, textAlign: 'center' }}>{aviso}</Text> : null}
        {opcoes && (
          <View style={{ backgroundColor: 'rgba(17,24,39,0.95)', borderRadius: 16, padding: 12, gap: 8 }}>
            <Text style={{ color: cor.suave }}>Toque no valor certo:</Text>
            {opcoes.map(o => (
              <Pressable key={o} onPress={() => devolver(o)} style={{ borderWidth: 1, borderColor: cor.azul, borderRadius: 10, padding: 12 }}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: 2, textAlign: 'center' }}>{o}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Pressable onPress={lerTexto} disabled={lendo} style={{ backgroundColor: cor.azul, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}>
          {lendo ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>{ehPlaca ? 'Ler placa' : 'Ler texto'}</Text>}
        </Pressable>
      </View>
    </View>
  );
}
