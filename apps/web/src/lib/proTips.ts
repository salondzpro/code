/**
 * Conseils de la story de l'accueil. Ce qui manque au salon passe d'abord, puis les conseils généraux,
 * qui tournent chaque jour. Aucun chiffre : rien ici ne promet un résultat qu'on ne peut pas prouver.
 */
import type { SalonOwnerView } from '@salondz/types';
import { t } from '@/i18n';

export type ProTip = { id: string; title: string; body: string; to?: string; action?: string };

const MAX_TIPS = 5;

export function proTips(salon: SalonOwnerView, pendingCount: number, dayIndex: number, question: string): ProTip[] {
  const urgent: ProTip[] = [];
  if (pendingCount > 0) {
    urgent.push({
      id: 'pending',
      title: t('Répondez à vos demandes'),
      body: t('Une demande sans réponse bloque le créneau. Acceptez ou refusez dès que vous pouvez.'),
      to: '/pro/reservations',
      action: t('Voir les demandes'),
    });
  }
  if (!salon.coverUrl) {
    urgent.push({
      id: 'cover',
      title: t('Ajoutez une photo de couverture'),
      body: t("C'est la première chose qu'on voit sur votre page."),
      to: '/pro/mon-salon',
      action: t('Ajouter une photo'),
    });
  } else if (salon.photos.length < 3) {
    urgent.push({
      id: 'photos',
      title: t('Montrez votre travail'),
      body: t('Ajoutez au moins trois photos de vos réalisations sur votre page.'),
      to: '/pro/mon-salon',
      action: t('Ajouter une photo'),
    });
  }

  const general: ProTip[] = [
    { id: 'bio', title: t('Votre lien dans votre bio'), body: t('Fini « {question} » en message. Dans Instagram : Modifier le profil, Liens, Ajouter un lien externe, puis collez votre lien.', { question }) },
    { id: 'reminders', title: t('Envoyez vos rappels'), body: t('Un petit message avant le rendez-vous, et moins de monde oublie de venir.'), to: '/pro/rappels', action: t('Voir mes rappels') },
    { id: 'story', title: t('Postez vos heures libres'), body: t('Une story avec vos disponibilités aide à remplir les trous de la journée.') },
    { id: 'qr', title: t('Affichez votre code QR'), body: t("Posé à l'accueil ou sur le miroir, il permet de reprendre rendez-vous sur place."), to: '/pro/lien', action: t('Voir mon code QR') },
    { id: 'reviews', title: t('Répondez à vos avis'), body: t('Une réponse courte montre que vous êtes à l’écoute.'), to: '/pro/avis', action: t('Voir mes avis') },
  ];
  const from = dayIndex % general.length;
  return [...urgent, ...general.slice(from), ...general.slice(0, from)].slice(0, MAX_TIPS);
}
