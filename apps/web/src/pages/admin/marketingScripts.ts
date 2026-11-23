/**
 * TEXTES À LIRE POUR LES VIDÉOS UGC (23 nov. 2026, lancement marketing en Algérie).
 *
 * Chaque vidéo = 3 plans : A) le propriétaire face caméra (téléphone vertical), B) la démonstration
 * dans l'application (enregistrée et montée par Claude), C) l'appel à l'action. La darija est écrite
 * en lettres latines comme on l'écrit sur les réseaux, avec les sous-titres en français. Le
 * propriétaire lit le texte « À dire » ; Claude ajoute les écrans, les sous-titres et la fin.
 */
export interface ScriptUgc {
  id: string;
  cible: 'clientes' | 'clients' | 'pros';
  titre: string;
  duree: string;
  /** Les 2 premières secondes : ce qui arrête le pouce. */
  accroche: string;
  plans: { plan: 'A' | 'B' | 'C'; dire?: string; montrer?: string; sousTitre?: string }[];
  /** Le texte du post (légende) et les mots-clés. */
  legende: string;
  lien: string;
}

export const SCRIPTS: ScriptUgc[] = [
  {
    id: 'cl-telephone',
    cible: 'clientes',
    titre: 'La coiffeuse qui ne répond jamais',
    duree: '25 s',
    accroche: 'Face caméra, l’air agacé, téléphone à l’oreille qui sonne dans le vide.',
    plans: [
      { plan: 'A', dire: 'Wesh, 3 fois n3ayet l coiffeuse dyali… ma terrdch. 😩', sousTitre: 'J’appelle ma coiffeuse 3 fois… elle ne répond pas.' },
      { plan: 'A', dire: 'Smahli, ana ma 3andich l weqt nestenna !', sousTitre: 'Désolée, je n’ai pas le temps d’attendre !' },
      { plan: 'B', montrer: 'Salon DZ : chercher « brushing », choisir un salon à côté, toucher 15:30, « Confirmer ».', sousTitre: 'Je choisis mon salon, mon heure… c’est réservé.' },
      { plan: 'A', dire: 'Khlass, réservit f 3 taps, w nchouf l prix 9bel ma nrouh.', sousTitre: 'Réservé en 3 taps, et je vois le prix avant d’y aller.' },
      { plan: 'C', dire: 'Salon DZ, gratuit. Le lien f la bio. 💅', sousTitre: 'Salon DZ, gratuit. Lien en bio.' },
    ],
    legende: 'Ma t3ayetch, réservi direct 💅 Coiffure, ongles, cils… les créneaux libres près de chez toi. Gratuit 👉 lien en bio #alger #coiffure #salondz #beauté #dz',
    lien: 'https://salondz.com/salons?src=tiktok&c=tel',
  },
  {
    id: 'cl-aid',
    cible: 'clientes',
    titre: 'Avant l’Aïd, tout est complet',
    duree: '20 s',
    accroche: 'Face caméra : « L3id ghodwa w ga3 les salons complets ?! »',
    plans: [
      { plan: 'A', dire: 'L3id qrib w ga3 les salons complets ?!', sousTitre: 'L’Aïd approche et tous les salons sont complets ?!' },
      { plan: 'B', montrer: 'Un jour « Complet », toucher « M’alerter si un créneau se libère », puis la notification qui arrive.', sousTitre: 'J’active l’alerte… et je suis prévenue dès qu’une place se libère.' },
      { plan: 'A', dire: 'Wahd la cliente annulat, w ana li khdit sa place. 😎', sousTitre: 'Une cliente a annulé… et c’est moi qui ai pris sa place.' },
      { plan: 'C', dire: 'Salon DZ. Télécharger l’appli, c’est gratuit.', sousTitre: 'Salon DZ — l’appli est gratuite.' },
    ],
    legende: 'Plus jamais « complet » avant l’Aïd 🌙 Active l’alerte créneau sur Salon DZ. Gratuit 👉 lien en bio #aid #alger #salon #dz',
    lien: 'https://salondz.com/salons?src=instagram&c=aid',
  },
  {
    id: 'cl-barbier',
    cible: 'clients',
    titre: 'Fini la queue chez le barbier',
    duree: '20 s',
    accroche: 'Plan sur une salle d’attente pleine (ou ta main qui compte « 1, 2, 3, 4… ») : « 4 personnes devant moi ? »',
    plans: [
      { plan: 'A', dire: 'Khouya, rabe3 nass 9damek f la queue ? Non merci.', sousTitre: '4 personnes devant toi ? Non merci.' },
      { plan: 'B', montrer: 'Pour Hommes → un barbier → « Coupe + barbe » → 18:00 → confirmé.', sousTitre: 'Je choisis mon barbier et mon heure.' },
      { plan: 'A', dire: 'Nji f l\'heure, nqa3ed, w nkhroj. Hadi hiya.', sousTitre: 'J’arrive à l’heure, je m’assois, je ressors.' },
      { plan: 'C', dire: 'Salon DZ. Lien f la bio.', sousTitre: 'Salon DZ — lien en bio.' },
    ],
    legende: 'Ton barbier, à ton heure 💈 Sans attendre, sans appeler. Salon DZ 👉 lien en bio #barber #alger #dz #coupe',
    lien: 'https://salondz.com/salons?src=snapchat&c=barbier',
  },
  {
    id: 'pro-independante',
    cible: 'pros',
    titre: 'Coiffeuse indépendante : le téléphone qui sonne pendant le brushing',
    duree: '30 s',
    accroche: 'Mains occupées (sèche-cheveux), téléphone qui vibre : « Wah, encore une fois… »',
    plans: [
      { plan: 'A', dire: 'Kont nrod 3la tilifoun w ana nkoupi… les clientes yetsennaw.', sousTitre: 'Je répondais au téléphone en coiffant… les clientes attendaient.' },
      { plan: 'B', montrer: 'Espace pro : une demande arrive, ✓ en un toucher, l’agenda par couleur, « Rappels » WhatsApp.', sousTitre: 'Maintenant les réservations arrivent seules dans mon agenda.' },
      { plan: 'A', dire: 'W l3yalat li ma yjiwch ? Rappel automatique 9bel b sa3a.', sousTitre: 'Et les clientes qui oublient ? Rappel automatique 1 h avant.' },
      { plan: 'C', dire: 'Salon DZ Pro, gratuit pour commencer. Black Friday : −40 % à vie.', sousTitre: 'Gratuit pour commencer. Black Friday : −40 % à vie.' },
    ],
    legende: 'Coiffeuses, esthéticiennes : votre salon se remplit pendant que vous travaillez ✂️ Gratuit pour commencer, Black Friday −40 % à vie 👉 lien en bio #coiffeuse #alger #salon #dz',
    lien: 'https://salondz.com/professionnels?src=facebook&c=bf-pros',
  },
  {
    id: 'pro-barbier',
    cible: 'pros',
    titre: 'Barbier : les clients qui ne viennent pas',
    duree: '25 s',
    accroche: 'Fauteuil vide, horloge : « Raho 15h… w ma ja hatta wahed. »',
    plans: [
      { plan: 'A', dire: 'Raho 15h… w l client ma jach. Sa3a mchat.', sousTitre: 'Il est 15 h… le client n’est pas venu. Une heure perdue.' },
      { plan: 'B', montrer: 'Lien en bio Instagram → page du salon → réservation → rappel envoyé au client.', sousTitre: 'Mes clients réservent depuis mon Instagram, et reçoivent un rappel.' },
      { plan: 'A', dire: 'Daba l agenda m3ammar, w l\'absences 9allou.', sousTitre: 'Mon agenda est plein, et les absences ont baissé.' },
      { plan: 'C', dire: 'Salon DZ Pro. Pour les barbiers d’Algérie.', sousTitre: 'Salon DZ Pro — pour les barbiers d’Algérie.' },
    ],
    legende: 'Barbiers : un lien en bio, et vos clients réservent seuls 💈 Rappels automatiques, moins d’absences. Salon DZ Pro 👉 lien en bio #barber #barbershop #alger #dz',
    lien: 'https://salondz.com/professionnels?src=instagram&c=barbier-pro',
  },
  {
    id: 'pro-blackfriday',
    cible: 'pros',
    titre: 'Black Friday : −40 % à vie',
    duree: '15 s',
    accroche: 'Face caméra, très direct : « Les pros de la beauté, 15 secondes. »',
    plans: [
      { plan: 'A', dire: 'Les pros, 15 secondes. Salon DZ Pro : agenda, réservations en ligne, rappels.', sousTitre: 'Agenda, réservations en ligne, rappels.' },
      { plan: 'B', montrer: 'Page « Offres » : Gratuit / Pro 790 DA / Max 990 DA, prix barrés.', sousTitre: 'Pro 790 DA au lieu de 1 320 DA. Max 990 DA.' },
      { plan: 'C', dire: '−40 % à vie, jusqu’au 30 novembre. Ktbouli f WhatsApp.', sousTitre: '−40 % à vie, jusqu’au 30 novembre. Écrivez-nous sur WhatsApp.' },
    ],
    legende: 'BLACK FRIDAY −40 % À VIE sur Salon DZ Pro 🖤 Jusqu’au 30 novembre. Gratuit pour commencer 👉 lien en bio #blackfriday #dz #salon',
    lien: 'https://salondz.com/professionnels?src=tiktok&c=black-friday',
  },
];

export const CONSEILS_TOURNAGE = [
  'Téléphone VERTICAL, caméra arrière si quelqu’un filme, sinon caméra avant à hauteur des yeux.',
  'Face à une fenêtre (lumière du jour), jamais dos à la lumière.',
  '1080p, 30 images/s. Pas de musique pendant que tu parles : je l’ajoute au montage.',
  'Endroit calme : le son de la voix compte plus que l’image.',
  'Une prise par phrase, avec 1 seconde de silence avant et après : je coupe au montage.',
  'Parle comme à une amie, pas comme une publicité. Un sourire au début, un clin d’œil à la fin.',
  'Fichier de 50 Mo au plus (environ 1 min en 1080p) : sinon, coupe en plusieurs prises.',
];
