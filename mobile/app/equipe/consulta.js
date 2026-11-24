// Equipe: consulta por placa ou serial → veículo, rastreador e histórico de OS (com o local de instalação)
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { lerComCamera } from '../../src/lib/leitor';
import { CAMPOS_OS } from '../../src/lib/osEquipe';
import { normalizaPlaca, osCodigo } from '../../src/lib/osConstants';
import { dataBR } from '../../src/lib/formato';
import { Botao, Campo, Cartao, Vazio, s } from '../../src/lib/ui';
import { cor } from '../../src/lib/tema';

function Info({ rotulo, valor }) {
  if (!valor) return null;
  return <Text style={{ color: cor.texto2, marginTop: 4 }}><Text style={{ color: cor.apagado }}>{rotulo}: </Text>{valor}</Text>;
}

export default function Consulta() {
  const [busca, setBusca] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  const pesquisar = async (texto = busca) => {
    const alvo = normalizaPlaca(texto);
    if (alvo.length < 3) return;
    setBuscando(true); setErro('');
    try {
      // Placa (com ou sem traço) ou serial do rastreador
      let { data: veiculos } = await supabase.from('veiculos').select('id, placa, modelo, status, operacao, id_instalado, data_inst, empresa_id, empresas(nome)').ilike('placa', `%${alvo}%`).limit(10);
      veiculos = (veiculos || []).filter(v => normalizaPlaca(v.placa).includes(alvo));
      if (!veiculos.length) {
        const { data: rs } = await supabase.from('rastreadores').select('veiculo_id, serial').ilike('serial', `%${alvo}%`).not('veiculo_id', 'is', null).limit(5);
        const ids = (rs || []).map(r => r.veiculo_id);
        if (ids.length) {
          const { data: vs } = await supabase.from('veiculos').select('id, placa, modelo, status, operacao, id_instalado, data_inst, empresa_id, empresas(nome)').in('id', ids);
          veiculos = vs || [];
        }
      }
      const ids = veiculos.map(v => v.id);
      const [{ data: osVeic }, { data: osTexto }, { data: rastr }] = await Promise.all([
        ids.length ? supabase.from('ordens_servico').select(CAMPOS_OS).in('veiculo_id', ids).order('data', { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
        supabase.from('ordens_servico').select(CAMPOS_OS).ilike('placa_texto', `%${alvo}%`).order('data', { ascending: false }).limit(50),
        ids.length ? supabase.from('rastreadores').select('id, serial, modelo, status, veiculo_id, sim_card, operadora').in('veiculo_id', ids) : Promise.resolve({ data: [] }),
      ]);
      const ordens = [...(osVeic || []), ...(osTexto || [])].filter((o, i, a) => a.findIndex(x => x.id === o.id) === i)
        .sort((a, b) => String(b.data).localeCompare(String(a.data)));
      setResultado({ veiculos, ordens, rastreadores: rastr || [] });
    } catch (e) { setErro(e.message); }
    setBuscando(false);
  };

  const lerPlaca = async () => { const v = await lerComCamera(router, 'placa'); setBusca(v); pesquisar(v); };
  const lerSerial = async () => { const v = await lerComCamera(router, 'serial'); setBusca(v); pesquisar(v); };

  return (
    <ScrollView style={s.tela} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Campo rotulo="Placa ou serial" value={busca} onChangeText={t => setBusca(t.toUpperCase())} autoCapitalize="characters" onSubmitEditing={() => pesquisar()} returnKeyType="search" />
      <View style={[s.linha, { marginBottom: 16 }]}>
        <Botao titulo="Buscar" onPress={() => pesquisar()} carregando={buscando} style={{ flex: 1 }} />
        <Botao titulo="Ler placa" tipo="secundario" onPress={lerPlaca} />
        <Botao titulo="Ler serial" tipo="secundario" onPress={lerSerial} />
      </View>
      {erro ? <Text style={{ color: cor.vermelho }}>{erro}</Text> : null}

      {resultado && resultado.veiculos.length === 0 && resultado.ordens.length === 0 && <Vazio texto="Nada encontrado para essa placa ou serial." />}

      {resultado?.veiculos.map(v => (
        <Cartao key={v.id} style={{ marginBottom: 12 }}>
          <Text style={{ color: cor.texto, fontSize: 20, fontWeight: '700', letterSpacing: 1 }}>{v.placa}</Text>
          <Info rotulo="Cliente" valor={v.empresas?.nome} />
          <Info rotulo="Modelo" valor={v.modelo} />
          <Info rotulo="Operação" valor={v.operacao} />
          <Info rotulo="Status" valor={v.status} />
          <Info rotulo="Instalado em" valor={v.data_inst ? dataBR(v.data_inst) : null} />
          {resultado.rastreadores.filter(r => r.veiculo_id === v.id).map(r => (
            <Info key={r.id} rotulo="Rastreador" valor={`${r.serial}${r.modelo ? ` (${r.modelo})` : ''}${r.operadora ? ` · ${r.operadora}` : ''}`} />
          ))}
          {!resultado.rastreadores.some(r => r.veiculo_id === v.id) && <Info rotulo="ID instalado" valor={v.id_instalado} />}
        </Cartao>
      ))}

      {resultado?.ordens.length > 0 && <Text style={{ color: cor.texto, fontWeight: '700', fontSize: 16, marginVertical: 8 }}>Histórico de OS ({resultado.ordens.length})</Text>}
      {resultado?.ordens.map(o => (
        <Pressable key={o.id} onPress={() => router.push(`/os/${o.id}`)}>
          <Cartao style={{ marginBottom: 8, padding: 12 }}>
            <View style={[s.linha, { justifyContent: 'space-between' }]}>
              <Text style={{ color: cor.texto2, fontWeight: '600' }}>{dataBR(o.data)} · {o.servico_realizado || 'Serviço'}</Text>
              <Text style={{ color: o.status === 'aberta' ? cor.ambar : cor.verde, fontSize: 12, fontWeight: '700' }}>{o.status === 'aberta' ? 'Aberta' : 'Finalizada'}</Text>
            </View>
            <Text style={{ color: cor.suave, marginTop: 4 }}>📍 {o.local_instalacao || 'Local não informado'}</Text>
            {o.regioes_mexidas?.length ? <Text style={{ color: cor.apagado, fontSize: 12, marginTop: 4 }}>Mexeu em: {o.regioes_mexidas.join(', ')}</Text> : null}
            <Text style={{ color: cor.apagado, fontSize: 12, marginTop: 4 }}>{osCodigo(o.id)} · {o.tecnico_nome || 'Sem técnico'}</Text>
          </Cartao>
        </Pressable>
      ))}
    </ScrollView>
  );
}
