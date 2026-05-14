import Redirect from "@/components/Redirect";
import Slider from "@/components/Slider";
import HomeImage from "@/components/Hero";
import { SliderData } from "@/components/SliderData";
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      {/* 1. O Slider dinâmico no topo, um pouco mais estreito */}
      <Slider slides={SliderData} />

      {/* 2. A div corporativa com a imagem de fundo original, texto e botão comercial */}
      <HomeImage 
        heading='Fullvision Tracking' 
        message='Gestão de operação logística e segurança da frota.' 
      />

      {/* 3. Seção do Card de acesso à plataforma de rastreamento */}
      <div className="w-full flex justify-center items-center my-12 px-4">
        <Redirect />
      </div>

      <Footer />
    </>
  )
}