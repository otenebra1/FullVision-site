import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Footer from '@/components/Footer';
import { FaMapMarkedAlt, FaShieldAlt, FaChartLine, FaServer, FaTimes } from 'react-icons/fa';

export default function Solutions() {
  // Estado para controlar qual o modal aberto (guarda o índice do item ou null se estiver fechado)
  const [activeModal, setActiveModal] = useState(null);

  // Lista de soluções enriquecida com pormenores técnicos para a janela flutuante
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

  return (
    // Adicionado overflow-hidden para evitar barras de scroll horizontais durante a animação
    <div className="flex flex-col min-h-screen bg-[#000000] text-white select-none relative overflow-hidden">
      <Head>
        <title>Soluções | FullVision Tracking</title>
      </Head>

      {/* Conteúdo Principal */}
      <main className="flex-grow w-full pt-[120px] pb-16 px-4">
        <div className="max-w-[1240px] mx-auto">
          
          {/* Cabeçalho da Página */}
          <div className="text-center max-w-[800px] mx-auto mb-16">
            <h1 data-aos="fade-down" className="text-4xl md:text-5xl font-bold tracking-wider mb-4 border-b-2 border-blue-500 pb-4 inline-block">
              NOSSAS SOLUÇÕES
            </h1>
            <p data-aos="fade-up" data-aos-delay="150" className="text-gray-300 text-lg md:text-xl leading-relaxed mt-4">
              Tecnologia de ponta em gestão de operação logística e segurança da frota para elevar o patamar do seu negócio.
            </p>
          </div>

          {/* Grid de Soluções */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {solutionsList.map((item, index) => (
              <div 
                key={index} 
                data-aos="fade-up"
                data-aos-delay={index * 150} // 0ms, 150ms, 300ms, 450ms (Efeito Cascata)
                onClick={() => setActiveModal(index)}
                className="bg-white/5 border border-white/10 rounded-lg p-8 hover:border-blue-500 transition-all duration-300 hover:bg-white/10 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {item.icon}
                  <h3 className="text-2xl font-semibold mb-3 tracking-wide text-gray-100 group-hover:text-blue-400 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed mb-6">
                    {item.description}
                  </p>
                </div>
                
                {/* Indicador visual de clique */}
                <div className="border-t border-white/5 pt-4 flex items-center justify-between text-sm text-blue-500 font-medium">
                  <span>Especificações Técnicas</span>
                  <span className="group-hover:translate-x-1 transition-transform duration-300">Saiba mais &rarr;</span>
                </div>
              </div>
            ))}
          </div>

          {/* Chamada para Ação */}
          <div data-aos="zoom-in" data-aos-delay="200" className="bg-gradient-to-r from-blue-600/20 to-blue-900/20 border border-white/10 rounded-lg p-8 text-center max-w-[900px] mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">Pronto para transformar a sua operação?</h2>
            <p className="text-gray-300 mb-6 max-w-[600px] mx-auto">
              Entre em contacto com a nossa equipa comercial e descubra como implementar o FullVision Tracker à medida da sua empresa.
            </p>
            <Link href="/contact">
              <button className="px-8 py-3 bg-blue-600 text-white font-semibold rounded hover:bg-white hover:text-black transition-all duration-300">
                Solicitar Contacto Comercial
              </button>
            </Link>
          </div>

        </div>
      </main>

      {/* ====== JANELA FLUUTUANTE (MODAL) ====== */}
      {/* O Modal não precisa de AOS pois já tem a sua própria animação de aparecimento (animate-fade-in) */}
      {activeModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all duration-300">
          
          {/* Caixa do Modal */}
          <div className="bg-[#111111] border border-blue-500/40 rounded-lg max-w-[650px] w-full p-6 md:p-8 relative shadow-2xl animate-fade-in">
            
            {/* Botão de Fechar */}
            <button 
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 hover:bg-red-500/20 p-2 rounded-full transition-all duration-200"
              title="Fechar"
            >
              <FaTimes size={18} />
            </button>

            {/* Cabeçalho do Modal */}
            <div className="flex items-center gap-4 mb-6 border-b border-white/10 pb-4">
              {solutionsList[activeModal].icon}
              <h3 className="text-2xl font-bold text-white tracking-wide">
                {solutionsList[activeModal].title}
              </h3>
            </div>

            {/* Descrição Curta */}
            <p className="text-gray-300 text-base leading-relaxed mb-6 bg-black/40 p-3 rounded border border-white/5">
              {solutionsList[activeModal].description}
            </p>

            {/* Lista de Pormenores Técnicos */}
            <h4 className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-3">
              Recursos e Capacidades do Sistema:
            </h4>
            
            <ul className="flex flex-col gap-3 mb-8">
              {solutionsList[activeModal].details.map((detail, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm md:text-base text-gray-300">
                  <span className="text-blue-500 shrink-0 mt-1">&#10003;</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>

            {/* Botão de Ação Direta dentro do Modal */}
            <div className="flex justify-end gap-4 border-t border-white/10 pt-4">
              <button 
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
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

      {/* Rodapé Global */}
      <Footer />
    </div>
  );
}
