/** C-F 10 — Vos coordonnées : nom, téléphone (+213), note pour le salon, rappel WhatsApp, feuille « Vérifier ». */
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
import { BottomSheet, Button, Field, I, Input, Textarea, Toggle, TopBar } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';

export function BookingDetails() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const salon = useSalon(slug);
  const me = useMe(!!session);
  const draft = readDraft(slug);
  const [name, setName] = useState(draft.name ?? '');
  const [digits, setDigits] = useState(() => (draft.phone ?? '').replace(/^\+213/, ''));
  const [notes, setNotes] = useState(draft.notes ?? '');
  const [whatsapp, setWhatsapp] = useState(draft.whatsapp ?? true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = me.data?.profile;
    if (!p) return;
    setName((v) => v || p.fullName || '');
    setDigits((v) => v || (p.phone ?? '').replace(/^\+213/, ''));
    setWhatsapp(p.whatsappReminders ?? true);
  }, [me.data]);

  if (!draft.startsAt || draft.serviceIds.length === 0) return <Navigate to={`/s/${slug}/prestations`} replace />;
  if (!session) return <Navigate to={`/connexion?next=${encodeURIComponent(`/s/${slug}/reserver/coordonnees`)}`} replace />;
  if (salon.isPending || me.isPending) return <Splash />;
  const s = salon.data;
  if (!s) return null;
  const chosen = draft.serviceIds.map((id) => s.services.find((x) => x.id === id)).filter(Boolean);
  const minutes = chosen.reduce((a, x) => a + (x?.durationMinutes ?? 0), 0);
  const price = chosen.reduce((a, x) => a + (x?.priceDa ?? 0), 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Indiquez votre nom.');
    const parsed = phoneDZ.safeParse(`0${digits.replace(/\D/g, '')}`);
    if (!parsed.success) return setError('Numéro algérien invalide (9 chiffres après +213).');
    setError(null);
    writeDraft(slug, { name: name.trim(), phone: parsed.data, notes: notes.trim(), whatsapp });
    navigate(`/s/${slug}/reserver/recap`);
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo={`/s/${slug}/reserver/quand`} right="Étape 4 sur 4" />
      <div>
        <h1 className="h1">Vos coordonnées</h1>
        <p className="p mt-3">Vous êtes connecté{me.data?.profile.gender === 'female' ? 'e' : ''} : vos coordonnées sont préremplies depuis votre compte.</p>
      </div>
      <form id="details" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nom et prénom" htmlFor="bk-name" error={error && name.trim().length < 2 ? error : null}>
          <Input id="bk-name" lg className={name ? 'f' : ''} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <div>
          <span className="lbl">Téléphone</span>
          <div className="flex gap-2.5">
            <div className="flex flex-none items-center gap-2 rounded-[14px] bg-fill px-4 text-[17px] font-medium">
              +213 <I icon={ChevronDown} size={16} className="text-subtle" />
            </div>
            <Input lg type="tel" inputMode="numeric" value={groupLocalDigits(digits)} onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 9))} aria-label="Téléphone" err={!!error && name.trim().length >= 2} />
          </div>
          {error && name.trim().length >= 2 && <p className="mt-1.5 text-[13px] text-danger">{error}</p>}
        </div>
        <Field label="Note pour le salon (optionnel)" htmlFor="bk-notes">
          <Textarea id="bk-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Base fine, gel rose pâle si possible" />
        </Field>
        <div className="crd !flex-row items-center gap-4">
          <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full border border-line bg-surface">
            <I icon={MessageCircle} size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px]">Confirmation et rappel sur WhatsApp</span>
            <span className="p block text-[15px]">2 h avant le rendez-vous</span>
          </span>
          <Toggle on={whatsapp} onChange={setWhatsapp} label="Rappel WhatsApp" />
        </div>
      </form>
      <BottomSheet>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[26px] font-bold tracking-[-0.5px]">{formatDA(price)}</div>
            <div className="p">
              {formatDuration(minutes)} · {formatDateLongDZ(draft.startsAt).replace(/^\w/, (c) => c.toLowerCase())}, {formatTimeDZ(draft.startsAt)}
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
