/**
 * Visuels de PRÉSENTATION pour l'App Store (et réutilisables sur Google Play) : six volets de
 * 1290 × 2796, dessinés d'un seul tenant sur 7740 px de large.
 *
 *   node scripts/make-store-panels.mjs
 *
 * POURQUOI UN PANORAMA ET NON SIX IMAGES : sur la fiche d'une boutique, les captures défilent
 * côte à côte. Le fond, les halos et le fil pointillé traversent les coupes — mis bout à bout, les
 * six visuels se relisent comme UNE seule image, et le défilement devient un mouvement continu.
 * C'est le procédé déjà employé pour Coligo.
 *
 * POURQUOI PAS DE REDIMENSIONNEMENT : le panorama est dessiné à la taille finale exacte. Passer par
 * une image plus grande puis réduire coûterait une dépendance de traitement d'image et, surtout,
 * 1320 × 2868 et 1290 × 2796 n'ont pas le même rapport — le contenu serait légèrement déformé ou
 * rogné. Ici, un volet découpé EST le fichier livré.
 *
 * La police est embarquée en base64 depuis `apps/web/public/fonts/` : la même Inter que le site,
 * et aucun appel réseau pendant le rendu (une police qui n'arrive pas donnerait un visuel en
 * Times New Roman, envoyé tel quel à Apple).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORE = path.join(ROOT, 'apps', 'web', 'ios', 'store');
const CAPTURES = path.join(STORE, 'captures-6-7');
const OUT = path.join(STORE, 'presentation-6-7');
const FONTS = path.join(ROOT, 'apps', 'web', 'public', 'fonts');

/** iPhone 6,7 pouces : la taille que l'App Store attend, et celle du panorama. */
const L = 1290;
const H = 2796;

const police = (poids) =>
  `@font-face{font-family:Inter;font-weight:${poids};font-display:block;src:url(data:font/woff2;base64,${fs
    .readFileSync(path.join(FONTS, `inter-${poids}.woff2`))
    .toString('base64')}) format('woff2')}`;
const POLICES = [400, 500, 600, 700].map(police).join('');

const image = (fichier) => `data:image/png;base64,${fs.readFileSync(path.join(CAPTURES, fichier)).toString('base64')}`;

/** L'icône de l'application, la même que sur les deux boutiques (générée par make-capacitor-icons). */
const ICONE = `data:image/png;base64,${fs
  .readFileSync(path.join(ROOT, 'apps', 'web', 'android', 'store', 'icone-play-store-512.png'))
  .toString('base64')}`;

/**
 * Trois photos de métier pour le volet de couverture. Ce sont celles de la démonstration : de VRAIES
 * photos de salon, pas des pictogrammes — c'est ce que le visiteur vient chercher, et un volet de
 * couverture qui ne montre que du texte sur du noir ne dit rien du produit.
 */
const ECLATS = ['h-coupe-barbe', 'f-chignon-mariee', 'f-pose-gel'].map(
  (nom) =>
    `data:image/webp;base64,${fs
      .readFileSync(path.join(ROOT, 'apps', 'web', 'public', 'demo', `${nom}.webp`))
      .toString('base64')}`,
);

/**
 * Les six volets. `accent` est le mot mis en valeur : il finit la phrase, et c'est lui qui porte
 * la promesse. `penche` incline l'appareil d'un volet à l'autre pour éviter l'effet catalogue.
 */
const VOLETS = [
  {
    surtitre: 'Salon DZ',
    titre: ['Votre salon,', 'en deux'],
    accent: 'gestes.',
    sous: 'Coiffure, barbier, institut — partout en Algérie.',
    // Une ligne en arabe sur le volet de couverture : c'est la langue d'une grande partie du pays,
    // et l'application la parle déjà (le site est en français, arabe et anglais).
    arabe: 'صالونك بين يديك',
    icone: true,
    marque: true,
  },
  {
    surtitre: 'Recherche',
    titre: ['Les salons', 'autour de'],
    accent: 'vous.',
    sous: 'Disponibilités en temps réel, prix en dinars.',
    capture: '1-place-de-marche.png',
    penche: -4,
  },
  {
    surtitre: 'Réservation',
    titre: ['Réservez en', 'quelques'],
    accent: 'secondes.',
    sous: 'La prestation, le jour, l’heure. Sans avoir à appeler.',
    capture: '2-fiche-salon.png',
    penche: 4,
  },
  {
    surtitre: 'Rappels',
    titre: ['On vous le', ''],
    accent: 'rappelle.',
    sous: 'Confirmation du salon, rappel la veille et 2 h avant.',
    capture: '4-mes-rendez-vous.png',
    penche: -4,
  },
  {
    surtitre: 'Professionnels',
    titre: ['Votre agenda,', 'dans votre'],
    accent: 'poche.',
    sous: 'Chaque demande en direct : confirmez ou refusez d’un geste.',
    capture: '5-accueil-professionnel.png',
    penche: 4,
  },
  {
    surtitre: 'Professionnels',
    titre: ['Votre journée,', 'heure par'],
    accent: 'heure.',
    sous: 'Votre équipe, vos prestations, votre chiffre d’affaires.',
    capture: '6-agenda-professionnel.png',
    penche: -4,
  },
];

const TOTAL = L * VOLETS.length;

const volet = (v) => `
  <section class="volet">
    <div class="surtitre">${v.surtitre}</div>
    <h1>${v.titre.filter(Boolean).join('<br />')}${v.titre[1] ? ' ' : '<br />'}<em>${v.accent}</em></h1>
    <p class="sous">${v.sous}</p>
    ${v.arabe ? `<p class="arabe">${v.arabe}</p>` : ''}
    ${
      v.icone
        ? `<div class="eventail">
             ${ECLATS.map((src, i) => `<img class="eclat e${i}" src="${src}" alt="" />`).join('')}
             <div class="icone"><img src="${ICONE}" alt="" /></div>
           </div>`
        : ''
    }
    ${
      v.capture
        ? `<div class="appareil" style="transform: rotate(${v.penche}deg)">
             <div class="ecran"><div class="ile"></div><img src="${image(v.capture)}" alt="" /></div>
           </div>`
        : ''
    }
    ${v.marque ? '<div class="marque"><span class="sigle">S</span> salondz.com</div>' : ''}
  </section>`;

const html = `<meta charset="utf-8" /><style>
  ${POLICES}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${TOTAL}px; height: ${H}px; overflow: hidden; }
  body { font-family: Inter, system-ui, sans-serif; background: #111214; position: relative; }

  /* Fond continu : encre de la marque, réchauffée par trois halos. Un salon n'est pas une
     application d'entreprise — le noir seul serait froid. */
  .fond {
    position: absolute; inset: 0;
    background:
      radial-gradient(1500px 1200px at 6% 14%, rgba(232, 218, 203, .20), transparent 62%),
      radial-gradient(1900px 1500px at 44% 92%, rgba(183, 148, 118, .22), transparent 60%),
      radial-gradient(1600px 1300px at 86% 18%, rgba(221, 227, 223, .13), transparent 58%),
      linear-gradient(104deg, #0d0e10 0%, #16171a 28%, #1e1d1c 54%, #171514 78%, #0f1011 100%);
  }
  /* Grain : sans lui, les dégradés se voient par bandes à cette taille. */
  .grain {
    position: absolute; inset: 0; opacity: .13; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='.5'/></svg>");
  }
  .fil { position: absolute; inset: 0; }

  .volets { position: absolute; inset: 0; display: flex; }
  .volet {
    width: ${L}px; height: ${H}px; position: relative;
    /* Marges hautes et basses généreuses : les boutiques posent leur propre habillage par-dessus
       les bords, et un titre collé en haut se fait rogner. */
    padding: 290px 92px 210px;
    display: flex; flex-direction: column;
  }

  .surtitre {
    font-weight: 700; font-size: 32px; letter-spacing: 5px; text-transform: uppercase;
    color: rgba(255, 255, 255, .50); margin-bottom: 32px;
  }
  h1 {
    font-weight: 700; font-size: 116px; line-height: .98; letter-spacing: -4px;
    color: #fff; text-wrap: balance;
  }
  h1 em { font-style: normal; color: #e8dacb; }
  .sous {
    margin-top: 32px; font-size: 42px; line-height: 1.34; font-weight: 400;
    color: rgba(255, 255, 255, .74); max-width: 980px;
  }

  /* Appareil : cadre sobre en titane, posé bas et débordant du volet — on montre l'application
     en train de servir, pas une vignette centrée dans du vide. */
  .appareil {
    position: absolute; left: 140px; top: 1010px;
    width: 1000px; height: 2170px; border-radius: 116px; padding: 13px;
    background: linear-gradient(160deg, #d9d6d1, #8d8a86 42%, #efece7 78%, #807d79);
    box-shadow: 0 60px 120px rgba(0, 0, 0, .45);
  }
  .ecran {
    width: 100%; height: 100%; border-radius: 104px; overflow: hidden;
    background: #fff; position: relative;
  }
  .ecran img { width: 100%; display: block; }
  /* Dynamic Island : sans elle, le cadre ne se lit pas comme un iPhone. */
  .ile {
    position: absolute; top: 34px; left: 50%; transform: translateX(-50%);
    width: 264px; height: 72px; border-radius: 40px; background: #08070c; z-index: 3;
  }

  .arabe {
    margin-top: 26px; font-size: 40px; font-weight: 600; direction: rtl;
    color: rgba(232, 218, 203, .62);
  }

  /* Volet de couverture : trois photos en éventail remplissent le bas, l'icône posée par-dessus.
     Une icône seule, sombre sur fond sombre, se lirait comme un trou dans l'image. */
  .eventail { position: absolute; left: 0; right: 0; top: 1060px; height: 1260px; }
  .eclat {
    position: absolute; left: 50%; top: 0; width: 470px; height: 740px;
    object-fit: cover; border-radius: 40px;
    box-shadow: 0 40px 90px rgba(0, 0, 0, .55);
    outline: 3px solid rgba(255, 255, 255, .10); outline-offset: -3px;
  }
  .eclat.e0 { transform: translateX(-50%) translateX(-300px) rotate(-10deg); }
  .eclat.e1 { transform: translateX(-50%) translateY(-40px); z-index: 2; }
  .eclat.e2 { transform: translateX(-50%) translateX(300px) rotate(10deg); }

  .icone {
    position: absolute; left: 50%; top: 790px; transform: translateX(-50%);
    width: 300px; height: 300px; border-radius: 72px; overflow: hidden; z-index: 3;
    box-shadow: 0 30px 70px rgba(0, 0, 0, .7), 0 0 0 5px rgba(255, 255, 255, .92);
  }
  .icone img { width: 100%; height: 100%; display: block; }

  .marque {
    position: absolute; left: 92px; bottom: 120px; display: flex; align-items: center; gap: 20px;
    color: rgba(255, 255, 255, .70); font-weight: 600; font-size: 34px;
  }
  .sigle {
    width: 62px; height: 62px; border-radius: 18px; background: #fff; color: #111214;
    display: flex; align-items: center; justify-content: center; font-size: 38px; font-weight: 700;
  }
</style>

<div class="fond"></div>
<div class="grain"></div>

<!-- Un seul fil, tiré sur les ${TOTAL} px : c'est lui qui recoud les volets entre eux. -->
<svg class="fil" viewBox="0 0 ${TOTAL} ${H}" preserveAspectRatio="none">
  <path d="M-60 2120 C 820 1930, 1380 2440, 2260 2270 S 3640 1660, 4500 1930 S 5900 2500, 6760 2210 S 7500 1860, ${TOTAL + 60} 1990"
        fill="none" stroke="rgba(232,218,203,.26)" stroke-width="9" stroke-linecap="round" stroke-dasharray="44 32" />
  <path d="M-60 620 C 1100 870, 1960 410, 3000 680 S 4880 1050, 6000 740 S 7200 430, ${TOTAL + 60} 640"
        fill="none" stroke="rgba(255,255,255,.10)" stroke-width="6" stroke-linecap="round" />
</svg>

<div class="volets">${VOLETS.map(volet).join('')}</div>`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(STORE, 'panorama.html'), html);

const browser = await pw.chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: TOTAL, height: H }, deviceScaleFactor: 1 });
try {
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);

  for (let i = 0; i < VOLETS.length; i++) {
    const fichier = path.join(OUT, `salondz-${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: fichier, clip: { x: i * L, y: 0, width: L, height: H } });
    const b = fs.readFileSync(fichier);
    const taille = `${b.readUInt32BE(16)}×${b.readUInt32BE(20)}`;
    if (taille !== `${L}×${H}`) throw new Error(`volet ${i + 1} : ${taille}, attendu ${L}×${H}`);
    console.log('✔', path.basename(fichier), taille, Math.round(b.length / 1024) + ' Ko');
  }
  console.log(`\n${VOLETS.length} visuels dans ${path.relative(ROOT, OUT)}`);
} finally {
  await browser.close();
}
