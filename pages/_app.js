import '@/styles/globals.css';
import Navbar from '@/components/Navbar'; // 1. Importando a Navbar
import WhatsAppButton from '@/components/WhatsAppButton';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Navbar /> {/* 2. Colocando a Navbar no topo do site */}
      <Component {...pageProps} /> 
      <WhatsAppButton />          
    </>
  );
}