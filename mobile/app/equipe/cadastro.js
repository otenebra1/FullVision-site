// Equipe: cadastro rápido de cliente e de veículo pelo celular (sem valores em R$)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { lerComCamera } from '../../src/lib/leitor';
import { normalizaPlaca } from '../../src/lib/osConstants';
import { dataDigitadaParaISO, mascaraData } from '../../src/lib/formato';
import Escolher from '../../src/components/Escolher';
import { Botao, Campo, Chip, s } from '../../src/lib/ui';
import { cor } from '../../src/lib/tema';

const VEICULO_VAZIO = { empresaId: '', placa: '', modelo: '', operacao: '', status: 'Ativo', idInstalado: '', dataInst: '' };

export default function Cadastro() {
  const [aba, setAba] = useState('veiculo');
  const [empresas, setEmpresas] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [cliente, setCliente] = useState({ nome: '', grupoId: '' });
  const [v, setV] = useState(VEICULO_VAZIO);
  const muda = (campo) => (valor) => setV(p => ({ ...p, [campo]: valor }));

  const carregarEmpresas = useCallback(async () => {
    const { data } = await supabase.from('empresas').select('id, nome, grupo_id').order('nome');
    setEmpresas(data || []);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial dos dados
  useEffect(() => { carregarEmpresas(); }, [carregarEmpresas]);

  const opcoesEmpresa = useMemo(() => empresas.map(e => ({ value: e.id, label: e.nome })), [empresas]);
  const opcoesGrupo = useMemo(() => [{ value: '', label: 'Nenhum (cliente principal)' }, ...empresas.filter(e => !e.grupo_id).map(e => ({ value: e.id, label: e.nome }))], [empresas]);

  const salvarCliente = async () => {
    const nome = cliente.nome.trim();
    if (!nome) return;
    if (empresas.some(e => e.nome.trim().toLowerCase() === nome.toLowerCase())) { Alert.alert('Cliente já existe', `Já há um cliente chamado ${nome}.`); return; }
    setSalvando(true);
    const { error } = await supabase.from('empresas').insert([{ nome, grupo_id: cliente.grupoId || null }]);
    setSalvando(false);
    if (error) { Alert.alert('Erro ao salvar cliente', error.message); return; }
    Alert.alert('Cliente criado', nome);
    setCliente({ nome: '', grupoId: '' });
    carregarEmpresas();
  };

  const salvarVeiculo = async () => {
    const placa = normalizaPlaca(v.placa);
    if (!v.empresaId) { Alert.alert('Falta o cliente', 'Escolha o cliente do veículo.'); return; }
    if (placa.length < 7) { Alert.alert('Placa', 'Informe a placa completa.'); return; }
    const dataInst = v.dataInst ? dataDigitadaParaISO(v.dataInst) : null;
    if (v.dataInst && !dataInst) { Alert.alert('Data', 'Use o formato DD/MM/AAAA.'); return; }
    setSalvando(true);
    const { data: parecidas } = await supabase.from('veiculos').select('id, placa, empresas(nome)').ilike('placa', `${placa.slice(0, 3)}%${placa.slice(3)}`).limit(5);
    const existe = (parecidas || []).filter(x => normalizaPlaca(x.placa) === placa);
    if (existe?.length) {
      setSalvando(false);
      Alert.alert('Placa já cadastrada', `A placa ${placa} já está em ${existe[0].empresas?.nome || 'outro cliente'}.`);
      return;
    }
    const { error } = await supabase.from('veiculos').insert([{
      empresa_id: v.empresaId, placa, modelo: v.modelo.trim() || null, operacao: v.operacao.trim() || null,
      status: v.status, id_instalado: v.idInstalado.trim() || null, data_inst: dataInst,
    }]);
    setSalvando(false);
    if (error) { Alert.alert('Erro ao salvar veículo', error.message); return; }
    Alert.alert('Veículo cadastrado', placa);
    setV(p => ({ ...VEICULO_VAZIO, empresaId: p.empresaId }));
  };

  return (
    <KeyboardAvoidingView style={s.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <View style={[s.linha, { marginBottom: 16 }]}>
          <Chip texto="Novo veículo" ativo={aba === 'veiculo'} onPress={() => setAba('veiculo')} />
          <Chip texto="Novo cliente" ativo={aba === 'cliente'} onPress={() => setAba('cliente')} />
        </View>

        {aba === 'cliente' ? (
          <>
            <Campo rotulo="Nome do cliente" value={cliente.nome} onChangeText={t => setCliente(p => ({ ...p, nome: t }))} />
            <Escolher rotulo="Faz parte de um grupo?" valor={cliente.grupoId} opcoes={opcoesGrupo} onChange={g => setCliente(p => ({ ...p, grupoId: g }))} placeholder="Nenhum (cliente principal)" />
            <Botao titulo="Salvar cliente" onPress={salvarCliente} carregando={salvando} desativado={!cliente.nome.trim()} />
            <Text style={[s.dica, { marginTop: 12 }]}>Contrato e valores continuam no painel do site.</Text>
          </>
        ) : (
          <>
            <Escolher rotulo="Cliente" valor={v.empresaId} opcoes={opcoesEmpresa} onChange={muda('empresaId')} />
            <Campo rotulo="Placa" value={v.placa} onChangeText={t => muda('placa')(t.toUpperCase())} autoCapitalize="characters"
              direita={<Botao titulo="Ler" tipo="secundario" onPress={async () => muda('placa')(normalizaPlaca(await lerComCamera(router, 'placa')))} />} />
            <Campo rotulo="Modelo" value={v.modelo} onChangeText={muda('modelo')} placeholder="Ex.: Volvo FH 540" />
            <Campo rotulo="Operação" value={v.operacao} onChangeText={muda('operacao')} />
            <Text style={s.rotulo}>Status</Text>
            <View style={[s.linha, { marginBottom: 14 }]}>
              {['Ativo', 'Inativo'].map(st => <Chip key={st} texto={st} ativo={v.status === st} onPress={() => muda('status')(st)} />)}
            </View>
            <Campo rotulo="ID instalado (serial do rastreador)" value={v.idInstalado} onChangeText={muda('idInstalado')} autoCapitalize="characters"
              direita={<Botao titulo="Ler" tipo="secundario" onPress={async () => muda('idInstalado')(await lerComCamera(router, 'serial'))} />} />
            <Campo rotulo="Data de instalação" value={v.dataInst} onChangeText={t => muda('dataInst')(mascaraData(t))} keyboardType="number-pad" placeholder="DD/MM/AAAA" />
            <Botao titulo="Salvar veículo" onPress={salvarVeiculo} carregando={salvando} />
            <Text style={[s.dica, { marginTop: 12 }]}>Mensalidade, custos e fotos do veículo continuam no painel do site.</Text>
          </>
        )}
        <View style={{ height: 24 }} />
        <Text style={{ color: cor.apagado, fontSize: 12 }}>Dica: depois de salvar, o veículo já aparece na Consulta e nas OS.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
