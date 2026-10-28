/**
 * Réservations (refonte du 28 oct. 2026) : deux onglets, « À valider » et « À venir ».
 *
 * - À valider : les demandes, en cartes partagées avec l'accueil (`RequestCard`) — l'heure et le
 *   jour en pavé, puis confirmer / reporter / refuser. Chaque carte a son propre état d'envoi.
 * - À venir : les rendez-vous des 30 prochains jours, groupés par jour, chaque jour en frise
 *   (`TimelineList`) avec son en-tête : le jour, le nombre de rendez-vous et ce qu'il rapporte.
 *   C'est la liste chronologique que l'agenda ne donne qu'un jour à la fois.
 *
 * Les deux panneaux restent MONTÉS (l'inactif masqué) : changer d'onglet ne recharge rien et ne
 * perd pas la position. On ouvre « À valider » quand une demande attend, sinon « À venir ».
 * Un rendez-vous s'ouvre en FENÊTRE (`BookingPeekSheet`), comme sur l'accueil et dans l'agenda.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CalendarCheck2, Inbox, Plus } from 'lucide-react';
import { useProBookings, useProPendingBookings, useProSalon, useSeenOnDisplay } from '@salondz/api-client';
import { addDaysToKey, categoryTone, formatDA, formatLocale, relativeDayLabelDZ, toLocalDateKey } from '@salondz/constants';
import { ErrorMessage } from '@/components/ErrorMessage';
import { RefuseRequestSheet, type RefusedRequest } from '@/components/RefuseRequestSheet';
import { BookingPeekSheet } from '@/components/BookingPeekSheet';
import { RequestCard, TimelineList, TimelineRow, toneVar } from '@/components/ProBookingCards';
import { Button, EmptyState, I, Skeleton, Tabs } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { t } from '@/i18n';

/** Fenêtre de la liste « à venir » : au-delà, l'agenda mois prend le relais. */
const HORIZON_DAYS = 30;
const localKey = (iso: string) => toLocalDateKey(new Date(iso));

type Tab = 'pending' | 'upcoming';

export function Requests() {
  const navigate = useNavigate();
  const pending = useProPendingBookings();
  const salon = useProSalon().data?.salon ?? null;
  const today = toLocalDateKey();
  const next = useProBookings({ from: today, to: addDaysToKey(today, HORIZON_DAYS), limit: 100 });
  const [refusing, setRefusing] = useState<RefusedRequest | null>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const items = pending.data?.items ?? [];
  // Choisi par la personne ; sinon « À valider » tant qu'une demande attend.
  const [chosen, setChosen] = useState<Tab | null>(null);
  const tab: Tab = chosen ?? (items.length ? 'pending' : 'upcoming');

  // À venir = ce qui n'est pas terminé, hors annulés et hors demandes (elles ont leur onglet).
  const now = Date.now();
  const upcoming = (next.data?.items ?? [])
    .filter(
      (b) =>
        (b.status === 'confirmed' || b.status === 'pending') &&
        new Date(b.endsAt).getTime() > now &&
        !items.some((p) => p.id === b.id),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const days: [string, typeof upcoming][] = [];
  for (const b of upcoming) {
    const key = localKey(b.startsAt);
    const last = days[days.length - 1];
    if (last && last[0] === key) last[1].push(b);
    else days.push([key, [b]]);
  }
  const toneOf = (serviceId: string | null) =>
    toneVar(categoryTone(salon?.services.find((s) => s.id === serviceId)?.categoryId));

  // La liste affichée vaut lecture : demandes et rendez-vous à venir sont marqués vus, et les
  // pastilles « Réservations » et « Agenda » baissent sans ouvrir chaque fiche.
  useSeenOnDisplay(
    [...items, ...upcoming].map((b) => b.id),
    !pending.isFetching && !next.isFetching,
  );

  const dateOf = (key: string) =>
    new Intl.DateTimeFormat(formatLocale(), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
      new Date(`${key}T12:00:00Z`),
    );

  return (
    <Screen bottom={NAV_PAD} gap={14}>
      {/* Nouveau rendez-vous : le « + » de l'en-tête, toujours à portée — pas de second bouton ici. */}
      <h1 className="h1">{t('Réservations')}</h1>

      <Tabs
        label={t('Réservations')}
        className="rsv-tabs"
        value={tab}
        onChange={setChosen}
        options={[
          { value: 'pending', label: t('À valider'), count: items.length },
          { value: 'upcoming', label: t('À venir'), count: upcoming.length },
        ]}
      />

      {/* ------------------------------------------------------------ À valider */}
      <div className={`rsv-panel flex flex-col gap-2.5 ${tab === 'pending' ? '' : 'hidden'}`}>
        {pending.isPending && <Skeleton className="h-[8rem] w-full !rounded-[var(--radius-card)]" />}
        {pending.isError && <ErrorMessage error={pending.error} retry={() => pending.refetch()} />}
        {items.map((b) => (
          <RequestCard key={b.id} b={b} today={today} onOpen={setPeek} onRefuse={setRefusing} />
        ))}
        {pending.data && !items.length && (
          <EmptyState
            icon={CalendarCheck2}
            title={t('Tout est traité')}
            description={t('Les nouvelles demandes de vos clients apparaîtront ici.')}
          />
        )}
      </div>

      {/* ------------------------------------------------------------ À venir */}
      <div className={`rsv-panel flex flex-col gap-4 ${tab === 'upcoming' ? '' : 'hidden'}`}>
        {next.isPending && <Skeleton className="h-[10rem] w-full !rounded-[var(--radius-card)]" />}
        {next.isError && <ErrorMessage error={next.error} retry={() => next.refetch()} />}
        {days.map(([key, list]) => {
          const total = list.reduce((a, b) => a + b.priceDa, 0);
          return (
            <section key={key} className="flex flex-col gap-2" aria-label={relativeDayLabelDZ(key, today)}>
              <div className="rsv-day">
                <span className="min-w-0">
                  <span className="rsv-day-t">{relativeDayLabelDZ(key, today)}</span>
                  {/* « Aujourd'hui » et « Demain » ne disent pas la date : on l'ajoute. */}
                  {(key === today || key === addDaysToKey(today, 1)) && (
                    <span className="rsv-day-d">{dateOf(key)}</span>
                  )}
                </span>
                <span className="rsv-day-s">
                  {t('{n} rendez-vous', { n: list.length })} · {formatDA(total)}
                </span>
              </div>
              <TimelineList>
                {list.map((b) => (
                  <TimelineRow key={b.id} b={b} tone={toneOf(b.serviceId)} onOpen={setPeek} />
                ))}
              </TimelineList>
            </section>
          );
        })}
        {next.data && !days.length && (
          <EmptyState
            icon={Inbox}
            title={t('Aucun rendez-vous à venir')}
            description={t('Les rendez-vous des 30 prochains jours apparaîtront ici.')}
            action={
              <Button onClick={() => navigate('/pro/rendez-vous/nouveau')}>
                <I icon={Plus} size={18} /> {t('Nouveau rendez-vous')}
              </Button>
            }
          />
        )}
      </div>

      {peek && <BookingPeekSheet id={peek} onClose={() => setPeek(null)} />}
      {refusing && <RefuseRequestSheet request={refusing} onClose={() => setRefusing(null)} />}
    </Screen>
  );
}
