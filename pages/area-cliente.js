import React, { useState } from 'react';
import Head from 'next/head';
import { 
  FaTruck, 
  FaCodeBranch, 
  FaCheckCircle, 
  FaSpinner, 
  FaClock, 
  FaCommentDots, 
  FaPaperPlane, 
  FaLock, 
  FaExternalLinkAlt 
} from 'react-icons/fa';

export default function AreaDoCliente() {
  // Estado para simular se o usuário está logado
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Estado das Etapas de Desenvolvimento (Alimentável via Banco de Dados futuramente)
  const [steps, setSteps] = useState([
    {
      id: 1,
      title: 'Módulo de Roteirização Avançada',
      description: 'Otimização de rotas com múltiplos pontos de parada e cálculo de consumo estimado.',
      status: 'completed', // completed | in_progress | planned
      progress: 100,
      badge: 'Concluído',
      comments: [
        { author: 'Cliente Silva Logistics', text: 'Ficou excelente! Ajudou bastante a reduzir o tempo de rota.' }
      ]
    },
    {
      id: 2,
      title: 'Gráfico Continuo de Sensores de Temperatura',
      description: 'Interligação dos pontos de telemetria de temperatura por linhas contínuas em tempo real.',
      status: 'in_progress',
      progress: 65,
      badge: 'Em Desenvolvimento',
      comments: [
        { author: 'Cliente Ad\'oro', text: 'Estamos aguardando essa funcionalidade para as placas TKH1J56!' }
      ]
    },
    {
      id: 3,
      title: 'Alerta Inteligente de Desvio de Rota & Sinistros 24h',
      description: 'Notificação instantânea para a central e app móvel em caso de parada não programada.',
      status: 'in_progress',
      progress: 35,
      badge: 'Em Desenvolvimento',
      comments: []
    },
    {
      id: 4,
      title: 'Relatórios Customizados em PDF/Excel',
      description: 'Exportação completa de histórico de paradas, velocidade e telemetria configurável.',
      status: 'planned',
      progress: 0,
      badge: 'Planejado',
      comments: []
    }
  ]);

  // Modal para ver detalhes e comentar
  const [selectedStep, setSelectedStep] = useState(null);
  const [newComment, setNewComment] = useState('');

  // Handler de Login
  const handleLogin = (e) => {
    e.preventDefault();
    if (email && password) {
      setIsLoggedIn(true);
    }
  };

  // Handler para adicionar comentário
  const handleAddComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const updatedSteps = steps.map((step) => {
      if (step.id === selectedStep.id) {
        return {
          ...step,
          comments: [
            ...step.comments,
            { author: email ? email.split('@')[0] : 'Cliente', text: newComment }
          ]
        };
      }
      return step;
    });

    setSteps(updatedSteps);
    // Atualiza o item selecionado para refletir o novo comentário na modal
    setSelectedStep({
      ...selectedStep,
      comments: [
        ...selectedStep.comments,
        { author: email ? email.split('@')[0] : 'Cliente', text: newComment }
      ]
    });
    setNewComment('');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Área do Cliente | Full Vision</title>
      </Head>

      <div className="max-w-6xl mx-auto">
        {!isLoggedIn ? (
          /* ================= TELA DE LOGIN ================= */
          <div className="max-w-md mx-auto bg-gray-900/80 border border-gray-800 rounded-2xl p-8 backdrop-blur-md shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                <FaLock className="text-2xl" />
              </div>
              <h1 className="text-2xl font-bold">Área do Cliente</h1>
              <p className="text-gray-400 text-sm mt-1">Acesse a plataforma de rastreio e acompanhe novos desenvolvimentos.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@empresa.com"
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Senha</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold py-3 rounded-lg shadow-lg shadow-blue-600/20 transition-all duration-300"
              >
                Entrar no Painel
              </button>
            </form>
          </div>
        ) : (
          /* ================= PAINEL DO CLIENTE LOGADO ================= */
          <div className="space-y-10">
            {/* Header com Boas-Vindas */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/60 border border-gray-800 rounded-2xl p-6 backdrop-blur-md">
              <div>
                <h1 className="text-2xl font-bold text-white">Bem-vindo à sua Área na Full Vision</h1>
                <p className="text-gray-400 text-sm mt-1">Acompanhe suas operações de rastreamento e participe da evolução dos nossos softwares.</p>
              </div>
              <button
                onClick={() => setIsLoggedIn(false)}
                className="self-start md:self-auto text-xs font-medium text-gray-400 hover:text-red-400 transition-colors border border-gray-700 hover:border-red-500/50 px-3 py-1.5 rounded-lg"
              >
                Sair da conta
              </button>
            </div>

            {/* SEÇÃO 1: ACESSO AO RASTREAMENTO */}
            <div className="bg-gradient-to-r from-blue-900/40 via-gray-900 to-gray-900 border border-blue-500/30 rounded-2xl p-6 md:p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
              <div className="space-y-2 max-w-xl">
                <span className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 text-xs font-semibold px-3 py-1 rounded-full border border-blue-500/20">
                  <FaTruck /> Plataforma de Rastreamento 24h
                </span>
                <h2 className="text-2xl font-bold">Acessar Sistema de Monitoramento</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Visualize sua frota em tempo real, relatórios de telemetria, rotas e alertas de segurança diretamente no portal oficial.
                </p>
              </div>
              <a
                href="https://tracker.fullvision.one/v1/home"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full md:w-auto inline-flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all duration-300 hover:scale-105"
              >
                Abrir Plataforma <FaExternalLinkAlt className="text-sm" />
              </a>
            </div>

            {/* SEÇÃO 2: ROADMAP DE DESENVOLVIMENTO INTERATIVO */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <FaCodeBranch className="text-blue-500" /> Central de Desenvolvimento & Entregas
                  </h2>
                  <p className="text-gray-400 text-sm">
                    Veja em tempo real em quais recursos nossa equipe está trabalhando e deixe seus comentários.
                  </p>
                </div>
              </div>

              {/* Grid das Etapas de Desenvolvimento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    onClick={() => setSelectedStep(step)}
                    className="bg-gray-900/70 border border-gray-800 hover:border-blue-500/50 rounded-2xl p-6 transition-all duration-300 cursor-pointer flex flex-col justify-between group shadow-lg hover:shadow-blue-500/5"
                  >
                    <div>
                      {/* Badge e Status */}
                      <div className="flex items-center justify-between mb-3">
                        {step.status === 'completed' && (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-500/20">
                            <FaCheckCircle /> {step.badge}
                          </span>
                        )}
                        {step.status === 'in_progress' && (
                          <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-500/20">
                            <FaSpinner className="animate-spin text-amber-400" /> {step.badge}
                          </span>
                        )}
                        {step.status === 'planned' && (
                          <span className="inline-flex items-center gap-1.5 bg-gray-800 text-gray-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-700">
                            <FaClock /> {step.badge}
                          </span>
                        )}

                        <span className="text-xs text-gray-400 flex items-center gap-1 group-hover:text-blue-400 transition-colors">
                          <FaCommentDots /> {step.comments.length} comentário(s)
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                        {step.title}
                      </h3>
                      <p className="text-gray-400 text-sm mt-2 line-clamp-2">
                        {step.description}
                      </p>
                    </div>

                    {/* Barra de Progresso Visual */}
                    <div className="mt-6">
                      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                        <span>Progresso da Etapa</span>
                        <span className="font-semibold text-gray-200">{step.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            step.status === 'completed'
                              ? 'bg-emerald-500'
                              : step.status === 'in_progress'
                              ? 'bg-blue-500'
                              : 'bg-gray-600'
                          }`}
                          style={{ width: `${step.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* MODAL / BOX INTERATIVO DE DETALHES E COMENTÁRIOS */}
            {selectedStep && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                  {/* Cabeçalho do Modal */}
                  <div className="flex justify-between items-start border-b border-gray-800 pb-4">
                    <div>
                      <span className="text-xs uppercase font-semibold text-blue-400 tracking-wider">
                        Detalhes do Desenvolvimento
                      </span>
                      <h3 className="text-xl font-bold mt-1 text-white">{selectedStep.title}</h3>
                    </div>
                    <button
                      onClick={() => setSelectedStep(null)}
                      className="text-gray-400 hover:text-white text-lg p-1"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Descrição e Progresso detalhado */}
                  <div className="space-y-4">
                    <p className="text-gray-300 text-sm leading-relaxed">{selectedStep.description}</p>
                    
                    <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
                      <div className="flex justify-between text-xs text-gray-400 mb-2">
                        <span>Status Atual</span>
                        <span className="font-semibold text-blue-400">{selectedStep.badge} ({selectedStep.progress}%)</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${selectedStep.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção de Comentários */}
                  <div className="border-t border-gray-800 pt-4 space-y-4">
                    <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                      <FaCommentDots className="text-blue-500" /> Feedback do Cliente ({selectedStep.comments.length})
                    </h4>

                    {/* Lista de Comentários */}
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                      {selectedStep.comments.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">Nenhum comentário enviado para esta etapa ainda. Seja o primeiro a opinar!</p>
                      ) : (
                        selectedStep.comments.map((c, i) => (
                          <div key={i} className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm">
                            <span className="font-semibold text-blue-400 text-xs block">{c.author}</span>
                            <p className="text-gray-300 text-xs mt-1">{c.text}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Form para Adicionar Comentário */}
                    <form onSubmit={handleAddComment} className="flex gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Escreva sua sugestão ou comentário sobre esta etapa..."
                        className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <FaPaperPlane /> Enviar
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}