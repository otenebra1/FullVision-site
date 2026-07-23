import '@/styles/globals.css';
import Navbar from '@/components/Navbar';
import WhatsAppButton from '@/components/WhatsAppButton';
import { Analytics } from '@vercel/analytics/react';
import { useEffect } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';

// 1. Importação da nova fonte premium
import { Plus_Jakarta_Sans } from 'next/font/google';

// 2. Configuração dos pesos da fonte que vamos usar
const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export default function App({ Component, pageProps }) {

  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out'
    });
  }, []);

  return (
    // 3. Envolver todo o projeto (Navbar, Componentes e Botões) com a classe da fonte
    <div className={fontSans.className}>
      <Navbar />
      <Component {...pageProps} />
      <WhatsAppButton />
      <Analytics />
    </div>
  );
}