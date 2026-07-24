import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Footer from '@/components/Footer';
import { 
  FaMapMarkedAlt, FaShieldAlt, FaChartLine, FaServer, FaTimes, 
  FaDesktop, FaMicrochip, FaSatellite, FaSignal, FaThermometerHalf, FaSlidersH 
} from 'react-icons/fa';

export default function Solutions() {
  const [activeTab, setActiveTab] = useState('services');
  const [activeModal, setActiveModal] = useState(null);
  const [activeImageModal, setActiveImageModal] = useState(null);

  const panelImages = [
    {
      src: "/images/rastreamento.jpeg",
      alt: "Painel de Rastreamento FullVision",
      icon: <FaDesktop className="text-blue-500 text-sm" />,
      label: "Módulo de Rastreamento",
      title: "Rastreamento em Tempo Real",
      description: "Visualize toda a sua frota em um único mapa dinâmico com atualização contínua de posições. O módulo de rastreamento exibe dados de telemetria ao vivo — velocidade, status do motor, nível de bateria e muito mais — diretamente sobre cada veículo.",
      features: [
        "Mapa interativo com suporte a visão de arruamento e satélite.",
        "Painel inferior com lista detalhada de todos os veículos da frota.",
        "Indicadores de status: ignição, movimento, parado, sleep mode.",
        "Dados de RPM, temperatura do motor, odômetro e bateria em tempo real.",
        "Filtros por grupo de veículos, motorista ou status operacional."
      ]
    },
    {
      src: "/images/roteirizacao.png",
      alt: "Painel de Roteirização FullVision",
      icon: <FaMapMarkedAlt className="text-blue-500 text-sm" />,
      label: "Módulo de Roteirização",
      title: "Planejamento e Otimização de Rotas",
      description: "Planeje, otimize e acompanhe rotas de entrega e logística em tempo real. O módulo calcula trajetos eficientes, estima horários de chegada e monitora desvios, garantindo redução de custos operacionais e cumprimento de prazos.",
      features: [
        "Criação automática de sequências de paradas otimizadas.",
        "Acompanhamento em tempo real do progresso de cada rota.",
        "Alertas de atraso, desvio de rota e paradas não programadas.",
        "Histórico completo de viagens para auditoria e relatórios de desempenho.",
        "Integração com o módulo de rastreamento para validação de entregas."
      ]
    }
  ];

  const services = [
    {
      id: 'telemetria',
      title: 'Telemetria Avançada',
      icon: <FaChartLine className="text-3xl text-blue-500" />,
      shortDesc: 'Monitoramento detalhado do comportamento do veículo e motorista.',
      fullDesc: 'Nossa solução de Telemetria Avançada coleta dados em tempo real sobre consumo de combustível, frenagens brutas, acelerações e tempo de ociosidade. Com isso, sua empresa reduz custos de manutenção e melhora a segurança na rodovia.'
    },
    {
      id: 'roteirizacao',
      title: 'Roteirização Inteligente',
      icon: <FaMapMarkedAlt className="text-3xl text-blue-500" />,
      shortDesc: 'Otimização de rotas para redução de custos e tempo de viagem.',
      fullDesc: 'O módulo de Roteirização Inteligente utiliza algoritmos avançados para calcular as rotas mais eficientes, levando em consideração trânsito, capacidade de carga e janelas de entrega. Economize combustível e cumpra seus prazos com precisão.'
    },
    {
      id: 'seguranca',
      title: 'Gestão de Risco e Segurança',
      icon: <FaShieldAlt className="text-3xl text-blue-500" />,
      shortDesc: 'Proteção total para sua carga e veículo com alertas em tempo real.',
      fullDesc: 'Oferecemos recursos como bloqueio remoto, sensores de abertura de porta, botão de pânico e alertas de violação de perímetro (cerca virtual). Garantia de proteção máxima para operações de alto valor.'
    },
    {
      id: 'infraestrutura',
      title: 'Infraestrutura dedicada',
      icon: <FaServer className="text-3xl text-blue-500" />,
      shortDesc: 'Servidores de alta performance com disponibilidade de 99.9%.',
      fullDesc: 'Garantimos estabilidade total para a sua operação. Nossos servidores funcionam em nuvem redundante com alta velocidade de processamento, assegurando que seus dados de frota estejam sempre acessíveis.'
    }
  ];

  const hardwares = [
    {
      title: "Full tracker (FT)",
      desc: "Rastreador compacto de alta precisão ideal para frotas leves e veículos comerciais.",
      features: ["Sinal GPS/GPRS de alta sensibilidade", "Bateria interna de backup", "Instalação rápida e discreta"],
      icon: <FaMicrochip className="text-3xl text-blue-500" />
    },
    {
      title: "Full Tracker Plus (FT-P)",
      desc: "Solução completa para telemetria avançada e integração com múltiplos sensores.",
      features: ["Entradas digitais e analógicas", "Leitura de CAN bus / OBD2", "Bloqueio progressivo de segurança"],
      icon: <FaSatellite className="text-3xl text-blue-500" />
    },
    {
      title: "Full Tracker Smart (FT-S)",
      desc: "Equipamento robusto com suporte a conectividade híbrida e sensores inteligentes.",
      features: ["Conectividade 4G / IoT", "Sensor de aceleração 3D (G-Sensor)", "Alertas de impacto e tombamento"],
      icon: <FaSignal className="text-3xl text-blue-500" />
    },
    {
      title: "Smart Full Tracker Plus (FT-SP)",
      desc: "A tecnologia mais avançada para operações complexas, transporte de carga e cadeia de frio.",
      features: ["Suporte a sensores de temperatura e umidade", "Identificação de motorista via iButton / RFID", "Múltiplas saídas para atuadores"],
      icon: <FaThermometerHalf className="text-3xl text-blue-500" />
    }
  ];

  return (
    <>
      <Head>
        <title>Soluções | FULL VISION</title>
        <meta name="description" content="Conheça as soluções em rastreamento, telemetria e gestão de frotas da FULL VISION." />
      </Head>

      <div className="min-h-screen bg-gray-950 text-white flex flex-col justify-between">
        <main className="flex-grow container mx-auto px-4 py-12">
          
          {/* Cabeçalho da Página */}
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h1 className="text-3xl md:text-5xl font-extrabold mb-4 text-white">
              Nossas <span className="text-blue-500">Soluções</span>
            </h1>
            <p className="text-gray-400 text-sm md:text-base leading-relaxed">
              Tecnologia de ponta em rastreamento e gestão logística para transformar a eficiência da sua frota.
            </p>
          </div>

          {/* Navegação por Abas */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <button
              onClick={() => setActiveTab('services')}
              className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'services'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Nossos Serviços
            </button>

            {/* Ocultado temporariamente conforme solicitado */}
            {/* <button
              onClick={() => setActiveTab('panel')}
              className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'panel'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Nosso Painel Web
            </button>
            */}

            <button
              onClick={() => setActiveTab('hardware')}
              className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'hardware'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Catálogo de Hardware
            </button>
          </div>

          {/* Conteúdo Aba 1: Nossos Serviços */}
          {activeTab === 'services' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {services.map((item) => (
                <div 
                  key={item.id}
                  className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 hover:border-blue-500/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="mb-4">{item.icon}</div>
                    <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-gray-400 text-xs leading-relaxed mb-4">{item.shortDesc}</p>
                  </div>
                  <button
                    onClick={() => setActiveModal(item)}
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 self-start border-b border-blue-500/30 pb-0.5"
                  >
                    Saiba mais →
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Conteúdo Aba 2: Nosso Painel Web */}
          {activeTab === 'panel' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {panelImages.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveImageModal(idx)}
                  className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1 cursor-pointer group shadow-xl"
                >
                  <div className="bg-gray-950 px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {img.icon}
                      <span className="text-xs font-medium text-gray-300">{img.label}</span>
                    </div>
                    <span className="text-[10px] text-blue-400 font-semibold group-hover:underline">Clique para expandir 🔍</span>
                  </div>
                  <div className="relative overflow-hidden bg-black/40">
                    <img 
                      src={img.src} 
                      alt={img.alt} 
                      className="w-full h-64 object-cover object-top group-hover:scale-105 transition-transform duration-500" 
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="text-base font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{img.title}</h3>
                    <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed">{img.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Conteúdo Aba 3: Catálogo de Hardware */}
          {activeTab === 'hardware' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {hardwares.map((hw, idx) => (
                <div key={idx} className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 hover:border-blue-500/50 transition-all flex flex-col justify-between">
                  <div>
                    <div className="mb-4">{hw.icon}</div>
                    <h3 className="text-lg font-bold text-white mb-2">{hw.title}</h3>
                    <p className="text-gray-400 text-xs leading-relaxed mb-4">{hw.desc}</p>
                    <ul className="space-y-2 mb-4">
                      {hw.features.map((feat, fIdx) => (
                        <li key={fIdx} className="text-xs text-gray-300 flex items-start gap-2">
                          <span className="text-blue-500">✓</span> {feat}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Banner CTA Final */}
          <div className="mt-20 bg-gradient-to-r from-blue-900/40 via-blue-800/20 to-gray-900 border border-blue-500/30 rounded-2xl p-8 md:p-12 text-center relative overflow-hidden">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">
              Pronto para transformar a sua operação?
            </h2>
            <p className="text-gray-300 max-w-2xl mx-auto mb-8 text-sm md:text-base leading-relaxed">
              Entre em contato com nossos especialistas e descubra como a FULL VISION pode elevar o nível da sua frota com tecnologia de ponta.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-semibold transition-all shadow-lg shadow-blue-500/30"
            >
              Falar com um Especialista
            </Link>
          </div>

        </main>

        {/* Modal de Serviço */}
        {activeModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-6 relative">
              <button 
                onClick={() => setActiveModal(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white p-2"
              >
                <FaTimes />
              </button>
              <div className="mb-4">{activeModal.icon}</div>
              <h3 className="text-xl font-bold text-white mb-3">{activeModal.title}</h3>
              <p className="text-gray-300 text-sm leading-relaxed mb-6">{activeModal.fullDesc}</p>
              <button 
                onClick={() => setActiveModal(null)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        {/* Modal de Imagem Expandida */}
        {activeImageModal !== null && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-4xl w-full overflow-hidden relative">
              <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                <div className="flex items-center gap-2">
                  {panelImages[activeImageModal].icon}
                  <span className="font-semibold text-sm text-white">{panelImages[activeImageModal].title}</span>
                </div>
                <button
                  onClick={() => setActiveImageModal(null)}
                  className="text-gray-400 hover:text-white bg-white/5 hover:bg-red-500/20 p-2 rounded-full transition-all duration-200"
                >
                  <FaTimes size={16} />
                </button>
              </div>

              <img
                src={panelImages[activeImageModal].src}
                alt={panelImages[activeImageModal].alt}
                className="w-full object-cover max-h-[60vh]"
              />

              <div className="p-6 border-t border-gray-800">
                <p className="text-gray-300 text-sm leading-relaxed mb-4">{panelImages[activeImageModal].description}</p>
                <h4 className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-3">Funcionalidades do Módulo:</h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {panelImages[activeImageModal].features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-gray-300">
                      <span className="text-blue-500 font-bold shrink-0">✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <Footer />
      </div>
    </>
  );
}