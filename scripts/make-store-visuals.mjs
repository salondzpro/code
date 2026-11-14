/**
 * VISUELS DE PRÉSENTATION DES BOUTIQUES, au thème actuel (14 nov. 2026, demande du propriétaire :
 * « un nouveau design, meilleur que celui d'avant, au même thème que l'application »).
 *
 *   node scripts/make-store-visuals.mjs            → captures fraîches de la PRODUCTION, puis visuels
 *   node scripts/make-store-visuals.mjs --sans-captures   → recompose seulement (captures déjà prises)
 *   node scripts/make-store-visuals.mjs --url http://localhost:9000
 *
 * PARTI PRIS (celui de la page `/home`) : fond clair, halos beige et gris, très grands titres en Plus
 * Jakarta Sans serrée, deuxième ligne en gris — et le PRODUIT au centre : de vrais écrans de
 * l'application, pris sur salondz.com avec les comptes de démonstration, dans un iPhone dessiné en
 * CSS (cadre, Dynamic Island, barre d'état). Le téléphone déborde du bas : on lit l'écran, pas un
 * gadget. Le premier visuel de chaque appli est une couverture à trois écrans en éventail.
 *
 * Sorties (écrasées à chaque passage) :
 *   apps/web/ios/store/presentation-6-7/            Salon DZ, iPhone 6,7 pouces (1290×2796)
 *   apps/web/ios/store/pro/presentation-6-7/        Salon DZ Pro, idem
 *   apps/web/android/store/client|pro/telephone/    Google Play téléphone (1080×1920)
 *   apps/web/android/store/client|pro/tablette-7/   Google Play tablette 7 pouces (1200×1920)
 *   apps/web/android/store/client|pro/tablette-10/  Google Play tablette 10 pouces (1600×2560)
 *   apps/web/android/store/client|pro/image-de-presentation-1024x500.png
 * Puis : `make-store-derives.mjs` (iPhone 6,5 et 5,5 pouces), `asc-captures.mjs`, `play-visuels.mjs`.
 *
 * Un écran de l'application qui change = relancer ce script : les visuels montrent le vrai produit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const BASE = arg('--url', 'https://salondz.com').replace(/\/$/, '');
const CAPTURER = !process.argv.includes('--sans-captures');
const ECRANS = path.join(ROOT, '.store-ecrans');

/** iPhone 6,7 pouces : 430×932 points, densité 3. Marges de l'iPhone à Dynamic Island. */
const PT = { l: 430, h: 932, d: 3, haut: 59, bas: 34 };

// ------------------------------------------------------------------------------------ captures
async function capturer() {
  fs.mkdirSync(path.join(ECRANS, 'client'), { recursive: true });
  fs.mkdirSync(path.join(ECRANS, 'pro'), { recursive: true });
  const b = await pw.chromium.launch({ channel: 'chrome' });
  const contexte = async (natif = false) => {
    const ctx = await b.newContext({
      viewport: { width: PT.l, height: PT.h },
      deviceScaleFactor: PT.d,
      isMobile: true,
      hasTouch: true,
      locale: 'fr-FR',
      timezoneId: 'Africa/Algiers',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });
    await ctx.addInitScript(
      ([haut, bas, natif]) => {
        const poser = () => {
          const s = document.documentElement.style;
          s.setProperty('--sat', haut + 'px');
          s.setProperty('--sab', bas + 'px');
        };
        poser();
        document.addEventListener('DOMContentLoaded', poser);
        // Écran du choix de la langue : il n'existe que dans l'application (coque native simulée).
        if (natif) Object.defineProperty(window, 'androidBridge', { value: { postMessage() {} }, configurable: true });
      },
      [PT.haut, PT.bas, natif],
    );
    const p = await ctx.newPage();
    p.setDefaultTimeout(40000);
    return p;
  };
  const calme = async (p, ms = 1800) => {
    await p.waitForLoadState('networkidle').catch(() => {});
    await p.waitForTimeout(ms);
  };
  const prendre = async (p, app, nom) => {
    // Piège connu (scripts/check-safe-areas.mjs) : une variable posée avant l'analyse du HTML est
    // remplacée par le parseur. Les marges de l'iPhone sont donc réinjectées APRÈS chargement.
    await p.addStyleTag({ content: `:root{--sat:${PT.haut}px !important;--sab:${PT.bas}px !important}` });
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(ECRANS, app, `${nom}.png`), clip: { x: 0, y: 0, width: PT.l, height: PT.h } });
    console.log('  ✔ écran', app, nom);
  };
  const connexion = async (p, base, email) => {
    await p.goto(`${BASE}${base}`, { waitUntil: 'domcontentloaded' });
    await calme(p, 1500);
    await p.locator('input[type=email]').first().fill(email);
    await p.getByRole('button', { name: /Continuer/ }).first().click();
    await p.locator('input[type=password]').first().fill(email);
    await p.getByRole('button', { name: /Se connecter/ }).first().click();
    await calme(p, 3500);
    if (/acces|intro|connexion/.test(new URL(p.url()).pathname)) throw new Error(`connexion refusée : ${email}`);
  };

  try {
    // ---- Salon DZ (client)
    let p = await contexte();
    await connexion(p, '/acces?next=%2F', 'client@salondz.com');
    await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await calme(p, 3000);
    await prendre(p, 'client', 'accueil');
    const salon = await p.evaluate(() => document.querySelector('a[href^="/s/"]')?.getAttribute('href'));
    await p.goto(`${BASE}${salon}`, { waitUntil: 'domcontentloaded' });
    await calme(p, 2500);
    await prendre(p, 'client', 'salon');
    await p.goto(`${BASE}${salon}/prestations`, { waitUntil: 'domcontentloaded' });
    await calme(p);
    await p.getByRole('button', { name: /Choisir/ }).first().click();
    await calme(p, 2500);
    await p.locator('button.slot, button[class*=slot]').first().click().catch(() => {});
    await calme(p, 1200);
    await prendre(p, 'client', 'quand');
    await p.goto(`${BASE}/rendez-vous`, { waitUntil: 'domcontentloaded' });
    await calme(p, 2500);
    // Le bandeau « activer les notifications » n'est pas le produit : on le referme.
    await p.getByRole('button', { name: /Plus tard|Fermer/ }).first().click().catch(() => {});
    await calme(p, 800);
    await prendre(p, 'client', 'rendez-vous');
    await p.goto(`${BASE}/carte`, { waitUntil: 'domcontentloaded' });
    await calme(p, 4500);
    await prendre(p, 'client', 'carte');
    // Choix de la langue : premier lancement de l'application.
    const q = await contexte(true);
    await q.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await calme(q, 3500);
    await q.getByRole('radio', { name: /العربية/ }).click().catch(() => {});
    await calme(q, 600);
    await prendre(q, 'client', 'langue');

    // ---- Salon DZ Pro (le salon de démonstration féminin : le plus fourni)
    p = await contexte();
    await connexion(p, '/pro/acces', 'pro-femme@salondz.com');
    for (const [nom, url, ms] of [
      ['accueil', '/pro', 3500],
      ['demandes', '/pro/reservations', 2500],
      ['rappels', '/pro/rappels', 2500],
      ['ma-page', '/pro/ma-page', 3000],
      ['clients', '/pro/clients', 2500],
    ]) {
      await p.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
      await calme(p, ms);
      await p.getByRole('button', { name: /Plus tard/ }).first().click().catch(() => {});
      await prendre(p, 'pro', nom);
    }
    await p.goto(`${BASE}/pro/agenda`, { waitUntil: 'domcontentloaded' });
    await calme(p, 3000);
    // Un agenda doit montrer des rendez-vous, pas des heures creuses : on descend vers la fin de matinée.
    await p.evaluate(() => {
      const d = [...document.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 300 && getComputedStyle(e).overflowY !== 'visible');
      if (d) d.scrollTop = d.scrollHeight * 0.18;
      else window.scrollBy(0, 220);
    });
    await calme(p, 1200);
    await prendre(p, 'pro', 'agenda');
  } finally {
    await b.close();
  }
}

// ------------------------------------------------------------------------------------ contenu
/** Les visuels, dans l'ordre d'affichage. `ecrans` : un écran, ou trois (couverture en éventail). */
const APPS = {
  client: {
    nom: 'Salon DZ',
    fichier: 'salondz',
    volets: [
      { cle: 'couverture', k: 'Salon DZ', t1: 'Votre beauté,', t2: 'réservée en 3 taps.', ar: 'احجز صالونك في ثوانٍ', ecrans: ['salon', 'accueil', 'quand'] },
      { cle: 'accueil', k: 'Tous les salons', t1: 'Coiffure, ongles,', t2: 'cils, barbe.', s: 'Les créneaux libres du jour, près de chez vous.', ecrans: ['accueil'] },
      { cle: 'creneau', k: 'Réservation', t1: 'Choisissez', t2: 'votre heure.', s: 'Sans appeler. Les prix en dinars.', ecrans: ['quand'] },
      { cle: 'salon', k: 'Chaque salon', t1: 'Prestations,', t2: 'photos et avis.', s: 'Tout ce qu’il faut pour choisir.', ecrans: ['salon'] },
      { cle: 'carte', k: 'Autour de vous', t1: 'Les salons', t2: 'sur la carte.', s: 'Et leurs prochaines heures libres.', ecrans: ['carte'] },
      { cle: 'rappels', k: 'Vos rendez-vous', t1: 'On vous le', t2: 'rappelle.', s: 'Confirmation du salon, rappel 1 h puis 30 min avant.', ecrans: ['rendez-vous'] },
      { cle: 'langues', k: 'Français · العربية · English', t1: 'Dans', t2: 'votre langue.', s: 'Choisie au premier lancement.', ecrans: ['langue'] },
    ],
  },
  pro: {
    nom: 'Salon DZ Pro',
    fichier: 'salondz-pro',
    volets: [
      { cle: 'couverture', k: 'Salon DZ Pro', t1: 'Votre salon se remplit', t2: 'pendant que vous coiffez.', ar: 'صالونك يمتلئ وأنت تعمل', ecrans: ['agenda', 'accueil', 'demandes'] },
      { cle: 'agenda', k: 'Agenda d’équipe', t1: 'Votre journée,', t2: 'heure par heure.', s: 'Chaque membre dans sa colonne, chaque statut dans sa couleur.', ecrans: ['agenda'] },
      { cle: 'demandes', k: 'Demandes', t1: 'Acceptez', t2: 'd’un geste.', s: 'Les réservations arrivent seules, jour et nuit.', ecrans: ['demandes'] },
      { cle: 'rappels', k: 'Rappels', t1: 'Vos messages,', t2: 'déjà écrits.', s: 'WhatsApp, SMS ou appel, en un toucher.', ecrans: ['rappels'] },
      { cle: 'ma-page', k: 'Ma page', t1: 'D’où viennent', t2: 'vos clientes.', s: 'Et ce que Salon DZ vous rapporte.', ecrans: ['ma-page'] },
      { cle: 'clientes', k: 'Fichier clientes', t1: 'Toutes vos clientes,', t2: 'au même endroit.', s: 'Historique, notes, fidélité.', ecrans: ['clients'] },
    ],
  },
};

// ------------------------------------------------------------------------------------ composition
const b64 = (f) => fs.readFileSync(f).toString('base64');
const FONTE = `@font-face{font-family:Jak;font-weight:200 800;src:url(data:font/woff2;base64,${b64(path.join(ROOT, 'apps/web/public/fonts/jakarta-latin.woff2'))}) format('woff2')}
@font-face{font-family:Cairo;src:url(data:font/woff2;base64,${b64(path.join(ROOT, 'apps/web/public/fonts/cairo-arabic.woff2'))}) format('woff2')}`;
const ICONE = (app) => `data:image/png;base64,${b64(path.join(ROOT, 'apps/web/android/store', app === 'pro' ? 'icone-play-store-512-pro.png' : 'icone-play-store-512.png'))}`;
const ecran = (app, nom) => `data:image/png;base64,${b64(path.join(ECRANS, app, `${nom}.png`))}`;

/** Un iPhone : cadre d'encre, écran réel, Dynamic Island, barre d'état. Largeur `--pw`. */
const telephone = (src, cls = '') => `
  <div class="ph ${cls}">
    <img src="${src}">
    <span class="sb"><b>9:41</b><i class="ic"><svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0zM3.3 6.7a6.6 6.6 0 0 1 9.4 0l-1.6 1.6a4.4 4.4 0 0 0-6.2 0zM1 4.4a9.9 9.9 0 0 1 14 0l-1.6 1.6a7.6 7.6 0 0 0-10.8 0z"/></svg><span class="bat"><span></span></span></i></span>
    <span class="di"></span>
  </div>`;

const CSS = `${FONTE}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:var(--W);height:var(--H);overflow:hidden}
body{font-family:Jak,-apple-system,sans-serif;color:#111;-webkit-font-smoothing:antialiased;position:relative;
  background:linear-gradient(180deg,#ffffff 0%,#fbfbfc 38%,#f2f2f5 100%)}
.halo{position:absolute;border-radius:50%;filter:blur(calc(var(--u)*9))}
.h1{width:calc(var(--u)*70);height:calc(var(--u)*70);left:calc(var(--u)*-18);top:calc(var(--H)*0.36);background:#efe2d2;opacity:.85}
.h2{width:calc(var(--u)*64);height:calc(var(--u)*64);right:calc(var(--u)*-20);top:calc(var(--H)*0.28);background:#dfe4ee;opacity:.9}
.h3{width:calc(var(--u)*50);height:calc(var(--u)*50);left:calc(var(--u)*30);top:calc(var(--H)*0.62);background:#f6ece2;opacity:.8}
.txt{position:absolute;left:0;right:0;top:calc(var(--H)*var(--top));padding:0 calc(var(--u)*7);text-align:center;z-index:2}
.k{display:inline-flex;align-items:center;gap:calc(var(--u)*1.6);font-size:calc(var(--u)*3.1);font-weight:600;color:#6e6e76;letter-spacing:-.01em}
.k img{width:calc(var(--u)*6.4);height:calc(var(--u)*6.4);border-radius:calc(var(--u)*1.5);box-shadow:0 calc(var(--u)*.6) calc(var(--u)*2) rgba(0,0,0,.18)}
.t{margin-top:calc(var(--u)*2.4);font-size:calc(var(--u)*var(--tz));font-weight:600;line-height:1.04;letter-spacing:-.048em;text-wrap:balance}
.t span{display:block}
.t .g{color:#9d9da4}
.s{margin:calc(var(--u)*2.6) auto 0;max-width:calc(var(--u)*78);font-size:calc(var(--u)*3.5);line-height:1.38;color:#6e6e76;letter-spacing:-.01em}
.ar{margin-top:calc(var(--u)*2.2);font-family:Cairo,sans-serif;font-size:calc(var(--u)*4);color:#8e8e94;direction:rtl}
.ph{--r:calc(var(--pw)*.155);position:absolute;width:var(--pw);aspect-ratio:1290/2796;border-radius:var(--r);background:#0b0b0c;padding:calc(var(--pw)*.028);
  box-shadow:0 0 0 calc(var(--pw)*.006) #2c2c2f inset,0 calc(var(--pw)*.004) 0 calc(var(--pw)*.006) #3a3a3d,0 calc(var(--pw)*.14) calc(var(--pw)*.22) calc(var(--pw)*-.08) rgba(0,0,0,.34),0 calc(var(--pw)*.05) calc(var(--pw)*.08) calc(var(--pw)*-.05) rgba(0,0,0,.25);z-index:3}
.ph img{display:block;width:100%;height:100%;object-fit:cover;object-position:top;border-radius:calc(var(--r) - var(--pw)*.028)}
.di{position:absolute;left:50%;top:calc(var(--pw)*.052);width:calc(var(--pw)*.29);height:calc(var(--pw)*.082);transform:translateX(-50%);border-radius:999px;background:#000}
.sb{position:absolute;left:calc(var(--pw)*.11);right:calc(var(--pw)*.09);top:calc(var(--pw)*.06);height:calc(var(--pw)*.07);display:flex;align-items:center;justify-content:space-between;font-size:calc(var(--pw)*.047);color:#111}
.sb b{font-weight:600;letter-spacing:-.02em;padding-left:calc(var(--pw)*.03)}
.ic{display:flex;align-items:center;gap:calc(var(--pw)*.014);font-style:normal}
.ic svg{height:calc(var(--pw)*.034);fill:#111}
.bat{position:relative;display:block;width:calc(var(--pw)*.07);height:calc(var(--pw)*.034);border-radius:calc(var(--pw)*.01);border:calc(var(--pw)*.004) solid rgba(0,0,0,.4);padding:calc(var(--pw)*.004)}
.bat span{display:block;width:80%;height:100%;border-radius:calc(var(--pw)*.006);background:#111}
.solo{left:50%;top:calc(var(--H)*var(--ptop));transform:translateX(-50%) rotate(var(--rot,0deg))}
.fan .c{left:50%;top:calc(var(--H)*var(--ptop));transform:translateX(-50%)}
.fan .g{left:50%;top:calc(var(--H)*var(--ptop) + var(--pw)*.16);transform:translateX(calc(-50% - var(--pw)*.72)) rotate(-8deg) scale(.86);z-index:2}
.fan .d{left:50%;top:calc(var(--H)*var(--ptop) + var(--pw)*.16);transform:translateX(calc(-50% + var(--pw)*.72)) rotate(8deg) scale(.86);z-index:2}
.pied{position:absolute;left:0;right:0;bottom:0;height:calc(var(--H)*.08);background:linear-gradient(180deg,rgba(242,242,245,0),#f2f2f5);z-index:4}
/* Bannière Google Play 1024×500 */
.ban{display:flex;align-items:center;height:100%;padding:0 56px;gap:24px;position:relative;z-index:2}
.ban .txt2{flex:1}
.ban .k{font-size:20px}.ban .k img{width:40px;height:40px;border-radius:10px}
.ban .t{font-size:48px;margin-top:14px}
`;

function page(app, v, W, H) {
  const portrait = H / W;
  // Proportions : un écran haut (iPhone 6,7) laisse plus de place au titre qu'un 9:16.
  const fan = v.ecrans.length === 3;
  const tz = v.t1.length + v.t2.length > 34 ? 8.2 : 9.6;
  const top = portrait > 2 ? 0.075 : 0.06;
  const ptop = portrait > 2 ? (fan ? 0.4 : 0.33) : fan ? 0.43 : 0.36;
  const pw = fan ? (portrait > 2 ? 0.5 : 0.42) : portrait > 2 ? 0.72 : portrait > 1.7 ? 0.6 : 0.56;
  const rot = 0;
  const phones = fan
    ? `<div class="fan">${telephone(ecran(app, v.ecrans[0]), 'g')}${telephone(ecran(app, v.ecrans[2]), 'd')}${telephone(ecran(app, v.ecrans[1]), 'c')}</div>`
    : telephone(ecran(app, v.ecrans[0]), 'solo');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}
:root{--W:${W}px;--H:${H}px;--u:${W / 100}px;--tz:${tz};--top:${top};--ptop:${ptop};--pw:${Math.round(W * pw)}px;--rot:${rot}deg}</style></head><body>
<span class="halo h1"></span><span class="halo h2"></span><span class="halo h3"></span>
<div class="txt">
  <p class="k">${v.cle === 'couverture' ? `<img src="${ICONE(app)}">` : ''}${v.k}</p>
  <h1 class="t"><span>${v.t1}</span><span class="g">${v.t2}</span></h1>
  ${v.s ? `<p class="s">${v.s}</p>` : ''}${v.ar ? `<p class="ar">${v.ar}</p>` : ''}
</div>
${phones}
<span class="pied"></span>
</body></html>`;
}

function banniere(app) {
  const a = APPS[app];
  const v = a.volets[0];
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}
:root{--W:1024px;--H:500px;--u:10.24px;--pw:200px}
.ph{position:absolute;top:70px}
</style></head><body>
<span class="halo h1" style="top:120px;left:420px"></span><span class="halo h2" style="top:-60px;right:-120px"></span>
<div class="ban"><div class="txt2"><p class="k"><img src="${ICONE(app)}">${a.nom}</p><h1 class="t"><span>${v.t1}</span><span class="g">${v.t2}</span></h1></div></div>
${telephone(ecran(app, v.ecrans[0]), '').replace('class="ph "', 'class="ph" style="left:600px;top:110px;transform:rotate(-7deg)"')}
${telephone(ecran(app, v.ecrans[1]), '').replace('class="ph "', 'class="ph" style="left:770px;top:60px;transform:rotate(5deg)"')}
</body></html>`;
}

async function composer() {
  const b = await pw.chromium.launch({ channel: 'chrome' });
  const FORMATS = [
    { cle: 'ios', W: 1290, H: 2796, dossier: (app) => path.join(ROOT, 'apps/web/ios/store', ...(app === 'pro' ? ['pro'] : []), 'presentation-6-7') },
    { cle: 'telephone', W: 1080, H: 1920, dossier: (app) => path.join(ROOT, 'apps/web/android/store', app, 'telephone') },
    { cle: 'tablette-7', W: 1200, H: 1920, dossier: (app) => path.join(ROOT, 'apps/web/android/store', app, 'tablette-7') },
    { cle: 'tablette-10', W: 1600, H: 2560, dossier: (app) => path.join(ROOT, 'apps/web/android/store', app, 'tablette-10') },
  ];
  try {
    for (const app of Object.keys(APPS)) {
      const a = APPS[app];
      for (const f of FORMATS) {
        const dossier = f.dossier(app);
        fs.mkdirSync(dossier, { recursive: true });
        for (const vieux of fs.readdirSync(dossier).filter((x) => x.endsWith('.png'))) fs.unlinkSync(path.join(dossier, vieux));
        const p = await b.newPage({ viewport: { width: f.W, height: f.H }, deviceScaleFactor: 1 });
        for (const [i, v] of a.volets.entries()) {
          await p.setContent(page(app, v, f.W, f.H), { waitUntil: 'load' });
          await p.evaluate(() => document.fonts.ready);
          await p.waitForTimeout(150);
          const nom = `${a.fichier}-${String(i + 1).padStart(2, '0')}-${v.cle}.png`;
          await p.screenshot({ path: path.join(dossier, nom), clip: { x: 0, y: 0, width: f.W, height: f.H } });
        }
        await p.close();
        console.log(`✔ ${app} · ${f.cle} (${f.W}×${f.H}) · ${a.volets.length} visuels → ${path.relative(ROOT, dossier)}`);
      }
      const p = await b.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
      await p.setContent(banniere(app), { waitUntil: 'load' });
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(150);
      const ban = path.join(ROOT, 'apps/web/android/store', app, 'image-de-presentation-1024x500.png');
      await p.screenshot({ path: ban, clip: { x: 0, y: 0, width: 1024, height: 500 } });
      await p.close();
      console.log(`✔ ${app} · bannière 1024×500`);
    }
  } finally {
    await b.close();
  }
}

if (CAPTURER) await capturer();
await composer();
