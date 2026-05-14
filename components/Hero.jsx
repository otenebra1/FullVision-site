import Link from 'next/link'
import React from 'react'

const HomeImage = ({ heading, message }) => {
  return (
    // 'relative' contém a máscara escura. Altura ajustada para um bloco bem proporcionado.
    <div className='relative flex items-center justify-center w-full h-[400px] md:h-[500px] mb-12 bg-fixed bg-cover bg-center img-custom'>
        
        {/* Sobreposição escura contida estritamente dentro desta div */}
        <div className='absolute top-0 left-0 right-0 bottom-0 bg-black/70 z-[1]' />
        
        {/* Conteúdo centralizado com espaçamento correto */}
        <div className='p-5 text-white z-[2] text-center max-w-[800px] mx-auto'>
            <h2 className='text-4xl md:text-5xl font-bold tracking-wide'>{heading}</h2>
            <p className='py-5 text-lg md:text-xl text-gray-200'>{message}</p>
            <div className='mt-4'>
                <Link href='/contact'>
                    <button className='px-8 py-3 border border-white bg-transparent hover:bg-white hover:text-black transition-all duration-300 font-medium'>
                        Solicitar Contato Comercial
                    </button>
                </Link>
            </div>
        </div>
    </div>
  )
}

export default HomeImage