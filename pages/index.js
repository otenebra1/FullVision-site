import Head from 'next/head';
import Redirect from "@/components/Redirect";
import Slider from "@/components/Slider";
import HomeImage from "@/components/Hero";
import { SliderData } from "@/components/SliderData";
import Footer from '@/components/Footer';

// Ícones que instalamos
import { FiActivity, FiMap, FiMonitor } from 'react-icons/fi';

export default function Home() {
  return (
    <div className="bg-[#000000] min-h-screen flex flex-col overflow-hidden text-white">
      <Head>
        <title>Início | FullVision Tracking</title>
        <meta name="description" content="Gestão de operação logística e segurança da frota em tempo real." />
      </Head>

      <main className="flex-grow">
        
        {/* 1. SLIDER NO TOPO (Agora será a única coisa no início) */}
        <div data-aos="fade-down" data-aos-duration="1000">
          <Slider slides={SliderData} />
        </div>

        {/* 2. BARRA DE ESTATÍSTICAS (Logo abaixo do slider) */}
        <div data-aos="fade-up" data-aos-delay="150" className="w-full bg-[#111111] py-12 border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <h3 className="text-4xl font-bold text-blue-500 mb-2">+300</h3>
              <p className="text-gray-400">Veículos Monitorados</p>
            </div>
            <div>
              <h3 className="text-4xl font-bold text-blue-500 mb-2">24h</h3>
              <p className="text-gray-400">Suporte e Pronta Resposta</p>
            </div>
            <div>
              <h3 className="text-4xl font-bold text-blue-500 mb-2">99,9%</h3>
              <p className="text-gray-400">Disponibilidade do Sistema</p>
            </div>
          </div>
        </div>

        {/* 3. CARDS DE SERVIÇOS */}
        <div className="max-w-7xl mx-auto px-4 py-20">
          <div className="text-center mb-16" data-aos="fade-up">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Inteligência e Tecnologia para sua Frota</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Muito mais que rastreamento. Oferecemos controle total, redução de custos e segurança para a sua operação logística.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div data-aos="fade-up" data-aos-delay="100" className="group bg-[#111111] p-8 rounded-lg border border-gray-800 hover:border-blue-500 transition-colors cursor-default">
              <FiActivity className="text-blue-500 text-5xl mb-6 transform group-hover:scale-110 transition-transform duration-300" />
              <h3 className="text-xl font-bold mb-3">Telemetria Avançada</h3>
              <p className="text-gray-400">Acompanhe RPM, hodômetro, frenagens bruscas e consumo de combustível em tempo real.</p>
            </div>
            
            <div data-aos="fade-up" data-aos-delay="200" className="group bg-[#111111] p-8 rounded-lg border border-gray-800 hover:border-blue-500 transition-colors cursor-default">
              <FiMap className="text-blue-500 text-5xl mb-6 transform group-hover:scale-110 transition-transform duration-300" />
              <h3 className="text-xl font-bold mb-3">Roteirização Inteligente</h3>
              <p className="text-gray-400">Otimize as rotas da sua equipe, reduzindo custos com pedágio e tempo de deslocamento.</p>
            </div>

            <div data-aos="fade-up" data-aos-delay="300" className="group bg-[#111111] p-8 rounded-lg border border-gray-800 hover:border-blue-500 transition-colors cursor-default">
              <FiMonitor className="text-blue-500 text-5xl mb-6 transform group-hover:scale-110 transition-transform duration-300" />
              <h3 className="text-xl font-bold mb-3">Painel Web Exclusivo</h3>
              <p className="text-gray-400">Gestão completa na palma da mão. Emita relatórios gerenciais com poucos cliques.</p>
            </div>
          </div>
        </div>

        {/* 4. IMAGEM FIXA REPOSICIONADA (Agora serve como um banner de impacto no meio da página) */}
        <div data-aos="fade-up">
          <HomeImage 
            heading='Controle absoluto em qualquer lugar' 
            message='Plataforma em nuvem robusta para frotas de todos os tamanhos.' 
          />
        </div>

        {/* 5. CARD DE ACESSO À PLATAFORMA */}
        <div data-aos="zoom-in" className="w-full flex justify-center items-center my-16 px-4">
          <Redirect />
        </div>

      </main>

      <Footer />
    </div>
  )
}