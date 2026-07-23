import React from 'react';
import { FiMonitor } from 'react-icons/fi';
import { BsBoxArrowUpRight } from 'react-icons/bs';

const Redirect = () => {
  return (
    <div id='trackapp' className="w-full max-w-5xl bg-gradient-to-r from-[#111111] via-[#161616] to-[#111111] border border-gray-800 hover:border-blue-500/50 rounded-2xl p-8 md:p-12 shadow-2xl transition-all duration-500 relative overflow-hidden group mx-auto my-12">
      
      {/* Luz subtil de fundo azul (efeito glow no hover) */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl group-hover:bg-blue-600/20 transition-all duration-500 pointer-events-none" />

      <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
        
        {/* Lado Esquerdo: Ícone + Textos */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
          {/* Caixa do Ícone com tom azul transparente */}
          <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-500 shrink-0">
            <FiMonitor className="text-4xl" />
          </div>

          <div>
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Acesse à plataforma de rastreamento
            </h3>
            <p className="text-gray-400 max-w-xl text-base leading-relaxed">
              Acompanhe a sua frota em tempo real, aceda a relatórios de gestão e controle a telemetria num único painel.
            </p>
          </div>
        </div>

        {/* Lado Direito: Botão de Ação */}
        <a
          href="https://tracker.fullvision.one/v1/home"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 shadow-lg shadow-blue-600/20 hover:shadow-blue-500/40 hover:scale-105 shrink-0 w-full md:w-auto"
        >
          <span>Full Vision Tracker</span>
          <BsBoxArrowUpRight className="text-xl font-bold" />
        </a>

      </div>
    </div>
  );
};

export default Redirect;