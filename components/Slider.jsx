import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { FiActivity, FiMonitor, FiMap } from 'react-icons/fi';

const Slider = ({ slides }) => {
  const [current, setCurrent] = useState(0);
  const length = slides.length;

  const nextSlide = () => {
    setCurrent(current === length - 1 ? 0 : current + 1);
  };

  const prevSlide = () => {
    setCurrent(current === 0 ? length - 1 : current - 1);
  };

  useEffect(() => {
    const slideInterval = setInterval(() => {
      nextSlide();
    }, 6000);
    return () => clearInterval(slideInterval);
  }, [current, length]);

  if (!Array.isArray(slides) || slides.length <= 0) {
    return null;
  }

  return (
    <div id="gallery" className="relative w-full h-screen overflow-hidden bg-black">
      
      {/* Setas de Navegação do Slider */}
      <button
        onClick={prevSlide}
        className="absolute top-1/2 left-4 md:left-8 -translate-y-1/2 z-30 p-3 rounded-full bg-black/40 text-white/80 hover:text-white hover:bg-black/70 backdrop-blur-md transition-all duration-300 border border-white/10"
        aria-label="Slide anterior"
      >
        <FaChevronLeft size={20} />
      </button>

      <button
        onClick={nextSlide}
        className="absolute top-1/2 right-4 md:right-8 -translate-y-1/2 z-30 p-3 rounded-full bg-black/40 text-white/80 hover:text-white hover:bg-black/70 backdrop-blur-md transition-all duration-300 border border-white/10"
        aria-label="Próximo slide"
      >
        <FaChevronRight size={20} />
      </button>

      {/* Imagens do Slider */}
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`absolute top-0 left-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
            index === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
        >
          {index === current && (
            <div className="relative w-full h-full">
              <Image
                src={slide.image}
                alt="Full Vision Slide"
                fill
                priority={index === 0}
                className="object-cover brightness-50"
              />
              {/* Overlay suave para melhorar o contraste das caixas */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/40" />
            </div>
          )}
        </div>
      ))}

      {/* 3 CAIXAS SOBREPOSTAS SOBRE O SLIDER (DESIGN GLASSMORPHISM) */}
      <div className="absolute bottom-6 md:bottom-12 left-1/2 -translate-x-1/2 w-full max-w-7xl px-4 z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          
          {/* Caixa 1: Tracker */}
          <div className="bg-gray-950/70 backdrop-blur-md border border-gray-800/80 hover:border-blue-500/50 rounded-xl p-5 shadow-2xl transition-all duration-300 group hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                <FiActivity size={18} />
              </div>
              <h3 className="text-base font-bold text-white tracking-wide">Tracker</h3>
            </div>
            <p className="text-gray-300 text-xs leading-relaxed font-normal">
              Sistema de rastreamento de alta precisão com dados de telemetria em tempo real, localização contínua e total estabilidade operacional.
            </p>
          </div>

          {/* Caixa 2: Painel Web */}
          <div className="bg-gray-950/70 backdrop-blur-md border border-gray-800/80 hover:border-blue-500/50 rounded-xl p-5 shadow-2xl transition-all duration-300 group hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                <FiMonitor size={18} />
              </div>
              <h3 className="text-base font-bold text-white tracking-wide">Painel Web</h3>
            </div>
            <p className="text-gray-300 text-xs leading-relaxed font-normal">
              Interface moderna e intuitiva em formato grid. Visualização gerencial unificada para análise ágil de indicadores e tomada de decisões.
            </p>
          </div>

          {/* Caixa 3: Roteirizador */}
          <div className="bg-gray-950/70 backdrop-blur-md border border-gray-800/80 hover:border-blue-500/50 rounded-xl p-5 shadow-2xl transition-all duration-300 group hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                <FiMap size={18} />
              </div>
              <h3 className="text-base font-bold text-white tracking-wide">Roteirizador</h3>
            </div>
            <p className="text-gray-300 text-xs leading-relaxed font-normal">
              Otimização de trajetos e planejamento inteligente de rotas para reduzir combustível, otimizar tempo e assegurar cumprimento de prazos.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};

export default Slider;