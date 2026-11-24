// Equipe: OS abertas e as de hoje, agrupadas por técnico, atualizando ao vivo
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { CAMPOS_OS } from '../../src/lib/osEquipe';
import { osCodigo } from '../../src/lib/osConstants';
import { dataBR, horaBR, hojeISO } from '../../src/lib/formato';
import { Cartao, Carregando, Chip, Vazio, s } from '../../src/lib/ui';
import { cor } from '../../src/lib/tema';

const STATUS = {
  aberta: { txt: 'Aberta', cor: cor.ambar },
  finalizada: { txt: 'Finalizada', cor: cor.verde },
};

export default function Hoje() {
  const [ordens, setOrdens] = useState(null);
  const [erro, setErro] = useState('');
  const [atualizando, setAtualizando] = useState(false);
  const [filtro, setFiltro] = useState('todas');
  const [aviso, setAviso] = useState(null);

  const carregar = useCallback(async () => {
    setAtualizando(true);
    const hoje = hojeISO();
    const { data, error } = await supabase.from('ordens_servico').select(CAMPOS_OS)
      .or(`status.eq.aberta,data.eq.${hoje}`).order('data', { ascending: true }).limit(300);
    if (error) setErro(error.message); else { setOrdens(data || []); setErro(''); }
    setAtualizando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial dos dados
    carregar();
    // Ao vivo: qualquer mudança em OS recarrega; OS finalizada mostra um aviso
    const canal = supabase.channel('os-hoje')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, (p) => {
        if (p.eventType === 'UPDATE' && p.new?.status === 'finalizada' && p.old?.status !== 'finalizada') {
          setAviso(`${p.new.tecnico_nome || 'Técnico'} finalizou ${osCodigo(p.new.id)}`);
          setTimeout(() => setAviso(null), 8000);
        }
        carregar();
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [carregar]);

  const grupos = useMemo(() => {
    const lista = (ordens || []).filter(o => filtro === 'todas' || (filtro === 'abertas' ? o.status === 'aberta' : o.status !== 'aberta'));
    const mapa = new Map();
    lista.forEach(o => {
      const k = o.tecnico_nome || 'Sem técnico';
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(o);
    });
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [ordens, filtro]);

  const abertas = (ordens || []).filter(o => o.status === 'aberta').length;
  const feitasHoje = (ordens || []).filter(o => o.status !== 'aberta').length;

  if (!ordens && !erro) return <Carregando />;
  return (
    <ScrollView style={s.tela} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={atualizando} onRefresh={carregar} tintColor={cor.azulClaro} />}>
      {aviso && <Cartao style={{ borderColor: cor.verde, marginBottom: 12 }}><Text style={{ color: cor.verde, fontWeight: '700' }}>✓ {aviso}</Text></Cartao>}
      {erro ? <Text style={{ color: cor.vermelho, marginBottom: 12 }}>{erro}</Text> : null}
      <View style={[s.linha, { gap: 8, marginBottom: 16, flexWrap: 'wrap' }]}>
        <Chip texto={`Todas (${(ordens || []).length})`} ativo={filtro === 'todas'} onPress={() => setFiltro('todas')} />
        <Chip texto={`Abertas (${abertas})`} ativo={filtro === 'abertas'} onPress={() => setFiltro('abertas')} />
        <Chip texto={`Finalizadas hoje (${feitasHoje})`} ativo={filtro === 'feitas'} onPress={() => setFiltro('feitas')} />
      </View>
      {grupos.length === 0 && <Vazio texto="Nenhuma OS aberta ou de hoje." />}
      {grupos.map(([tecnico, lista]) => (
        <View key={tecnico} style={{ marginBottom: 18 }}>
          <Text style={{ color: cor.texto, fontWeight: '700', fontSize: 16, marginBottom: 8 }}>
            {tecnico} <Text style={{ color: cor.apagado, fontWeight: '400' }}>· {lista.filter(o => o.status !== 'aberta').length}/{lista.length} feitas</Text>
          </Text>
          {lista.map(o => {
            const st = STATUS[o.status] || { txt: o.status, cor: cor.suave };
            return (
              <Pressable key={o.id} onPress={() => router.push(`/os/${o.id}`)}>
                <Cartao style={{ marginBottom: 8, padding: 12 }}>
                  <View style={[s.linha, { justifyContent: 'space-between' }]}>
                    <Text style={{ color: cor.texto2, fontWeight: '600', flex: 1 }} numberOfLines={1}>{o.empresas?.nome || 'Cliente'}</Text>
                    <Text style={{ color: st.cor, fontWeight: '700', fontSize: 12 }}>{st.txt}</Text>
                  </View>
                  <Text style={{ color: cor.suave, marginTop: 4 }}>
                    {o.veiculos?.placa || o.placa_texto || 'Placa nova'} · {o.servico_realizado || 'Serviço'}
                  </Text>
                  <Text style={{ color: cor.apagado, fontSize: 12, marginTop: 4 }}>
                    {osCodigo(o.id)} · {dataBR(o.data)}{o.horario_previsto ? ` ${horaBR(o.horario_previsto)}` : ''}{o.finalizada_em ? ` · finalizada ${horaBR(o.finalizada_em)}` : ''}
                  </Text>
                </Cartao>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}
