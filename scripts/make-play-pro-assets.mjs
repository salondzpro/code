/**
 * Visuels Google Play de l'application PROFESSIONNELLE (« Salon DZ Pro », `pro.salondz.app`).
 *
 *   node scripts/make-play-pro-assets.mjs
 *   node scripts/make-play-pro-assets.mjs --url http://localhost:9000
 *
 * Produit, sous `apps/web/android/store/pro/` :
 *   captures/     les six écrans professionnels bruts, 1080×1920, pris sur la PRODUCTION
 *   telephone/    les six visuels à envoyer sur la fiche, 1080×1920
 *   image-de-presentation-1024x500.png
 *
 * POURQUOI UN AUTRE FORMAT QUE L'APP STORE : Google refuse un rapport supérieur à 2:1. Les visuels
 * iPhone font 1290×2796, soit 2,167 — ils seraient rejetés à l'envoi. On dessine donc en 1080×1920
 * (16:9) de bout en bout, sans redimensionner : un volet découpé EST le fichier livré.
 *
 * POURQUOI ON PEUT LES PRENDRE DEPUIS LE SITE : depuis la bascule Capacitor, l'application EST le
 * site embarqué. Un rendu à la taille d'un téléphone est l'application au pixel près. La variante
 * professionnelle ne retire que les routes clientes : les écrans `/pro/*` y sont identiques.
 *
 * Le contenu vient de la DÉMONSTRATION (`pro-homme@salondz.com`, mot de passe identique à
 * l'adresse) : agenda rempli, demandes à confirmer, clientèle avec historique. La vraie place de
 * marché ne contient encore qu'un salon, et un agenda vide ne montre rien du produit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'apps', 'web', 'android', 'store', 'pro');
const CAPTURES = path.join(OUT, 'captures');
const PANNEAUX = path.join(OUT, 'telephone');
const FONTS = path.join(ROOT, 'apps', 'web', 'public', 'fonts');

const arg = (nom, defaut) => {
  const i = process.argv.indexOf(nom);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
};
const BASE = arg('--url', 'https://salondz.com').replace(/\/$/, '');

/**
 * 360×640 points à densité 3 donnent exactement 1080×1920. La DENSITÉ fait la taille, pas la
 * largeur de fenêtre : mettre 1080 px de large donnerait la mise en page d'une TABLETTE.
 */
const L = 1080;
const H = 1920;
const VUE = { width: 360, height: 640 };
/** Marges système d'un téléphone Android : l'application les réserve, la capture doit les montrer. */
const HAUT = 28;
const BAS = 16;

/** Les écrans qui décident un professionnel, dans l'ordre où Play les affichera. */
const ECRANS = [
  {
    nom: 'accueil',
    url: '/pro',
    surtitre: 'Votre journée',
    titre: ['Tout votre salon,', 'sur un'],
    accent: 'écran.',
    sous: 'Les rendez-vous du jour, les demandes à confirmer, le prochain client.',
  },
  {
    nom: 'agenda',
    url: '/pro/agenda',
    // L'agenda s'ouvre sur l'ouverture du salon, souvent creuse : on descend juste assez pour que
    // la capture montre des rendez-vous, pas des heures vides.
    defile: { part: 0.24 },
    surtitre: 'Agenda',
    titre: ['Toute l’équipe,', 'heure par'],
    accent: 'heure.',
    sous: 'Une colonne par personne. Un appui sur un creux crée le rendez-vous.',
  },
  {
    nom: 'reservations',
    url: '/pro/reservations',
    surtitre: 'Réservations',
    titre: ['Confirmez ou refusez,', 'en un'],
    accent: 'geste.',
    sous: 'Chaque demande arrive en notification, à l’instant où elle est faite.',
  },
  {
    nom: 'clients',
    url: '/pro/clients',
    surtitre: 'Clientèle',
    titre: ['Vous savez', 'qui'],
    accent: 'revient.',
    sous: 'Historique, notes et numéro de chaque client, au même endroit.',
  },
  {
    nom: 'lien',
    url: '/pro/lien',
    surtitre: 'Votre lien',
    titre: ['Instagram, WhatsApp :', 'on réserve'],
    accent: 'chez vous.',
    sous: 'Un lien et un QR code à vous. Vos clients réservent sans vous appeler.',
  },
  {
    nom: 'chiffre-affaires',
    url: '/pro/chiffre-affaires',
    // Le titre et le sélecteur sont déjà dits par le volet ; on descend sur le montant et le
    // graphique, qui autrement se termine sous la barre d'onglets.
    defile: { px: 150 },
    surtitre: 'Chiffre d’affaires',
    titre: ['Ce que rapporte', 'votre'],
    accent: 'semaine.',
    sous: 'Le jour, la semaine, le mois. En dinars, sans tableur.',
  },
];

const police = (poids) =>
  `@font-face{font-family:Inter;font-weight:${poids};font-display:block;src:url(data:font/woff2;base64,${fs
    .readFileSync(path.join(FONTS, `inter-${poids}.woff2`))
    .toString('base64')}) format('woff2')}`;
const POLICES = [400, 500, 600, 700].map(police).join('');
const b64 = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
const taille = (f) => {
  const b = fs.readFileSync(f);
  return { texte: `${b.readUInt32BE(16)}×${b.readUInt32BE(20)}`, ko: Math.round(b.length / 1024) };
};

fs.mkdirSync(CAPTURES, { recursive: true });
fs.mkdirSync(PANNEAUX, { recursive: true });

const navigateur = await pw.chromium.launch({ channel: 'chrome' });

try {
  // -------------------------------------------------------------------------------------------
  // 1. Les captures, prises sur l'application en ligne
  // -------------------------------------------------------------------------------------------
  const ctx = await navigateur.newContext({
    viewport: VUE,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
    timezoneId: 'Africa/Algiers',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);

  /**
   * Les mêmes variables que `MainActivity` pose côté Android. Elles sont injectées APRÈS le
   * chargement : posées sur le document d'avant l'analyse du HTML, le parseur les remplace et le
   * rendu se fait avec des marges nulles — c'est le piège qui a déjà validé des captures fausses.
   */
  const marges = async () => page.addStyleTag({ content: `:root{--sat:${HAUT}px;--sab:${BAS}px}` });
  const calme = async (ms = 1400) => {
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(ms);
  };

  // Portail PROFESSIONNEL : `/connexion` sans `role=pro` renvoie sur `/intro`.
  await page.goto(`${BASE}/connexion?role=pro`, { waitUntil: 'domcontentloaded' });
  await marges();
  await calme(2200); // l'animation d'ouverture dure 1,6 s
  await page.locator('input[type="email"], input[name="email"]').first().fill('pro-homme@salondz.com');
  await page.locator('input[type="password"]').first().fill('pro-homme@salondz.com');
  await page.locator('form button[type="submit"]').first().click();
  await calme(3200);
  const ou = new URL(page.url()).pathname;
  // Sans session, les six captures seraient le même formulaire de connexion — et le défaut ne se
  // verrait qu'une fois la fiche envoyée à Google.
  if (!ou.startsWith('/pro')) {
    const erreur = await page.locator('[role="alert"], .err').first().textContent().catch(() => null);
    throw new Error(`connexion professionnelle refusée — resté sur ${ou}${erreur ? ` (${erreur.trim()})` : ''}`);
  }
  console.log(`  session professionnelle → ${ou}`);

  /**
   * On met la relance d'activation des notifications en sommeil : c'est un bandeau utile dans la
   * vie de l'application, mais sur l'accueil il mangeait la moitié de la capture et repoussait le
   * produit sous la ligne de flottaison. Même geste que « Plus tard ».
   */
  await page.evaluate(() => localStorage.setItem('salondz:push:repos', String(Date.now() + 31_536_000_000)));

  for (const e of ECRANS) {
    await page.goto(BASE + e.url, { waitUntil: 'domcontentloaded' });
    await marges();
    await calme(1600);
    if (e.defile) {
      await page.evaluate((d) => {
        const defilant = [...document.querySelectorAll('*')].find((n) => n.scrollHeight > n.clientHeight + 200);
        const ou = d.px ?? (defilant ? defilant.scrollHeight * d.part : 400);
        if (defilant) defilant.scrollTop = ou;
        else window.scrollBy(0, ou);
      }, e.defile);
      await page.waitForTimeout(800);
    }
    const fichier = path.join(CAPTURES, `${e.nom}.png`);
    await page.screenshot({ path: fichier, clip: { x: 0, y: 0, ...VUE } });
    const t = taille(fichier);
    if (t.texte !== `${L}×${H}`) throw new Error(`capture ${e.nom} : ${t.texte}, attendu ${L}×${H}`);
    console.log('✔ capture', e.nom, t.texte);
  }
  await ctx.close();

  // -------------------------------------------------------------------------------------------
  // 2. Les volets, dessinés d'un seul tenant puis découpés
  // -------------------------------------------------------------------------------------------
  const TOTAL = L * ECRANS.length;
  const volet = (e) => `
    <section class="volet">
      <div class="marque"><b>Salon</b><i>DZ</i><span>PRO</span></div>
      <div class="surtitre">${e.surtitre}</div>
      <h1>${e.titre[0]}<br />${e.titre[1]} <em>${e.accent}</em></h1>
      <p class="sous">${e.sous}</p>
      <div class="appareil"><div class="ecran"><img src="${b64(path.join(CAPTURES, `${e.nom}.png`))}" alt="" /></div></div>
    </section>`;

  const html = `<meta charset="utf-8" /><style>
    ${POLICES}
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${TOTAL}px;height:${H}px;overflow:hidden}
    body{font-family:Inter,system-ui,sans-serif;background:#111214;position:relative}
    .fond{position:absolute;inset:0;background:
      radial-gradient(1100px 900px at 7% 15%, rgba(232,218,203,.20), transparent 62%),
      radial-gradient(1400px 1100px at 46% 92%, rgba(183,148,118,.22), transparent 60%),
      linear-gradient(104deg,#0d0e10 0%,#16171a 30%,#1e1d1c 56%,#171514 80%,#0f1011 100%)}
    .fil{position:absolute;inset:0}
    .volets{position:absolute;inset:0;display:flex}
    .volet{width:${L}px;height:${H}px;position:relative;padding:104px 76px 0;display:flex;flex-direction:column;color:#fff;overflow:hidden}
    .marque{font-size:29px;letter-spacing:-1px;margin-bottom:34px;opacity:.92}
    .marque b{font-weight:600}
    .marque i{font-style:normal;font-weight:300;color:rgba(255,255,255,.6);margin-left:.14em}
    .marque span{display:inline-block;margin-left:12px;background:#e8dacb;color:#111214;font-weight:700;
      font-size:18px;letter-spacing:3px;padding:4px 11px;border-radius:6px;vertical-align:4px}
    .surtitre{font-weight:700;font-size:26px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:20px}
    h1{font-weight:700;font-size:80px;line-height:1.02;letter-spacing:-3px}
    h1 em{font-style:normal;color:#e8dacb}
    .sous{margin-top:20px;font-size:31px;line-height:1.34;font-weight:400;color:rgba(255,255,255,.72)}
    /* L'appareil déborde volontairement du bas : on montre une application en train de servir, pas
       une vignette centrée dans du vide. */
    .appareil{position:absolute;left:50%;transform:translateX(-50%);top:700px;width:820px;height:1440px;
      border-radius:90px;padding:11px;background:linear-gradient(160deg,#d9d6d1,#8d8a86 42%,#efece7 78%,#807d79);
      box-shadow:0 46px 96px rgba(0,0,0,.52)}
    .ecran{width:100%;height:100%;border-radius:80px;overflow:hidden;background:#fff}
    .ecran img{width:100%;display:block}
  </style>
  <div class="fond"></div>
  <svg class="fil" viewBox="0 0 ${TOTAL} ${H}" preserveAspectRatio="none">
    <path d="M-60 1500 C 700 1360, 1180 1700, 1900 1580 S 3100 1160, 3820 1350 S 5000 1740, 5720 1540 S 6300 1300, ${TOTAL + 60} 1390"
          fill="none" stroke="rgba(232,218,203,.22)" stroke-width="8" stroke-linecap="round" stroke-dasharray="38 28" />
  </svg>
  <div class="volets">${ECRANS.map(volet).join('')}</div>`;

  const panorama = await navigateur.newPage({ viewport: { width: TOTAL, height: H }, deviceScaleFactor: 1 });
  await panorama.setContent(html);
  await panorama.evaluate(() => document.fonts.ready);
  await panorama.waitForTimeout(1200);
  for (let i = 0; i < ECRANS.length; i++) {
    const f = path.join(PANNEAUX, `salondz-pro-${String(i + 1).padStart(2, '0')}-${ECRANS[i].nom}.png`);
    await panorama.screenshot({ path: f, clip: { x: i * L, y: 0, width: L, height: H } });
    const t = taille(f);
    if (t.texte !== `${L}×${H}`) throw new Error(`volet ${i + 1} : ${t.texte}, attendu ${L}×${H}`);
    console.log('✔', path.basename(f), t.texte, `${t.ko} Ko`);
  }
  await panorama.close();

  // -------------------------------------------------------------------------------------------
  // 3. L'image de présentation, en tête de fiche — 1024×500 exactement, imposé par Google
  // -------------------------------------------------------------------------------------------
  /**
   * Google recadre cette image selon les surfaces : le texte reste donc à GAUCHE du centre, et les
   * deux téléphones débordent à droite — ils peuvent être rognés sans rien faire perdre.
   */
  const banniere = `<meta charset="utf-8" /><style>
    ${POLICES}
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:1024px;height:500px;overflow:hidden}
    body{font-family:Inter,system-ui,sans-serif;color:#fff;position:relative;background:
      radial-gradient(700px 500px at 10% 18%, rgba(232,218,203,.22), transparent 62%),
      radial-gradient(820px 620px at 82% 92%, rgba(183,148,118,.26), transparent 60%),
      linear-gradient(104deg,#0d0e10,#1e1d1c 55%,#0f1011)}
    .texte{position:absolute;left:66px;top:50%;transform:translateY(-50%);width:560px;z-index:2}
    .marque{font-size:29px;letter-spacing:-1px;margin-bottom:18px}
    .marque b{font-weight:600}
    .marque i{font-style:normal;font-weight:300;color:rgba(255,255,255,.62);margin-left:.14em}
    .marque span{display:inline-block;margin-left:13px;background:#e8dacb;color:#111214;font-weight:700;
      font-size:18px;letter-spacing:3px;padding:5px 12px;border-radius:7px;vertical-align:4px}
    h1{font-size:52px;font-weight:700;line-height:1.06;letter-spacing:-2px}
    h1 em{font-style:normal;color:#e8dacb}
    p{margin-top:18px;font-size:23px;color:rgba(255,255,255,.7);line-height:1.34}
    .tel{position:absolute;border-radius:40px;padding:6px;overflow:hidden;
      background:linear-gradient(160deg,#d9d6d1,#8d8a86 42%,#efece7 78%,#807d79);
      box-shadow:0 30px 60px rgba(0,0,0,.55)}
    .tel img{width:100%;display:block;border-radius:34px}
    .tel.a{width:270px;height:520px;right:150px;top:-26px;transform:rotate(-7deg)}
    .tel.b{width:250px;height:480px;right:-54px;top:96px;transform:rotate(6deg)}
    .voile{position:absolute;inset:0;background:linear-gradient(90deg,#0d0e10 32%,rgba(13,14,16,0) 62%);z-index:1}
  </style>
  <div class="tel a"><img src="${b64(path.join(CAPTURES, 'accueil.png'))}" alt="" /></div>
  <div class="tel b"><img src="${b64(path.join(CAPTURES, 'agenda.png'))}" alt="" /></div>
  <div class="voile"></div>
  <div class="texte">
    <div class="marque"><b>Salon</b><i>DZ</i><span>PRO</span></div>
    <h1>Votre salon se remplit pendant que vous <em>travaillez.</em></h1>
    <p>Agenda, demandes, clientèle et chiffre d’affaires.</p>
  </div>`;
  const pageBanniere = await navigateur.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await pageBanniere.setContent(banniere);
  await pageBanniere.evaluate(() => document.fonts.ready);
  await pageBanniere.waitForTimeout(600);
  const fBan = path.join(OUT, 'image-de-presentation-1024x500.png');
  await pageBanniere.screenshot({ path: fBan, clip: { x: 0, y: 0, width: 1024, height: 500 } });
  const tBan = taille(fBan);
  if (tBan.texte !== '1024×500') throw new Error(`image de présentation : ${tBan.texte}, attendu 1024×500`);
  console.log('✔ image de présentation', tBan.texte);

  console.log(
    `\nÀ envoyer sur Play Console :` +
      `\n  ${ECRANS.length} visuels de téléphone  ${path.relative(ROOT, PANNEAUX)}` +
      `\n  image de présentation    ${path.relative(ROOT, fBan)}` +
      `\n  icône 512×512            apps/web/android/store/icone-play-store-512-pro.png`,
  );
} finally {
  await navigateur.close();
}
