/**
 * Espace pro — Membre de l'équipe : trois pages dédiées (une par sujet), pas de feuille à onglets.
 *   /pro/equipe/:id               fiche : activation, résumé des prestations et des horaires, retrait
 *   /pro/equipe/:id/prestations   prestations réalisées (toutes ou une sélection)
 *   /pro/equipe/:id/horaires      horaires du salon ou personnalisés (pauses par jour)
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Camera, ChevronRight, Clock, Scissors } from 'lucide-react';
import { useProSalon, useProStaffMutations, useStaffHours } from '@salondz/api-client';
import {
  DAY_LABELS_SHORT_FR,
  formatDayRanges,
  rangesFromRows,
  rowError,
  rowsFromRanges,
  type DayHoursRow,
} from '@salondz/constants';
import type { OpeningHour, SalonOwnerView, Staff } from '@salondz/types';
import { errorText } from '@/components/ErrorMessage';
import {
  Avatar,
  BottomSheet,
  Button,
  I,
  Segmented,
  Skeleton,
  Toggle,
  TopBar,
} from '@/components/ui';
import { Screen, NAV_PAD, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { ServicesPicker } from './Team';
import { WeekHoursEditor } from './onboarding/Step9Hours';
import { ImageCropper } from '@/components/ImageCropper';
import { uploadSalonPhoto } from '@/lib/upload';

const salonRanges = (hours: OpeningHour[]) =>
  hours
    .filter((h) => !h.isClosed)
    .map((h) => ({ dayOfWeek: h.dayOfWeek, start: h.opensAt, end: h.closesAt }));

function useMember(): { salon: SalonOwnerView | null; member: Staff | null; id: string } {
  const { id = '' } = useParams();
  const salon = useProSalon().data?.salon ?? null;
  const member = salon?.staff.find((m) => m.id === id) ?? null;
  return { salon, member, id };
}

export function TeamMember() {
  const navigate = useNavigate();
  const { salon, member } = useMember();
  const hours = useStaffHours(member?.id ?? '', !!member);
  const { update, remove } = useProStaffMutations();
  const avatarInput = useRef<HTMLInputElement | null>(null);
  const [cropAvatar, setCropAvatar] = useState<File | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  if (!member)
    return (
      <Screen bottom={NAV_PAD} gap={16}>
        <TopBar backTo="/pro/equipe" />
        <p className="p">Membre introuvable.</p>
      </Screen>
    );
  const isOwner = member.userId === salon.ownerId;
  const servicesSummary = member.allServices
    ? 'Toutes les prestations'
    : `${member.serviceIds.length} prestation${member.serviceIds.length > 1 ? 's' : ''} sur ${salon.services.length}`;
  const hoursSummary = hours.isPending
    ? '…'
    : hours.data && hours.data.length > 0
      ? `Personnalisés · ${[...new Set(hours.data.map((h) => h.dayOfWeek))].length} jour${new Set(hours.data.map((h) => h.dayOfWeek)).size > 1 ? 's' : ''}`
      : 'Horaires du salon';

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo="/pro/equipe" right="Équipe" />
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          className="relative flex-none"
          onClick={() => avatarInput.current?.click()}
          aria-label="Changer la photo du membre"
          disabled={avatarBusy}
        >
          <Avatar src={member.avatarUrl} name={member.displayName} size={64} />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-ink text-white">
            <I icon={Camera} size={12} />
          </span>
        </button>
        <input
          ref={avatarInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setCropAvatar(f);
            e.target.value = '';
          }}
        />
        <span className="min-w-0 flex-1">
          <h1 className="h1 truncate !text-[1.375rem]">{member.displayName}</h1>
          <span className="p block">
            {avatarBusy
              ? 'Envoi de la photo…'
              : isOwner
                ? 'Propriétaire'
                : member.isActive
                  ? 'Membre actif'
                  : 'Inactif — masqué à la réservation'}
          </span>
          {member.avatarUrl && !avatarBusy && (
            <button
              type="button"
              className="text-[0.75rem] font-semibold text-danger"
              onClick={() =>
                update.mutate(
                  { id: member.id, avatarUrl: null },
                  { onError: (e) => setError(errorText(e)) },
                )
              }
            >
              Retirer la photo
            </button>
          )}
        </span>
        {!isOwner && (
          <Toggle
            on={member.isActive}
            onChange={(v) =>
              update.mutate(
                { id: member.id, isActive: v },
                { onError: (e) => setError(errorText(e)) },
              )
            }
            label="Actif"
          />
        )}
      </div>

      <div className="crd !gap-0 !py-1">
        <button
          type="button"
          className="li w-full !py-4 text-left"
          onClick={() => navigate(`/pro/equipe/${member.id}/prestations`)}
        >
          <span className="flex items-center gap-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fill">
              <I icon={Scissors} size={18} />
            </span>
            <span>
              <span className="block text-[1rem] font-semibold">Prestations</span>
              <span className="p block">{servicesSummary}</span>
            </span>
          </span>
          <I icon={ChevronRight} size={18} className="text-disabled" />
        </button>
        <button
          type="button"
          className="li w-full !py-4 text-left"
          onClick={() => navigate(`/pro/equipe/${member.id}/horaires`)}
        >
          <span className="flex items-center gap-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fill">
              <I icon={Clock} size={18} />
            </span>
            <span>
              <span className="block text-[1rem] font-semibold">Horaires</span>
              <span className="p block">{hoursSummary}</span>
            </span>
          </span>
          <I icon={ChevronRight} size={18} className="text-disabled" />
        </button>
      </div>

      {hours.data && hours.data.length > 0 && (
        <div className="crd !gap-1">
          <span className="h3">Semaine du membre</span>
          {[0, 1, 2, 3, 4, 5, 6].map((d) => {
            const ranges = hours.data
              .filter((h) => h.dayOfWeek === d)
              .map((h) => ({ start: h.startsAt, end: h.endsAt }));
            return (
              <span key={d} className="flex justify-between text-[0.875rem]">
                <span className={ranges.length ? '' : 'text-subtle'}>
                  {DAY_LABELS_SHORT_FR[d as 0]}
                </span>
                <span className="text-muted">{formatDayRanges(ranges, 'Repos')}</span>
              </span>
            );
          })}
        </div>
      )}

      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
      {!isOwner &&
        (confirmRemove ? (
          <Button
            className="!bg-danger !text-white"
            disabled={remove.isPending}
            onClick={async () => {
              try {
                await remove.mutateAsync(member.id);
                navigate('/pro/equipe', { replace: true });
              } catch (err) {
                setError(errorText(err));
              }
            }}
          >
            Confirmer le retrait
          </Button>
        ) : (
          <button
            type="button"
            className="py-2 text-[0.875rem] text-danger"
            onClick={() => setConfirmRemove(true)}
          >
            Retirer de l'équipe
          </button>
        ))}
      {cropAvatar && (
        <ImageCropper
          file={cropAvatar}
          aspect={1}
          round
          title="Recadrer la photo"
          onCancel={() => setCropAvatar(null)}
          onDone={async (f) => {
            setCropAvatar(null);
            setAvatarBusy(true);
            try {
              const url = await uploadSalonPhoto(salon.id, f);
              await update.mutateAsync({ id: member.id, avatarUrl: url });
            } catch (e) {
              setError(errorText(e));
            } finally {
              setAvatarBusy(false);
            }
          }}
        />
      )}
    </Screen>
  );
}

export function TeamMemberServices() {
  const navigate = useNavigate();
  const { salon, member } = useMember();
  const { update } = useProStaffMutations();
  const [all, setAll] = useState(member?.allServices ?? true);
  const [selected, setSelected] = useState<string[]>(member?.serviceIds ?? []);
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  if (!member)
    return (
      <Screen bottom={NAV_PAD}>
        <TopBar backTo="/pro/equipe" />
        <p className="p">Membre introuvable.</p>
      </Screen>
    );
  const invalid = !all && selected.length === 0 && salon.services.length > 0;
  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        id: member.id,
        allServices: all,
        serviceIds: all ? [] : selected,
      });
      navigate(`/pro/equipe/${member.id}`, { replace: true });
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo={`/pro/equipe/${member.id}`} right={member.displayName} />
      <h1 className="h1">Prestations</h1>
      <p className="p">
        Le membre n'est proposé aux clients que pour les prestations qu'il réalise.
      </p>
      <ServicesPicker
        services={salon.services}
        all={all}
        selected={selected}
        onAll={setAll}
        onToggle={(id) =>
          setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
        }
      />
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <BottomSheet grab={false}>
        <Button onClick={() => void save()} disabled={update.isPending || invalid}>
          {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </BottomSheet>
    </Screen>
  );
}

export function TeamMemberHours() {
  const navigate = useNavigate();
  const { salon, member } = useMember();
  const hours = useStaffHours(member?.id ?? '', !!member);
  const { setHours } = useProStaffMutations();
  const [custom, setCustom] = useState(false);
  const [rows, setRows] = useState<DayHoursRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const seeded = useRef(false);
  useEffect(() => {
    if (!salon || !hours.data || seeded.current) return;
    seeded.current = true;
    const base = rowsFromRanges([], salonRanges(salon.openingHours)).map((r) => ({
      ...r,
      open: salon.openingHours.some((h) => h.dayOfWeek === r.dayOfWeek && !h.isClosed),
    }));
    if (hours.data.length === 0) {
      setCustom(false);
      setRows(base);
    } else {
      setCustom(true);
      setRows(
        rowsFromRanges(
          hours.data.map((h) => ({ dayOfWeek: h.dayOfWeek, start: h.startsAt, end: h.endsAt })),
          salonRanges(salon.openingHours),
        ),
      );
    }
  }, [salon, hours.data]);
  if (!salon) return <Splash />;
  if (!member)
    return (
      <Screen bottom={NAV_PAD}>
        <TopBar backTo="/pro/equipe" />
        <p className="p">Membre introuvable.</p>
      </Screen>
    );
  const invalid = custom && rows.some((r) => rowError(r) !== null);
  const save = async () => {
    setError(null);
    try {
      await setHours.mutateAsync({
        id: member.id,
        hours: custom
          ? rangesFromRows(rows).map((r) => ({
              dayOfWeek: r.dayOfWeek,
              startsAt: r.start,
              endsAt: r.end,
            }))
          : [],
      });
      navigate(`/pro/equipe/${member.id}`, { replace: true });
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo={`/pro/equipe/${member.id}`} right={member.displayName} />
      <h1 className="h1">Horaires</h1>
      <Segmented
        label="Horaires"
        value={custom ? 'custom' : 'salon'}
        onChange={(v) => setCustom(v === 'custom')}
        options={[
          { value: 'salon', label: 'Horaires du salon' },
          { value: 'custom', label: 'Horaires personnalisés' },
        ]}
      />
      {hours.isPending || rows.length === 0 ? (
        <Skeleton className="h-[7.5rem]" />
      ) : custom ? (
        <WeekHoursEditor rows={rows} onChange={setRows} closedLabel="Repos" />
      ) : (
        <p className="p">Ce membre est réservable sur tous les horaires d'ouverture du salon.</p>
      )}
      {!custom && salon.openingHours.some((h) => !h.isClosed) && (
        <div className="crd !gap-1">
          <span className="h3">Horaires du salon</span>
          {[0, 1, 2, 3, 4, 5, 6].map((d) => {
            const ranges = salon.openingHours
              .filter((h) => h.dayOfWeek === d && !h.isClosed)
              .map((h) => ({ start: h.opensAt, end: h.closesAt }));
            return (
              <span key={d} className="flex justify-between text-[0.875rem]">
                <span className={ranges.length ? '' : 'text-subtle'}>
                  {DAY_LABELS_SHORT_FR[d as 0]}
                </span>
                <span className="text-muted">{formatDayRanges(ranges)}</span>
              </span>
            );
          })}
        </div>
      )}
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <BottomSheet grab={false}>
        <Button
          onClick={() => void save()}
          disabled={setHours.isPending || invalid || hours.isPending}
        >
          {setHours.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </BottomSheet>
    </Screen>
  );
}
