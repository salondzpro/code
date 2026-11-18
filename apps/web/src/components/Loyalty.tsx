/**
 * PROGRAMME FIDÉLITÉ — les trois pièces visibles, partagées par le pro et le client (18 nov. 2026) :
 *   - `LoyaltyBadge` : la pastille « 6ᵉ visite offerte » avec l'icône carte fidélité (cartes des salons) ;
 *   - `LoyaltyStamps` : la rangée de tampons, la dernière case étant le cadeau ;
 *   - `LoyaltyCardView` : la carte complète (nom du salon, tampons, phrase de la récompense).
 * Une seule apparence partout : ce que le pro voit en aperçu EST ce que voit le client.
 */
import { Gift } from 'lucide-react';
import { formatDA, loyaltyDiscount, loyaltyHeadline, loyaltyReward, type LoyaltyPublic } from '@salondz/constants';
import { useBookingLoyalty } from '@salondz/api-client';
import { ICONE } from '@/lib/actionIcons';
import { I } from './ui';
import { t } from '@/i18n';

type Prog = Pick<LoyaltyPublic, 'visits' | 'rewardKind' | 'rewardValue'>;

export function LoyaltyBadge({ program, className = '' }: { program: Prog; className?: string }) {
  return (
    <span className={`fid-badge ${className}`}>
      <I icon={ICONE.fidelite} size={15} strokeWidth={1.8} />
      {loyaltyHeadline(program)}
    </span>
  );
}

export function LoyaltyStamps({ visits, stamps }: { visits: number; stamps: number }) {
  return (
    <div className="fid-stamps" style={{ gridTemplateColumns: `repeat(${Math.min(visits, 10)}, minmax(0, 1fr))` }} role="img" aria-label={t('{n} tampons sur {total}', { n: stamps, total: visits })}>
      {Array.from({ length: visits }, (_, i) =>
        i === visits - 1 ? (
          <span key={i} className={`fid-dot gift${stamps >= visits - 1 ? ' ready' : ''}`}>
            <Gift size={15} strokeWidth={2} />
          </span>
        ) : (
          <span key={i} className={`fid-dot${i < stamps ? ' on' : ''}`} />
        ),
      )}
    </div>
  );
}

export function LoyaltyCardView({
  program,
  stamps,
  title,
  sub,
  action,
}: {
  program: Prog;
  stamps: number;
  /** Nom du salon (« Ma fidélité ») ou rien (page du salon : le nom est déjà au-dessus). */
  title?: string;
  sub?: string | null;
  action?: React.ReactNode;
}) {
  const ready = stamps >= program.visits - 1;
  return (
    <div className="crd fid-card">
      <div className="flex items-center gap-2.5">
        <span className="fid-ic" aria-hidden>
          <I icon={ICONE.fidelite} size={20} strokeWidth={1.7} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[1rem] font-semibold">{title ?? t('Carte fidélité')}</b>
          <span className="block truncate text-[0.857rem] text-muted">{sub ?? loyaltyHeadline(program)}</span>
        </span>
        <b className="mono flex-none text-[1.143rem]" dir="ltr">
          {stamps}/{program.visits}
        </b>
      </div>
      <LoyaltyStamps visits={program.visits} stamps={stamps} />
      {ready && (
        <p className="fid-ready">
          {t('Prochaine visite : {recompense}', { recompense: loyaltyReward(program).toLowerCase() })}
        </p>
      )}
      {action}
    </div>
  );
}

/**
 * Côté PRO, fenêtre et fiche d'un rendez-vous à venir : « Récompense fidélité · −500 DA ». Rien
 * quand ce n'est pas la visite récompensée — la fenêtre reste telle quelle.
 */
export function BookingLoyaltyNote({ bookingId, priceDa, active }: { bookingId: string; priceDa: number; active: boolean }) {
  const q = useBookingLoyalty(bookingId, active);
  const p = q.data?.program;
  if (!active || !q.data?.reward || !p) return null;
  return (
    <div className="fid-reward" role="status">
      <span className="fid-ic" aria-hidden>
        <I icon={ICONE.fidelite} size={20} strokeWidth={1.7} />
      </span>
      <span className="min-w-0">
        <b>{t('Récompense fidélité : {recompense}', { recompense: q.data.reward.toLowerCase() })}</b>
        <span dir="auto">{t('À déduire : {montant}', { montant: formatDA(loyaltyDiscount(p, priceDa)) })}</span>
      </span>
    </div>
  );
}
