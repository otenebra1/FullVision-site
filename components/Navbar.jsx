import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { AiOutlineMenu, AiOutlineClose } from 'react-icons/ai'

const Navbar = () => {
    const [nav, setNav] = useState(false)
    
    const [color, setColor] = useState('#000000')
    const [textColor, setTextColor] = useState('white')

    useEffect(() => {
        const changeColor = () => {
            if (window.scrollY >= 90) {
                setColor('#ffffff');
                setTextColor('#000000')
            } else {
              
                setColor('#000000');
                setTextColor('#ffffff')
            }
        }
        window.addEventListener('scroll', changeColor)
    }, [])

    return (
        
        <div style={{ backgroundColor: `${color}` }} className='fixed left-0 top-0 w-full z-30 transition-colors duration-300'>
            <div className='max-w-[1240px] m-auto flex justify-between items-center p-4 text-white'>
                <Link href='/'>
    <img 
    src="/images/logofv.png" 
    className="h-14 w-32 object-contain hover:opacity-80 transition-opacity duration-300 cursor-pointer" 
    alt="Logo FullVision" 
/>
</Link>
                
                {/** Desktop Menu */}
                <ul style={{ color: `${textColor}` }} className='hidden sm:flex align-middle'>
                    <li className='p-4 mt-1'>
                        <Link href='/'>Início</Link>
                    </li>
                    <li className='p-4 mt-1'>
                        <Link href='/about'>Sobre nós</Link>
                    </li>
                    <li className='p-4 mt-1'>
                        <Link href='/solutions'>Soluções</Link>
                    </li>
                    <li className='p-4 mt-1'>
                        <Link href='/contact'>Contato</Link>
                    </li>
                </ul>

                {/** Mobile Button */}
                <div onClick={() => setNav(!nav)} className='block sm:hidden z-10 cursor-pointer'>
                    {nav
                        ? <AiOutlineClose size={20} style={{ color: `${textColor}` }} />
                        : <AiOutlineMenu size={20} style={{ color: `${textColor}` }} />}
                </div>

                {/** Mobile Menu */}
                <div className={nav
                    ? 'sm:hidden absolute top-0 left-0 right-0 bottom-0 flex justify-center items-center w-full h-screen bg-black text-center ease-in duration-300'
                    : 'sm:hidden absolute top-0 left-[-100%] right-0 bottom-0 flex justify-center items-center w-full h-screen bg-black text-center ease-in duration-300'
                }>
                    <ul>
                        <li className='p-4 text-4xl hover:text-gray-500'>
                            <Link href='/' onClick={() => setNav(!nav)}>Início</Link>
                        </li>
                        <li className='p-4 text-4xl hover:text-gray-500'>
                            <Link href='/about' onClick={() => setNav(!nav)}>Sobre nós</Link>
                        </li>
                        <li className='p-4 text-4xl hover:text-gray-500'>
                            <Link href='/solutions' onClick={() => setNav(!nav)}>Soluções</Link>
                        </li>
                        <li className='p-4 text-4xl hover:text-gray-500'>
                            <Link href='/contact' onClick={() => setNav(!nav)}>Contato</Link>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    )
}

export default Navbar