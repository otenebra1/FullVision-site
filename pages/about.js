import React from 'react';
import Head from 'next/head';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { FaShieldAlt, FaEye, FaRocket } from 'react-icons/fa';

export default function About() {
  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen font-sans flex flex-col justify-between">
      <Head>
        <title>Sobre Nós | Full Vision</title>
        <meta name="description" content="A Full Vision é uma empresa de tecnologia em gestão operacional, focada em eficiência, performance e previsibilidade para operações logísticas." />
      </Head>
      
      <Navbar />

      <main className="flex-grow">
        {/* 1. SEÇÃO HERO */}
        <section className="relative pt-24 pb-12 md:pt-32 md:pb-16 bg-gradient-to-b from-blue-950/20 to-transparent px-4 overflow-hidden">
          <div className="max-w-[1140px] mx-auto text-center">
            <span data-aos="fade-down" className="text-blue-500 font-bold text-xs uppercase tracking-widest bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20">
              Sobre Nós
            </span>
            <h1 data-aos="fade-up" data-aos-delay="100" className="text-3xl md:text-5xl lg:text-6xl font-extrabold mt-6 mb-6 tracking-tight text-white">
              Transformamos dados em <span className="text-blue-500">inteligência de gestão</span>
            </h1>
            <p data-aos="fade-up" data-aos-delay="200" className="text-gray-400 text-sm md:text-lg max-w-3xl mx-auto leading-relaxed">
              Ajudamos empresas a ter visão total, controle e eficiência em tempo real de suas operações logísticas.
            </p>
          </div>
        </section>

        {/* 2. OS 3 CAMPOS PRINCIPAIS: MISSÃO, VISÃO E VALORES (COM OS TEXTOS DO PDF) */}
        <section className="py-12 px-4 max-w-[1140px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Campo 1: Nossa Missão */}
            <div data-aos="fade-up" data-aos-delay="0" className="bg-gray-900/60 border border-gray-800 p-8 rounded-2xl hover:border-blue-500/50 transition-all flex flex-col justify-between shadow-lg">
              <div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 text-2xl mb-6">
                  <FaRocket />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Nossa Missão</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Ser referência em inteligência logística, transformando dados em decisões estratégicas que geram controle, eficiência e crescimento sustentável para empresas.
                </p>
              </div>
            </div>

            {/* Campo 2: Nossa Visão */}
            <div data-aos="fade-up" data-aos-delay="100" className="bg-gray-900/60 border border-gray-800 p-8 rounded-2xl hover:border-blue-500/50 transition-all flex flex-col justify-between shadow-lg">
              <div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 text-2xl mb-6">
                  <FaEye />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Nossa Visão</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Oferecemos uma visão 360° da operação, permitindo que gestores acompanhem, em tempo real. Tudo centralizado em dashboards inteligentes e relatórios personalizados, facilitando decisões rápidas e estratégicas.
                </p>
              </div>
            </div>

            {/* Campo 3: Nossos Valores */}
            <div data-aos="fade-up" data-aos-delay="200" className="bg-gray-900/60 border border-gray-800 p-8 rounded-2xl hover:border-blue-500/50 transition-all flex flex-col justify-between shadow-lg">
              <div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 text-2xl mb-6">
                  <FaShieldAlt />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Nossos Valores</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  A Full Vision não é apenas uma empresa de segurança logística. Somos uma empresa de tecnologia em gestão operacional, focada em eficiência, performance e previsibilidade.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* 3. BLOCO DE NÚMEROS (STATS) */}
        <section className="py-16 px-4 max-w-[1140px] mx-auto text-center overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            <div data-aos="zoom-in" data-aos-delay="0" className="space-y-1">
              <span className="text-3xl md:text-5xl font-extrabold text-blue-500 tracking-tight">99.9%</span>
              <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Uptime do Servidor</p>
            </div>
            <div data-aos="zoom-in" data-aos-delay="100" className="space-y-1">
              <span className="text-3xl md:text-5xl font-extrabold text-blue-500 tracking-tight">24/7</span>
              <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Monitoramento Ativo</p>
            </div>
            <div data-aos="zoom-in" data-aos-delay="200" className="space-y-1">
              <span className="text-3xl md:text-5xl font-extrabold text-blue-500 tracking-tight">0ms</span>
              <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Latência de Telemetria</p>
            </div>
            <div data-aos="zoom-in" data-aos-delay="300" className="space-y-1">
              <span className="text-3xl md:text-5xl font-extrabold text-blue-500 tracking-tight">100%</span>
              <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Suporte Dedicado</p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}