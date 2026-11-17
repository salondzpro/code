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
import { Ban, ChevronDown, Pencil, StickyNote } from 'lucide-react';
import type { BookingWithSalon } from '@salondz/types';
import { ApiError, useBookingStanding, useCreateBooking, useMe, useSalon } from '@salondz/api-client';
import { CLIENT_CANCEL_MIN_HOURS, depositFor, formatDA, wilayaName } from '@salondz/constants';
import { phoneDZ } from '@salondz/validation';
import { groupLocalDigits, phoneDigits } from '@/lib/authFlow';
import { clearDraft, readDraft, writeDraft } from '@/lib/bookingDraft';
import { BottomSheet, Button, Field, I, Input, Segmented, Textarea, TopBar } from '@/components/ui';
import { BookingSummary } from '@/components/BookingSummary';
import { ConfirmedView } from './BookingConfirmed';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
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
        <div className="flex flex-none items-center gap-2 rounded-[var(--radius-input)] bg-fill px-4 text-[0.929rem] font-medium" dir="ltr">
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
  const [forOther, setForOther] = useState(!!draft.forOther);
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
  const minutes = chosen.reduce((a, x) => a + (x?.durationMinutes ?? 0), 0);
  const price = chosen.reduce((a, x) => a + (x?.priceDa ?? 0), 0);
  const deposit = depositFor(price, s.depositMode ?? 'off', s.depositValue ?? 0);
  const staff = draft.staffId ? (s.staff ?? []).find((m) => m.id === draft.staffId) : null;
  const cannotBook = !forOther && !!standing.data && !standing.data.canBook;
  const compteComplet = !!profil?.fullName && !!profil?.phone;
  const area = [s.address, s.zone ?? s.city, wilayaName(s.wilayaCode)].filter(Boolean).join(', ');
  const endsAt = new Date(new Date(draft.startsAt).getTime() + minutes * 60_000).toISOString();
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

  return (
    <Screen bottom={SHEET_PAD} gap={12}>
      <TopBar backTo={`/s/${slug}/reserver/quand`} title={t('Confirmer')} />

      {cannotBook && (
        <div className="flex items-center gap-2.5 rounded-[var(--radius-card)] bg-cancel-bg p-4 text-cancel-fg" role="alert">
          <I icon={Ban} size={20} className="flex-none" />
          <span className="text-[1rem] font-semibold">{standing.data?.message ?? t('Réservation en ligne impossible')}</span>
        </div>
      )}

      <BookingSummary
        className={cannotBook ? 'opacity-60' : ''}
        salon={{ name: s.name, logoUrl: s.logoUrl, coverUrl: s.coverUrl, area }}
        startsAt={draft.startsAt}
        endsAt={endsAt}
        lines={chosen.map((sv) => ({ id: sv!.id, name: sv!.name, minutes: sv!.durationMinutes, priceDa: sv!.priceDa }))}
        staffName={staff?.displayName}
        priceDa={price}
        payNote={
          deposit != null
            ? t('Versement de {montant} · reste {reste} sur place', { montant: formatDA(deposit), reste: formatDA(price - deposit) })
            : t('Paiement sur place · annulation gratuite jusqu’à {h} h avant', { h: s.cancelMinHours ?? CLIENT_CANCEL_MIN_HOURS })
        }
      />

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
        <div className="crd !gap-3">
          <Field label={t('Nom et prénom')} htmlFor="bk-other" error={msg('otherName')}>
            <Input id="bk-other" lg value={otherName} onChange={(e) => setOtherName(e.target.value)} autoComplete="off" />
          </Field>
          <PhoneField label={t('Téléphone')} digits={otherDigits} onDigits={setOtherDigits} error={msg('otherPhone')} />
        </div>
      ) : compteComplet ? (
        <div className="crd !flex-row items-center gap-3 !p-3">
          <span className="flex h-[2.75rem] w-[2.75rem] flex-none items-center justify-center rounded-full bg-fill text-[1rem] font-semibold" aria-hidden>
            {(profil!.fullName ?? '').trim().charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1rem] font-semibold">{profil!.fullName}</span>
            <span className="block text-[0.857rem] text-muted" dir="ltr" style={{ textAlign: 'start' }}>
              +213 {groupLocalDigits((profil!.phone ?? '').replace(/^\+213/, ''))}
            </span>
          </span>
          <button type="button" onClick={modifierCompte} className="hdr-b !h-10 !w-10" aria-label={t('Modifier mon nom ou mon numéro')}>
            <I icon={Pencil} size={17} />
          </button>
        </div>
      ) : (
        <div className="crd !gap-3">
          <Field label={t('Nom et prénom')} htmlFor="bk-name" error={msg('name')}>
            <Input id="bk-name" lg value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
          <PhoneField label={t('Téléphone')} digits={digits} onDigits={setDigits} error={msg('phone')} />
        </div>
      )}

      {noteOpen ? (
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder={t('Note pour le salon')} aria-label={t('Note pour le salon')} />
      ) : (
        <button type="button" className="bk-note" onClick={() => setNoteOpen(true)}>
          <I icon={StickyNote} size={17} />
          {t('Ajouter une note')}
          <I icon={ChevronDown} size={16} className="ms-auto text-subtle" />
        </button>
      )}

      {slotError && (
        <div className="flex flex-col gap-3">
          <ErrorMessage error={new Error(slotError)} />
          <Button icon={ICONE.autreCreneau} variant="g" onClick={() => navigate(`/s/${slug}/reserver/quand`)}>
            {t('Choisir un autre créneau')}
          </Button>
        </div>
      )}
      {!slotError && <ErrorMessage error={create.error} />}

      <BottomSheet>
        <Button icon={ICONE.confirmerRdv} onClick={() => void confirm()} loading={create.isPending} disabled={create.isPending || cannotBook || standing.isPending}>
          {cannotBook ? t('Réservation en ligne impossible') : t('Confirmer · {heure}', { heure: time })}
        </Button>
      </BottomSheet>
    </Screen>
  );
}
