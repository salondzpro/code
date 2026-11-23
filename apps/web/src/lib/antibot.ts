/**
 * ANTI-ROBOTS côté écran (23 nov. 2026, `apps/api/src/lib/antibot.ts`) : avant une inscription, une
 * connexion par mot de passe, un lien ou un code envoyé, on demande un casse-tête au serveur et on
 * le résout pour l'adresse ou le numéro visé (`solveProof`, environ une demi-seconde, invisible).
 * Une preuve reste valable 3 minutes : elle est gardée par sujet et resservie (deuxième essai de
 * mot de passe, adresse interne du même compte) au lieu d'être recalculée.
 */
import { api } from './api';
import { solveProof } from './proofOfWork';

type Preuve = { challenge: string; nonce: string };
const cache = new Map<string, { p: Preuve; jusqua: number }>();

export async function preuve(sujet: string): Promise<Preuve> {
  const cle = sujet.trim().toLowerCase();
  const deja = cache.get(cle);
  if (deja && deja.jusqua > Date.now()) return deja.p;
  const { challenge, bits } = await api.auth.challenge();
  const nonce = await solveProof(challenge, cle, bits);
  const p = { challenge, nonce };
  // Le serveur accorde 3 min ; on s'arrête à 2 min 30 pour ne jamais envoyer une preuve périmée.
  cache.set(cle, { p, jusqua: Date.now() + 150_000 });
  return p;
}
