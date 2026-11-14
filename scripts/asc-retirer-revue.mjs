/**
 * Retire de la revue d'Apple la soumission en attente d'une application (14 nov. 2026).
 *
 *   node --env-file=.env scripts/asc-retirer-revue.mjs          → « Salon DZ »
 *   node --env-file=.env scripts/asc-retirer-revue.mjs --pro    → « Salon DZ Pro »
 *
 * POURQUOI : pendant « En attente de revue », Apple verrouille la fiche — on ne peut changer ni les
 * visuels ni le texte (« Can't Create Screenshot while Waiting For Review »). Retirer la soumission
 * repasse la version en « Rejetée par le développeur » : elle redevient modifiable, et
 * `asc-soumettre.mjs` la renvoie ensuite. La version repart en fin de file d'attente.
 * Une version déjà EN REVUE (IN_REVIEW) ne se retire pas : le script le dit et s'arrête.
 */
import { asc } from './asc-lib.mjs';

const PRO = process.argv.includes('--pro');
const APP = PRO ? '6821947874' : '6817317513';
const NOM = PRO ? 'Salon DZ Pro' : 'Salon DZ';

const r = await asc('GET', `/v1/reviewSubmissions?filter[app]=${APP}&filter[state]=WAITING_FOR_REVIEW,IN_REVIEW,READY_FOR_REVIEW&limit=5`);
const subs = r.json?.data ?? [];
if (!subs.length) {
  console.log(`· ${NOM} : aucune soumission en attente.`);
  process.exit(0);
}
for (const s of subs) {
  const etat = s.attributes.state;
  if (etat === 'IN_REVIEW') {
    console.log(`✖ ${NOM} : déjà EN REVUE chez Apple, impossible de la retirer — attendre la décision.`);
    process.exit(1);
  }
  if (etat === 'READY_FOR_REVIEW') {
    console.log(`· ${NOM} : soumission ${s.id} encore ouverte (non envoyée), rien à retirer.`);
    continue;
  }
  const p = await asc('PATCH', `/v1/reviewSubmissions/${s.id}`, {
    data: { type: 'reviewSubmissions', id: s.id, attributes: { canceled: true } },
  });
  if (p.status >= 300) {
    console.log(`✖ ${NOM} : retrait refusé ${p.status}`, JSON.stringify(p.json?.errors ?? p.json));
    process.exit(1);
  }
  console.log(`✔ ${NOM} : soumission retirée de la revue (était ${etat}).`);
}
