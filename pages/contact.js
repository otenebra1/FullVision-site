import React, { useState } from 'react';
import emailjs from '@emailjs/browser';
import Head from 'next/head';
import Footer from '@/components/Footer';
import { FaEnvelope, FaWhatsapp, FaMapMarkerAlt, FaClock } from 'react-icons/fa';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    vehicles: '',
    message: ''
  });

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const googleScriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;

    try {
      await Promise.all([
        fetch(googleScriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(formData),
        }),
        emailjs.send(
          process.env.NEXT_PUBLIC_EMAILJS_SERVICE,
          process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE,
          formData,
          process.env.NEXT_PUBLIC_EMAILJS_KEY
        )
      ]);

      setSubmitted(true);
      setFormData({ name: '', email: '', phone: '', company: '', vehicles: '', message: '' });
      setTimeout(() => setSubmitted(false), 5000);

    } catch (error) {
      console.error("Erro no envio:", error);
      alert("Erro ao enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Adicionado overflow-hidden para proteger a animação
    <div className="flex flex-col min-h-screen bg-[#000000] text-white select-none overflow-hidden">
      <Head>
        <title>Contato | FullVision Tracking</title>
        <meta name="description" content="Fale com a FullVision. Dúvidas, suporte ou propostas comerciais sobre rastreamento e gestão de frota." />
        <meta property="og:title" content="Contato | FullVision Tracking" />
        <meta property="og:description" content="Entre em contato com nossa equipe para soluções customizadas de rastreamento e segurança de frota." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://fullvision.one/contact" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <main className="flex-grow w-full pt-[120px] pb-16 px-4">
        <div className="max-w-[1240px] mx-auto">
          
          {/* Cabeçalho */}
          <div className="text-center max-w-[800px] mx-auto mb-16">
            <h1 data-aos="fade-down" className="text-4xl md:text-5xl font-bold tracking-wider mb-4 border-b-2 border-blue-500 pb-4 inline-block">
              FALE CONOSCO
            </h1>
            <p data-aos="fade-up" data-aos-delay="150" className="text-gray-300 text-lg md:text-xl mt-4">
              Dúvidas, suporte ou propostas comerciais? Preencha o formulário ou utilize nossos canais diretos.
            </p>
          </div>

          {/* Grid de 2 colunas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            
            {/* ====== ESQUERDA: Formulário de Contato (Vem da Esquerda) ====== */}
            <div data-aos="fade-right" className="bg-white/5 border border-white/10 rounded-lg p-6 md:p-8 shadow-xl relative">
              <h2 className="text-2xl font-semibold mb-6 text-blue-500 tracking-wide border-b border-white/10 pb-3">
                Envie uma Mensagem
              </h2>

              {submitted && (
                <div className="mb-6 p-4 bg-green-500/20 border border-green-500 text-green-300 rounded text-center font-medium transition-all">
                  Mensagem enviada com sucesso! Entraremos em contato em breve.
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* Nome */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Digite seu nome"
                    className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* E-mail */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    E-mail
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="contato@suaempresa.com"
                    className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    WhatsApp / Telefone
                  </label>
                  <input
                    type="text"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="(11) 99999-9999"
                    className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Nome da Empresa */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nome da Empresa
                  </label>
                  <input
                    type="text"
                    name="company"
                    required
                    value={formData.company}
                    onChange={handleChange}
                    placeholder="Razão Social ou Nome Fantasia"
                    className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Quantidade de Veículos */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Quantidade de Veículos
                  </label>
                  <input
                    type="number"
                    name="vehicles"
                    min="1"
                    required
                    value={formData.vehicles}
                    onChange={handleChange}
                    placeholder="Ex: 15"
                    className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Mensagem */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Sua Mensagem
                  </label>
                  <textarea
                    name="message"
                    rows="4"
                    required
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Como podemos ajudar a impulsionar a sua operação?"
                    className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 mt-2 bg-blue-600 hover:bg-white text-white hover:text-black font-semibold rounded transition-all duration-300 tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Enviando...' : 'Enviar Mensagem'}
                </button>
              </form>
            </div>

            {/* ====== DIREITA: Dados Oficiais (Vem da Direita) ====== */}
            <div className="flex flex-col gap-8">
              
              <div data-aos="fade-left" className="bg-white/5 border-l-4 border-blue-500 border-y border-r border-white/10 rounded-r-lg p-6 md:p-8 shadow-xl">
                <h2 className="text-2xl font-semibold mb-8 text-white tracking-wide border-b border-white/10 pb-3">
                  Nossos Dados
                </h2>

                <div className="flex flex-col gap-8">
                  
                  {/* E-mail */}
                  <div className="flex items-center gap-5 group">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-black transition-all duration-300 shrink-0">
                      <FaEnvelope size={20} />
                    </div>
                    <div>
                      <span className="block text-xs text-gray-400 font-medium tracking-wider uppercase mb-1">
                        E-mail
                      </span>
                      <a 
                        href="mailto:contato@fullvision.one" 
                        className="text-base md:text-lg text-gray-200 hover:text-blue-500 transition-colors font-semibold"
                      >
                        contato@fullvision.one
                      </a>
                    </div>
                  </div>

                  {/* WhatsApp */}
                  <div className="flex items-center gap-5 group">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-black transition-all duration-300 shrink-0">
                      <FaWhatsapp size={24} />
                    </div>
                    <div>
                      <span className="block text-xs text-gray-400 font-medium tracking-wider uppercase mb-1">
                        WhatsApp
                      </span>
                      <a 
                        href="https://wa.me/5511940670589" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-base md:text-lg text-gray-200 hover:text-blue-500 transition-colors font-semibold"
                      >
                        1194067-0589
                      </a>
                    </div>
                  </div>

                  {/* Localização */}
                  <div className="flex items-center gap-5 group">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-black transition-all duration-300 shrink-0">
                      <FaMapMarkerAlt size={22} />
                    </div>
                    <div>
                      <span className="block text-xs text-gray-400 font-medium tracking-wider uppercase mb-1">
                        Localização
                      </span>
                      <span className="text-base md:text-lg text-gray-200 font-semibold">
                        Santo André - São Paulo
                      </span>
                    </div>
                  </div>

                  {/* Horário de Atendimento */}
                  <div className="flex items-center gap-5 group">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-black transition-all duration-300 shrink-0">
                      <FaClock size={22} />
                    </div>
                    <div>
                      <span className="block text-xs text-gray-400 font-medium tracking-wider uppercase mb-1">
                        Horário de Atendimento
                      </span>
                      <span className="text-base md:text-lg text-gray-200 font-semibold">
                        Segunda a Sexta, 08h às 18h
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Mensagem de valor agregado (Sobe de baixo) */}
              <div data-aos="fade-up" data-aos-delay="200" className="bg-gradient-to-r from-blue-600/10 to-transparent border border-white/5 rounded-lg p-6 text-gray-400 text-sm leading-relaxed">
                <p>
                  <strong className="text-gray-200 font-semibold">Atendimento Ágil:</strong> Nossa equipe está pronta para desenhar projetos customizados de rastreamento, telemetria e segurança corporativa sob medida para a sua frota.
                </p>
              </div>

            </div>

          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}