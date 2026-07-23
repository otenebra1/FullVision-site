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

        {/* 3. BARRA DE ESTATÍSTICAS */}
        <div data-aos="fade-up" data-aos-delay="150" className="w-full bg-[#111111] py-12 border-y border-gray-800 my-8">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <h3 className="text-4xl font-bold text-blue-500 mb-2">+500</h3>
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

        {/* 4. SEÇÃO DE DESTAQUE CORPORATIVA */}
        <div data-aos="fade-up" className="max-w-7xl mx-auto px-4 my-16">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#141414] to-[#0a0a0a] border border-gray-800/80 p-8 md:p-16 shadow-2xl">
            
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-600/15 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-500/10 rounded-full blur-[90px] pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
              
              <div className="lg:col-span-7 flex flex-col items-start text-left">
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-6">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                  Plataforma 100% em Nuvem
                </span>

                <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mb-6">
                  Controle absoluto da sua frota <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">em qualquer lugar</span>
                </h2>

                <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-2xl">
                  Uma plataforma robusta e intuitiva projetada para operações de todos os tamanhos. Acompanhe rotas, telemetria e segurança em tempo real com alta disponibilidade.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 w-full">
                  <div className="flex items-center gap-3 text-gray-300">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">✓</div>
                    <span className="text-sm font-medium">Monitoramento 24/7 sem interrupções</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-300">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">✓</div>
                    <span className="text-sm font-medium">Relatórios e alertas inteligentes</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-300">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">✓</div>
                    <span className="text-sm font-medium">Compatível com múltiplos hardwares</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-300">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">✓</div>
                    <span className="text-sm font-medium">Interface otimizada para Web e Mobile</span>
                  </div>
                </div>

                <a
                  href="https://tracker.fullvision.one/v1/home"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
                >
                  <span>Acessar Plataforma</span>
                  <BsBoxArrowUpRight className="text-sm" />
                </a>
              </div>

              <div className="lg:col-span-5 w-full">
                <div className="relative mx-auto max-w-md lg:max-w-none bg-[#111111]/80 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
                      <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block"></span>
                      <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block"></span>
                    </div>
                    <span className="text-xs text-gray-500 font-mono">tracker.fullvision.one</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-[#181818] rounded-xl border border-gray-800/60 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400">Frota Ativa</p>
                        <p className="text-xl font-bold text-white">99.9% Conectada</p>
                      </div>
                      <span className="px-2.5 py-1 bg-green-500/10 text-green-400 border border-green-500/20 text-xs rounded-full font-semibold">Online</span>
                    </div>

                    <div className="p-4 bg-[#181818] rounded-xl border border-gray-800/60 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400">Sua frota</p>
                        <p className="text-xl font-bold text-blue-400">+35% Otimizada</p>
                      </div>
                      <span className="text-xs text-gray-400">Telemetria Real</span>
                    </div>

                    <div className="p-4 bg-[#181818] rounded-xl border border-gray-800/60">
                      <p className="text-xs text-gray-400 mb-1">Status da Central</p>
                      <p className="text-sm text-gray-300">Pronta resposta ativa e monitoramento contínuo de riscos.</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </main>

      <Footer />
    </div>
  )
}