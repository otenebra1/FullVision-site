import React, { useState, useEffect } from 'react';
import Image from 'next/image';

const Footer = () => {
  const partners = [
    { name: 'Parceiro 1', image: '/images/emp1.jpg' },
    { name: 'Parceiro 2', image: '/images/emp2.jpg' },
    { name: 'Parceiro 3', image: '/images/emp3.jpg' },
    { name: 'Parceiro 4', image: '/images/emp4.avif' },
    { name: 'Parceiro 5', image: '/images/emp5.png' },
    { name: 'Parceiro 6', image: '/images/emp6.png' },
    { name: 'Parceiro 7', image: '/images/emp7.png' },
    { name: 'Parceiro 8', image: '/images/emp8.png' },
    { name: 'Parceiro 9', image: '/images/emp9.jpeg' },
  ];

  // Lógica Automática: Cria as páginas fatiando a lista de 2 em 2 com segurança
  const duplas = [];
  for (let i = 0; i < partners.length; i += 2) {
    duplas.push(partners.slice(i, i + 2));
  }

  const [currentDupla, setCurrentDupla] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDupla((prev) => (prev + 1) % duplas.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [duplas.length]);

  return (
    <footer className='w-full bg-[#0a0a0a] text-white py-12 px-4 border-t border-gray-800 select-none'>
      <div className='max-w-[1240px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center'>
        
        {/* Coluna da Esquerda: Informações */}
        <div>
          <h3 className='text-2xl font-bold tracking-wider mb-3 border-l-4 border-blue-500 pl-3 uppercase'>
            FullVision
          </h3>
          <p className='text-gray-400 max-w-[420px] text-sm leading-relaxed'>
            Horizonte é o limite da sua visão? Não mais. Veja sua operação aonde quer que ela esteja com a máxima segurança e tecnologia de ponta.
          </p>
          <p className='text-xs text-gray-600 mt-6'>
            © {new Date().getFullYear()} FullVision. Todos os direitos reservados.
          </p>
        </div>

        {/* Coluna da Direita: Slider de Parceiros */}
        <div className='w-full flex flex-col items-center md:items-start'>
          <h4 className='text-xl font-semibold mb-4 text-gray-200 tracking-wide'>
            Clientes e Parceiros
          </h4>
          
          <div className='relative w-full max-w-[500px] h-[100px] bg-white/5 rounded-lg border border-white/10 overflow-hidden px-4 py-2'>
            {duplas.map((dupla, index) => (
              <div
                key={index}
                className={`absolute top-0 left-0 w-full h-full flex items-center justify-center gap-6 px-6 transition-opacity duration-1000 ease-in-out ${
                  index === currentDupla ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
                }`}
              >
                {/* Mapeia de forma dinâmica: se a página tiver só 1 logo, renderiza apenas ela perfeitamente centralizada */}
                {dupla.map((parceiro, itemIdx) => (
                  <div key={itemIdx} className='relative w-1/2 max-w-[180px] h-[70px]'>
                    <Image 
                      src={parceiro.image} 
                      alt={parceiro.name} 
                      layout='fill' 
                      objectFit='contain' 
                      className='filter hover:brightness-125 transition-all duration-300' 
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Indicadores do Slider */}
          <div className='flex gap-2 mt-4 self-center md:self-start z-10'>
            {duplas.map((_, idx) => (
              <span
                key={idx}
                onClick={() => setCurrentDupla(idx)}
                className={`h-2 rounded-full cursor-pointer transition-all duration-500 ${
                  idx === currentDupla ? 'bg-blue-500 w-8' : 'bg-gray-700 hover:bg-gray-500 w-2'
                }`}
              />
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;