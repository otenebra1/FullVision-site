import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { AiOutlineMenu, AiOutlineClose } from 'react-icons/ai'
import { BsBoxArrowUpRight } from 'react-icons/bs'; // Importação do ícone

const Navbar = () => {
    const [nav, setNav] = useState(false)
    const [color, setColor] = useState('transparent')
    const [textColor, setTextColor] = useState('white')

    useEffect(() => {
        const changeColor = () => {
            if (window.scrollY >= 90) {
                setColor('#ffffff')
                setTextColor('#000000')
            } else {
                setColor('transparent')
                setTextColor('#ffffff')
            }
        }
        window.addEventListener('scroll', changeColor)
    }, [])

    return (
        <div style={{ backgroundColor: color }} className='fixed left-0 top-0 w-full z-30 transition-all duration-300 ease-in backdrop-blur-sm'>
            <div className='max-w-[1240px] m-auto flex justify-between items-center p-4 text-white'>
                
                {/* Logo */}
                <Link href='/'>
                    <img 
                        src="/images/logofv.png" 
                        className='h-14 w-32 object-contain cursor-pointer hover:opacity-80 transition-opacity' 
                        alt="Logo FullVision" 
                    />
                </Link>

                {/* Menu Desktop + Botão */}
                <div className='hidden sm:flex items-center gap-6'>
                    <ul style={{ color: textColor }} className='flex items-center gap-8 font-medium'>
                        <li className='hover:text-blue-500 transition-colors'>
                            <Link href='/'>Início</Link>
                        </li>
                        <li className='hover:text-blue-500 transition-colors'>
                            <Link href='/about'>Sobre nós</Link>
                        </li>
                        <li className='hover:text-blue-500 transition-colors'>
                            <Link href='/solutions'>Soluções</Link>
                        </li>
                        <li className='hover:text-blue-500 transition-colors'>
                            <Link href='/contact'>Contato</Link>
                        </li>
                    </ul>
                    
                    {/* NOVO: Botão de Acesso à Plataforma */}
                    <a
                        href="https://tracker.fullvision.one/v1/home"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-blue-600/20 hover:scale-105"
                    >
                        Acessar Plataforma <BsBoxArrowUpRight className='text-sm font-bold' />
                    </a>
                </div>

                {/* Ícone Menu Mobile */}
                <div onClick={() => setNav(!nav)} className='block sm:hidden z-10 cursor-pointer'>
                    {nav ? <AiOutlineClose size={20} style={{ color: nav ? 'white' : textColor }} /> : <AiOutlineMenu size={20} style={{ color: textColor }} />}
                </div>

                {/* Menu Mobile Dropdown */}
                <div className={nav ? 'sm:hidden absolute top-0 left-0 right-0 bottom-0 flex flex-col justify-center items-center w-full h-screen bg-black text-center ease-in duration-300' : 'sm:hidden absolute top-0 left-[-100%] right-0 bottom-0 flex flex-col justify-center items-center w-full h-screen bg-black text-center ease-in duration-300'}>
                    <ul className='flex flex-col gap-8 text-2xl text-white mb-12'>
                        <li onClick={() => setNav(false)} className='hover:text-blue-500'><Link href='/'>Início</Link></li>
                        <li onClick={() => setNav(false)} className='hover:text-blue-500'><Link href='/about'>Sobre nós</Link></li>
                        <li onClick={() => setNav(false)} className='hover:text-blue-500'><Link href='/solutions'>Soluções</Link></li>
                        <li onClick={() => setNav(false)} className='hover:text-blue-500'><Link href='/contact'>Contato</Link></li>
                    </ul>

                    {/* NOVO: Botão de Acesso no Menu Mobile */}
                    <a
                        href="https://tracker.fullvision.one/v1/home"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setNav(false)}
                        className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-semibold transition-all shadow-lg text-lg"
                    >
                        Acessar Plataforma <BsBoxArrowUpRight className='text-lg font-bold' />
                    </a>
                </div>
            </div>
        </div>
    )
}

export default Navbar