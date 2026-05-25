import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { AiOutlineMenu, AiOutlineClose } from 'react-icons/ai'

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
        // Adicionamos 'backdrop-blur-md' para o efeito de vidro
        <div style={{ backgroundColor: color }} className='fixed left-0 top-0 w-full z-30 transition-all duration-300 ease-in backdrop-blur-sm'>
            <div className='max-w-[1240px] m-auto flex justify-between items-center p-4 text-white'>
                
                {/* Logo envolvendo com Link para home */}
                <Link href='/'>
                    <img 
                        src="/images/logofv.png" 
                        className='h-14 w-32 object-contain cursor-pointer hover:opacity-80 transition-opacity' 
                        alt="Logo FullVision" 
                    />
                </Link>

                {/* Menu Desktop */}
                <ul style={{ color: textColor }} className='hidden sm:flex gap-8 font-medium'>
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

                {/* Mobile Button */}
                <div onClick={() => setNav(!nav)} className='block sm:hidden z-10 cursor-pointer'>
                    {nav ? <AiOutlineClose size={20} style={{ color: textColor }} /> : <AiOutlineMenu size={20} style={{ color: textColor }} />}
                </div>

                {/* Mobile Menu */}
                <div className={nav ? 'sm:hidden absolute top-0 left-0 right-0 bottom-0 flex justify-center items-center w-full h-screen bg-black text-center ease-in duration-300' : 'sm:hidden absolute top-0 left-[-100%] right-0 bottom-0 flex justify-center items-center w-full h-screen bg-black text-center ease-in duration-300'}>
                    <ul className='flex flex-col gap-8 text-2xl'>
                        <li onClick={() => setNav(false)}><Link href='/'>Início</Link></li>
                        <li onClick={() => setNav(false)}><Link href='/about'>Sobre nós</Link></li>
                        <li onClick={() => setNav(false)}><Link href='/solutions'>Soluções</Link></li>
                        <li onClick={() => setNav(false)}><Link href='/contact'>Contato</Link></li>
                    </ul>
                </div>
            </div>
        </div>
    )
}

export default Navbar