import '@/styles/globals.css';
import Navbar from '@/components/Navbar';
import WhatsAppButton from '@/components/WhatsAppButton';
import { Analytics } from '@vercel/analytics/react';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Navbar />
      <Component {...pageProps} />
      <WhatsAppButton />
      <Analytics /> {/* Adicione esta linha */}
    </>
  );
}

// 1. Importações da animação
import { useEffect } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css'; // Importa o CSS das animações

export default function App({ Component, pageProps }) {
  
  // 2. Este código liga as animações assim que o site carrega
  useEffect(() => {
    AOS.init({
      duration: 800,     // A animação demora 0.8 segundos (suave)
      once: true,        // A animação só acontece uma vez (não repete ao subir a página)
      easing: 'ease-out' // Efeito de abrandamento no final
    });
  }, []);

  return (
    <>
      <Navbar />
      <Component {...pageProps} />
      <WhatsAppButton />
    </>
  );
}