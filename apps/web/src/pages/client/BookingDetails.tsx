/**
 * C-F 10 — Pour qui ? : rendez-vous pour soi (coordonnées du compte, préremplies) ou POUR
 * QUELQU'UN D'AUTRE (son nom et son numéro), puis note pour le salon et rappels.
 *
 * Réserver pour quelqu'un d'autre est la norme ici : on prend rendez-vous pour sa mère, sa
 * sœur, un ami qui n'a pas l'application. Le rendez-vous appartient alors à cette personne
 * — son numéro l'identifie, et s'il correspond à un compte il s'y rattache — donc les mêmes
 * règles la concernent : plafond de rendez-vous à venir, doublon d'horaire, suspension pour
 * annulations. C'est dit en une ligne sous le choix, parce que ça change qui est engagé.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ChevronDown, MessageCircle } from 'lucide-react';
import { useMe, useSalon } from '@salondz/api-client';
import { formatDA, formatDateLongDZ, formatTimeDZ } from '@salondz/constants';
import { phoneDZ } from '@salondz/validation';
import { useAuth } from '@/lib/auth';
import { groupLocalDigits } from '@/lib/authFlow';
import { readDraft, writeDraft } from '@/lib/bookingDraft';
import { formatDuration } from '@/lib/format';
import {
  BottomSheet,
  Button,
  Field,
  I,
  Input,
  Segmented,
  Textarea,
  Toggle,
  TopBar,
} from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';

type Who = 'me' | 'other';
type FieldName = 'name' | 'phone' | 'otherName' | 'otherPhone';

/** Champ téléphone algérien : indicatif figé + 9 chiffres groupés. */
function PhoneField({
  label,
  digits,
  onDigits,
  error,
}: {
  label: string;
  digits: string;
  onDigits: (v: string) => void;
  error?: string | null;
}) {
  return (
    <div>
      <span className="lbl">{label}</span>
      <div className="flex gap-2.5">
        <div className="flex flex-none items-center gap-2 rounded-[0.571rem] bg-fill px-4 text-[0.857rem] font-medium">
          +213 <I icon={ChevronDown} size={16} className="text-subtle" />
        </div>
        <Input
          lg
          type="tel"
          inputMode="numeric"
          value={groupLocalDigits(digits)}
          onChange={(e) => onDigits(e.target.value.replace(/\D/g, '').slice(0, 9))}
          aria-label={label}
          err={!!error}
        />
      </div>
      {error && <p className="mt-1.5 text-[0.857rem] text-danger">{error}</p>}
    </div>
  );
}

export function BookingDetails() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const salon = useSalon(slug);
  const me = useMe(!!session);
  const draft = readDraft(slug);
  const [who, setWho] = useState<Who>(draft.forOther ? 'other' : 'me');
  const [name, setName] = useState(draft.name ?? '');
  const [digits, setDigits] = useState(() => (draft.phone ?? '').replace(/^\+213/, ''));
  const [otherName, setOtherName] = useState(draft.otherName ?? '');
  const [otherDigits, setOtherDigits] = useState(() =>
    (draft.otherPhone ?? '').replace(/^\+213/, ''),
  );
  const [notes, setNotes] = useState(draft.notes ?? '');
  const [whatsapp, setWhatsapp] = useState(draft.whatsapp ?? true);
  const [err, setErr] = useState<{ field: FieldName; msg: string } | null>(null);

  useEffect(() => {
    const p = me.data?.profile;
    if (!p) return;
    setName((v) => v || p.fullName || '');
    setDigits((v) => v || (p.phone ?? '').replace(/^\+213/, ''));
    setWhatsapp(p.whatsappReminders ?? true);
  }, [me.data]);

  if (!draft.startsAt || draft.serviceIds.length === 0)
    return <Navigate to={`/s/${slug}/prestations`} replace />;
  if (!session)
    return (
      <Navigate
        to={`/connexion?next=${encodeURIComponent(`/s/${slug}/reserver/coordonnees`)}`}
        replace
      />
    );
  if (salon.isPending || me.isPending) return <Splash />;
  const s = salon.data;
  if (!s) return null;
  const chosen = draft.serviceIds.map((id) => s.services.find((x) => x.id === id)).filter(Boolean);
  const minutes = chosen.reduce((a, x) => a + (x?.durationMinutes ?? 0), 0);
  const price = chosen.reduce((a, x) => a + (x?.priceDa ?? 0), 0);
  const forOther = who === 'other';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parse = (d: string) => phoneDZ.safeParse(`0${d.replace(/\D/g, '')}`);
    const bad = 'Numéro algérien invalide (9 chiffres après +213).';

    if (forOther) {
      if (otherName.trim().length < 2)
        return setErr({ field: 'otherName', msg: 'Indiquez le nom de la personne.' });
      const p = parse(otherDigits);
      if (!p.success) return setErr({ field: 'otherPhone', msg: bad });
      setErr(null);
      writeDraft(slug, {
        forOther: true,
        otherName: otherName.trim(),
        otherPhone: p.data,
        name: name.trim() || me.data?.profile.fullName || '',
        phone: parse(digits).success ? parse(digits).data : (me.data?.profile.phone ?? undefined),
        notes: notes.trim(),
        whatsapp,
      });
      return navigate(`/s/${slug}/reserver/recap`);
    }

    if (name.trim().length < 2) return setErr({ field: 'name', msg: 'Indiquez votre nom.' });
    const p = parse(digits);
    if (!p.success) return setErr({ field: 'phone', msg: bad });
    setErr(null);
    writeDraft(slug, {
      forOther: false,
      otherName: '',
      otherPhone: '',
      name: name.trim(),
      phone: p.data,
      notes: notes.trim(),
      whatsapp,
    });
    navigate(`/s/${slug}/reserver/recap`);
  };

  const msg = (f: FieldName) => (err?.field === f ? err.msg : null);

  return (
    <Screen bottom={SHEET_PAD} gap={14}>
      <TopBar backTo={`/s/${slug}/reserver/quand`} right="Étape 2 sur 3" />
      <h1 className="h1">Pour qui ?</h1>

      <Segmented
        label="Pour qui est ce rendez-vous"
        value={who}
        onChange={(v) => {
          setWho(v);
          setErr(null);
        }}
        options={[
          { value: 'me', label: 'Pour moi' },
          { value: 'other', label: 'Pour quelqu’un d’autre' },
        ]}
      />

      <form id="details" onSubmit={submit} className="flex flex-col gap-3.5">
        {forOther ? (
          <>
            {/* Ce que ça engage, en une ligne : le rendez-vous est à elle, règles comprises. */}
            <p className="p">
              Le rendez-vous sera au nom de cette personne, sur son compte si elle en a un, avec
              les mêmes règles d&apos;annulation.
            </p>
            <Field label="Nom et prénom de la personne" htmlFor="bk-other" error={msg('otherName')}>
              <Input
                id="bk-other"
                lg
                className={otherName ? 'f' : ''}
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                placeholder="Amina Bensalem"
                autoComplete="off"
              />
            </Field>
            <PhoneField
              label="Son téléphone"
              digits={otherDigits}
              onDigits={setOtherDigits}
              error={msg('otherPhone')}
            />
          </>
        ) : (
          <>
            <Field label="Nom et prénom" htmlFor="bk-name" error={msg('name')}>
              <Input
                id="bk-name"
                lg
                className={name ? 'f' : ''}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </Field>
            <PhoneField
              label="Téléphone"
              digits={digits}
              onDigits={setDigits}
              error={msg('phone')}
            />
          </>
        )}

        <Field label="Note pour le salon (optionnel)" htmlFor="bk-notes">
          <Textarea
            id="bk-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={300}
            placeholder="Base fine, gel rose pâle si possible"
          />
        </Field>

        <div className="crd !flex-row items-center gap-3.5 !p-3">
          <span className="flex h-[2.75rem] w-[2.75rem] flex-none items-center justify-center rounded-full border border-line bg-surface">
            <I icon={MessageCircle} size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[1rem] font-semibold">Confirmation et rappel</span>
            <span className="block text-[0.857rem] text-muted">2 h avant le rendez-vous</span>
          </span>
          <Toggle on={whatsapp} onChange={setWhatsapp} label="Rappels de rendez-vous" />
        </div>
      </form>

      <BottomSheet>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[1.429rem] font-bold tracking-[-0.5px]">{formatDA(price)}</div>
            <div className="p">
              {formatDuration(minutes)} ·{' '}
              {formatDateLongDZ(draft.startsAt).replace(/^\w/, (c) => c.toLowerCase())},{' '}
              {formatTimeDZ(draft.startsAt)}
            </div>
          </div>
          <Button type="submit" form="details" auto className="!rounded-full !px-7 !py-3.5">
            Vérifier
          </Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}
