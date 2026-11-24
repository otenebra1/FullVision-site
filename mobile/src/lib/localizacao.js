// Técnico: envia a posição para a equipe ver no mapa (só com o app aberto)
import * as Location from 'expo-location';
import { api } from './api';

export async function enviarPosicao() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return false;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    await api('/api/tecnico/localizacao', {
      method: 'POST',
      body: JSON.stringify({ lat: loc.coords.latitude, lng: loc.coords.longitude, precisao: loc.coords.accuracy }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function posicaoAtual() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude, precisao: loc.coords.accuracy };
  } catch {
    return null;
  }
}
