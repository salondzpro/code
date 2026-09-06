/**
 * Espace pro — Équipe : membres, activation et horaires propres (feuille au design).
 * Liste vide côté API = « suit les horaires du salon » ; créneaux = salon ∩ membre (calcul SQL).
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useProSalon, useProStaffMutations, useStaffHours } from '@salondz/api-client';
import { DAY_LABELS_FR, WEEK_DAYS, type DayOfWeek } from '@salondz/constants';
import type { OpeningHour, Staff } from '@salondz/types';
import { errorText } from '@/components/ErrorMessage';
import { Avatar, BottomSheet, Button, I, Input, Segmented, Skeleton, Toggle } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';

interface Row {
  dayOfWeek: DayOfWeek;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
}

/** Lignes par défaut = horaires d'ouverture du salon. */
function rowsFromSalon(salonHours: OpeningHour[]): Row[] {
  return WEEK_DAYS.map((d) => {
    const h = salonHours.find((x) => x.dayOfWeek === d && !x.isClosed);
    return { dayOfWeek: d, enabled: !!h, startsAt: h?.opensAt ?? '09:00', endsAt: h?.closesAt ?? '19:00' };
  });
}

function MemberSheet({ member, salon, onClose }: { member: Staff; salon: { ownerId: string; openingHours: OpeningHour[] }; onClose: () => void }) {
  const hours = useStaffHours(member.id);
  const { update, remove, setHours } = useProStaffMutations();
  const [custom, setCustom] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => rowsFromSalon(salon.openingHours));
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isOwner = member.userId === salon.ownerId;
  const seeded = useRef(false);

  // Amorce unique depuis l'API : ne pas écraser les choix faits pendant le chargement.
  useEffect(() => {
    if (!hours.data || seeded.current) return;
    seeded.current = true;
    if (hours.data.length === 0) {
      setCustom(false);
      setRows(rowsFromSalon(salon.openingHours));
      return;
    }
    setCustom(true);
    const base = rowsFromSalon(salon.openingHours);
    setRows(
      WEEK_DAYS.map((d) => {
        const h = hours.data.find((x) => x.dayOfWeek === d);
        const def = base.find((r) => r.dayOfWeek === d)!;
        return h ? { dayOfWeek: d, enabled: true, startsAt: h.startsAt, endsAt: h.endsAt } : { ...def, enabled: false };
      }),
    );
  }, [hours.data, salon.openingHours]);

  const patch = (d: DayOfWeek, p: Partial<Row>) => setRows((prev) => prev.map((r) => (r.dayOfWeek === d ? { ...r, ...p } : r)));
  const invalid = custom && rows.some((r) => r.enabled && r.startsAt >= r.endsAt);

  const save = async () => {
    setError(null);
    try {
      await setHours.mutateAsync({
        id: member.id,
        hours: custom ? rows.filter((r) => r.enabled).map(({ dayOfWeek, startsAt, endsAt }) => ({ dayOfWeek, startsAt, endsAt })) : [],
      });
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <>
      <div className="dim" onClick={onClose} />
      <BottomSheet className="max-h-[88vh] !z-50 overflow-y-auto">
        <div role="dialog" aria-label={`Membre ${member.displayName}`} className="flex flex-col gap-3.5">
          <div className="flex items-center gap-3.5">
            <Avatar src={member.avatarUrl} name={member.displayName} size={56} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[22px] font-bold tracking-[-0.4px]">{member.displayName}</span>
              <span className="p block text-[15px]">{isOwner ? 'Propriétaire' : member.isActive ? 'Membre actif' : 'Inactif — masqué à la réservation'}</span>
            </span>
            {!isOwner && <Toggle on={member.isActive} onChange={(v) => update.mutate({ id: member.id, isActive: v }, { onError: (e) => setError(errorText(e)) })} label="Actif" />}
          </div>
          <Segmented
            label="Horaires"
            value={custom ? 'custom' : 'salon'}
            onChange={(v) => setCustom(v === 'custom')}
            options={[
              { value: 'salon', label: 'Horaires du salon' },
              { value: 'custom', label: 'Horaires personnalisés' },
            ]}
          />
          {hours.isPending ? (
            <Skeleton className="h-[120px]" />
          ) : custom ? (
            <div className="crd !gap-0 !py-1">
              {rows.map((r) => (
                <div key={r.dayOfWeek} className="li !py-3">
                  <span className={`w-[96px] flex-none text-[17px] ${r.enabled ? '' : 'text-subtle'}`}>{DAY_LABELS_FR[r.dayOfWeek]}</span>
                  <span className="flex flex-1 items-center gap-1 text-[17px] text-muted">
                    {r.enabled ? (
                      <>
                        <input type="time" className="tm" value={r.startsAt} onChange={(e) => patch(r.dayOfWeek, { startsAt: e.target.value })} aria-label={`Début ${DAY_LABELS_FR[r.dayOfWeek]}`} />
                        <span>–</span>
                        <input type="time" className="tm" value={r.endsAt} onChange={(e) => patch(r.dayOfWeek, { endsAt: e.target.value })} aria-label={`Fin ${DAY_LABELS_FR[r.dayOfWeek]}`} />
                      </>
                    ) : (
                      <span className="text-disabled">Repos</span>
                    )}
                  </span>
                  <Toggle on={r.enabled} onChange={(v) => patch(r.dayOfWeek, { enabled: v })} label={DAY_LABELS_FR[r.dayOfWeek]} />
                </div>
              ))}
            </div>
          ) : (
            <p className="p text-[15px]">Ce membre est réservable sur tous les horaires d'ouverture du salon.</p>
          )}
          {invalid && <p className="text-[14px] text-danger">L'heure de début doit précéder la fin.</p>}
          {error && (
            <p className="text-[14px] text-danger" role="alert">
              {error}
            </p>
          )}
          <Button onClick={() => void save()} disabled={setHours.isPending || invalid || hours.isPending}>
            {setHours.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {!isOwner &&
            (confirmRemove ? (
              <Button
                className="!bg-danger !text-white"
                disabled={remove.isPending}
                onClick={async () => {
                  try {
                    await remove.mutateAsync(member.id);
                    onClose();
                  } catch (err) {
                    setError(errorText(err));
                  }
                }}
              >
                Confirmer le retrait
              </Button>
            ) : (
              <button type="button" className="py-2 text-[17px] text-danger" onClick={() => setConfirmRemove(true)}>
                Retirer de l'équipe
              </button>
            ))}
        </div>
      </BottomSheet>
    </>
  );
}

export function Team() {
  const salon = useProSalon().data?.salon ?? null;
  const { create } = useProStaffMutations();
  const [name, setName] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const member = salon.staff.find((m) => m.id === open) ?? null;

  const add = async () => {
    if (name.trim().length < 1) return;
    setError(null);
    try {
      await create.mutateAsync({ displayName: name.trim() });
      setName('');
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <h1 className="h1 !text-[34px]">Équipe</h1>
      <p className="p">Chaque membre a son propre agenda. Les clients choisissent « n'importe qui » ou un membre précis.</p>
      <ul className="crd !gap-0 !py-1">
        {salon.staff.map((m) => (
          <li key={m.id}>
            <button type="button" className="li w-full !py-4 text-left" onClick={() => setOpen(m.id)}>
              <span className="flex min-w-0 items-center gap-3.5">
                <Avatar src={m.avatarUrl} name={m.displayName} size={52} />
                <span className="min-w-0">
                  <span className="block truncate text-[19px]">
                    {m.displayName}
                    {m.userId === salon.ownerId && <span className="text-muted"> (vous)</span>}
                  </span>
                  <span className="p block text-[15px]">{m.isActive ? 'Actif' : 'Inactif'}</span>
                </span>
              </span>
              <I icon={ChevronRight} size={18} className="shrink-0 text-disabled" />
            </button>
          </li>
        ))}
      </ul>
      <div className="crd !gap-3">
        <Input
          lg
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add();
          }}
          placeholder="Prénom du membre"
          aria-label="Nouveau membre"
          maxLength={60}
        />
        <Button onClick={() => void add()} disabled={create.isPending || !name.trim()}>
          Ajouter
        </Button>
      </div>
      {error && (
        <p className="text-[14px] text-danger" role="alert">
          {error}
        </p>
      )}
      {member && <MemberSheet member={member} salon={salon} onClose={() => setOpen(null)} />}
    </Screen>
  );
}
