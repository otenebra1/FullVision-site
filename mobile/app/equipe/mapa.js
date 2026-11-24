// Equipe: última posição de cada técnico (enviada pelo app dele), em mapa OpenStreetMap
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { supabase } from '../../src/lib/supabase';
import { haQuanto } from '../../src/lib/formato';
import { Botao, Carregando, s } from '../../src/lib/ui';
import { cor } from '../../src/lib/tema';

const html = (pontos) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0;background:#030712}.leaflet-popup-content{font:14px sans-serif}</style>
</head><body><div id="m"></div><script>
var pontos=${JSON.stringify(pontos)};
var m=L.map('m',{zoomControl:true});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m);
var b=[];
pontos.forEach(function(p){var c=L.circleMarker([p.lat,p.lng],{radius:9,color:'#fff',weight:2,fillColor:p.recente?'#2563eb':'#6b7280',fillOpacity:1}).addTo(m);
c.bindTooltip(p.nome,{permanent:true,direction:'top',offset:[0,-8]});c.bindPopup('<b>'+p.nome+'</b><br>'+p.quando);b.push([p.lat,p.lng]);});
if(b.length){m.fitBounds(b,{padding:[40,40],maxZoom:14});}else{m.setView([-22.9,-47.06],7);}
</script></body></html>`;

export default function Mapa() {
  const [linhas, setLinhas] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('tecnico_localizacao').select('*').order('tecnico_nome');
    if (error) setErro(/relation|does not exist/i.test(error.message) ? 'Falta rodar o SQL do app (20261124f_app_mobile.sql) no Supabase.' : error.message);
    else { setLinhas((data || []).map(l => ({ ...l, recente: Date.now() - new Date(l.atualizado_em).getTime() < 30 * 60 * 1000 }))); setErro(''); }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial dos dados
    carregar();
    const canal = supabase.channel('mapa-tecnicos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tecnico_localizacao' }, carregar)
      .subscribe();
    const t = setInterval(carregar, 60 * 1000);
    return () => { supabase.removeChannel(canal); clearInterval(t); };
  }, [carregar]);

  const pontos = useMemo(() => (linhas || []).map(l => ({
    nome: l.tecnico_nome || 'Técnico', lat: l.lat, lng: l.lng, quando: `Atualizado ${haQuanto(l.atualizado_em)}`,
    recente: l.recente,
  })), [linhas]);

  if (erro) return <View style={s.centro}><Text style={{ color: cor.vermelho, textAlign: 'center', marginBottom: 12 }}>{erro}</Text><Botao titulo="Tentar de novo" onPress={carregar} /></View>;
  if (!linhas) return <Carregando />;
  return (
    <View style={s.tela}>
      <WebView originWhitelist={['*']} source={{ html: html(pontos) }} style={{ flex: 1, backgroundColor: cor.fundo }} />
      <View style={{ padding: 12, borderTopWidth: 1, borderColor: cor.borda }}>
        <Text style={{ color: cor.suave, fontSize: 12 }}>
          {pontos.length ? `${pontos.length} técnico(s). Azul: posição dos últimos 30 min. Cinza: mais antiga. A posição só é enviada com o app do técnico aberto.` : 'Nenhum técnico enviou posição ainda. Ela aparece quando o técnico abre o app.'}
        </Text>
      </View>
    </View>
  );
}
