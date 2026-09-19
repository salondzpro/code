/**
 * Photos des comptes de DÉMONSTRATION : de vraies photos de métier, à la place des illustrations.
 *
 * Source : Unsplash, dont la licence autorise l'usage commercial, sans redevance ni autorisation.
 * On ne reprend JAMAIS les photos d'un autre service de réservation, même « juste pour l'exemple » :
 * elles appartiennent à leur auteur et au salon photographié, et elles partiraient en production
 * sur salondz.com.
 *
 * Les fichiers portent la CLÉ de ce qu'ils illustrent (`h-coupe-barbe`, `f-pose-gel`, `cover-hommes`,
 * `avatar-lina`…) : la démonstration les lit par `demoImage(clé)`, donc rien d'autre à brancher.
 * Chaque prestation a SA photo, dont le sujet correspond (des ciseaux pour une coupe, une barbe
 * pour la barbe, des mains pour l'onglerie, un œil pour les cils).
 *
 * Le script télécharge, recadre au format voulu et enregistre en WebP dans `apps/web/public/demo/`.
 * Recadrage et encodage passent par Chrome, déjà présent pour les captures : aucune dépendance.
 *
 *   node scripts/demo-photos.mjs              # tout
 *   node scripts/demo-photos.mjs prestation   # une famille de formats seulement
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'apps/web/public/demo');

/** Formats : couverture large, portrait carré, prestation en 4/3. */
const FORMATS = {
  couverture: { w: 1000, h: 560, q: 0.82 },
  portrait: { w: 320, h: 320, q: 0.85 },
  prestation: { w: 720, h: 540, q: 0.8 },
};

/**
 * `clé: [format, identifiant Unsplash, position du recadrage]`.
 * La position (0 → haut, 1 → bas, 0.5 → centre) évite de couper les visages.
 */
const PHOTOS = {
  // ---------- Couvertures des deux salons de démonstration
  'cover-hommes': ['couverture', '1585747860715-2ba37e788b70', 0.5],
  'cover-femmes': ['couverture', '1600948836101-f9ffda59d250', 0.5],

  // ---------- Portraits : professionnels, second membre d'équipe, clients
  'avatar-hommes': ['portrait', '1568602471122-7832951cc4c5', 0.35],
  'avatar-femmes': ['portrait', '1557053908-94f31a224f8f', 0.35],
  'avatar-sofiane': ['portrait', '1528892952291-009c663ce843', 0.35],
  'avatar-lina': ['portrait', '1654765437547-6b572f52ee1a', 0.35],
  'avatar-clienthomme': ['portrait', '1522529599102-193c0d76b5b6', 0.35],
  'avatar-clientfemme': ['portrait', '1612928414075-bc722ade44f1', 0.35],

  // ---------- Prestations hommes (13)
  'h-coupe-barbe': ['prestation', '1605497788044-5a32c7078486', 0.5],
  'h-coupe': ['prestation', '1647140655214-e4a2d914971f', 0.5],
  'h-coupe-mariage': ['prestation', '1593702295094-aea22597af65', 0.5],
  'h-nettoyage-peau': ['prestation', '1570172619644-dfd03ed5d881', 0.5],
  'h-lissage-keratine': ['prestation', '1621605815971-fbc98d665033', 0.5],
  'h-lissage-proteine': ['prestation', '1630827020718-3433092696e7', 0.5],
  'h-defrisage': ['prestation', '1629189784191-9afdcbcb0398', 0.5],
  'h-coupe-barbe-brushing': ['prestation', '1635273051839-003bf06a8751', 0.5],
  'h-brushing': ['prestation', '1635273051937-a0ddef9573b6', 0.5],
  'h-barbe': ['prestation', '1517832606299-7ae9b720a186', 0.5],
  'h-tracage': ['prestation', '1599011176306-4a96f1516d4d', 0.5],
  'h-coupe-barbe-shampoing': ['prestation', '1596728325488-58c87691e9af', 0.5],
  'h-coupe-lissage': ['prestation', '1598524374912-6b0b0bab43dd', 0.5],

  // ---------- Prestations femmes (21)
  'f-coupe': ['prestation', '1560869713-bf165a9cfac1', 0.5],
  'f-brushing': ['prestation', '1522338140262-f46f5913618a', 0.5],
  'f-coloration': ['prestation', '1617391654484-2894196c2cc9', 0.5],
  'f-balayage': ['prestation', '1712213396688-c6f2d536671f', 0.5],
  'f-lissage-bresilien': ['prestation', '1620331309205-b5a4669ac526', 0.5],
  'f-soin-proteine': ['prestation', '1527799820374-dcf8d9d4a388', 0.5],
  'f-chignon-mariee': ['prestation', '1638064432604-8da1fc75de09', 0.5],
  'f-tresses': ['prestation', '1619218533116-f050e7d91d91', 0.5],
  'f-manucure': ['prestation', '1604902396830-aca29e19b067', 0.5],
  'f-pose-gel': ['prestation', '1632345031435-8727f6897d53', 0.5],
  'f-semi-permanent': ['prestation', '1610992015762-45dca7fa3a85', 0.5],
  'f-nail-art': ['prestation', '1630843599725-32ead7671867', 0.5],
  'f-pedicure': ['prestation', '1587729927069-ef3b7a5ab9b4', 0.5],
  'f-extension-cils': ['prestation', '1589710751893-f9a6770ad71b', 0.5],
  'f-rehaussement-cils': ['prestation', '1735151226446-1d364b4adc2f', 0.5],
  'f-teinture-cils': ['prestation', '1639629509821-c54cdd984227', 0.5],
  'f-sourcils': ['prestation', '1567629307995-b9f33097bd30', 0.5],
  'f-sourcils-fil': ['prestation', '1548902378-2ec44c906391', 0.5],
  'f-nettoyage-peau': ['prestation', '1616394584738-fc6e612e71b9', 0.5],
  'f-soin-hydratant': ['prestation', '1643684391140-c5056cfd3436', 0.5],
  'f-epilation-visage': ['prestation', '1531299244174-d247dd4e5a66', 0.5],
};

const seulement = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

const browser = await pw.chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
let faits = 0;
const manques = [];

for (const [nom, [famille, id, pos]] of Object.entries(PHOTOS)) {
  if (seulement && famille !== seulement) continue;
  const f = FORMATS[famille];
  // On demande à Unsplash une image déjà proche de la taille finale : moins d'octets, et le
  // recadrage travaille sur une source nette.
  const url = `https://images.unsplash.com/photo-${id}?fm=jpg&q=80&w=${f.w * 2}&fit=max`;
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) {
    manques.push(`${nom} (${id})`);
    continue;
  }
  const base64 = Buffer.from(await res.arrayBuffer()).toString('base64');
  const webp = await page.evaluate(
    async ({ base64, w, h, q, pos }) => {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${base64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      // Recadrage « cover » : remplir le cadre sans déformer, en gardant la zone voulue.
      const echelle = Math.max(w / img.width, h / img.height);
      const lw = img.width * echelle;
      const lh = img.height * echelle;
      ctx.drawImage(img, (w - lw) * pos, (h - lh) * pos, lw, lh);
      return c.toDataURL('image/webp', q).split(',')[1];
    },
    { base64, w: f.w, h: f.h, q: f.q, pos },
  );
  fs.writeFileSync(path.join(OUT, `${nom}.webp`), Buffer.from(webp, 'base64'));
  faits++;
}

await browser.close();
const poids = fs
  .readdirSync(OUT)
  .filter((f) => f.endsWith('.webp'))
  .reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`${faits} photo(s) écrite(s) · dossier ${Math.round(poids / 1024)} ko`);
if (manques.length) console.log(`À REPRENDRE : ${manques.join(', ')}`);
