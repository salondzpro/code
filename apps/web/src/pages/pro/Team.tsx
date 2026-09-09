/**
 * Espace pro — Équipe : membres, activation, prestations affectées et horaires propres (feuille au design).
 * Prestations : « toutes » par défaut, ou une sélection — les créneaux et réservations ne proposent le membre
 * que pour les prestations qu'il réalise (calcul SQL). Horaires : liste vide côté API = « suit le salon » ;
 * sinon plages par jour avec pause facultative ; créneaux = salon ∩ membre.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useProSalon, useProStaffMutations, useStaffHours } from '@salondz/api-client';
import { formatDA, rangesFromRows, rowError, rowsFromRanges, type DayHoursRow } from '@salondz/constants';
import type { OpeningHour, Service, Staff } from '@salondz/types';
import { errorText } from '@/components/ErrorMessage';
import { Avatar, BottomSheet, Button, Checkbox, I, Input, Segmented, Skeleton, Toggle } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { WeekHoursEditor } from './onboarding/Step9Hours';

const salonRanges = (hours: OpeningHour[]) => hours.filter((h) => !h.isClosed).map((h) => ({ dayOfWeek: h.dayOfWeek, start: h.opensAt, end: h.closesAt }));

/** Choix des prestations d'un membre : toutes, ou cases à cocher. */
function ServicesPicker({ services, all, selected, onAll, onToggle }: { services: Service[]; all: boolean; selected: string[]; onAll: (v: boolean) => void; onToggle: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label="Prestations"
        value={all ? 'all' : 'some'}
        onChange={(v) => onAll(v === 'all')}
        options={[
          { value: 'all', label: 'Toutes les prestations' },
          { value: 'some', label: 'Sélection' },
        ]}
      />
      {all ? (
        <p className="p text-[0.9375rem]">Ce membre réalise toutes les prestations du catalogue, y compris celles ajoutées plus tard.</p>
      ) : services.length === 0 ? (
        <p className="p text-[0.9375rem]">Aucune prestation au catalogue pour l'instant.</p>
      ) : (
        <div className="crd !gap-0 !py-1">
          {services.map((sv) => (
            <label key={sv.id} className="li cursor-pointer !py-3">
              <span className="min-w-0">
                <span className={`block text-[0.9375rem] ${sv.isActive ? '' : 'text-subtle'}`}>{sv.name}</span>
                <span className="s block">
                  {sv.durationMinutes} min · {formatDA(sv.priceDa)}
                  {sv.groupName ? ` · ${sv.groupName}` : ''}
                </span>
              </span>
              <Checkbox on={selected.includes(sv.id)} onChange={() => onToggle(sv.id)} label={sv.name} />
            </label>
          ))}
        </div>
      )}
      {!all && selected.length === 0 && services.length > 0 && <p className="text-[0.8125rem] text-danger">Choisissez au moins une prestation, sinon le membre ne sera jamais proposé.</p>}
    </div>
  );
}

function MemberSheet({ member, salon, onClose }: { member: Staff; salon: { ownerId: string; openingHours: OpeningHour[]; services: Service[] }; onClose: () => void }) {
  const hours = useStaffHours(member.id);
  const { update, remove, setHours } = useProStaffMutations();
  const [tab, setTab] = useState<'services' | 'hours'>('services');
  const [all, setAll] = useState(member.allServices);
  const [selected, setSelected] = useState<string[]>(member.serviceIds);
  const [custom, setCustom] = useState(false);
  const [rows, setRows] = useState<DayHoursRow[]>(() => rowsFromRanges([], salonRanges(salon.openingHours)).map((r) => ({ ...r, open: salon.openingHours.some((h) => h.dayOfWeek === r.dayOfWeek && !h.isClosed) })));
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isOwner = member.userId === salon.ownerId;
  const seeded = useRef(false);

  // Amorce unique depuis l'API : ne pas écraser les choix faits pendant le chargement.
  useEffect(() => {
    if (!hours.data || seeded.current) return;
    seeded.current = true;
    if (hours.data.length === 0) return setCustom(false);
    setCustom(true);
    setRows(rowsFromRanges(hours.data.map((h) => ({ dayOfWeek: h.dayOfWeek, start: h.startsAt, end: h.endsAt })), salonRanges(salon.openingHours)));
  }, [hours.data, salon.openingHours]);

  const invalidHours = custom && rows.some((r) => rowError(r) !== null);
  const invalidServices = !all && selected.length === 0 && salon.services.length > 0;

  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({ id: member.id, allServices: all, serviceIds: all ? [] : selected });
      await setHours.mutateAsync({
        id: member.id,
        hours: custom ? rangesFromRows(rows).map((r) => ({ dayOfWeek: r.dayOfWeek, startsAt: r.start, endsAt: r.end })) : [],
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
              <span className="block truncate text-[1.125rem] font-bold tracking-[-0.4px]">{member.displayName}</span>
              <span className="p block text-[0.9375rem]">{isOwner ? 'Propriétaire' : member.isActive ? 'Membre actif' : 'Inactif — masqué à la réservation'}</span>
            </span>
            {!isOwner && <Toggle on={member.isActive} onChange={(v) => update.mutate({ id: member.id, isActive: v }, { onError: (e) => setError(errorText(e)) })} label="Actif" />}
          </div>
          <Segmented
            label="Réglages du membre"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'services', label: `Prestations${all ? '' : ` (${selected.length})`}` },
              { value: 'hours', label: 'Horaires' },
            ]}
          />
          {tab === 'services' ? (
            <ServicesPicker services={salon.services} all={all} selected={selected} onAll={setAll} onToggle={(id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))} />
          ) : (
            <>
              <Segmented
                label="Horaires"
                value={custom ? 'custom' : 'salon'}
                onChange={(v) => setCustom(v === 'custom')}
                options={[
                  { value: 'salon', label: 'Horaires du salon' },
                  { value: 'custom', label: 'Horaires personnalisés' },
                ]}
              />
              {hours.isPending ? <Skeleton className="h-[7.5rem]" /> : custom ? <WeekHoursEditor rows={rows} onChange={setRows} closedLabel="Repos" /> : <p className="p text-[0.9375rem]">Ce membre est réservable sur tous les horaires d'ouverture du salon.</p>}
            </>
          )}
          {error && (
            <p className="text-[0.875rem] text-danger" role="alert">
              {error}
            </p>
          )}
          <Button onClick={() => void save()} disabled={setHours.isPending || update.isPending || invalidHours || invalidServices || hours.isPending}>
            {setHours.isPending || update.isPending ? 'Enregistrement…' : 'Enregistrer'}
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
              <button type="button" className="py-2 text-[0.8125rem] text-danger" onClick={() => setConfirmRemove(true)}>
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
  const [all, setAll] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeServices = useMemo(() => (salon?.services ?? []).filter((s) => s.isActive), [salon?.services]);
  if (!salon) return <Splash />;
  const member = salon.staff.find((m) => m.id === open) ?? null;

  const add = async () => {
    if (name.trim().length < 1) return;
    setError(null);
    try {
      await create.mutateAsync({ displayName: name.trim(), allServices: all, serviceIds: all ? [] : selected });
      setName('');
      setAll(true);
      setSelected([]);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const summary = (m: Staff) => {
    const state = m.isActive ? 'Actif' : 'Inactif';
    if (m.allServices) return `${state} · toutes les prestations`;
    return `${state} · ${m.serviceIds.length} prestation${m.serviceIds.length > 1 ? 's' : ''}`;
  };

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <h1 className="h1">Équipe</h1>
      <p className="p">Chaque membre a son agenda, ses prestations et ses horaires. Les clients choisissent « n'importe qui » ou un membre précis.</p>
      <ul className="crd !gap-0 !py-1">
        {salon.staff.map((m) => (
          <li key={m.id}>
            <button type="button" className="li w-full !py-4 text-left" onClick={() => setOpen(m.id)}>
              <span className="flex min-w-0 items-center gap-3.5">
                <Avatar src={m.avatarUrl} name={m.displayName} size={52} />
                <span className="min-w-0">
                  <span className="block truncate text-[0.9375rem]">
                    {m.displayName}
                    {m.userId === salon.ownerId && <span className="text-muted"> (vous)</span>}
                  </span>
                  <span className="p block text-[0.9375rem]">{summary(m)}</span>
                </span>
              </span>
              <I icon={ChevronRight} size={18} className="shrink-0 text-disabled" />
            </button>
          </li>
        ))}
      </ul>
      <div className="crd !gap-3">
        <span className="h3">Nouveau membre</span>
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
        <ServicesPicker services={activeServices} all={all} selected={selected} onAll={setAll} onToggle={(id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))} />
        <Button onClick={() => void add()} disabled={create.isPending || !name.trim() || (!all && selected.length === 0 && activeServices.length > 0)}>
          Ajouter
        </Button>
      </div>
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
      {member && <MemberSheet member={member} salon={salon} onClose={() => setOpen(null)} />}
    </Screen>
  );
}
