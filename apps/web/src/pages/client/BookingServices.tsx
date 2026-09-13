/**
 * C-F 08 / C-H 10 — Prestations cumulées : formule(s) et prestations à la carte cochables,
 * feuille de synthèse (durées, total, « Choisir un créneau »).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useSalon } from '@salondz/api-client';
import { formatDA, groupServices, localDateTimeToISO } from '@salondz/constants';
import { readDraft, shortDuration, writeDraft } from '@/lib/bookingDraft';
import { formatDuration } from '@/lib/format';
import { Check } from 'lucide-react';
import { BottomSheet, Button, I, Img, SectionLabel, TopBar } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';
import type { Service } from '@salondz/types';

const isFormula = (sv: Service) => /^formule\b/i.test(sv.name);

export function BookingServices() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const salon = useSalon(slug);
  /**
   * UNE prestation par rendez-vous, comme sur la fiche du salon : « Choisir » écrase le
   * brouillon avec un seul identifiant et passe à l'horaire. Deux prestations = deux
   * rendez-vous.
   */
  const chooseService = (id: string) => {
    writeDraft(slug, { serviceIds: [id] });
    navigate(`/s/${slug}/reserver/quand`);
  };

  // Créneau proposé sur la carte marketplace (?date=YYYY-MM-DD&time=HH:mm) : pré-rempli dans le brouillon,
  // l'écran « Quand » s'ouvre directement dessus (et le libère s'il n'est plus disponible).
  useEffect(() => {
    const date = params.get('date');
    const time = params.get('time');
    if (date && time && /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)) {
      writeDraft(slug, { date, startsAt: localDateTimeToISO(date, time) });
    }
  }, [slug, params]);

  const s = salon.data;

  if (salon.isPending) return <Splash />;
  if (salon.isError || !s) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;

  const groups = groupServices(s.services);

  const Row = ({ sv, boxed }: { sv: Service; boxed?: boolean }) => (
    <div className={`flex w-full items-start gap-3 ${boxed ? 'crd !flex-row' : 'li !items-start'}`}>
      <div className="min-w-0 flex-1">
        <span className="block text-[1.143rem] font-bold tracking-[-0.3px]">{sv.name}</span>
        {sv.description && (
          <span className="mt-0.5 block text-[1rem] text-muted">{sv.description}</span>
        )}
        <span className="mt-1 block text-[1rem] font-semibold">
          {formatDA(sv.priceDa)}
          <span className="font-normal text-muted"> · {formatDuration(sv.durationMinutes)}</span>
        </span>
      </div>
      <Button sm auto className="mt-0.5 flex-none !rounded-full !px-5" onClick={() => chooseService(sv.id)}>
        Choisir
      </Button>
    </div>
  );

  return (
    <Screen gap={12}>
      <TopBar backTo={`/s/${s.slug}`} right={<span className="pill soft !text-[1rem] !font-semibold">{s.name} · {s.genderTarget === 'men' ? 'Homme' : 'Femme'}</span>} />
      <h1 className="h1">Prestations</h1>
      <p className="p !text-[1rem]">
        Une prestation par rendez-vous. Pour en cumuler plusieurs, prenez un rendez-vous par
        prestation.
      </p>
      {groups.map((g) =>
        g.name === 'Formule' ? (
          <div key={g.name} className="flex flex-col gap-3">
            <SectionLabel>Formule</SectionLabel>
            {g.services.map((sv) => (
              <Row key={sv.id} sv={sv} boxed />
            ))}
          </div>
        ) : (
          <div key={g.name} className="flex flex-col gap-3">
            <SectionLabel>{g.name}</SectionLabel>
            <div className="crd !gap-0 !py-1">
              {g.services.map((sv) => (
                <Row key={sv.id} sv={sv} />
              ))}
            </div>
          </div>
        ),
      )}
      {groups.length === 0 && <p className="p py-3">Aucune prestation pour le moment.</p>}

    </Screen>
  );
}
