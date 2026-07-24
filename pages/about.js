import React from 'react';
import Head from 'next/head';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { FaShieldAlt, FaEye, FaRocket } from 'react-icons/fa';

export default function About() {
  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen font-sans flex flex-col justify-between">
      <Head>
        <title>Sobre Nós | FULL VISION</title>
        <meta name="description" content="Conheça a FULL VISION: nascemos com o propósito de transformar dados complexos em segurança palpável e eficiência milimétrica para a sua frota." />
        <meta property="og:title" content="Sobre Nós | FULL VISION" />
        <meta property="og:description" content="Conheça a FULL VISION: gestão de operação logística e segurança da frota com tecnologia de ponta." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://fullvision.one/about" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      
      {/* Barra de Navegação */}
      <Navbar />

      <main className="flex-grow">
        {/* 1. SEÇÃO HERO */}
        <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 bg-gradient-to-b from-blue-950/20 to-transparent px-4 overflow-hidden">
          <div className="max-w-[1140px] mx-auto text-center">
            <span className="text-blue-500 font-bold text-xs uppercase tracking-widest bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20">
              Sobre Nós
            </span>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold mt-6 mb-6 tracking-tight text-white">
              Transformamos dados em <span className="text-blue-500">segurança</span> e <span className="text-blue-500">eficiência</span>
            </h1>
            <p className="text-gray-400 text-sm md:text-lg max-w-3xl mx-auto leading-relaxed">
              A FULL VISION nasceu com o propósito de oferecer gestão inteligente de frotas, rastreamento avançado e telemetria de alta precisão para otimizar operações logísticas de qualquer porte.
            </p>
          </div>
        </section>

        {/* 2. PILARES / MISSÃO, VISÃO E VALORES */}
        <section className="py-16 px-4 max-w-[1140px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-900/60 border border-gray-800 p-8 rounded-2xl hover:border-blue-500/50 transition-all">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 text-2xl mb-6">
                <FaRocket />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Nossa Missão</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Entregar tecnologia de ponta para gestão e rastreamento de frotas, garantindo segurança, redução de custos operacionais e controle total em tempo real.
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800 p-8 rounded-2xl hover:border-blue-500/50 transition-all">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 text-2xl mb-6">
                <FaEye />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Nossa Visão</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Ser referência nacional em soluções inteligentes de telemetria e rastreamento, reconhecida pela inovação constante e excelência no suporte ao cliente.
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800 p-8 rounded-2xl hover:border-blue-500/50 transition-all">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 text-2xl mb-6">
                <FaShieldAlt />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Nossos Valores</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Transparência, inovação contínua, foco no cliente, precisão nos dados e compromisso inegociável com a segurança da sua operação.
              </p>
            </div>
          </div>
        </section>

        {/* 3. BLOCO DE NÚMEROS (STATS) */}
        <section className="py-20 px-4 max-w-[1140px] mx-auto text-center overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            <div className="space-y-1">
              <span className="text-3xl md:text-5xl font-extrabold text-blue-500 tracking-tight">99.9%</span>
              <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Uptime do Servidor</p>
            </div>
            <div className="space-y-1">
              <span className="text-3xl md:text-5xl font-extrabold text-blue-500 tracking-tight">24/7</span>
              <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Monitoramento Ativo</p>
            </div>
            <div className="space-y-1">
              <span className="text-3xl md:text-5xl font-extrabold text-blue-500 tracking-tight">0ms</span>
              <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Latência de Telemetria</p>
            </div>
            <div className="space-y-1">
              <span className="text-3xl md:text-5xl font-extrabold text-blue-500 tracking-tight">100%</span>
              <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Suporte Dedicado</p>
            </div>
          </div>
        </section>
      </main>

      {/* Rodapé da Página */}
      <Footer />
    </div>
  );
}