/**
 * Espace pro — Équipe : liste des membres ; chaque ligne ouvre la fiche du membre (page dédiée), qui mène
 * aux pages Prestations et Horaires. « Ajouter un membre » ouvre la page de création.
 */
import { useNavigate } from 'react-router';
import { CalendarOff, ChevronRight, Plus } from 'lucide-react';
import { useProSalon } from '@salondz/api-client';
import { formatDA } from '@salondz/constants';
import type { Service, Staff } from '@salondz/types';
import { Avatar, Button, Checkbox, I, Segmented, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';

/** Choix des prestations d'un membre : toutes, ou cases à cocher. */
export function ServicesPicker({
  services,
  all,
  selected,
  onAll,
  onToggle,
}: {
  services: Service[];
  all: boolean;
  selected: string[];
  onAll: (v: boolean) => void;
  onToggle: (id: string) => void;
}) {
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
        <p className="p text-[0.9375rem]">
          Ce membre réalise toutes les prestations du catalogue, y compris celles ajoutées plus
          tard.
        </p>
      ) : services.length === 0 ? (
        <p className="p text-[0.9375rem]">Aucune prestation au catalogue pour l'instant.</p>
      ) : (
        <div className="crd !gap-0 !py-1">
          {services.map((sv) => (
            <label key={sv.id} className="li cursor-pointer !py-3">
              <span className="min-w-0">
                <span className={`block text-[0.9375rem] ${sv.isActive ? '' : 'text-subtle'}`}>
                  {sv.name}
                </span>
                <span className="s block">
                  {sv.durationMinutes} min · {formatDA(sv.priceDa)}
                  {sv.groupName ? ` · ${sv.groupName}` : ''}
                </span>
              </span>
              <Checkbox
                on={selected.includes(sv.id)}
                onChange={() => onToggle(sv.id)}
                label={sv.name}
              />
            </label>
          ))}
        </div>
      )}
      {!all && selected.length === 0 && services.length > 0 && (
        <p className="text-[0.8125rem] text-danger">
          Choisissez au moins une prestation, sinon le membre ne sera jamais proposé.
        </p>
      )}
    </div>
  );
}

export function Team() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  if (!salon) return <Splash />;

  const summary = (m: Staff) => {
    const state = m.isActive ? 'Actif' : 'Inactif';
    if (m.allServices) return `${state} · toutes les prestations`;
    return `${state} · ${m.serviceIds.length} prestation${m.serviceIds.length > 1 ? 's' : ''}`;
  };

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo="/pro/profil" right="Profil" />
      <h1 className="h1">Équipe</h1>
      <p className="p">
        Chaque membre a son agenda, ses prestations et ses horaires. Les clients choisissent «
        n'importe qui » ou un membre précis.
      </p>
      <ul className="crd !gap-0 !py-1">
        {salon.staff.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className="li w-full !py-4 text-left"
              onClick={() => navigate(`/pro/equipe/${m.id}`)}
            >
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
      <button
        type="button"
        className="crd !flex-row !items-center !gap-3.5 !py-3.5 text-left"
        onClick={() => navigate('/pro/blocages')}
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-fill">
          <I icon={CalendarOff} size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[1rem] font-semibold">Absences et fermetures</span>
          <span className="block text-[0.875rem] text-muted">
            Congés, pauses d'un membre, exceptions
          </span>
        </span>
        <I icon={ChevronRight} size={18} className="text-disabled" />
      </button>
      <Button onClick={() => navigate('/pro/equipe/nouveau')}>
        <I icon={Plus} size={18} /> Ajouter un membre
      </Button>
    </Screen>
  );
}
