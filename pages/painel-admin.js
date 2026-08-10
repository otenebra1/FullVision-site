import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import {
  FaTruck, FaCheckCircle, FaTimesCircle, FaBuilding, FaMoneyBillWave,
  FaTools, FaSpinner, FaArrowLeft, FaChartPie, FaLayerGroup, FaExclamationCircle,
} from 'react-icons/fa';

// ==========================================
// Card de estatística do topo do dashboard
// ==========================================
function StatCard({ icon, label, value, colorClass }) {
  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${colorClass}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-gray-400 uppercase font-semibold">{label}</div>
      </div>
    </div>
  );
}

// ==========================================
// Linha de resumo (usada tanto pro grupo quanto pela unidade filha)
// ==========================================
function ResumoRow({ nome, isGrupo, total, ativos, inativos, mensalidade, custoTotal }) {
  return (
    <tr className={isGrupo ? 'bg-gray-800/60 font-semibold' : 'hover:bg-gray-800/40'}>
      <td className={`p-3 text-white ${isGrupo ? '' : 'pl-8 text-gray-300 font-normal'}`}>
        {isGrupo && <FaLayerGroup className="inline text-purple-400 mr-2" />}
        {nome}
      </td>
      <td className="p-3 text-gray-300">{total}</td>
      <td className="p-3 text-emerald-400">{ativos}</td>
      <td className="p-3 text-red-400">{inativos}</td>
      <td className="p-3 text-gray-300">
        {mensalidade.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </td>
      <td className="p-3 text-gray-300">
        {custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </td>
    </tr>
  );
}

export default function PainelAdmin() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [empresas, setEmpresas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // ------------------------------------------
  // Guard de acesso: só admin passa
  // ------------------------------------------
  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace('/area-cliente');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role !== 'admin') {
        router.replace('/area-cliente');
        return;
      }

      setIsAuthorized(true);
      setAuthChecked(true);
    };
    checkAccess();
  }, [router]);

  // ------------------------------------------
  // Carrega os dados do dashboard (só depois de autorizado)
  // ------------------------------------------
  useEffect(() => {
    if (!isAuthorized) return;

    const fetchData = async () => {
      setIsLoadingData(true);

      const { data: empresasData } = await supabase
        .from('empresas')
        .select('id, nome, grupo_id')
        .order('nome');
      if (empresasData) setEmpresas(empresasData);

      const { data: veiculosData } = await supabase
        .from('veiculos')
        .select('id, empresa_id, status, mensalidade, custo_total');
      if (veiculosData) setVeiculos(veiculosData);

      const { count } = await supabase
        .from('solicitacoes_servico')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente');
      setPendingRequestsCount(count || 0);

      setIsLoadingData(false);
    };
    fetchData();
  }, [isAuthorized]);

  // ------------------------------------------
  // Agregações
  // ------------------------------------------
  const stats = useMemo(() => {
    const ativos = veiculos.filter(v => v.status === 'Ativo').length;
    const inativos = veiculos.filter(v => v.status !== 'Ativo').length;
    const mensalidadeAtivaTotal = veiculos
      .filter(v => v.status === 'Ativo')
      .reduce((sum, v) => sum + (Number(v.mensalidade) || 0), 0);
    return { ativos, inativos, total: veiculos.length, mensalidadeAtivaTotal };
  }, [veiculos]);

  // Empresas "folha" (sem filhos) = unidades reais de cliente
  const empresaIdsComFilhos = useMemo(
    () => new Set(empresas.filter(e => e.grupo_id).map(e => e.grupo_id)),
    [empresas]
  );

  const clientesAtivos = useMemo(() => {
    const leafIds = empresas.filter(e => !empresaIdsComFilhos.has(e.id)).map(e => e.id);
    const comVeiculoAtivo = new Set(
      veiculos.filter(v => v.status === 'Ativo').map(v => v.empresa_id)
    );
    return leafIds.filter(id => comVeiculoAtivo.has(id)).length;
  }, [empresas, empresaIdsComFilhos, veiculos]);

  // Agrega veículos por empresa
  const resumoPorEmpresa = useMemo(() => {
    const map = {};
    empresas.forEach(e => {
      map[e.id] = { total: 0, ativos: 0, inativos: 0, mensalidade: 0, custoTotal: 0 };
    });
    veiculos.forEach(v => {
      const r = map[v.empresa_id];
      if (!r) return;
      r.total += 1;
      if (v.status === 'Ativo') { r.ativos += 1; r.mensalidade += Number(v.mensalidade) || 0; }
      else r.inativos += 1;
      r.custoTotal += Number(v.custo_total) || 0;
    });
    return map;
  }, [empresas, veiculos]);

  // Monta a hierarquia: grupos (com soma dos filhos) + clientes avulsos
  const hierarquia = useMemo(() => {
    const grupos = empresas.filter(e => !e.grupo_id && empresaIdsComFilhos.has(e.id));
    const avulsos = empresas.filter(e => !e.grupo_id && !empresaIdsComFilhos.has(e.id));

    const gruposComFilhos = grupos.map(g => {
      const filhos = empresas.filter(e => e.grupo_id === g.id);
      const somaGrupo = filhos.reduce((acc, f) => {
        const r = resumoPorEmpresa[f.id] || { total: 0, ativos: 0, inativos: 0, mensalidade: 0, custoTotal: 0 };
        return {
          total: acc.total + r.total,
          ativos: acc.ativos + r.ativos,
          inativos: acc.inativos + r.inativos,
          mensalidade: acc.mensalidade + r.mensalidade,
          custoTotal: acc.custoTotal + r.custoTotal,
        };
      }, { total: 0, ativos: 0, inativos: 0, mensalidade: 0, custoTotal: 0 });

      return { grupo: g, resumo: somaGrupo, filhos };
    });

    return { gruposComFilhos, avulsos };
  }, [empresas, empresaIdsComFilhos, resumoPorEmpresa]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <FaSpinner className="animate-spin text-3xl text-blue-500" />
      </div>
    );
  }

  if (!isAuthorized) return null; // já foi redirecionado

  return (
    <>
      <Head><title>Painel Administrativo | Full Vision</title></Head>
      <div className="min-h-screen bg-black text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Cabeçalho */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <FaChartPie className="text-purple-400" /> Painel Administrativo
              </h1>
              <p className="text-gray-400 text-sm mt-1">Visão geral da operação Full Vision</p>
            </div>
            <a href="/area-cliente" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-800 rounded-xl px-4 py-2">
              <FaArrowLeft /> Voltar pra Área do Cliente
            </a>
          </div>

          {isLoadingData ? (
            <div className="flex items-center justify-center py-24 text-gray-500">
              <FaSpinner className="animate-spin text-2xl mr-3" /> Carregando dados...
            </div>
          ) : (
            <>
              {/* Cards de resumo */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard icon={<FaTruck />} label="Veículos Ativos" value={stats.ativos} colorClass="bg-emerald-500/10 text-emerald-400" />
                <StatCard icon={<FaTimesCircle />} label="Veículos Inativos" value={stats.inativos} colorClass="bg-red-500/10 text-red-400" />
                <StatCard icon={<FaBuilding />} label="Clientes Ativos" value={clientesAtivos} colorClass="bg-blue-500/10 text-blue-400" />
                <StatCard
                  icon={<FaMoneyBillWave />}
                  label="Mensalidade Ativa (Total)"
                  value={stats.mensalidadeAtivaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                  colorClass="bg-amber-500/10 text-amber-400"
                />
                <a href="/area-cliente" className="block">
                  <StatCard icon={<FaTools />} label="Solicitações Pendentes" value={pendingRequestsCount} colorClass="bg-cyan-500/10 text-cyan-400" />
                </a>
              </div>

              {/* Resumo por cliente/grupo */}
              <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2"><FaBuilding className="text-blue-400" /> Resumo por Cliente</h2>
                <div className="border border-gray-800 rounded-xl overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-gray-950 text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Total</th>
                        <th className="p-3">Ativos</th>
                        <th className="p-3">Inativos</th>
                        <th className="p-3">Mensalidade Ativa</th>
                        <th className="p-3">Custo Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {hierarquia.gruposComFilhos.map(({ grupo, resumo, filhos }) => (
                        <React.Fragment key={grupo.id}>
                          <ResumoRow nome={grupo.nome} isGrupo {...resumo} />
                          {filhos.map(f => (
                            <ResumoRow key={f.id} nome={f.nome} isGrupo={false} {...(resumoPorEmpresa[f.id] || { total: 0, ativos: 0, inativos: 0, mensalidade: 0, custoTotal: 0 })} />
                          ))}
                        </React.Fragment>
                      ))}
                      {hierarquia.avulsos.map(e => (
                        <ResumoRow key={e.id} nome={e.nome} isGrupo={false} {...(resumoPorEmpresa[e.id] || { total: 0, ativos: 0, inativos: 0, mensalidade: 0, custoTotal: 0 })} />
                      ))}
                      {empresas.length === 0 && (
                        <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nenhuma empresa cadastrada.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}