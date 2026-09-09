/** Espace pro — Nouveau rendez-vous (client de passage ou téléphone) : client, prestations, date, heure, membre. */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Check } from 'lucide-react';
import { useProBookingMutations, useProSalon } from '@salondz/api-client';
import { formatDA, localDateTimeToISO, toLocalDateKey } from '@salondz/constants';
import { phoneDZ } from '@salondz/validation';
import { errorText } from '@/components/ErrorMessage';
import { BottomSheet, Button, Field, I, Input, TopBar } from '@/components/ui';
import { PickerField } from '@/components/Picker';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { formatDuration } from '@/lib/format';

export function ProBookingNew() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const salon = useProSalon().data?.salon ?? null;
  const { createWalkIn } = useProBookingMutations();
  const [name, setName] = useState(params.get('name') ?? '');
  const [phone, setPhone] = useState(params.get('phone') ?? '');
  const [services, setServices] = useState<string[]>([]);
  const [date, setDate] = useState(params.get('date') ?? toLocalDateKey());
  const [time, setTime] = useState(/^\d{2}:\d{2}$/.test(params.get('time') ?? '') ? params.get('time')! : '10:00');
  const [staffId, setStaffId] = useState<string>(params.get('staff') ?? '');
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const active = salon.services.filter((s) => s.isActive);
  const staff = salon.staff.filter((s) => s.isActive);
  const chosen = services.map((id) => active.find((s) => s.id === id)).filter(Boolean);
  const total = chosen.reduce((a, s) => a + (s?.priceDa ?? 0), 0);
  const minutes = chosen.reduce((a, s) => a + (s?.durationMinutes ?? 0), 0);

  const submit = async () => {
    if (name.trim().length < 2) return setError('Indiquez le nom du client.');
    if (services.length === 0) return setError('Choisissez au moins une prestation.');
    let clientPhone: string | undefined;
    if (phone.trim()) {
      const parsed = phoneDZ.safeParse(phone);
      if (!parsed.success) return setError('Numéro invalide (ex : 05 51 23 45 67).');
      clientPhone = parsed.data;
    }
    setError(null);
    try {
      // Plusieurs prestations : enchaînées à la suite, même membre.
      let start = localDateTimeToISO(date, time);
      let first: { id: string } | null = null;
      for (const s of chosen) {
        const b = await createWalkIn.mutateAsync({ serviceId: s!.id, staffId: staffId || staff[0]!.id, startsAt: start, clientName: name.trim(), clientPhone, source: 'walk_in' });
        first ??= b;
        start = b.endsAt;
      }
      navigate(first ? `/pro/rendez-vous/${first.id}` : '/pro/agenda', { replace: true });
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo="/pro/agenda" right="Nouveau rendez-vous" />
      <h1 className="h1">Ajouter un rendez-vous</h1>
      <Field label="Client" htmlFor="nb-name">
        <Input id="nb-name" lg value={name} onChange={(e) => setName(e.target.value)} placeholder="Mohamed B." autoFocus />
      </Field>
      <Field label="Téléphone (facultatif)" htmlFor="nb-phone">
        <Input id="nb-phone" lg type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05 51 23 45 67" />
      </Field>
      <span className="lbl">Prestations</span>
      <div className="crd !gap-0 !py-1">
        {active.map((s) => {
          const on = services.includes(s.id);
          return (
            <button key={s.id} type="button" className="li w-full !py-3 text-left" onClick={() => setServices((prev) => (on ? prev.filter((x) => x !== s.id) : [...prev, s.id]))} aria-pressed={on}>
              <span>
                <span className="block text-[0.9375rem] font-semibold">{s.name}</span>
                <span className="p block text-[0.9375rem]">
                  {formatDuration(s.durationMinutes)} · {formatDA(s.priceDa)}
                </span>
              </span>
              <span className={`chk${on ? ' on' : ''}`} aria-hidden>
                {on && <I icon={Check} size={16} />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="crd !gap-0 !py-1">
        <label className="li !py-4">
          <span className="text-[0.9375rem]">Date</span>
          <input type="date" className="bg-transparent text-right text-[0.9375rem] outline-none" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        </label>
        <label className="li !py-4">
          <span className="text-[0.9375rem]">Heure</span>
          <input type="time" step={300} className="bg-transparent text-right text-[0.9375rem] outline-none" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Heure" />
        </label>
        {staff.length > 1 && (
          <label className="li !py-4">
            <span className="text-[0.9375rem]">Membre</span>
            <PickerField inline label="Membre" value={staffId || staff[0]!.id} onChange={setStaffId} options={staff.map((m) => ({ value: m.id, label: m.displayName }))} />
          </label>
        )}
      </div>
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <BottomSheet>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[1.25rem] font-bold tracking-[-0.4px]">{formatDA(total)}</div>
            <div className="p">{chosen.length ? `${chosen.length} prestation${chosen.length > 1 ? 's' : ''} · ${formatDuration(minutes)}` : 'Choisissez une prestation'}</div>
          </div>
          <Button auto className="!rounded-full !px-7 !py-3.5" onClick={() => void submit()} disabled={createWalkIn.isPending}>
            Ajouter
          </Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}
