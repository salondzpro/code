/**
 * DIAGNOSTIC TEMPORAIRE (24 nov. 2026) — connexion Google / Apple dans les applications.
 *
 * Le serveur voit la connexion réussir puis plus rien : on ne sait pas à quelle étape l'application
 * repart sur le portail. Pendant les 5 minutes qui suivent un toucher sur Google ou Apple, chaque
 * étape envoie une requête `GET /v1/_trace/<étape>?…` que l'API journalise (404 sans effet). JAMAIS
 * de jeton ni d'adresse e-mail : seulement des étapes, des oui/non et des chemins sans fragment.
 * À RETIRER une fois la cause trouvée.
 */
import { env } from './env';
import { APPLI } from './flavor';

const CLE = 'salondz:trace-connexion';
const DUREE_MS = 5 * 60_000;

export function demarrerTrace(): void {
  try {
    localStorage.setItem(CLE, String(Date.now()));
  } catch {
    /* stockage indisponible */
  }
}

function actif(): boolean {
  try {
    const t = Number(localStorage.getItem(CLE));
    return Boolean(t) && Date.now() - t < DUREE_MS;
  } catch {
    return false;
  }
}

export function trace(etape: string, infos: Record<string, string | number | boolean | null | undefined> = {}): void {
  if (!actif()) return;
  const q = new URLSearchParams({
    a: APPLI ?? 'site',
    v: String(import.meta.env.VITE_BUNDLE_VERSION || 'dev').slice(0, 7),
    p: location.pathname,
    t: String(Date.now() % 1e7),
  });
  for (const [k, v] of Object.entries(infos)) if (v !== undefined) q.set(k, String(v).slice(0, 80));
  try {
    void fetch(`${env.apiUrl.replace(/\/$/, '')}/v1/_trace/${encodeURIComponent(etape)}?${q}`, { mode: 'no-cors', keepalive: true }).catch(() => undefined);
  } catch {
    /* rien */
  }
}
