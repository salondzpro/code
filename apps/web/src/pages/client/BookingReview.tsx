/**
 * CONFIRMER — refonte du 15 nov. 2026 (« réserver vite, compact, premium ») : UN écran après le choix
 * de l'heure. La carte du rendez-vous (où, quand, quoi, combien), « Pour moi / Quelqu'un d'autre »,
 * une note repliée, et « Confirmer ». L'ancien écran « Pour qui ? » (`/reserver/coordonnees`) y est
 * fondu : l'adresse redirige ici. Après la création, l'écran SE TRANSFORME en confirmation animée
 * (`ConfirmedView`) : confirmé, demande envoyée ou versement à faire, selon le salon.
 * Blocage par le salon ou suspension anti-abus : dit en haut, bouton grisé — jamais après un clic.
 */
import { ICONE } from '@/lib/actionIcons';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Ban } from 'lucide-react';
import type { BookingWithSalon } from '@salondz/types';
import { ApiError, useBookingStanding, useCreateBooking, useLoyaltyPrograms, useMe, useMyLoyaltyAt, usePromos, useSalon } from '@salondz/api-client';
import { loyaltyDiscount, loyaltyReward, promoDiscount } from '@salondz/constants';
import { PromoCodeField, RewardBox } from '@/components/Loyalty';
import { depositFor, formatDA, formatLocale } from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { phoneDZ } from '@salondz/validation';
import { groupLocalDigits, phoneDigits } from '@/lib/authFlow';
import { clearDraft, readDraft, writeDraft } from '@/lib/bookingDraft';
import { Button, Field, I, Input, Segmented, Textarea } from '@/components/ui';
import { ConfirmedView } from './BookingConfirmed';
import { ErrorMessage } from '@/components/ErrorMessage';
import { PageLoading } from '@/components/PageLoading';
import { bookingOrigin } from '@/lib/pageView';
import { t } from '@/i18n';

/** Téléphone algérien : indicatif figé + 9 chiffres groupés. */
function PhoneField({ label, digits, onDigits, error }: { label: string; digits: string; onDigits: (v: string) => void; error?: string | null }) {
  return (
    <div>
      <span className="lbl">{label}</span>
      <div className="flex gap-2.5">
        <div className="fld flex flex-none items-center gap-2 rounded-[var(--radius-input)] px-4 text-[0.929rem] font-medium" dir="ltr">
          +213
        </div>
        <Input lg type="tel" inputMode="numeric" value={groupLocalDigits(digits)} onChange={(e) => onDigits(phoneDigits(e.target.value))} aria-label={label} err={!!error} />
      </div>
      {error && <p className="mt-1.5 text-[0.857rem] text-danger">{error}</p>}
    </div>
  );
}

type FieldName = 'name' | 'phone' | 'otherName' | 'otherPhone';

export function BookingReview() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const salon = useSalon(slug);
  const me = useMe();
  const create = useCreateBooking();
  const standing = useBookingStanding(salon.data?.id ?? '');
  // Instantané : la création invalide des requêtes avant la transformation de l'écran.
  const [draft] = useState(() => readDraft(slug));
  // « Pour moi » par défaut (18 nov. 2026) : « Quelqu'un d'autre » n'est repris que si sa saisie avait commencé —
  // sinon un compte complet se voyait redemander un nom et un numéro.
  const [forOther, setForOther] = useState(!!draft.forOther && !!(draft.otherName || draft.otherPhone));
  const [name, setName] = useState(draft.name ?? '');
  const [digits, setDigits] = useState(() => (draft.phone ?? '').replace(/^\+213/, ''));
  const [otherName, setOtherName] = useState(draft.otherName ?? '');
  const [otherDigits, setOtherDigits] = useState(() => (draft.otherPhone ?? '').replace(/^\+213/, ''));
  const [notes, setNotes] = useState(draft.notes ?? '');
  const [noteOpen, setNoteOpen] = useState(!!draft.notes);
  const [err, setErr] = useState<{ field: FieldName; msg: string } | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [done, setDone] = useState<BookingWithSalon | null>(null);

  const profil = me.data?.profile;
  // Fidélité : cette visite est-elle la récompense ? (pour soi seulement : la carte est celle du compte)
  const carte = useMyLoyaltyAt(salon.data?.id, !forOther);
  const promo = useLoyaltyPrograms().data?.some((p) => p.salonId === salon.data?.id && p.mode === 'promo');
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const promosSalon = usePromos().data?.find((x) => x.salonId === salon.data?.id)?.promos ?? [];
  useEffect(() => {
    if (!profil) return;
    setName((v) => v || profil.fullName || '');
    setDigits((v) => v || (profil.phone ?? '').replace(/^\+213/, ''));
  }, [profil]);

  if (done) return <ConfirmedView booking={done} />;
  if (!draft.startsAt || draft.serviceIds.length === 0) return <Navigate to={`/s/${slug}`} replace />;
  if (salon.isPending || me.isPending) return <PageLoading />;
  if (salon.isError) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;
  const s = salon.data;
  if (!s) return <ErrorMessage error={new Error('Salon introuvable')} />;

  const chosen = draft.serviceIds.map((id) => s.services.find((x) => x.id === id)).filter(Boolean);
  const price = chosen.reduce((a, x) => a + (x?.priceDa ?? 0), 0);
  const deposit = depositFor(price, s.depositMode ?? 'off', s.depositValue ?? 0);
  const cannotBook = !forOther && !!standing.data && !standing.data.canBook;
  const compteComplet = !!profil?.fullName && !!profil?.phone;
  const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Algiers' }).format(new Date(draft.startsAt));

  const confirm = async () => {
    setSlotError(null);
    const parse = (d: string) => phoneDZ.safeParse(`0${d.replace(/\D/g, '')}`);
    const bad = t('Numéro algérien invalide (9 chiffres après +213).');
    let clientName = profil?.fullName ?? '';
    let clientPhone = profil?.phone ?? undefined;
    let beneficiary: { fullName: string; phone: string } | undefined;
    if (forOther) {
      if (otherName.trim().length < 2) return setErr({ field: 'otherName', msg: t('Indiquez le nom de la personne.') });
      const p = parse(otherDigits);
      if (!p.success) return setErr({ field: 'otherPhone', msg: bad });
      beneficiary = { fullName: otherName.trim(), phone: p.data };
    } else if (!compteComplet) {
      if (name.trim().length < 2) return setErr({ field: 'name', msg: t('Indiquez votre nom.') });
      const p = parse(digits);
      if (!p.success) return setErr({ field: 'phone', msg: bad });
      clientName = name.trim();
      clientPhone = p.data;
    }
    setErr(null);
    try {
      const b = await create.mutateAsync({
        salonId: s.id,
        serviceIds: draft.serviceIds,
        staffId: draft.staffId ?? null,
        startsAt: draft.startsAt!,
        notes: notes.trim() || undefined,
        clientName: clientName || name.trim(),
        clientPhone,
        origin: bookingOrigin(s.id),
        beneficiary,
        promoCode: !forOther && promoCode ? promoCode : undefined,
      });
      clearDraft(slug);
      // Même entrée d'historique, nouvelle adresse : un rechargement rouvre la confirmation.
      window.history.replaceState(window.history.state, '', `/rendez-vous/${b.id}/confirme`);
      setDone(b);
    } catch (e) {
      if (e instanceof ApiError && ['SLOT_TAKEN', 'TOO_SOON', 'OUTSIDE_OPENING_HOURS', 'ALREADY_BOOKED'].includes(e.code ?? '')) setSlotError(e.message);
    }
  };
  const msg = (f: FieldName) => (err?.field === f ? err.msg : null);
  const modifierCompte = () => {
    writeDraft(slug, { notes: notes.trim(), forOther });
    navigate(`/compte/informations?retour=${encodeURIComponent(`/s/${slug}/reserver/recap`)}`);
  };

  const jour = new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Algiers' }).format(new Date(draft.startsAt));
  /** « Supprimer » une prestation : la durée change, donc on rechoisit l'heure (ou la prestation). */
  const retirer = (id: string) => {
    const rest = draft.serviceIds.filter((x) => x !== id);
    writeDraft(slug, { serviceIds: rest, startsAt: undefined });
    navigate(rest.length ? `/s/${slug}/reserver/quand` : `/s/${slug}`);
  };

  // FAÇON PLANITY (19 nov. 2026, demande du propriétaire) : nom du salon, puis « 1. Prestation
  // sélectionnée », « 2. Date et heure sélectionnées » (Modifier), « 3. Vos informations », et le
  // bouton noir « Confirmer le rendez-vous » dans la page.
  return (
    <div className="rd pl-bk h-app">
      <h1 className="pl-bk-t">{s.name}</h1>

      {cannotBook && (
        <div className="mx-4 flex items-center gap-2.5 rounded-[var(--radius-card)] bg-cancel-bg p-4 text-cancel-fg" role="alert">
          <I icon={Ban} size={20} className="flex-none" />
          <span className="text-[1rem] font-semibold">{standing.data?.message ?? t('Réservation en ligne impossible')}</span>
        </div>
      )}

      <h2 className="pl-h2 pl-bk-h">
        <span className="pl-num">1.</span> {t('Prestation sélectionnée')}
      </h2>
      <div className="pl-card pl-bk-sel">
        {chosen.map((sv) => (
          <div key={sv!.id} className="pl-bk-sv">
            <div className="min-w-0">
              <span className="pl-bk-svn">{sv!.name}</span>
              <span className="pl-bk-svm" dir="ltr">
                {formatDuration(sv!.durationMinutes)}
                <span className="pl-dot" aria-hidden>•</span>
                <b>{formatDA(sv!.priceDa)}</b>
              </span>
            </div>
            <button type="button" className="pl-link" onClick={() => retirer(sv!.id)}>
              {t('Supprimer')}
            </button>
          </div>
        ))}
      </div>

      <h2 className="pl-h2 pl-bk-h">
        <span className="pl-num">2.</span> {t('Date et heure sélectionnées')}
      </h2>
      <div className="pl-card pl-bk-sel">
        <div className="pl-bk-sv">
          <div className="min-w-0">
            <span className="pl-bk-svn">{jour}</span>
            <span className="pl-bk-svm">{t('à {heure}', { heure: time })}</span>
          </div>
          <button type="button" className="pl-link" onClick={() => navigate(`/s/${slug}/reserver/quand`)}>
            {t('Modifier')}
          </button>
        </div>
      </div>

      {/* Promotion en cours sur une prestation choisie : la réduction, déduite par le salon. */}
      {(() => {
        const off = promoDiscount(chosen.map((x) => ({ serviceId: x!.id, priceDa: x!.priceDa })), promosSalon);
        return off > 0 ? (
          <div className="mx-4">
            <RewardBox tone="promo" icon={ICONE.promo} title={t('Promotion : −{montant}', { montant: formatDA(off) })} sub={t('À payer au salon : {montant}', { montant: formatDA(price - off) })} />
          </div>
        ) : null;
      })()}
      {/* Fidélité (18 nov. 2026) : cadeau de la carte. Pour soi seulement. */}
      {!forOther && carte.data?.giftAvailable && (
        <div className="mx-4">
          {price >= carte.data.program.minSpend ? (
            <RewardBox
              title={t('Cadeau fidélité : {recompense}', { recompense: loyaltyReward(carte.data.program) })}
              sub={t('{montant} déduits par le salon', { montant: formatDA(loyaltyDiscount(carte.data.program, price)) })}
            />
          ) : (
            <RewardBox
              title={t('Cadeau fidélité : {recompense}', { recompense: loyaltyReward(carte.data.program) })}
              sub={t('Valable dès {montant} : ajoutez une prestation.', { montant: formatDA(carte.data.program.minSpend) })}
            />
          )}
        </div>
      )}

      <h2 className="pl-h2 pl-bk-h">
        <span className="pl-num">3.</span> {t('Vos informations')}
      </h2>
      <div className="pl-card pl-bk-sel">
        <Segmented
          label={t('Pour qui')}
          value={forOther ? 'other' : 'me'}
          onChange={(v) => {
            setForOther(v === 'other');
            setErr(null);
          }}
          options={[
            { value: 'me', label: t('Pour moi') },
            { value: 'other', label: t('Quelqu’un d’autre') },
          ]}
        />

        {forOther ? (
          <div className="flex flex-col gap-3">
            <Field label={t('Nom et prénom')} htmlFor="bk-other" error={msg('otherName')}>
              <Input id="bk-other" lg value={otherName} onChange={(e) => setOtherName(e.target.value)} autoComplete="off" />
            </Field>
            <PhoneField label={t('Téléphone')} digits={otherDigits} onDigits={setOtherDigits} error={msg('otherPhone')} />
          </div>
        ) : compteComplet ? (
          <div className="pl-bk-sv">
            <div className="min-w-0">
              <span className="pl-bk-svn truncate">{profil!.fullName}</span>
              <span className="pl-bk-svm" dir="ltr" style={{ textAlign: 'start' }}>
                +213 {groupLocalDigits((profil!.phone ?? '').replace(/^\+213/, ''))}
              </span>
            </div>
            <button type="button" className="pl-link" onClick={modifierCompte}>
              {t('Modifier')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Field label={t('Nom et prénom')} htmlFor="bk-name" error={msg('name')}>
              <Input id="bk-name" lg value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <PhoneField label={t('Téléphone')} digits={digits} onDigits={setDigits} error={msg('phone')} />
          </div>
        )}

        {!forOther && promo && <PromoCodeField salonId={s.id} priceDa={price} onCode={setPromoCode} />}

        {noteOpen ? (
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder={t('Note pour le salon')} aria-label={t('Note pour le salon')} />
        ) : (
          <button type="button" className="pl-link self-start" onClick={() => setNoteOpen(true)}>
            {t('Ajouter une note')}
          </button>
        )}
      </div>

      {deposit != null && (
        <p className="mx-4 text-[1rem] text-muted">
          {t('Versement de {montant} · reste {reste} sur place', { montant: formatDA(deposit), reste: formatDA(price - deposit) })}
        </p>
      )}

      {slotError && (
        <div className="mx-4 flex flex-col gap-3">
          <ErrorMessage error={new Error(slotError)} />
          <Button icon={ICONE.autreCreneau} variant="g" onClick={() => navigate(`/s/${slug}/reserver/quand`)}>
            {t('Choisir un autre créneau')}
          </Button>
        </div>
      )}
      {!slotError && create.error && (
        <div className="mx-4">
          <ErrorMessage error={create.error} />
        </div>
      )}

      <div className="pl-bk-go">
        <button type="button" className="pl-btn pl-btn-ink" onClick={() => void confirm()} disabled={create.isPending || cannotBook || standing.isPending}>
          {create.isPending ? t('Réservation…') : cannotBook ? t('Réservation en ligne impossible') : t('Confirmer le rendez-vous')}
        </button>
      </div>
    </div>
  );
}
