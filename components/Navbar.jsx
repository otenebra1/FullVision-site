import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BsBoxArrowUpRight } from 'react-icons/bs';
import { FaBars, FaTimes } from 'react-icons/fa';

const Navbar = () => {
  const [nav, setNav] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleNav = () => {
    setNav(!nav);
  };

  useEffect(() => {
    const changeColor = () => {
      if (window.scrollY >= 90) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', changeColor);
    return () => window.removeEventListener('scroll', changeColor);
  }, []);

  return (
    <div
      className={`fixed left-0 top-0 w-full z-50 transition-all duration-300 backdrop-blur-md border-b ${
        scrolled
          ? 'bg-black/75 border-gray-800/80 shadow-xl'
          : 'bg-black/30 border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center p-4 text-white">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/images/logo.png"
            alt="Full Vision Logo"
            width={160}
            height={40}
            className="object-contain"
            priority
          />
        </Link>

        {/* Menu Desktop */}
        <div className="hidden md:flex items-center gap-8">
          <ul className="flex items-center gap-8 text-sm font-medium">
            <li>
              <Link href="/" className="hover:text-blue-400 transition-colors">
                Início
              </Link>
            </li>
            <li>
              <Link href="/solutions" className="hover:text-blue-400 transition-colors">
                Soluções
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-blue-400 transition-colors">
                Sobre Nós
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-blue-400 transition-colors">
                Contato
              </Link>
            </li>
          </ul>

          {/* Botão de Acesso ao Sistema */}
          <a
            href="https://tracker.fullvision.one/v1/home"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-xs font-semibold transition-all shadow-md shadow-blue-500/20"
          >
            Acessar Sistema <BsBoxArrowUpRight size={13} />
          </a>
        </div>

        {/* Ícone Menu Mobile */}
        <div onClick={handleNav} className="block md:hidden z-10 cursor-pointer">
          {nav ? <FaTimes size={22} className="text-white" /> : <FaBars size={22} className="text-white" />}
        </div>

        {/* Menu Mobile */}
        <div
          className={
            nav
              ? 'md:hidden absolute top-0 left-0 right-0 bottom-0 flex flex-col justify-center items-center w-full h-screen bg-black/95 backdrop-blur-xl text-center transition-all duration-300'
              : 'md:hidden absolute top-0 left-[-100%] right-0 bottom-0 flex flex-col justify-center items-center w-full h-screen bg-black/95 text-center transition-all duration-300'
          }
        >
          <ul className="space-y-6 text-lg font-semibold mb-8">
            <li onClick={handleNav}>
              <Link href="/" className="hover:text-blue-400 transition-colors">
                Início
              </Link>
            </li>
            <li onClick={handleNav}>
              <Link href="/solutions" className="hover:text-blue-400 transition-colors">
                Soluções
              </Link>
            </li>
            <li onClick={handleNav}>
              <Link href="/about" className="hover:text-blue-400 transition-colors">
                Sobre Nós
              </Link>
            </li>
            <li onClick={handleNav}>
              <Link href="/contact" className="hover:text-blue-400 transition-colors">
                Contato
              </Link>
            </li>
          </ul>

          <a
            href="https://tracker.fullvision.one/v1/home"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleNav}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-blue-500/30"
          >
            Acessar Sistema <BsBoxArrowUpRight size={15} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default Navbar;