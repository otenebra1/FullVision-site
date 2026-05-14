import React from 'react'
import Footer from './Footer'

const AboutImage = () => {
  return (
    <>
      <div className='flex items-center justify-center h-screen mb-12 bg-fixed bg-cover img-custom'>
        <div className='absolute top-0 left-0 right-0 bottom-0 bg-black/70 z-[2]' />
        <div className='p-5 text-white z-[2] mt-auto mb-auto'>
          <h1 className="text-white text-5xl font-bold">Sobre nós</h1>
        </div>
      </div>
      <div className="flex md:px-64 flex-wrap justify-center p-16">
        <h1 className="font-bold text-black text-5xl mb-5">Quem somos?</h1>
        <p className='py-8 text-xl'>
          A Full Vision tem o intuito de apresentar um novo ponto de vista para o mercado de Segurança e soluções em logística. Temos o compromisso de prestar o melhor atendimento e acessória possível, visando atender as necessidades e particularidades de cada cliente.
        </p>
        <p className="text-xl">
          Através das melhores tecnologias, conseguimos desenvolver uma solução completa para que seja possível oferecer todas as ferramentas de campo necessárias, atreladas a um sistema intuitivo e dinâmico, se tornando a melhor opção que unifica a gestão de operação logística e a seguraça da frota.
        </p>
      </div>

      <Footer />
    </>
  )
}

export default AboutImage