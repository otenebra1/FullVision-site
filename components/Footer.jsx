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

  // Lógica Automática: Cria as páginas fatiando a lista de 2 em 2
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
    <footer className="bg-gray-950 text-white py-12 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          {/* Coluna 1: Sobre a Empresa */}
          <div>
            <h3 className="text-xl font-bold text-blue-500 mb-4">FULL VISION</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Tecnologia avançada em rastreamento, telemetria e gestão inteligente de frotas para otimizar sua operação.
            </p>
          </div>

          {/* Coluna 2: Links Rápidos */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-white">Links Rápidos</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="/" className="hover:text-blue-500 transition-colors">Início</a></li>
              <li><a href="/solutions" className="hover:text-blue-500 transition-colors">Soluções</a></li>
              <li><a href="/about" className="hover:text-blue-500 transition-colors">Sobre Nós</a></li>
              <li><a href="/contact" className="hover:text-blue-500 transition-colors">Contato</a></li>
            </ul>
          </div>

          {/* Coluna 3: Contato */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-white">Contato</h4>
            <p className="text-gray-400 text-sm mb-2">Email: contato@fullvision.one</p>
            <p className="text-gray-400 text-sm mb-2">Atendimento comercial e suporte técnico.</p>
          </div>

          {/* Coluna 4: Parceiros Carousel */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-white">Nossos Parceiros</h4>
            <div className="relative h-20 w-full bg-gray-900/50 rounded-lg p-2 overflow-hidden flex items-center justify-center">
              {duplas.map((dupla, index) => (
                <div
                  key={index}
                  className={`absolute top-0 left-0 w-full h-full flex items-center justify-center gap-6 px-6 transition-opacity duration-1000 ease-in-out ${
                    index === currentDupla ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
                  }`}
                >
                  {dupla.map((parceiro, itemIdx) => (
                    <div key={itemIdx} className='relative w-1/2 max-w-[180px] h-[70px]'>
                      <Image 
                        src={parceiro.image} 
                        alt={parceiro.name} 
                        fill
                        className='object-contain filter hover:brightness-125 transition-all duration-300' 
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Indicadores do Slider */}
            <div className='flex gap-2 mt-4 self-center md:self-start z-10 justify-center md:justify-start'>
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

        {/* Linha de Copyright */}
        <div className="border-t border-gray-800 pt-8 text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} FULL VISION. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;