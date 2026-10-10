/**
 * Ce qu'une notification POUSSÉE doit porter en plus de son texte : un emoji qui dit le type d'un
 * coup d'œil, la destination exacte dans l'application, et le compteur à poser sur l'icône.
 *
 * POURQUOI ICI ET PAS À LA CRÉATION : les notifications naissent à sept endroits (réservation,
 * annulation, report, rappels, liste d'attente, modération, démonstration). Mettre l'emoji et
 * l'adresse à chacun garantissait qu'un nouveau type sorte un jour sans. `lib/push.ts` est le
 * passage OBLIGÉ de tout ce qui part vers un téléphone : la règle vit donc là, une fois.
 *
 * Le texte en base reste NU (sans emoji) : il s'affiche aussi dans la liste des notifications de
 * l'application, où l'icône de type est déjà présente et où un emoji ferait doublon.
 */

/** Une notification s'adresse au client ou au professionnel — `data.audience` le dit pour les types partagés. */
type Public = 'client' | 'pro';

/**
 * Emoji par type. Les rappels et les mouvements de rendez-vous sont partagés entre les deux
 * publics : seul `booking_created` change de sens (le pro reçoit une DEMANDE, le client une
 * CONFIRMATION de sa réservation).
 */
const EMOJI: Record<string, string | Record<Public, string>> = {
  // Le pro reçoit un NOUVEAU rendez-vous (📅) ; le client, l'accusé de sa DEMANDE (📨).
  booking_created: { pro: '📅', client: '📨' },
  booking_confirmed: '✅',
  booking_cancelled: '❌',
  booking_rescheduled: '🔄',
  booking_reminder: '⏰',
  booking_completed: '⭐',
  // Une absence signalée pèse dans les règles anti-abus : c'est un avertissement, pas une information.
  booking_no_show: '⚠️',
  // Une demande attend encore une réponse : action requise.
  request_pending: '⚠️',
  slot_freed: '✨',
};

export function emojiFor(type: string, audience: Public): string {
  const e = EMOJI[type];
  if (!e) return '🔔';
  return typeof e === 'string' ? e : e[audience];
}

/** Le titre tel qu'il apparaît sur l'écran verrouillé : l'emoji d'abord, il se lit avant les mots. */
export function pushTitle(type: string, audience: Public, titre: string): string {
  return `${emojiFor(type, audience)} ${titre}`;
}

/**
 * Où mène un appui sur la notification. Une notification qui ouvre l'accueil oblige à retrouver
 * soi-même le rendez-vous dont elle parle — c'est exactement ce qu'elle était censée éviter.
 *
 * `data.url` posée à la création l'emporte (la liste d'attente vise une page de réservation
 * précise) ; sinon on déduit du rendez-vous concerné, côté pro ou côté client.
 */
export function pushUrl(
  n: { data: Record<string, unknown>; booking_id: string | null },
  audience: Public,
): string | null {
  const explicite = n.data?.url;
  if (typeof explicite === 'string' && explicite.startsWith('/')) return explicite;
  const id = n.booking_id ?? (typeof n.data?.bookingId === 'string' ? n.data.bookingId : null);
  if (!id) return null;
  return audience === 'pro' ? `/pro/rendez-vous/${id}` : `/rendez-vous/${id}`;
}

/** Le public visé : `data.audience` quand il est posé (rappel du pro), le client par défaut. */
export function audienceOf(data: Record<string, unknown>): Public {
  return data?.audience === 'pro' ? 'pro' : 'client';
}
