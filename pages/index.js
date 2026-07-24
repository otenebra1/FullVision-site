import Head from 'next/head';
import Slider from "@/components/Slider";
import { SliderData } from "@/components/SliderData";
import Footer from '@/components/Footer';

// Ícones da biblioteca react-icons
import { FiActivity, FiMap, FiMonitor } from 'react-icons/fi';
import { BsBoxArrowUpRight } from 'react-icons/bs';

export default function Home() {
  return (
    <div className="bg-[#000000] min-h-screen flex flex-col overflow-hidden text-white">
      <Head>
        <title>Full Vision</title>
        <meta name="description" content="Gestão de operação logística e segurança da frota em tempo real." />
      </Head>

      <main className="flex-grow">
        
        {/* 1. SLIDER NO TOPO */}
        <div data-aos="fade-down" data-aos-duration="1000">
          <Slider slides={SliderData} />
        </div>

        {/* 2. CARDS DE SERVIÇO */}
        <div className="max-w-7xl mx-auto px-4 py-20">
          <div className="text-center mb-16" data-aos="fade-up">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Inteligência e Tecnologia para sua Frota</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Muito mais que rastreamento. Oferecemos controle total, redução de custos e segurança para a sua operação logística.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Box 1: Tracker */}
            <div data-aos="fade-up" data-aos-delay="0" className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-8 hover:border-blue-500/50 transition-all group">
              <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 transition-transform">
                <FiActivity size={24} />
              </div>
              <h3 className="text-xl font-bold mb-4">Tracker</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Nosso sistema de rastreamento de alta precisão oferece dados de telemetria em tempo real. Acompanhe a localização exata e o status dos veículos com estabilidade e máxima segurança.
              </p>
            </div>

            {/* Box 2: Painel Web */}
            <div data-aos="fade-up" data-aos-delay="100" className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-8 hover:border-blue-500/50 transition-all group">
              <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 transition-transform">
                <FiMonitor size={24} />
              </div>
              <h3 className="text-xl font-bold mb-4">Painel Web</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Uma interface moderna e intuitiva em formato grid. Tenha uma visão gerencial e operacional completa em uma única tela, desenhada para facilitar a análise de dados e a tomada de decisões.
              </p>
            </div>

            {/* Box 3: Roteirizador */}
            <div data-aos="fade-up" data-aos-delay="200" className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-8 hover:border-blue-500/50 transition-all group">
              <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 transition-transform">
                <FiMap size={24} />
              </div>
              <h3 className="text-xl font-bold mb-4">Roteirizador</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Otimize rotas, calcule trajetos eficientes e estime os horários de chegada. Reduza os custos de combustível e garanta o cumprimento dos prazos na sua operação logística de maneira automatizada.
              </p>
            </div>
          </div>
        </div>

        {/* 3. CTA DE ACESSO AO SISTEMA */}
        <div className="max-w-7xl mx-auto px-4 pb-20">
          <div data-aos="zoom-in" className="bg-gradient-to-r from-blue-900/40 via-blue-800/20 to-gray-900 border border-blue-500/30 rounded-2xl p-8 md:p-12 text-center flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-left max-w-2xl">
              <h2 className="text-2xl font-bold mb-2">Já é cliente Full Vision?</h2>
              <p className="text-gray-400 text-sm">Acesse nosso painel exclusivo e tenha o controle total na palma da mão.</p>
            </div>
            <a 
              href="https://tracker.fullvision.one/v1/home"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-semibold transition-all whitespace-nowrap shadow-lg shadow-blue-500/30"
            >
              Acessar Sistema <BsBoxArrowUpRight size={18} />
            </a>
          </div>
        </div>

      </main>
      
      <Footer />
    </div>
  );
}