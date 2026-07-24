import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { FiActivity, FiMonitor, FiMap } from 'react-icons/fi';

const cardData = [
  {
    id: 0,
    title: 'Tracker',
    icon: <FiActivity size={18} />,
    description: 'Sistema de rastreamento de alta precisão com dados de telemetria em tempo real, localização contínua e total estabilidade operacional.'
  },
  {
    id: 1,
    title: 'Painel Web',
    icon: <FiMonitor size={18} />,
    description: 'Interface moderna e intuitive em formato grid. Visualização gerencial unificada para análise ágil de indicadores e tomada de decisões.'
  },
  {
    id: 2,
    title: 'Roteirizador',
    icon: <FiMap size={18} />,
    description: 'Otimização de trajetos e planejamento inteligente de rotas para reduzir combustível, otimizar tempo e assegurar cumprimento de prazos.'
  }
];

const Slider = ({ slides }) => {
  const [current, setCurrent] = useState(0);
  const length = slides ? slides.length : cardData.length;

  // Tempo aumentado para 8 segundos (8000ms) para permitir leitura
  useEffect(() => {
    const slideInterval = setInterval(() => {
      setCurrent((prev) => (prev === length - 1 ? 0 : prev + 1));
    }, 8000);

    return () => clearInterval(slideInterval);
  }, [current, length]);

  const nextSlide = () => {
    setCurrent(current === length - 1 ? 0 : current + 1);
  };

  const prevSlide = () => {
    setCurrent(current === 0 ? length - 1 : current - 1);
  };

  const handleSelectCard = (index) => {
    setCurrent(index);
  };

  if (!Array.isArray(slides) || slides.length <= 0) {
    return null;
  }

  return (
    <div id="gallery" className="relative w-full h-screen overflow-hidden bg-black">
      
      {/* Setas de Navegação */}
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

      {/* Imagens de Fundo do Slider */}
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
                alt={`Full Vision Slide ${index + 1}`}
                fill
                priority={index === 0}
                className="object-cover brightness-50"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/40" />
            </div>
          )}
        </div>
      ))}

      {/* 3 CAIXAS INTERATIVAS SINCRONIZADAS COM O SLIDER */}
      <div className="absolute bottom-6 md:bottom-12 left-1/2 -translate-x-1/2 w-full max-w-7xl px-4 z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {cardData.map((card, idx) => {
            const isActive = idx === current;
            return (
              <div
                key={card.id}
                onClick={() => handleSelectCard(idx)}
                className={`cursor-pointer rounded-xl p-5 shadow-2xl transition-all duration-500 backdrop-blur-md border ${
                  isActive
                    ? 'bg-blue-950/40 border-blue-500 scale-[1.02] shadow-blue-500/20 ring-1 ring-blue-500/50'
                    : 'bg-gray-950/60 border-gray-800/80 hover:border-blue-500/40 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                      isActive 
                        ? 'bg-blue-500 text-white shadow-md shadow-blue-500/50' 
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {card.icon}
                    </div>
                    <h3 className={`text-base font-bold tracking-wide transition-colors ${
                      isActive ? 'text-white' : 'text-gray-200'
                    }`}>
                      {card.title}
                    </h3>
                  </div>

                  {/* Ponto indicador de seleção ativa */}
                  {isActive && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                  )}
                </div>

                <p className={`text-xs leading-relaxed transition-colors ${
                  isActive ? 'text-gray-100' : 'text-gray-400'
                }`}>
                  {card.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default Slider;