// POST /api/nfse/situacao  (só ADM)
// Diz se os tokens do emissor estão configurados na Vercel (sem mostrar o token)
import { soAdmin } from '../../../lib/nfseAuth';

export default async function handler(req, res) {
  if (!(await soAdmin(req, res))) return;
  return res.status(200).json({
    homologacao: Boolean(process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO),
    producao: Boolean(process.env.FOCUS_NFE_TOKEN_PRODUCAO),
  });
}
