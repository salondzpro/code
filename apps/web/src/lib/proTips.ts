/**
 * « CONSEIL » de l'accueil pro — un DIAGNOSTIC du salon (refonte du 26 nov. 2026, demande du
 * propriétaire : « adapte-toi au besoin du professionnel et à ce qui lui manque : promotions,
 * programme fidélité… proposez-lui un abonnement plus haut, ses avantages »).
 *
 * Ordre : (1) l'URGENT (demandes à valider, avis sans réponse) ; (2) la première chose qui MANQUE à sa
 * page (photo, réalisations, présentation, numéro) ; (3) ce qui ferait REVENIR et REMPLIR — fidélité, promotions,
 * versement contre les absences — avec, quand la fonction dépend d'une offre supérieure, l'OFFRE
 * qui la débloque, son prix et ses avantages ; (4) le reste de la page, puis les gestes du quotidien,
 * qui tournent chaque jour. Huit conseils au plus.
 * Un conseil déjà réglé n'apparaît jamais. Aucun chiffre de résultat : rien ici ne promet ce qu'on ne
 * peut pas prouver (seuls les prix des offres sont des chiffres).
 */
import { PLANS, PLAN_PROMO_END, formatDA, toLocalDateKey } from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';
import { t } from '@/i18n';

export type ProTip = {
  id: string;
  title: string;
  body: string;
  to?: string;
  action?: string;
  /** Pastille au-dessus du titre (« Offre Pro · 790 DA / mois », « À faire »…). */
  tag?: string;
  /** Les avantages, trois au plus, une ligne chacun. */
  points?: string[];
  /** Mise en avant (offre supérieure) : le bouton passe en noir brillant. */
  upsell?: boolean;
};

/** Ce que l'écran sait du salon (chaque valeur peut manquer : réseau, ancienne version). */
export type ProTipsContext = {
  salon: SalonOwnerView;
  pending: number;
  dayIndex: number;
  question: string;
  plan?: 'free' | 'pro' | 'salon';
  loyaltyOn?: boolean;
  promosOn?: boolean;
  depositOn?: boolean;
  unansweredReviews?: number;
  showPhone?: boolean;
};

const MAX_TIPS = 8;
const MAX_GROWTH = 3;

/** « 790 DA / mois » (tarif de lancement tant qu'il court, sinon le prix normal). */
function prix(id: 'pro' | 'salon'): string {
  const p = PLANS.find((x) => x.id === id)!;
  const lancement = toLocalDateKey() <= PLAN_PROMO_END;
  return t('{prix} / mois', { prix: formatDA(lancement ? p.promo : p.price) });
}
const lancementEnCours = () => toLocalDateKey() <= PLAN_PROMO_END;

export function proTips(c: ProTipsContext): ProTip[] {
  const { salon } = c;
  const urgent: ProTip[] = [];
  const page: ProTip[] = [];
  const growth: ProTip[] = [];

  /* 1 · L'urgent. */
  if (c.pending > 0) {
    urgent.push({
      id: 'pending',
      tag: t('À faire'),
      title: c.pending > 1 ? t('{n} demandes attendent votre réponse', { n: c.pending }) : t('Une demande attend votre réponse'),
      body: t('Une demande sans réponse bloque le créneau. Acceptez ou refusez dès que vous pouvez.'),
      to: '/pro/reservations',
      action: t('Voir les demandes'),
    });
  }
  if ((c.unansweredReviews ?? 0) > 0) {
    urgent.push({
      id: 'reviews',
      tag: t('À faire'),
      title: t('Répondez à vos avis'),
      body: t('Une réponse courte et polie rassure les prochaines clientes qui lisent vos avis.'),
      to: '/pro/avis',
      action: t('Voir mes avis'),
    });
  }

  /* 2 · Ce qui manque à la page. */
  if (!salon.coverUrl) {
    page.push({
      id: 'cover',
      tag: t('Votre page'),
      title: t('Ajoutez une photo de couverture'),
      body: t("C'est la première chose qu'on voit sur votre page."),
      to: '/pro/photos',
      action: t('Ajouter une photo'),
    });
  }
  if ((salon.works?.length ?? 0) < 3) {
    page.push({
      id: 'works',
      tag: t('Votre page'),
      title: t('Montrez votre travail'),
      body: t('Avant de réserver, une cliente regarde vos réalisations. Ajoutez au moins trois photos.'),
      to: '/pro/realisations',
      action: t('Ajouter des réalisations'),
    });
  }
  if (!salon.description?.trim()) {
    page.push({
      id: 'description',
      tag: t('Votre page'),
      title: t('Présentez votre salon'),
      body: t('Deux phrases : votre spécialité, votre ambiance, ce qui vous rend unique.'),
      to: '/pro/mon-salon',
      action: t('Écrire ma présentation'),
    });
  }

  /* 3 · Faire revenir et remplir — selon l'offre. */
  const plan = c.plan;
  const payant = plan === 'pro' || plan === 'salon';
  const equipe = salon.staff.length > 1;
  if (plan === 'free') {
    growth.push({
      id: 'upsell-pro',
      upsell: true,
      tag: `${t('Offre Pro')} · ${prix('pro')}`,
      title: t('Passez à l’offre Pro'),
      body: lancementEnCours() ? t('Tarif de lancement −40 %, gardé à vie, jusqu’au 30 novembre.') : t('Tout ce qu’il faut pour faire revenir vos clientes.'),
      points: [t('Programme fidélité et promotions'), t('Versement à la réservation contre les absences'), t('Mis en avant dans votre ville')],
      to: '/pro/abonnement',
      action: t('Voir l’offre Pro'),
    });
    growth.push({
      id: 'loyalty-locked',
      tag: t('Avec l’offre Pro'),
      title: t('Faites revenir vos clientes'),
      body: t('Une carte de fidélité : au bout de quelques visites, un cadeau. Vos clientes la voient sur votre page.'),
      points: [t('Passages, points ou code promo'), t('Prêt en trois touchers')],
      to: '/pro/abonnement',
      action: t('Débloquer la fidélité'),
    });
    growth.push({
      id: 'promo-locked',
      tag: t('Avec l’offre Pro'),
      title: t('Remplissez vos heures creuses'),
      body: t('Une promotion sur une prestation, affichée sur la place de marché avec le prix barré.'),
      to: '/pro/abonnement',
      action: t('Débloquer les promotions'),
    });
    if (equipe) {
      growth.push({
        id: 'upsell-max',
        upsell: true,
        tag: `${t('Offre Max')} · ${prix('salon')}`,
        title: t('Toute votre équipe sur Salon DZ'),
        body: t('Avec l’offre Gratuit, une seule personne reçoit des réservations.'),
        points: [t('Jusqu’à 8 personnes'), t('Un agenda par personne'), t('En tête de votre ville')],
        to: '/pro/abonnement',
        action: t('Voir l’offre Max'),
      });
    }
  }
  if (payant) {
    if (c.loyaltyOn === false) {
      growth.push({
        id: 'loyalty',
        tag: t('Inclus dans votre offre'),
        title: t('Lancez votre programme fidélité'),
        body: t('Une carte de fidélité : au bout de quelques visites, un cadeau. Vos clientes la voient sur votre page.'),
        points: [t('Passages, points ou code promo'), t('Prêt en trois touchers')],
        to: '/pro/profil/fidelite',
        action: t('Créer mon programme'),
      });
    }
    if (c.promosOn === false) {
      growth.push({
        id: 'promos',
        tag: t('Inclus dans votre offre'),
        title: t('Remplissez vos heures creuses'),
        body: t('Une promotion sur une prestation, affichée sur la place de marché avec le prix barré.'),
        to: '/pro/promotions',
        action: t('Créer une promotion'),
      });
    }
    if (c.depositOn === false) {
      growth.push({
        id: 'deposit',
        tag: t('Inclus dans votre offre'),
        title: t('Fini les rendez-vous oubliés'),
        body: t('Demandez un petit versement par CCP pour réserver : la cliente qui paie vient.'),
        points: [t('Pour tout le monde ou les nouvelles clientes'), t('Vous validez le reçu en un toucher')],
        to: '/pro/profil/versement',
        action: t('Régler le versement'),
      });
    }
    if (plan === 'pro' && equipe) {
      growth.push({
        id: 'upsell-max',
        upsell: true,
        tag: `${t('Offre Max')} · ${prix('salon')}`,
        title: t('Toute votre équipe sur Salon DZ'),
        body: t('Avec l’offre Pro, une seule personne reçoit des réservations.'),
        points: [t('Jusqu’à 8 personnes'), t('Un agenda par personne'), t('En tête de votre ville')],
        to: '/pro/abonnement',
        action: t('Voir l’offre Max'),
      });
    }
  }
  if (c.showPhone === false) {
    page.push({
      id: 'phone',
      tag: t('Votre page'),
      title: t('Affichez votre numéro'),
      body: t('Vos clientes peuvent vous appeler en un toucher depuis leur rendez-vous.'),
      to: '/pro/profil/regles',
      action: t('Afficher mon numéro'),
    });
  }

  /* 4 · Le quotidien, qui tourne chaque jour. */
  const general: ProTip[] = [
    { id: 'bio', title: t('Votre lien dans votre bio'), body: t('Fini « {question} » en message. Dans Instagram : Modifier le profil, Liens, Ajouter un lien externe, puis collez votre lien.', { question: c.question }), to: '/pro/lien', action: t('Copier mon lien') },
    { id: 'video', title: t('Publiez votre pub vidéo'), body: t('Le rond « Ma pub » : une vidéo prête qui montre comment réserver chez vous. À poster en story ou en Reel.') },
    { id: 'reminders', title: t('Envoyez vos rappels'), body: t('Un petit message avant le rendez-vous, et moins de monde oublie de venir.'), to: '/pro/rappels', action: t('Voir mes rappels') },
    { id: 'story', title: t('Postez vos heures libres'), body: t('Une story avec vos disponibilités aide à remplir les trous de la journée.') },
    { id: 'qr', title: t('Affichez votre code QR'), body: t("Posé à l'accueil ou sur le miroir, il permet de reprendre rendez-vous sur place."), to: '/pro/qr', action: t('Voir mon code QR') },
  ];

  // Les leviers tournent eux aussi (une offre ne revient pas en tête chaque matin), l'offre supérieure d'abord.
  const tourne = <T,>(xs: T[], n: number) => (xs.length ? [...xs.slice(n % xs.length), ...xs.slice(0, n % xs.length)] : xs);
  const leviers = [...growth.filter((x) => x.upsell), ...tourne(growth.filter((x) => !x.upsell), c.dayIndex)].slice(0, MAX_GROWTH);
  // L'urgent, la plus grosse lacune de la page, PUIS les leviers (ce que le pro vient chercher ici),
  // puis le reste de la page et le quotidien.
  return [...urgent, ...page.slice(0, 1), ...leviers, ...page.slice(1), ...tourne(general, c.dayIndex)].slice(0, MAX_TIPS);
}
