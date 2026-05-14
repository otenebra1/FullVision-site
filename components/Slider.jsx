import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { SliderData } from './SliderData';
import { FaArrowCircleLeft, FaArrowCircleRight } from 'react-icons/fa';

const Slider = ({ slides }) => {
  const [current, setCurrent] = useState(0);
  const length = SliderData.length;

  const nextSlide = () => {
    setCurrent(current === length - 1 ? 0 : current + 1);
  };

  const prevSlide = () => {
    setCurrent(current === 0 ? length - 1 : current - 1);
  };

  // Auto-play: Passa as imagens automaticamente a cada 5 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      nextSlide();
    }, 5000);

    return () => clearInterval(timer);
  }, [current]);

  if (!Array.isArray(SliderData) || SliderData.length <= 0) {
    return null;
  }

  return (
    <div id='slider-banner' className='relative w-full h-[35vh] sm:h-[45vh] md:h-[55vh] lg:h-[60vh] mb-0 overflow-hidden mt-[90px]'>
      
      {/* Loop dos Slides */}
      {SliderData.map((slide, index) => {
        return (
          <div
            key={index}
            className={`absolute top-0 left-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
              index === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            {/* Imagem de base */}
            <Image
  src={slide.image}
  alt={slide.heading || `Slide ${index + 1}`}
  fill
  className='select-none object-cover object-center'
  priority={index === 0}
/>

            {/* Overlay escuro individual */}
            <div className='absolute inset-0 bg-black/40 z-[1]' />

            {/* Caixa de texto na camada superior */}
            {slide.heading && (
              /* COR ALTERADA: border-orange-500 para border-blue-500 */
              <div className='absolute bottom-[20%] left-[5%] md:left-[10%] max-w-[600px] text-white z-[2] p-4 md:p-6 bg-black/30 backdrop-blur-sm rounded-lg border-l-4 border-blue-500 select-none'>
                <h3 className='text-2xl md:text-4xl font-bold mb-2 drop-shadow-md'>
                  {slide.heading}
                </h3>
                <p className='text-sm md:text-lg text-gray-200 drop-shadow'>
                  {slide.desc}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Setas de Controle */}
      <FaArrowCircleLeft
        onClick={prevSlide}
        className='absolute top-[50%] left-[15px] md:left-[40px] translate-y-[-50%] text-white/60 hover:text-white cursor-pointer select-none z-20 transition-all duration-300 drop-shadow-md hover:scale-110'
        size={40}
      />

      <FaArrowCircleRight
        onClick={nextSlide}
        className='absolute top-[50%] right-[15px] md:right-[40px] translate-y-[-50%] text-white/60 hover:text-white cursor-pointer select-none z-20 transition-all duration-300 drop-shadow-md hover:scale-110'
        size={40}
      />

      {/* Indicadores / Botões Funcionais (Dots) */}
      <div className='absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-20'>
        {SliderData.map((_, idx) => (
          <span
            key={idx}
            onClick={() => setCurrent(idx)}
            /* COR ALTERADA: bg-orange-500 para bg-blue-500 */
            className={`h-2 rounded-full cursor-pointer transition-all duration-500 ${
              idx === current ? 'bg-blue-500 w-8' : 'bg-white/50 hover:bg-white w-2'
            }`}
            title={`Ir para o slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default Slider;