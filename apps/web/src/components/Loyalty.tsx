/**
 * PROGRAMME FIDÉLITÉ — les pièces visibles, partagées par le pro et le client (18 nov. 2026) :
 *   - `LoyaltyBadge` : la pastille « −20 % après 5 visites » avec l'icône carte fidélité (cartes des salons) ;
 *   - `LoyaltyCardView` : la carte — tampons (passages) ou barre (points), et le cadeau quand il est gagné ;
 *   - `BookingLoyaltyNote` : côté pro, « Cadeau fidélité · à déduire » sur le rendez-vous concerné.
 * Une seule apparence partout : ce que le pro voit en aperçu EST ce que voit le client.
 */
import { useState, type ReactNode } from 'react';
import { Gift } from 'lucide-react';
import { formatDA, formatDateShortDZ, loyaltyCondition, loyaltyDiscount, loyaltyHeadline, loyaltyReward, type LoyaltyPublic } from '@salondz/constants';
import { useApi, useBookingLoyalty } from '@salondz/api-client';
import { ICONE } from '@/lib/actionIcons';
import { Button, I, SettingRow } from './ui';
import { t } from '@/i18n';

type Prog = Pick<LoyaltyPublic, 'mode' | 'threshold' | 'rewardKind' | 'rewardValue' | 'minSpend'>;

/** La couleur de sens du type de programme : passages bleu, points orange, code promo rouge. */
export const fidColor = (mode: LoyaltyPublic['mode']) => `fid-c-${mode}`;

export function LoyaltyBadge({ program, className = '' }: { program: Prog; className?: string }) {
  return (
    <span className={`fid-tag ${fidColor(program.mode)} ${className}`}>
      <I icon={ICONE.fidelite} size={14} strokeWidth={2} />
      {loyaltyHeadline(program)}
    </span>
  );
}

/** Passages : une case par visite, la dernière est le cadeau. */
function Stamps({ threshold, progress, gift }: { threshold: number; progress: number; gift: boolean }) {
  return (
    <div className="fid-stamps" style={{ gridTemplateColumns: `repeat(${threshold + 1}, minmax(0, 1fr))` }} role="img" aria-label={t('{n} visites sur {total}', { n: progress, total: threshold })}>
      {Array.from({ length: threshold }, (_, i) => (
        <span key={i} className={`fid-dot${i < progress || gift ? ' on' : ''}`} />
      ))}
      <span className={`fid-dot gift${gift ? ' ready' : ''}`}>
        <Gift size={15} strokeWidth={2} />
      </span>
    </div>
  );
}

/** Points : une barre et le cadeau au bout. */
function Points({ threshold, progress, gift }: { threshold: number; progress: number; gift: boolean }) {
  const pct = gift ? 100 : Math.round((progress / Math.max(1, threshold)) * 100);
  return (
    <div className="flex items-center gap-2.5">
      <div className="fid-bar" role="img" aria-label={t('{n} points sur {total}', { n: progress, total: threshold })}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className={`fid-dot gift !w-8 flex-none${gift ? ' ready' : ''}`}>
        <Gift size={15} strokeWidth={2} />
      </span>
    </div>
  );
}

export function LoyaltyCardView({
  program,
  progress,
  giftAvailable = false,
  giftExpiresAt = null,
  title,
  action,
}: {
  program: Prog;
  progress: number;
  giftAvailable?: boolean;
  giftExpiresAt?: string | null;
  /** Nom du salon (« Ma fidélité ») ; par défaut « Carte fidélité ». */
  title?: string;
  action?: ReactNode;
}) {
  const cond = loyaltyCondition(program);
  const unit = program.mode === 'points' ? t('{n} pts', { n: `${progress}/${program.threshold}` }) : `${progress}/${program.threshold}`;
  return (
    <div className={`crd fid-card ${fidColor(program.mode)}`}>
      <div className="flex items-center gap-2.5">
        <span className="fid-ic" aria-hidden>
          <I icon={ICONE.fidelite} size={18} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[1rem] font-semibold">{title ?? t('Carte fidélité')}</b>
          <span className="block truncate text-[0.857rem] text-muted">
            {loyaltyHeadline(program)}
            {cond ? ` · ${cond}` : ''}
          </span>
        </span>
        {!giftAvailable && (
          <b className="fid-count mono flex-none text-[1rem]" dir="ltr">
            {unit}
          </b>
        )}
      </div>
      {program.mode === 'points' ? (
        <Points threshold={program.threshold} progress={progress} gift={giftAvailable} />
      ) : (
        <Stamps threshold={program.threshold} progress={progress} gift={giftAvailable} />
      )}
      {giftAvailable && (
        <p className="fid-ready">
          {giftExpiresAt
            ? t('Cadeau {recompense} jusqu’au {date}', { recompense: loyaltyReward(program), date: formatDateShortDZ(giftExpiresAt) })
            : t('Cadeau {recompense}', { recompense: loyaltyReward(program) })}
        </p>
      )}
      {action}
    </div>
  );
}

/** Côté PRO : « Cadeau fidélité : −20 % · à déduire 300 DA ». Rien sinon. */
export function BookingLoyaltyNote({ bookingId, active }: { bookingId: string; priceDa?: number; active: boolean }) {
  const q = useBookingLoyalty(bookingId, active);
  if (!active || (!q.data?.reward && !q.data?.promo)) return null;
  return (
    <div className="lst" role="status">
      {q.data.promo && (
        <SettingRow
          className="fid-c-promo"
          icon={ICONE.promo}
          title={t('Promotion : {reduction}', { reduction: q.data.promo.label ?? '' })}
          right={<b className="text-[1rem] text-ok-fg" dir="ltr">−{formatDA(q.data.promo.discount)}</b>}
        />
      )}
      {q.data.reward && (
        <SettingRow
          className="fid-c-gift"
          icon={ICONE.fidelite}
          title={t('Cadeau fidélité : {recompense}', { recompense: q.data.reward })}
          right={<b className="text-[1rem] text-ok-fg" dir="ltr">−{formatDA(q.data.discount)}</b>}
        />
      )}
    </div>
  );
}

/** L'encadré du cadeau côté client (« Confirmer ») : ce qui sera déduit. */
export function RewardBox({ title, sub, icon = ICONE.fidelite, tone = 'gift' }: { title: string; sub: string; icon?: typeof ICONE.fidelite; tone?: 'gift' | 'promo' }) {
  return (
    <div className="lst" role="status">
      <SettingRow className={`fid-c-${tone}`} icon={icon} title={title} sub={<span dir="auto">{sub}</span>} />
    </div>
  );
}

/**
 * CODE PROMO sur « Confirmer » (salon en mode code promo) : replié tant qu'on n'en a pas besoin,
 * vérifié par le serveur (valable, pas déjà utilisé), puis l'encadré du cadeau. `onCode` reçoit le
 * code retenu (ou null), envoyé avec la réservation.
 */
export function PromoCodeField({ salonId, priceDa, onCode }: { salonId: string; priceDa: number; onCode: (code: string | null) => void }) {
  const { api } = useApi();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<LoyaltyPublic | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const apply = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await api.me.checkPromo(salonId, code);
      if (!r.valid) {
        setErr(r.reason === 'used' ? t('Vous avez déjà utilisé ce code.') : t('Ce code n’est pas valable.'));
        onCode(null);
        return;
      }
      if (priceDa < r.program.minSpend) {
        setErr(t('Ce code est valable dès {montant}.', { montant: formatDA(r.program.minSpend) }));
        onCode(null);
        return;
      }
      setOk(r.program);
      onCode(code.trim().toUpperCase());
    } catch {
      setErr(t('Vérification impossible. Réessayez.'));
    } finally {
      setBusy(false);
    }
  };
  if (ok)
    return <RewardBox tone="promo" icon={ICONE.promo} title={t('Code promo : {recompense}', { recompense: loyaltyReward(ok) })} sub={t('{montant} déduits par le salon', { montant: formatDA(loyaltyDiscount(ok, priceDa)) })} />;
  return (
    <div className="crd fid-code fid-c-promo">
      <div className="flex items-center gap-2.5">
        <span className="fid-ic" aria-hidden>
          <I icon={ICONE.promo} size={18} strokeWidth={2} />
        </span>
        <b className="text-[1rem] font-semibold">{t('Vous avez un code promo ?')}</b>
      </div>
      <div className="row">
        <input
          className="inp"
          value={code}
          maxLength={12}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
            setErr(null);
          }}
          placeholder={t('Code promo')}
          aria-label={t('Code promo')}
          autoCapitalize="characters"
        />
        <Button icon={ICONE.valider} sm auto loading={busy} disabled={code.length < 3} onClick={() => void apply()}>
          {t('Appliquer')}
        </Button>
      </div>
      {err && (
        <p className="text-[0.857rem] text-danger" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
