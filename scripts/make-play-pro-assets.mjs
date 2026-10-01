/**
 * Visuels Google Play de l'application PROFESSIONNELLE (« Salon DZ Pro », `pro.salondz.app`).
 *
 *   node scripts/make-play-pro-assets.mjs
 *   node scripts/make-play-pro-assets.mjs --url http://localhost:9000
 *   node scripts/make-play-pro-assets.mjs --format tablette-10
 *
 * Produit, sous `apps/web/android/store/pro/` :
 *   telephone/     6 visuels 1080×1920   (emplacement « téléphone » de la fiche)
 *   tablette-7/    6 visuels 1920×1200   (emplacement « tablette 7 pouces »)
 *   tablette-10/   6 visuels 2560×1600   (emplacement « tablette 10 pouces »)
 *   image-de-presentation-1024x500.png
 *   captures/<format>/  les écrans bruts, hors git
 *
 * POURQUOI UN AUTRE FORMAT QUE L'APP STORE : Google refuse un rapport supérieur à 2:1. Les visuels
 * iPhone font 1290×2796, soit 2,167 — ils seraient rejetés à l'envoi. On dessine donc à la taille
 * finale de bout en bout, sans redimensionner : un volet découpé EST le fichier livré.
 *
 * POURQUOI LES TABLETTES NE SONT PAS LE TÉLÉPHONE AGRANDI : à partir de 1 024 px l'espace
 * professionnel remplace la barre d'onglets flottante par un RAIL permanent (`apps/web/src/styles/
 * index.css`). La capture de 10 pouces (1 280 points) montre donc une mise en page réellement
 * différente, celle d'un outil de travail — et c'est ce que Google demande de prouver. Celle de
 * 7 pouces (960 points) reste en barre d'onglets, parce qu'un vrai 7 pouces reste en dessous du
 * seuil : on montre ce que la personne verra, pas ce qui flatte.
 *
 * POURQUOI ON PEUT LES PRENDRE DEPUIS LE SITE : depuis la bascule Capacitor, l'application EST le
 * site embarqué. La variante professionnelle ne retire que les routes clientes : les écrans
 * `/pro/*` y sont identiques.
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
const FONTS = path.join(ROOT, 'apps', 'web', 'public', 'fonts');

const arg = (nom, defaut) => {
  const i = process.argv.indexOf(nom);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
};
const BASE = arg('--url', 'https://salondz.com').replace(/\/$/, '');
const SEUL = arg('--format', null);

/**
 * Les trois emplacements de la fiche. La DENSITÉ fait la taille, jamais la largeur de fenêtre :
 * poser 2 560 px de large donnerait une mise en page de très grand écran, pas celle d'une tablette.
 *   téléphone   360 × 640 points × 3 = 1080 × 1920
 *   7 pouces    960 × 600 points × 2 = 1920 × 1200  (barre d'onglets : on est sous 1 024)
 *   10 pouces  1280 × 800 points × 2 = 2560 × 1600  (rail permanent)
 * `marges` simule les barres système que l'application réserve ; sur une tablette en paysage elles
 * sont minces, et la barre du bas n'existe pas.
 */
const FORMATS = [
  { cle: 'telephone', vue: { width: 360, height: 640 }, dsf: 3, marges: { haut: 28, bas: 16 }, paysage: false },
  { cle: 'tablette-7', vue: { width: 960, height: 600 }, dsf: 2, marges: { haut: 20, bas: 0 }, paysage: true },
  { cle: 'tablette-10', vue: { width: 1280, height: 800 }, dsf: 2, marges: { haut: 20, bas: 0 }, paysage: true },
];

/**
 * Les écrans qui décident un professionnel, dans l'ordre où Play les affichera.
 * `defile` : certains écrans s'ouvrent sur une zone creuse (l'agenda à l'heure d'ouverture, le
 * chiffre d'affaires sur son sélecteur). On descend juste assez pour que la capture montre le
 * produit. Les valeurs diffèrent par format : la même page ne défile pas pareil à 640 et à 800
 * points de haut.
 */
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
    // L'agenda se place TOUT SEUL sur l'heure actuelle au chargement. Sur téléphone cela tombe
    // bien ; sur tablette la hauteur montre déjà la journée, et ce recentrage coupait l'en-tête du
    // jour et affichait le repère rouge « avant l'ouverture » à moitié sorti. On remonte en haut.
    defile: { telephone: { part: 0.24 }, 'tablette-7': { px: 0 }, 'tablette-10': { px: 0 } },
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
    // Sur tablette, cet écran est une colonne de lecture sans rail : un QR code au milieu d'une
    // grande surface grise, qui a l'air d'une page cassée plutôt que d'un produit. Le catalogue
    // dit la même chose du métier — prestations, durées, prix — et remplit la largeur.
    tablette: {
      nom: 'catalogue',
      url: '/pro/catalogue',
      surtitre: 'Catalogue',
      titre: ['Vos prestations,', 'vos durées,'],
      accent: 'vos prix.',
      sous: 'En dinars, avec vos photos. Exactement ce que vos clients voient.',
    },
  },
  {
    nom: 'chiffre-affaires',
    url: '/pro/chiffre-affaires',
    defile: { telephone: { px: 150 } },
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
/** L'écran tel qu'il est montré dans ce format : certains changent entre téléphone et tablette. */
const ecranPour = (e, fmt) => (fmt.paysage && e.tablette ? { ...e, ...e.tablette } : e);
/**
 * Le dossier de sortie est VIDÉ avant d'être rempli. Les fichiers portent le nom de l'écran : le
 * jour où l'on en remplace un, l'ancien resterait là et partirait sur la fiche en double.
 */
const vider = (dossier) => {
  fs.rmSync(dossier, { recursive: true, force: true });
  fs.mkdirSync(dossier, { recursive: true });
};
const FOND = `
  radial-gradient(1100px 900px at 7% 15%, rgba(232,218,203,.20), transparent 62%),
  radial-gradient(1400px 1100px at 46% 92%, rgba(183,148,118,.22), transparent 60%),
  linear-gradient(104deg,#0d0e10 0%,#16171a 30%,#1e1d1c 56%,#171514 80%,#0f1011 100%)`;
const MARQUE = '<div class="marque"><b>Salon</b><i>DZ</i><span>PRO</span></div>';

const navigateur = await pw.chromium.launch({ channel: 'chrome' });

try {
  // -------------------------------------------------------------------------------------------
  // 1. Une session professionnelle, ouverte une fois et prêtée aux trois formats
  // -------------------------------------------------------------------------------------------
  // La densité d'affichage se fixe à la création du contexte : il en faut un par format. On ne se
  // reconnecte pas trois fois pour autant — l'état du navigateur se recopie.
  const ouvrirSession = async () => {
    const ctx = await navigateur.newContext({ viewport: { width: 360, height: 640 }, locale: 'fr-FR', timezoneId: 'Africa/Algiers' });
    const page = await ctx.newPage();
    page.setDefaultTimeout(30_000);
    // Portail PROFESSIONNEL : `/connexion` sans `role=pro` renvoie sur `/intro`.
    await page.goto(`${BASE}/connexion?role=pro`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2600); // l'animation d'ouverture dure 1,6 s
    await page.locator('input[type="email"], input[name="email"]').first().fill('pro-homme@salondz.com');
    await page.locator('input[type="password"]').first().fill('pro-homme@salondz.com');
    await page.locator('form button[type="submit"]').first().click();
    await page.waitForTimeout(3400);
    const ou = new URL(page.url()).pathname;
    // Sans session, les captures seraient toutes le même formulaire de connexion — et le défaut ne
    // se verrait qu'une fois la fiche envoyée à Google.
    if (!ou.startsWith('/pro')) {
      const erreur = await page.locator('[role="alert"], .err').first().textContent().catch(() => null);
      throw new Error(`connexion professionnelle refusée — resté sur ${ou}${erreur ? ` (${erreur.trim()})` : ''}`);
    }
    // La relance d'activation des notifications est utile dans la vie de l'application, mais sur
    // l'accueil elle mangeait la moitié de la capture et repoussait le produit sous la ligne de
    // flottaison. Même geste que « Plus tard ».
    await page.evaluate(() => localStorage.setItem('salondz:push:repos', String(Date.now() + 31_536_000_000)));
    const etat = await ctx.storageState();
    await ctx.close();
    console.log(`  session professionnelle → ${ou}`);
    return etat;
  };
  const SESSION = await ouvrirSession();

  // -------------------------------------------------------------------------------------------
  // 2. Les captures, format par format
  // -------------------------------------------------------------------------------------------
  async function capturer(fmt) {
    const L = fmt.vue.width * fmt.dsf;
    const H = fmt.vue.height * fmt.dsf;
    const dossier = path.join(OUT, 'captures', fmt.cle);
    vider(dossier);

    const ctx = await navigateur.newContext({
      viewport: fmt.vue,
      deviceScaleFactor: fmt.dsf,
      isMobile: !fmt.paysage, // une tablette n'est pas un téléphone : pas d'émulation « mobile »
      hasTouch: true,
      locale: 'fr-FR',
      timezoneId: 'Africa/Algiers',
      storageState: SESSION,
      userAgent: fmt.paysage
        ? 'Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        : 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(30_000);

    /**
     * Les mêmes variables que `MainActivity` pose côté Android. Elles sont injectées APRÈS le
     * chargement : posées sur le document d'avant l'analyse du HTML, le parseur les remplace et le
     * rendu se fait avec des marges nulles — c'est le piège qui a déjà validé des captures fausses.
     */
    const marges = () => page.addStyleTag({ content: `:root{--sat:${fmt.marges.haut}px;--sab:${fmt.marges.bas}px}` });

    for (const brut of ECRANS) {
      const e = ecranPour(brut, fmt);
      await page.goto(BASE + e.url, { waitUntil: 'domcontentloaded' });
      await marges();
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(1600);
      const d = e.defile?.[fmt.cle];
      if (d) {
        await page.evaluate((d) => {
          const defilant = [...document.querySelectorAll('*')].find((n) => n.scrollHeight > n.clientHeight + 200);
          const combien = d.px ?? (defilant ? defilant.scrollHeight * d.part : 400);
          if (defilant) defilant.scrollTop = combien;
          else window.scrollBy(0, combien);
        }, d);
        await page.waitForTimeout(800);
      }
      const fichier = path.join(dossier, `${e.nom}.png`);
      await page.screenshot({ path: fichier, clip: { x: 0, y: 0, ...fmt.vue } });
      const t = taille(fichier);
      if (t.texte !== `${L}×${H}`) throw new Error(`capture ${fmt.cle}/${e.nom} : ${t.texte}, attendu ${L}×${H}`);
    }
    await ctx.close();
    console.log(`✔ ${ECRANS.length} captures ${fmt.cle} en ${L}×${H}`);
    return dossier;
  }

  // -------------------------------------------------------------------------------------------
  // 3a. Volets TÉLÉPHONE : un panorama continu, découpé en six
  // -------------------------------------------------------------------------------------------
  async function voletsTelephone(fmt, captures) {
    const L = fmt.vue.width * fmt.dsf;
    const H = fmt.vue.height * fmt.dsf;
    const TOTAL = L * ECRANS.length;
    const sortie = path.join(OUT, fmt.cle);
    vider(sortie);

    const volet = (e) => `
      <section class="volet">
        ${MARQUE}
        <div class="surtitre">${e.surtitre}</div>
        <h1>${e.titre[0]}<br />${e.titre[1]} <em>${e.accent}</em></h1>
        <p class="sous">${e.sous}</p>
        <div class="appareil"><div class="ecran"><img src="${b64(path.join(captures, `${e.nom}.png`))}" alt="" /></div></div>
      </section>`;

    const html = `<meta charset="utf-8" /><style>
      ${POLICES}
      *{margin:0;padding:0;box-sizing:border-box}
      html,body{width:${TOTAL}px;height:${H}px;overflow:hidden}
      body{font-family:Inter,system-ui,sans-serif;background:#111214;position:relative}
      .fond{position:absolute;inset:0;background:${FOND}}
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
      /* L'appareil déborde volontairement du bas : on montre une application en train de servir,
         pas une vignette centrée dans du vide. */
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

    const page = await navigateur.newPage({ viewport: { width: TOTAL, height: H }, deviceScaleFactor: 1 });
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200);
    for (let i = 0; i < ECRANS.length; i++) {
      const f = path.join(sortie, `salondz-pro-${String(i + 1).padStart(2, '0')}-${ECRANS[i].nom}.png`);
      await page.screenshot({ path: f, clip: { x: i * L, y: 0, width: L, height: H } });
      const t = taille(f);
      if (t.texte !== `${L}×${H}`) throw new Error(`volet ${i + 1} : ${t.texte}, attendu ${L}×${H}`);
      console.log('✔', `${fmt.cle}/${path.basename(f)}`, t.texte, `${t.ko} Ko`);
    }
    await page.close();
  }

  // -------------------------------------------------------------------------------------------
  // 3b. Volets TABLETTE : paysage, texte à gauche, appareil débordant à droite
  // -------------------------------------------------------------------------------------------
  /**
   * Un seul gabarit pour les deux tailles : tout est écrit en « unités 10 pouces » et multiplié par
   * `k`. Le 7 pouces est exactement 0,75 fois le 10 pouces, donc les deux volets sont identiques au
   * pixel de rendu près — ce qui évite deux mises en page à tenir à jour.
   *
   * Chaque volet est rendu SEUL, pas en panorama : un panorama de six volets de 10 pouces ferait
   * 15 360 px de large, soit près de 100 Mo de surface à rastériser d'un coup sur une machine à
   * 8 Go. Le fil décoratif devient donc un arc par volet.
   */
  async function voletsTablette(fmt, captures) {
    const L = fmt.vue.width * fmt.dsf;
    const H = fmt.vue.height * fmt.dsf;
    const k = L / 2560;
    const u = (n) => `${Math.round(n * k)}px`;
    const sortie = path.join(OUT, fmt.cle);
    vider(sortie);

    const page = await navigateur.newPage({ viewport: { width: L, height: H }, deviceScaleFactor: 1 });
    for (let i = 0; i < ECRANS.length; i++) {
      const e = ecranPour(ECRANS[i], fmt);
      const html = `<meta charset="utf-8" /><style>
        ${POLICES}
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{width:${L}px;height:${H}px;overflow:hidden}
        body{font-family:Inter,system-ui,sans-serif;background:#111214;color:#fff;position:relative}
        .fond{position:absolute;inset:0;background:${FOND}}
        .fil{position:absolute;inset:0}
        .texte{position:absolute;left:${u(140)};top:50%;transform:translateY(-50%);width:${u(900)};z-index:2}
        .marque{font-size:${u(32)};letter-spacing:-1px;margin-bottom:${u(32)};opacity:.92}
        .marque b{font-weight:600}
        .marque i{font-style:normal;font-weight:300;color:rgba(255,255,255,.6);margin-left:.14em}
        .marque span{display:inline-block;margin-left:${u(13)};background:#e8dacb;color:#111214;font-weight:700;
          font-size:${u(20)};letter-spacing:3px;padding:${u(5)} ${u(13)};border-radius:${u(7)};vertical-align:${u(5)}}
        .surtitre{font-weight:700;font-size:${u(26)};letter-spacing:${u(5)};text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:${u(20)}}
        h1{font-weight:700;font-size:${u(74)};line-height:1.04;letter-spacing:${u(-2.8)}}
        h1 em{font-style:normal;color:#e8dacb}
        .sous{margin-top:${u(22)};font-size:${u(32)};line-height:1.35;font-weight:400;color:rgba(255,255,255,.72)}
        /* L'appareil déborde du bord droit : une tablette entière posée au milieu du volet aurait
           l'air d'une vignette de catalogue, pas d'un écran de travail. */
        .appareil{position:absolute;left:${u(1100)};top:${u(300)};width:${u(1578)};height:${u(1000)};
          border-radius:${u(42)};padding:${u(18)};background:linear-gradient(160deg,#d9d6d1,#8d8a86 42%,#efece7 78%,#807d79);
          box-shadow:0 ${u(40)} ${u(80)} rgba(0,0,0,.52)}
        .ecran{width:100%;height:100%;border-radius:${u(26)};overflow:hidden;background:#fff}
        .ecran img{width:100%;display:block}
      </style>
      <div class="fond"></div>
      <svg class="fil" viewBox="0 0 2560 1600" preserveAspectRatio="none">
        <path d="M-40 1310 C 420 1180, 760 1430, 1180 1330 S 1980 1010, 2600 1180"
              fill="none" stroke="rgba(232,218,203,.2)" stroke-width="7" stroke-linecap="round" stroke-dasharray="34 26" />
      </svg>
      <div class="texte">
        ${MARQUE}
        <div class="surtitre">${e.surtitre}</div>
        <h1>${e.titre[0]}<br />${e.titre[1]} <em>${e.accent}</em></h1>
        <p class="sous">${e.sous}</p>
      </div>
      <div class="appareil"><div class="ecran"><img src="${b64(path.join(captures, `${e.nom}.png`))}" alt="" /></div></div>`;

      await page.setContent(html);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      const f = path.join(sortie, `salondz-pro-${String(i + 1).padStart(2, '0')}-${e.nom}.png`);
      await page.screenshot({ path: f, clip: { x: 0, y: 0, width: L, height: H } });
      const t = taille(f);
      if (t.texte !== `${L}×${H}`) throw new Error(`volet ${fmt.cle} ${i + 1} : ${t.texte}, attendu ${L}×${H}`);
      console.log('✔', `${fmt.cle}/${path.basename(f)}`, t.texte, `${t.ko} Ko`);
    }
    await page.close();
  }

  let captureTelephone = path.join(OUT, 'captures', 'telephone');
  for (const fmt of FORMATS) {
    if (SEUL && fmt.cle !== SEUL) continue;
    const captures = await capturer(fmt);
    if (fmt.cle === 'telephone') captureTelephone = captures;
    await (fmt.paysage ? voletsTablette(fmt, captures) : voletsTelephone(fmt, captures));
  }

  // -------------------------------------------------------------------------------------------
  // 4. L'image de présentation, en tête de fiche — 1024×500 exactement, imposé par Google
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
  <div class="tel a"><img src="${b64(path.join(captureTelephone, 'accueil.png'))}" alt="" /></div>
  <div class="tel b"><img src="${b64(path.join(captureTelephone, 'agenda.png'))}" alt="" /></div>
  <div class="voile"></div>
  <div class="texte">
    ${MARQUE}
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
      FORMATS.map((f) => `\n  ${f.cle.padEnd(12)} ${ECRANS.length} visuels   ${path.relative(ROOT, path.join(OUT, f.cle))}`).join('') +
      `\n  présentation ${path.relative(ROOT, fBan)}` +
      `\n  icône 512    apps/web/android/store/icone-play-store-512-pro.png`,
  );
} finally {
  await navigateur.close();
}
