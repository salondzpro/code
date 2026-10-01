/**
 * Pilotage de Codemagic depuis le PC : lancer une compilation iOS, la suivre, lire ses étapes.
 *
 *   node --env-file=.env scripts/codemagic.mjs --lancer     → démarre une compilation sur `main`
 *   node --env-file=.env scripts/codemagic.mjs --suivre     → suit la dernière jusqu'à la fin
 *   node --env-file=.env scripts/codemagic.mjs              → l'état des cinq dernières
 *
 * UNE COMPILATION macOS SE PAIE À LA MINUTE (500 min/mois offertes, ~12 min par passage) : ne
 * lancer que lorsqu'il y a vraiment quelque chose à publier, jamais pour une retouche.
 */
const JETON = process.env.CODEMAGIC_API_TOKEN;
if (!JETON) throw new Error('CODEMAGIC_API_TOKEN absent : node --env-file=.env …');
const APP = '6aba963b3b35a524ae18ca5b';
const H = { 'x-auth-token': JETON, 'Content-Type': 'application/json' };
const api = async (p, init) => (await fetch('https://api.codemagic.io' + p, { headers: H, ...init })).json();

const arg = (n) => process.argv.includes(n);

/** Identifiant de la compilation à suivre : celle qu'on vient de lancer, sinon la dernière. */
let suivi = null;

if (arg('--lancer')) {
  const r = await api('/builds', { method: 'POST', body: JSON.stringify({ appId: APP, workflowId: 'ios', branch: 'main' }) });
  suivi = r.buildId ?? null;
  console.log('compilation lancée :', suivi ?? JSON.stringify(r));
}

/**
 * On suit la compilation PAR SON IDENTIFIANT. Interroger « la dernière » juste après l'avoir
 * lancée renvoyait parfois la précédente, déjà terminée : le suivi s'arrêtait aussitôt en
 * annonçant un succès qui n'était pas le sien.
 */
const dernier = async () =>
  suivi ? (await api(`/builds/${suivi}`)).build : (await api(`/builds?appId=${APP}&limit=1`)).builds?.[0];

if (arg('--suivre') || arg('--lancer')) {
  const fin = Date.now() + 45 * 60_000;
  let vu = '';
  while (Date.now() < fin) {
    const b = await dernier();
    const faites = (b?.buildActions ?? []).filter((a) => a.status === 'success').map((a) => a.name);
    const etat = `${b?.status} · ${faites.length} étape(s) · ${faites.at(-1) ?? '…'}`;
    if (etat !== vu) {
      console.log(new Date().toISOString().slice(11, 19), etat);
      vu = etat;
    }
    if (b?.status === 'finished') {
      console.log('✔ terminée · artefacts :', (b.artefacts ?? []).map((a) => a.name).join(', ') || 'aucun');
      process.exit(0);
    }
    if (b?.status === 'failed' || b?.status === 'canceled') {
      const rate = (b.buildActions ?? []).find((a) => a.status !== 'success' && a.status !== 'skipped');
      console.log('✖ échec à l’étape :', rate?.name ?? '?');
      process.exit(1);
    }
    await new Promise((f) => setTimeout(f, 30_000));
  }
  console.log('! toujours en cours après 45 min');
  process.exit(2);
}

const l = await api(`/builds?appId=${APP}&limit=5`);
for (const b of l.builds ?? []) console.log(b._id, b.status, b.startedAt ?? '');
