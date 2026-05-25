import Head from 'next/head';
import Redirect from "@/components/Redirect";
import Slider from "@/components/Slider";
import HomeImage from "@/components/Hero";
import { SliderData } from "@/components/SliderData";
import Footer from '@/components/Footer';

export default function Home() {
  return (
    // Adicionado o fundo preto padrão e overflow-hidden para não ter barras de scroll indesejadas na animação
    <div className="bg-[#000000] min-h-screen flex flex-col overflow-hidden">
      <Head>
        <title>Início | FullVision Tracking</title>
        <meta name="description" content="Gestão de operação logística e segurança da frota." />
      </Head>

      <main className="flex-grow">
        {/* 1. O Slider dinâmico no topo, surgindo suavemente */}
        <div data-aos="fade-down" data-aos-duration="1000">
          <Slider slides={SliderData} />
        </div>

        {/* 2. A div corporativa com a imagem de fundo original */}
        <div data-aos="fade-up" data-aos-delay="150">
          <HomeImage 
            heading='Fullvision Tracking' 
            message='Gestão de operação logística e segurança da frota.' 
          />
        </div>

        {/* 3. Seção do Card de acesso à plataforma de rastreamento */}
        <div 
          data-aos="zoom-in" 
          data-aos-delay="300" 
          className="w-full flex justify-center items-center my-16 px-4"
        >
          <Redirect />
        </div>
      </main>

      <Footer />
    </div>
  )
}