import React from 'react';
import { FaWhatsapp } from 'react-icons/fa';

const WhatsAppButton = () => {
  const phoneNumber = "5511940670589"; 
  const message = "Olá! Estava no site da FullVision e gostaria de saber mais sobre as soluções de rastreamento.";
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-[0_4px_15px_rgba(37,211,102,0.4)] hover:bg-[#20bd5a] hover:scale-110 hover:shadow-[0_6px_20px_rgba(37,211,102,0.6)] transition-all duration-300 group"
      title="Fale conosco pelo WhatsApp"
    >
      <FaWhatsapp className="text-3xl" />
      <span className="absolute right-16 top-3 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap border border-gray-700">
        Fale com um especialista
      </span>
    </a>
  );
};

// ESSA É A LINHA QUE EVITA O ERRO 130:
export default WhatsAppButton;