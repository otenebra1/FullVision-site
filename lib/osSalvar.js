// lib/osSalvar.js
// Grava uma OS completa: OS, itens com valores, estoque de rastreadores, fotos e assinatura.

// Reduz a foto antes de enviar (fotos de celular passam de 4 MB; assim sobem rápido no 4G)
export async function reduzirImagem(file, maxLado = 1600, qualidade = 0.82) {
  try {
    if (typeof createImageBitmap !== 'function' || !file.type || !file.type.startsWith('image/')) return file;
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * escala);
    const h = Math.round(bmp.height * escala);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', qualidade));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.\w+$/, '')}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

const nomesDosServicos = (servicos) => servicos.map(s => s.nome).join(', ');

/**
 * d = {
 *   data, tecnico: { id, nome, email }, empresaId, servicos: [{ servicoId, nome, quantidade }],
 *   veiculoId, placaTexto, placaDoVeiculo,
 *   rastreadorInstaladoId, rastreadorInstaladoSerial, rastreadorRetiradoId, rastreadorRetiradoDestino,
 *   local, km, atendimentos, observacoes, problemas, checklist, regioes,
 *   calculo (resultado de calcularOS) | null, totaisManuais: { tecnico, cliente },
 *   fotos: { [tipo]: File }, fotoTipos: [{ key, label }], assinatura: Blob | null, assinanteNome, geo,
 * }
 */
export async function salvarOS(client, d, onProgress = () => {}) {
  const agora = new Date().toISOString();
  const calc = d.calculo;
  const novaPlaca = !d.veiculoId;

  const payload = {
    data: d.data,
    tecnico_id: d.tecnico.id || null,
    tecnico_nome: d.tecnico.nome,
    tecnico_email: d.tecnico.email || null,
    servico_realizado: nomesDosServicos(d.servicos),
    empresa_id: d.empresaId,
    veiculo_id: novaPlaca ? null : d.veiculoId,
    placa_texto: novaPlaca ? String(d.placaTexto || '').trim().toUpperCase() : null,
    rastreador_instalado_id: d.rastreadorInstaladoId || null,
    rastreador_retirado_id: d.rastreadorRetiradoId || null,
    local_instalacao: d.local || null,
    km_percorrido: d.km !== '' && d.km != null ? Number(d.km) : null,
    valor_km: null,
    atendimentos_mesmo_local: d.atendimentos || null,
    observacoes: d.observacoes || null,
    problemas_relatados: d.problemas || null,
    checklist_estado: d.checklist && Object.keys(d.checklist).length ? d.checklist : null,
    regioes_mexidas: d.regioes && d.regioes.length ? d.regioes : null,
    assinante_nome: d.assinanteNome || null,
    geo_lat: d.geo?.lat ?? null,
    geo_lng: d.geo?.lng ?? null,
    geo_precisao: d.geo?.precisao ?? null,
    finalizada_em: agora,
    custo_tecnico: calc ? calc.totalTecnico : Number(d.totaisManuais?.tecnico) || 0,
    faturamento_cliente: calc ? calc.totalCliente : Number(d.totaisManuais?.cliente) || 0,
    deslocamento_tecnico: calc ? calc.deslocamentoTecnico : 0,
    deslocamento_cliente: calc ? calc.deslocamentoCliente : 0,
  };

  onProgress('Salvando ordem de serviço...');
  const { data: os, error } = await client
    .from('ordens_servico').insert([payload]).select('*, empresas(nome), veiculos(placa)').single();
  if (error) throw new Error(error.message);

  const resultado = { os, rastreadores: [], veiculos: [], falhas: [] };

  // Valores por serviço (guardados com o preço da época: mudar a tabela depois não altera OS antigas)
  if (calc && calc.itens.length) {
    const { error: errItens } = await client.from('ordens_servico_itens').insert(calc.itens.map(i => ({
      ordem_servico_id: os.id,
      servico_id: i.servicoId || null,
      servico_nome: i.nome,
      quantidade: i.quantidade,
      valor_tecnico: i.valorTecnico,
      valor_cliente: i.valorCliente,
      origem_tecnico: i.origemTecnico,
      origem_cliente: i.origemCliente,
    })));
    if (errItens) resultado.falhas.push('valores por serviço');
  }

  // Estoque de rastreadores acompanha o que aconteceu na OS
  onProgress('Atualizando estoque de rastreadores...');
  if (d.rastreadorRetiradoId) {
    const { data: r } = await client.from('rastreadores').update({
      veiculo_id: null, placa_atual: null, status: d.rastreadorRetiradoDestino, localizacao_atual: d.tecnico.nome,
    }).eq('id', d.rastreadorRetiradoId).select().single();
    if (r) resultado.rastreadores.push(r);
  }
  if (d.rastreadorInstaladoId && !novaPlaca) {
    const { data: r } = await client.from('rastreadores').update({
      veiculo_id: d.veiculoId, placa_atual: d.placaDoVeiculo || null, status: 'instalado', localizacao_atual: null,
    }).eq('id', d.rastreadorInstaladoId).select().single();
    if (r) resultado.rastreadores.push(r);
    await client.from('veiculos').update({ id_instalado: d.rastreadorInstaladoSerial || null }).eq('id', d.veiculoId);
    resultado.veiculos.push({ id: d.veiculoId, id_instalado: d.rastreadorInstaladoSerial || null });
  } else if (d.rastreadorRetiradoId && !novaPlaca) {
    await client.from('veiculos').update({ id_instalado: null }).eq('id', d.veiculoId);
    resultado.veiculos.push({ id: d.veiculoId, id_instalado: null });
  }

  // Fotos
  for (const ft of d.fotoTipos) {
    const original = d.fotos[ft.key];
    if (!original) continue;
    onProgress(`Enviando foto: ${ft.curto || ft.label}...`);
    const file = await reduzirImagem(original);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${os.id}/${ft.key}-${Date.now()}.${ext}`;
    const { error: errUp } = await client.storage.from('os-fotos').upload(path, file);
    if (errUp) { resultado.falhas.push(ft.curto || ft.label); continue; }
    await client.from('ordens_servico_fotos').insert([{ ordem_servico_id: os.id, tipo: ft.key, storage_path: path }]);
  }

  // Assinatura do responsável
  if (d.assinatura) {
    onProgress('Enviando assinatura...');
    const path = `${os.id}/assinatura-${Date.now()}.png`;
    const { error: errAss } = await client.storage.from('os-fotos').upload(path, d.assinatura, { contentType: 'image/png' });
    if (errAss) resultado.falhas.push('assinatura');
    else {
      const url = client.storage.from('os-fotos').getPublicUrl(path).data.publicUrl;
      await client.from('ordens_servico').update({ assinatura_url: url }).eq('id', os.id);
      resultado.os = { ...os, assinatura_url: url };
    }
  }

  return resultado;
}
