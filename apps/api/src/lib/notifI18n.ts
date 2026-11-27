/**
 * NOTIFICATIONS DANS LA LANGUE DE LA PERSONNE (27 nov. 2026).
 *
 * Les notifications naissent en français à une quarantaine d'endroits (déclencheurs SQL, cron, API).
 * Plutôt que de toucher à chacun, la traduction se fait AU DERNIER MOMENT — à l'envoi poussé
 * (`lib/push.ts`) et à la lecture de la liste (`GET /me/notifications`) — d'après `profiles.locale`.
 * Le texte en base reste français : un compte en français ne voit strictement rien changer.
 *
 * Un message est fait de données (noms, prestations, dates, montants) et de quelques mots fixes :
 * on traduit les titres connus, les mots de liaison et les jours. Ce qui n'est pas reconnu reste en
 * français plutôt que d'être mal traduit. Les nouveautés et campagnes de l'administration gardent le
 * texte de leur auteur. Tout nouveau texte de notification = une règle ici.
 */
export type Langue = 'fr' | 'ar' | 'en';

type Regle = [RegExp, string, string];

/** Titres complets (ancrés). L'emoji éventuel est géré par `pushTitle`, pas ici. */
const TITRES: Regle[] = [
  [/^Nouvelle réservation$/, 'حجز جديد', 'New booking'],
  [/^Réservation confirmée$/, 'تم تأكيد الحجز', 'Booking confirmed'],
  [/^Réservation annulée$/, 'تم إلغاء الحجز', 'Booking cancelled'],
  [/^Réservation déplacée$/, 'تم تغيير موعد الحجز', 'Booking rescheduled'],
  [/^Demande expirée$/, 'انتهت صلاحية الطلب', 'Request expired'],
  [/^Absence signalée$/, 'تم تسجيل غياب', 'No-show reported'],
  [/^Merci pour votre visite$/, 'شكرًا على زيارتك', 'Thanks for your visit'],
  [/^Rendez-vous dans 1 h$/, 'موعد بعد ساعة', 'Appointment in 1 h'],
  [/^Rappel : rendez-vous dans 1 h$/, 'تذكير: موعدك بعد ساعة', 'Reminder: appointment in 1 h'],
  [/^Rappel : rendez-vous dans 30 min$/, 'تذكير: موعدك بعد 30 دقيقة', 'Reminder: appointment in 30 min'],
  [/^Une demande attend votre réponse$/, 'طلب في انتظار ردك', 'A request is waiting for your answer'],
  [/^Rendez-vous annulé$/, 'تم إلغاء الموعد', 'Appointment cancelled'],
  [/^Rendez-vous déplacé$/, 'تم تغيير الموعد', 'Appointment moved'],
  [/^Un créneau s’est libéré$/, 'تحرر موعد', 'A slot just opened'],
  [/^Un créneau plus tôt s’est libéré$/, 'تحرر موعد أبكر', 'An earlier slot just opened'],
  [/^Justificatif de versement reçu$/, 'تم استلام وصل العربون', 'Deposit receipt received'],
  [/^Justificatif à renvoyer$/, 'يرجى إعادة إرسال الوصل', 'Please resend the receipt'],
  [/^Félicitations pour votre journée 🎉$/, 'مبروك على يومك 🎉', 'Congrats on your day 🎉'],
  [/^Demain, on remplit l’agenda 💪$/, 'غدًا نملأ الأجندة 💪', 'Tomorrow, let’s fill your calendar 💪'],
  [/^(.+) vous offre un code promo$/, '$1 يقدم لك رمزًا ترويجيًا', '$1 offers you a promo code'],
  [/^(.+) lance sa carte fidélité$/, '$1 يطلق بطاقة الوفاء', '$1 launches a loyalty card'],
  [/^Cadeau débloqué chez (.+)$/, 'هدية مفتوحة عند $1', 'Gift unlocked at $1'],
  [/^\+1 visite chez (.+)$/, '+1 زيارة عند $1', '+1 visit at $1'],
  [/^\+(\d+) points chez (.+)$/, '+$1 نقطة عند $2', '+$1 points at $2'],
  [/^Crédit enregistré chez (.+)$/, 'تم تسجيل دين عند $1', 'Credit recorded at $1'],
  [/^Paiement reçu par (.+)$/, 'استلم $1 الدفع', 'Payment received by $1'],
];

/** Messages complets (ancrés) : phrases sans données, ou presque. */
const CORPS: Regle[] = [
  [/^Donnez votre avis sur (.+)$/, 'قيّم $1', 'Leave a review for $1'],
  [
    /^Partagez votre lien Salon DZ en story : vos clientes réservent même quand vous êtes occupé\.$/,
    'شارك رابط Salon DZ في القصة: زبوناتك يحجزن حتى وأنت مشغول.',
    'Share your Salon DZ link in your story: clients book even while you’re busy.',
  ],
  [/^Encore (\d+) points avant votre cadeau \((.+)\)\.$/, 'بقي $1 نقطة قبل هديتك ($2).', '$1 more points before your gift ($2).'],
  [/^Encore (\d+) visites? avant votre cadeau \((.+)\)\.$/, 'بقيت $1 زيارة قبل هديتك ($2).', '$1 more visit(s) before your gift ($2).'],
  [/^(.+) à régler\. Reste dû : (.+)\.$/, '$1 للدفع. الباقي: $2.', '$1 to pay. Balance due: $2.'],
  [/^(.+) reçus\. Reste dû : (.+)\.$/, 'تم استلام $1. الباقي: $2.', '$1 received. Balance due: $2.'],
  [/^(.+) reçus\. Avance en votre faveur : (.+)\.$/, 'تم استلام $1. رصيد لصالحك: $2.', '$1 received. Credit in your favour: $2.'],
  [/^(.+) reçus\. Votre crédit est soldé, merci\.$/, 'تم استلام $1. تم تسديد دينك، شكرًا.', '$1 received. Your balance is cleared, thank you.'],
];

/** Mots de liaison au milieu d'un message (toutes les occurrences). */
const FRAGMENTS: Regle[] = [
  [/ · le créneau reste bloqué jusqu'à votre réponse/g, ' · الموعد محجوز حتى ردك', ' · the slot is held until you answer'],
  [/ · à vérifier pour confirmer/g, ' · يجب التحقق للتأكيد', ' · check it to confirm'],
  [/ · premier arrivé, premier servi/g, ' · الأولوية لمن يحجز أولًا', ' · first come, first served'],
  [/ · avancez votre rendez-vous si vous le souhaitez/g, ' · قدّم موعدك إن أردت', ' · move your appointment earlier if you like'],
  [/ — ce salon a fermé son compte\./g, ' — أغلق هذا الصالون حسابه.', ' — this salon has closed its account.'],
  [/ — demande non confirmée à temps/g, ' — لم يُؤكَّد الطلب في الوقت', ' — request not confirmed in time'],
  [/ n'a pas confirmé à temps · /g, ' لم يؤكد في الوقت · ', ' did not confirm in time · '],
  [/ a annulé · /g, ' ألغى · ', ' cancelled · '],
  [/ a signalé une absence · /g, ' سجّل غيابًا · ', ' reported a no-show · '],
  [/ sur votre prochaine visite/g, ' في زيارتك القادمة', ' on your next visit'],
  [/, valable (\d+) mois\./g, '، صالحة $1 أشهر.', ', valid for $1 month(s).'],
  [/ — vos visites réservées sur Salon DZ comptent\./g, ' — زياراتك المحجوزة على Salon DZ تُحتسب.', ' — visits booked on Salon DZ count.'],
  [/, en réservant sur Salon DZ\./g, '، عند الحجز على Salon DZ.', ', when booking on Salon DZ.'],
  [/ rendez-vous aujourd’hui/g, ' مواعيد اليوم', ' appointments today'],
  [/, dont (\d+) réservés? en ligne via Salon DZ/g, '، منها $1 محجوزة عبر Salon DZ', ', $1 booked online via Salon DZ'],
  [/\. Continuez comme ça !/g, '. واصل هكذا!', '. Keep it up!'],
  // Dates : « 26/11 à 13:45 » → « 26/11 13:45 » ; « à 13:45 » → l'heure seule.
  [/(\d{2}\/\d{2}) à (\d{1,2}:\d{2})/g, '$1 $2', '$1 $2'],
  [/(^| )à (\d{1,2}:\d{2})/g, '$1$2', '$1at $2'],
  [/\bVotre salon\b/g, 'صالونك', 'Your salon'],
];

/** Jours abrégés de `Intl` en français (« jeu. 26/11 10:30 »). */
const JOURS: Record<string, [string, string]> = {
  'lun.': ['الإثنين', 'Mon'],
  'mar.': ['الثلاثاء', 'Tue'],
  'mer.': ['الأربعاء', 'Wed'],
  'jeu.': ['الخميس', 'Thu'],
  'ven.': ['الجمعة', 'Fri'],
  'sam.': ['السبت', 'Sat'],
  'dim.': ['الأحد', 'Sun'],
};

const appliquer = (texte: string, regles: Regle[], l: 'ar' | 'en', ancre: boolean): string => {
  let s = texte;
  for (const [re, ar, en] of regles) {
    if (ancre) {
      if (re.test(s)) return s.replace(re, l === 'ar' ? ar : en);
    } else s = s.replace(re, l === 'ar' ? ar : en);
  }
  return s;
};

export function langueDe(locale: unknown): Langue {
  return locale === 'ar' || locale === 'en' ? locale : 'fr';
}

/** Titre et message traduits pour `locale` ; inchangés en français ou pour une notification d'auteur. */
export function localiserNotif<T extends { title: string; body: string | null; data?: Record<string, unknown> | null }>(n: T, locale: Langue): T {
  if (locale === 'fr') return n;
  const kind = n.data?.kind;
  if (kind === 'news' || kind === 'campaign') return n;
  const title = appliquer(n.title, TITRES, locale, true);
  let body = n.body ?? '';
  if (body) {
    const entier = appliquer(body, CORPS, locale, true);
    body = entier !== body ? entier : appliquer(body, FRAGMENTS, locale, false);
    body = body.replace(/\b(lun|mar|mer|jeu|ven|sam|dim)\. /g, (j) => `${JOURS[j.trim()]![locale === 'ar' ? 0 : 1]} `);
  }
  return { ...n, title, body: n.body === null ? null : body };
}
