/**
 * « MA FIDÉLITÉ » (18 nov. 2026) : toutes les cartes du client, la plus proche de la récompense
 * d'abord. Chaque carte mène au salon pour réserver la visite suivante.
 */
import { useMyLoyalty } from '@salondz/api-client';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { EmptyState, LinkButton, Skeleton, TopBar } from '@/components/ui';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoyaltyCardView } from '@/components/Loyalty';
import { ICONE } from '@/lib/actionIcons';
import { MARCHE } from '@/lib/flavor';
import { t } from '@/i18n';

export function Loyalty() {
  const cards = useMyLoyalty();
  return (
    <Screen bottom={NAV_PAD} gap={12}>
      <TopBar backTo="/profil" title={t('Ma fidélité')} />
      {cards.isPending ? (
        <Skeleton className="h-[9rem] w-full !rounded-[var(--radius-card)]" />
      ) : cards.isError ? (
        <ErrorMessage error={cards.error} retry={() => cards.refetch()} />
      ) : cards.data.length === 0 ? (
        <EmptyState
          icon={ICONE.fidelite}
          title={t('Aucune carte pour l’instant')}
          description={t('Réservez sur Salon DZ dans un salon qui affiche la carte fidélité : chaque visite vous rapproche d’une récompense.')}
          action={
            <LinkButton to={MARCHE} icon={ICONE.explorer}>
              {t('Trouver un salon')}
            </LinkButton>
          }
        />
      ) : (
        cards.data.map((c) => (
          <LoyaltyCardView
            key={c.salon.id}
            program={c.program}
            progress={c.progress}
            giftAvailable={c.giftAvailable}
            giftExpiresAt={c.giftExpiresAt}
            title={c.salon.name}
            action={
              <LinkButton to={`/s/${c.salon.slug}`} variant={c.giftAvailable ? undefined : 'g'} sm icon={ICONE.reserver}>
                {c.giftAvailable ? t('Réserver et profiter du cadeau') : t('Réserver')}
              </LinkButton>
            }
          />
        ))
      )}
    </Screen>
  );
}
