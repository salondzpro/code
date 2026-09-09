/**
 * Une application ouverte depuis longtemps sur un téléphone garde l'ancien bundle en mémoire : après un
 * déploiement, l'utilisateur ne voit pas les nouveautés tant qu'il ne recharge pas. Au retour au premier plan
 * (et au plus toutes les 10 min), on relit index.html sans cache et on compare le nom du bundle : s'il a
 * changé, on recharge la page — uniquement quand aucune saisie n'est en cours.
 */
const INTERVAL_MS = 10 * 60_000;
let last = 0;

function currentBundle(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]');
  return el?.getAttribute('src') ?? null;
}

async function check(): Promise<void> {
  const now = Date.now();
  if (now - last < INTERVAL_MS) return;
  last = now;
  const mine = currentBundle();
  if (!mine) return;
  try {
    const html = await (await fetch('/index.html', { cache: 'no-store' })).text();
    const m = html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/);
    if (m && m[1] && !mine.endsWith(m[1].replace(/^\./, '')) && m[1] !== mine) {
      const typing =
        document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
      if (!typing) window.location.reload();
    }
  } catch {
    // hors ligne : on réessaiera plus tard
  }
}

export function startUpdateCheck(): void {
  if (import.meta.env.DEV) return;
  last = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
  window.setInterval(() => void check(), INTERVAL_MS);
}
