// lib/nfseAuth.js — só o ADM usa as rotas /api/nfse/*
import { quemChamou } from './apiAuth';

export async function soAdmin(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ erro: 'Use POST.' }); return null; }
  const quem = await quemChamou(req);
  if (!quem || quem.role !== 'admin') { res.status(403).json({ erro: 'Só o ADM emite notas fiscais.' }); return null; }
  return quem;
}
