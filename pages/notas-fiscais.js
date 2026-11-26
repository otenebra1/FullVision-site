// /notas-fiscais — as notas fiscais agora ficam dentro do Financeiro (aba "Notas fiscais").
// Este endereço só redireciona, para não quebrar links antigos.
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function NotasFiscaisRedireciona() {
  const router = useRouter();
  useEffect(() => { router.replace('/financeiro?aba=notas'); }, [router]);
  return <div className="min-h-screen bg-black" />;
}
