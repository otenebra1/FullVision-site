import '@/styles/globals.css';
import Navbar from '@/components/Navbar';
import WhatsAppButton from '@/components/WhatsAppButton';
import { Analytics } from '@vercel/analytics/react';
import { useEffect } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function App({ Component, pageProps }) {

  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out'
    });
  }, []);

  return (
    <>
      <Navbar />
      <Component {...pageProps} />
      <WhatsAppButton />
      <Analytics />
    </>
  );
}
