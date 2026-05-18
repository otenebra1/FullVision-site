import React from 'react';
import { FaShieldAlt, FaEye, FaRocket, FaGlobe } from 'react-icons/fa';

export default function About() {
  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen font-sans">
      
      {/* 1. SEÇÃO HERO */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 bg-gradient-to-b from-blue-950/20 to-transparent px-4">
        <div className="max-w-[1140px] mx-auto text-center">
          <span className="text-blue-500 font-bold text-xs uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full">
            Conheça a FullVision
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold mt-4 tracking-tight leading-tight max-w-[800px] mx-auto">
            Redefinindo os limites da <span className="text-blue-500">Visão Logística</span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg mt-6 max-w-[600px] mx-auto leading-relaxed">
            Nascemos com o propósito de transformar dados complexos em segurança palpável e eficiência milimétrica para a sua frota.
          </p>
        </div>
      </section>

      {/* 2. HISTÓRIA E CONCEITO */}
      <section className="py-16 px-4 max-w-[1140px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <div className="border-l-4 border-blue-500 pl-4">
            <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wide">Quem Somos</h2>
          </div>
          <p className="text-gray-300 text-sm md:text-base leading-relaxed">
            A <strong>FullVision</strong> foi criada para responder a um desafio crítico do mercado atual: a necessidade de controle total e preditivo sobre operações logísticas. Não somos apenas uma plataforma de rastreamento; somos a inteligência que protege o seu patrimônio.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed">
            Combinamos engenharia de software avançada com telemetria de ponta para garantir que, independentemente do tamanho da sua frota ou da distância da rota, você tenha uma visão completa, centralizada e em tempo real de cada quilômetro rodado.
          </p>
        </div>
        
        {/* Bloco Visual de Destaque (Substitui uma imagem estática por um design moderno de tecnologia) */}
        <div className="bg-gradient-to-br from-blue-600/10 to-blue-900/20 border border-blue-500/20 rounded-2xl p-8 flex flex-col justify-between h-[300px] shadow-lg shadow-blue-500/5 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="text-blue-500 text-4xl"><FaGlobe /></div>
          <div>
            <h3 className="text-xl font-bold mb-2">Presença e Monitoramento</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              Infraestrutura em nuvem de alta disponibilidade, garantindo estabilidade operacional para o gerenciamento de riscos a qualquer hora do dia.
            </p>
          </div>
        </div>
      </section>

      {/* 3. NOSSOS PILARES */}
      <section className="py-16 bg-white/5 border-y border-white/5 px-4">
        <div className="max-w-[1140px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wider">Nossos Valores Fundamentais</h2>
            <p className="text-gray-400 text-xs mt-2">Os princípios que guiam cada linha de código e decisão da nossa equipe.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Card 1 */}
            <div className="bg-[#121212] p-6 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all duration-300 group">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500 text-xl group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                <FaEye />
              </div>
              <h3 className="text-lg font-bold mt-4 mb-2">Visão Total</h3>
              <p className="text-gray-400 text-xs leading-relaxed">
                Transparência absoluta. Permitir que gestores acompanhem e entendam cada evento da rota sem delays ou ruídos de informação.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-[#121212] p-6 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all duration-300 group">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500 text-xl group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                <FaShieldAlt />
              </div>
              <h3 className="text-lg font-bold mt-4 mb-2">Segurança Preditiva</h3>
              <p className="text-gray-400 text-xs leading-relaxed">
                Mitigação de riscos ativa. Proteger motoristas, cargas e veículos através de alertas instantâneos e telemetria inteligente.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-[#121212] p-6 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all duration-300 group">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500 text-xl group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                <FaRocket />
              </div>
              <h3 className="text-lg font-bold mt-4 mb-2">Evolução Tecnológica</h3>
              <p className="text-gray-400 text-xs leading-relaxed">
                Inovação constante. Atualizar nossas ferramentas continuamente para que sua empresa use sempre o estado da arte em logística.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 4. SEÇÃO DE NÚMEROS (STATS) */}
      <section className="py-20 px-4 max-w-[1140px] mx-auto text-center">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          <div className="space-y-1">
            <span className="text-3xl md:text-5xl font-extrabold text-blue-500 tracking-tight">99.9%</span>
            <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Uptime do Servidor</p>
          </div>
          <div className="space-y-1">
            <span className="text-3xl md:text-5xl font-extrabold text-blue-500 tracking-tight">24/7</span>
            <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Monitoramento Ativo</p>
          </div>
          <div className="space-y-1">
            <span className="text-3xl md:text-5xl font-extrabold text-blue-500 tracking-tight">Oms</span>
            <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Latência de Telemetria</p>
          </div>
          <div className="space-y-1">
            <span className="text-3xl md:text-5xl font-extrabold text-blue-500 tracking-tight">+Precisão</span>
            <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Na Tomada de Decisão</p>
          </div>
        </div>
      </section>

    </div>
  );
}