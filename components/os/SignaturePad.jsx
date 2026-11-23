import React, { useEffect, useRef, useState } from 'react';
import { FaEraser } from 'react-icons/fa';

// Quadro de assinatura (dedo no celular ou mouse). Devolve um PNG pelo onChange (null quando limpo).
export default function SignaturePad({ onChange, height = 150 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [temTraco, setTemTraco] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round((rect.width || 300) * dpr));
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111827';
    }
  }, [height]);

  const ponto = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const ctxDe = () => (canvasRef.current && canvasRef.current.getContext ? canvasRef.current.getContext('2d') : null);

  const inicio = (e) => {
    const ctx = ctxDe();
    if (!ctx) return;
    drawing.current = true;
    if (canvasRef.current.setPointerCapture) canvasRef.current.setPointerCapture(e.pointerId);
    const { x, y } = ponto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  };
  const mover = (e) => {
    if (!drawing.current) return;
    const ctx = ctxDe();
    if (!ctx) return;
    const { x, y } = ponto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const fim = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setTemTraco(true);
    canvasRef.current.toBlob((blob) => onChange(blob), 'image/png');
  };
  const limpar = () => {
    const canvas = canvasRef.current;
    const ctx = ctxDe();
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTemTraco(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border border-gray-700 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          style={{ height, touchAction: 'none' }}
          className="w-full block cursor-crosshair"
          onPointerDown={inicio}
          onPointerMove={mover}
          onPointerUp={fim}
          onPointerLeave={fim}
          aria-label="Quadro de assinatura"
        />
        {!temTraco && <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 pointer-events-none">Assine aqui</div>}
      </div>
      <button type="button" onClick={limpar} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
        <FaEraser size={11} /> Limpar assinatura
      </button>
    </div>
  );
}
