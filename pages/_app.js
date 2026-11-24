import '@/styles/globals.css';
import Navbar from '@/components/Navbar';
import WhatsAppButton from '@/components/WhatsAppButton';
import TrocaSenhaObrigatoria from '@/components/TrocaSenhaObrigatoria';
import { Analytics } from '@vercel/analytics/react';
import { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AOS from 'aos';
import 'aos/dist/aos.css';

// 1. Importação da nova fonte premium
import { Plus_Jakarta_Sans } from 'next/font/google';

// 2. Configuração dos pesos da fonte que vamos usar
const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

// Telas de app (celular) sem o menu e o botão de WhatsApp do site institucional
const ROTAS_APP = ['/tecnico'];

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const telaDeApp = ROTAS_APP.includes(router.pathname);

  // PWA: registra o service worker (só em produção, para não atrapalhar o next dev)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

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
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      {!telaDeApp && <Navbar />}
      <Component {...pageProps} />
      {!telaDeApp && <WhatsAppButton />}
      <TrocaSenhaObrigatoria />
      <Analytics />
    </div>
  );
}