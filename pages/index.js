import Head from 'next/head';
import Redirect from "@/components/Redirect";
import Slider from "@/components/Slider";
import HomeImage from "@/components/Hero";
import { SliderData } from "@/components/SliderData";
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <div className="bg-[#000000] min-h-screen flex flex-col overflow-hidden text-white">
      <Head>
        <title>Início | FullVision Tracking</title>
        <meta name="description" content="Gestão de operação logística e segurança da frota." />
      </Head>

      <main className="flex-grow">
        {/* 1. Slider Original */}
        <div data-aos="fade-down" data-aos-duration="1000">
          <Slider slides={SliderData} />
        </div>

        {/* 2. Hero / Banner Original */}
        <div data-aos="fade-up" data-aos-delay="150">
          <HomeImage 
            heading='Fullvision Tracking' 
            message='Gestão de operação logística e segurança da frota em tempo real.' 
          />
        </div>

        {/* NOVA SEÇÃO: 3. Barra de Números / Prova Social (Gera Autoridade Imediata) */}
        <div data-aos="fade-up" data-aos-delay="200" className="w-full bg-[#111111] py-12 border-y border-gray-800">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <h3 className="text-4xl font-bold text-blue-500 mb-2">+500</h3>
              <p className="text-gray-400">Veículos Monitorados</p>
            </div>
            <div>
              <h3 className="text-4xl font-bold text-blue-500 mb-2">24h</h3>
              <p className="text-gray-400">Central de Pronta Resposta</p>
            </div>
            <div>
              <h3 className="text-4xl font-bold text-blue-500 mb-2">99%</h3>
              <p className="text-gray-400">Eficiência na Recuperação</p>
            </div>
          </div>
        </div>

        {/* NOVA SEÇÃO: 4. Problema vs Solução (Cards de Serviço) */}
        <div className="max-w-7xl mx-auto px-4 py-20">
          <div className="text-center mb-16" data-aos="fade-up">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Inteligência e Tecnologia para sua Frota</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Muito mais que rastreamento. Oferecemos controle total, redução de custos e segurança para a sua operação logística.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div data-aos="fade-up" data-aos-delay="100" className="bg-[#111111] p-8 rounded-lg border border-gray-800 hover:border-blue-500 transition-colors">
              <div className="text-blue-500 text-3xl mb-4">📍</div>
              <h3 className="text-xl font-bold mb-3">Telemetria Avançada</h3>
              <p className="text-gray-400">Acompanhe RPM, hodômetro, frenagens bruscas e consumo de combustível em tempo real.</p>
            </div>
            
            {/* Card 2 */}
            <div data-aos="fade-up" data-aos-delay="200" className="bg-[#111111] p-8 rounded-lg border border-gray-800 hover:border-blue-500 transition-colors">
              <div className="text-blue-500 text-3xl mb-4">🚚</div>
              <h3 className="text-xl font-bold mb-3">Roteirização Inteligente</h3>
              <p className="text-gray-400">Otimize as rotas da sua equipe, reduzindo custos com pedágio e tempo de deslocamento.</p>
            </div>

            {/* Card 3 */}
            <div data-aos="fade-up" data-aos-delay="300" className="bg-[#111111] p-8 rounded-lg border border-gray-800 hover:border-blue-500 transition-colors">
              <div className="text-blue-500 text-3xl mb-4">💻</div>
              <h3 className="text-xl font-bold mb-3">Painel Web Exclusivo</h3>
              <p className="text-gray-400">Gestão completa na palma da mão. Emita relatórios gerenciais com poucos cliques.</p>
            </div>
          </div>
        </div>

        {/* 5. Card de Acesso à Plataforma Original (Redirect) */}
        <div data-aos="zoom-in" className="w-full flex justify-center items-center my-16 px-4">
          <Redirect />
        </div>

      </main>

      <Footer />
    </div>
  )
}