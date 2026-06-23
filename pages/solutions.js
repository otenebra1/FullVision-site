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

  const solutionsList = [
    {
      icon: <FaMapMarkedAlt className="text-blue-500 text-4xl mb-4" />,
      title: "Rastreamento em Tempo Real",
      description: "Acompanhe a localização exata da sua frota com atualização contínua e precisão de ponta para garantir o controlo total da operação logística de onde estiver.",
      details: [
        "Atualização contínua de posições com latência ultrabaixa via satélite e GSM.",
        "Histórico completo de rotas percorridas guardado em nuvem para auditorias.",
        "Visualização das condições de trânsito em direto para desvios estratégicos.",
        "Suporte para visualização em múltiplos formatos de mapa (arruamento, satélite e relevo)."
      ]
    },
    {
      icon: <FaShieldAlt className="text-blue-500 text-4xl mb-4" />,
      title: "Segurança da Frota e Carga",
      description: "Sistemas avançados de telemetria e alertas automáticos para prevenir acidentes, desvios de rota e garantir a máxima integridade dos seus veículos e condutores.",
      details: [
        "Notificações instantâneas em caso de ignição não autorizada ou movimento indevido.",
        "Criação de cercas eletrónicas (geofencing) com alerta imediato de entrada ou saída.",
        "Comando de bloqueio remoto do veículo ativado de forma segura pela plataforma.",
        "Sensores opcionais para monitorização de abertura de portas de baú e controlo de temperatura."
      ]
    },
    {
      icon: <FaChartLine className="text-blue-500 text-4xl mb-4" />,
      title: "Gestão e Roteirização",
      description: "Otimize trajetos, reduza custos operacionais com combustível e aumente a eficiência das entregas através de relatórios gerenciais completos e intuitivos.",
      details: [
        "Telemetria avançada: identificação de excesso de velocidade, travagens ou acelerações bruscas.",
        "Métricas e relatórios de consumo estimado de combustível e tempos de paragem com motor ligado.",
        "Planeamento inteligente de rotas para entregas múltiplas, minimizando distâncias e tempo.",
        "Agendamento de lembretes automáticos para manutenção preventiva (revisões, óleo, pneus)."
      ]
    },
    {
      icon: <FaServer className="text-blue-500 text-4xl mb-4" />,
      title: "Plataforma Customizada",
      description: "Integração facilitada com os sistemas da sua empresa, oferecendo painéis sob medida e suporte técnico especializado para as necessidades do seu negócio.",
      details: [
        "Acesso multiplataforma totalmente responsivo (Web, e aplicações nativas iOS e Android).",
        "Gestão de acessos avançada com criação de perfis e diferentes níveis de permissão por utilizador.",
        "Integração direta e transparente via API REST com o sistema ERP ou software logístico da sua empresa.",
        "Suporte técnico dedicado e exportação simplificada de relatórios gerenciais nos formatos Excel e PDF."
      ]
    }
  ];

  const panelFeatures = [
    {
      icon: <FaDesktop className="text-blue-500 text-2xl" />,
      title: "Interface Analytics de Alta Performance",
      desc: "Painel de controle centralizado baseado em nuvem de alta disponibilidade, focado na experiência do usuário para tomadas de decisão rápidas."
    },
    {
      icon: <FaThermometerHalf className="text-blue-500 text-2xl" />,
      title: "Gráfico de Eventos de Temperatura",
      desc: "Módulo avançado para cargas refrigeradas. Gráficos de linha contínuos em tempo real interligando sensores para auditoria térmica rigorosa de cada placa."
    },
    {
      icon: <FaSlidersH className="text-blue-500 text-2xl" />,
      title: "Roteirizador inteligente com Filtros",
      desc: "Ferramenta nativa que permite filtrar clientes específicos por área e criar janelas dinâmicas de carregamento e cubagem de baú."
    }
  ];

  const technologyCatalog = [
    {
      icon: <FaSignal className="text-blue-500 text-3xl" />,
      title: "Full Tracker (FT)",
      tech: "Monitoramento e eventos em tempo real.",
      specs: [
        "Localizaçãp em tempo real.",
        "Precisão de GPS em até 10m.",
        "Amarzena até 2000 posições em área de sombra.",
        "Compatível com bloqueio."
      ]
    },
    {
      icon: <FaSatellite className="text-blue-500 text-3xl" />,
      title: "Full Tracker Plus (FT-P)",
      tech: "Cercas e rotas embarcadas, eficiência logística.",
      specs: [
        "Controle de jornada.",
        "Identificação do Motorista.",
        "Detecção de Jammer de GPS E Celular.",
        "Baixo custo em sleep mode."
      ]
    },
    {
      icon: <FaMicrochip className="text-blue-500 text-3xl" />,
      title: "Full Tracker Smart (FT-S)",
      tech: "Gestão de frota inteligente com funcionalidades avançadas de telemetria.",
      specs: [
        "Bloqueio Seguro.",
        "Gestão de Combustível.",
        "Controle RPM.",
        "Aceleração e freada brusca."
      ]
    },
    {
      icon: <FaShieldAlt className="text-blue-500 text-3xl" />,
      title: "Smart Full Tracker Plus (FT-SP)",
      tech: "Gestão de frota com tecnologia Bluetooth.",
      specs: [
        "Sensores Bluetooth.",
        "Saída Bluettoth.",
        "Porta RS 232.",
        "Compatível com veículos elétricos."
      ]
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#000000] text-white select-none relative overflow-hidden">
      <Head>
        <title>Soluções e Tecnologias | FullVision Tracking</title>
      </Head>

      <main className="flex-grow w-full pt-[120px] pb-16 px-4">
        <div className="max-w-[1240px] mx-auto">
          
          <div className="text-center max-w-[800px] mx-auto mb-12">
            <h1 data-aos="fade-down" className="text-4xl md:text-5xl font-bold tracking-wider mb-4 border-b-2 border-blue-500 pb-4 inline-block">
              TECNOLOGIA & OPERAÇÃO
            </h1>
            <p data-aos="fade-up" data-aos-delay="150" className="text-gray-300 text-base md:text-lg leading-relaxed mt-2">
              Explore nossa infraestrutura de software, hardware e inteligência integrada para proteção de frotas.
            </p>
          </div>

          <div data-aos="fade-up" className="flex flex-wrap justify-center items-center gap-2 md:gap-4 mb-16 border-b border-white/10 pb-4">
            <button
              onClick={() => setActiveTab('services')}
              className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 ${
                activeTab === 'services' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              Soluções e Serviços
            </button>
            <button
              onClick={() => setActiveTab('panel')}
              className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 ${
                activeTab === 'panel' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              💻 Nosso Painel Web
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 ${
                activeTab === 'catalog' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              🛰️ Catálogo de Hardware
            </button>
          </div>

          <div className="transition-all duration-500">
            
            {activeTab === 'services' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 animate-fade-in">
                {solutionsList.map((item, index) => (
                  <div 
                    key={index} 
                    onClick={() => setActiveModal(index)}
                    className="bg-white/5 border border-white/10 rounded-lg p-8 hover:border-blue-500 transition-all duration-300 hover:bg-white/10 cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      {item.icon}
                      <h3 className="text-2xl font-semibold mb-3 tracking-wide text-gray-100 group-hover:text-blue-400 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-gray-400 leading-relaxed mb-6 text-sm">
                        {item.description}
                      </p>
                    </div>
                    <div className="border-t border-white/5 pt-4 flex items-center justify-between text-sm text-blue-500 font-medium">
                      <span>Especificações Técnicas</span>
                      <span className="group-hover:translate-x-1 transition-transform duration-300">Saiba mais &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'panel' && (
              <div className="space-y-12 max-w-[900px] mx-auto mb-16 animate-fade-in">
                <div className="bg-gradient-to-r from-blue-950/30 to-white/5 p-6 rounded-xl border border-white/10 flex flex-col md:flex-row items-center gap-6">
                  <div className="text-5xl text-blue-500"><FaDesktop /></div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Central Logística em Tempo Real</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Nossa plataforma foi desenhada sob rígidos conceitos corporativos. Ela compila telemetria, mapas dinâmicos e disparo automático de comandos de segurança em milissegundos.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {panelFeatures.map((feat, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/5 rounded-lg p-6 hover:border-blue-500/40 transition-colors">
                      <div className="mb-4">{feat.icon}</div>
                      <h4 className="text-lg font-bold mb-2 text-gray-200">{feat.title}</h4>
                      <p className="text-gray-400 text-xs leading-relaxed">{feat.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'catalog' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-16 animate-fade-in">
                {technologyCatalog.map((tech, idx) => (
                  <div key={idx} className="bg-[#0f0f0f] border border-white/10 rounded-xl p-6 flex flex-col justify-between hover:border-blue-500/40 hover:scale-[1.02] transition-all duration-300">
                    <div>
                      <div className="mb-4 bg-blue-500/10 w-14 h-14 rounded-lg flex items-center justify-center">
                        {tech.icon}
                      </div>
                      
                      <h3 className="text-xl font-bold mb-2 text-white">{tech.title}</h3>
                      <p className="text-gray-400 text-xs leading-relaxed mb-4">{tech.tech}</p>
                      
                      <div className="border-t border-white/5 pt-4 mt-2">
                        <h4 className="text-[11px] font-bold text-blue-500 uppercase tracking-widest mb-2">
                          Especificações Técnicas:
                        </h4>
                        <ul className="space-y-1.5">
                          {tech.specs.map((spec, sIdx) => (
                            <li key={sIdx} className="text-gray-300 text-[11px] md:text-xs flex items-start gap-2">
                              <span className="text-blue-500 font-bold shrink-0">✓</span>
                              <span>{spec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-6 text-xs text-blue-500 font-semibold uppercase tracking-wider border-t border-white/5 pt-3">
                      🟢 Equipamento Homologado ANATEL
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>

          <div data-aos="zoom-in" data-aos-delay="200" className="bg-gradient-to-r from-blue-600/20 to-blue-900/20 border border-white/10 rounded-lg p-8 text-center max-w-[900px] mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">Pronto para transformar a sua operação?</h2>
            <p className="text-gray-300 mb-6 max-w-[600px] mx-auto text-sm">
              Entre em contacto com a nossa equipa comercial e descubra como implementar o FullVision Tracker à medida da sua empresa.
            </p>
            <Link href="/contact">
              <button className="px-8 py-3 bg-blue-600 text-white font-semibold rounded hover:bg-white hover:text-black transition-all duration-300 text-sm">
                Solicitar Contacto Comercial
              </button>
            </Link>
          </div>

        </div>
      </main>

      {activeModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all duration-300">
          <div className="bg-[#111111] border border-blue-500/40 rounded-lg max-w-[650px] w-full p-6 md:p-8 relative shadow-2xl animate-fade-in">
            <button 
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 hover:bg-red-500/20 p-2 rounded-full transition-all duration-200"
              title="Fechar"
            >
              <FaTimes size={18} />
            </button>

            <div className="flex items-center gap-4 mb-6 border-b border-white/10 pb-4">
              {solutionsList[activeModal].icon}
              <h3 className="text-2xl font-bold text-white tracking-wide">
                {solutionsList[activeModal].title}
              </h3>
            </div>

            <p className="text-gray-300 text-sm leading-relaxed mb-6 bg-black/40 p-3 rounded border border-white/5">
              {solutionsList[activeModal].description}
            </p>

            <h4 className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-3">
              Recursos e Capacidades do Sistema:
            </h4>
            
            <ul className="flex flex-col gap-3 mb-8">
              {solutionsList[activeModal].details.map((detail, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                  <span className="text-blue-500 shrink-0 mt-1">&#10003;</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>

            <div className="flex justify-end gap-4 border-t border-white/10 pt-4">
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                Fechar
              </button>
              <Link href="/contact">
                <button className="px-5 py-2 text-sm bg-blue-600 hover:bg-white text-white hover:text-black font-semibold rounded transition-all duration-300">
                  Tenho Interesse
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}