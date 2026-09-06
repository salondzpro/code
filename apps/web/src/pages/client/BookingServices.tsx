/**
 * C-F 08 / C-H 10 — Prestations cumulées : formule(s) et prestations à la carte cochables,
 * feuille de synthèse (durées, total, « Choisir un créneau »).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useSalon } from '@salondz/api-client';
import { formatDA } from '@salondz/constants';
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
  const [selected, setSelected] = useState<string[]>(() => {
    const fromUrl = (params.get('services') ?? '').split(',').filter(Boolean);
    return fromUrl.length ? fromUrl : readDraft(slug).serviceIds;
  });

  useEffect(() => {
    writeDraft(slug, { serviceIds: selected });
  }, [slug, selected]);

  const s = salon.data;
  const chosen = useMemo(() => (s ? selected.map((id) => s.services.find((x) => x.id === id)).filter((x): x is Service => !!x) : []), [s, selected]);
  const total = chosen.reduce((a, x) => a + x.priceDa, 0);
  const minutes = chosen.reduce((a, x) => a + x.durationMinutes, 0);

  if (salon.isPending) return <Splash />;
  if (salon.isError || !s) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;

  const formulas = s.services.filter(isFormula);
  const carte = s.services.filter((sv) => !isFormula(sv));
  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const Row = ({ sv, boxed }: { sv: Service; boxed?: boolean }) => {
    const on = selected.includes(sv.id);
    const photo = sv.photos?.[0]?.url ?? s.coverUrl;
    return (
      <button type="button" onClick={() => toggle(sv.id)} className={`flex w-full items-center gap-4 text-left ${boxed ? 'crd !flex-row' : 'li !py-4'}`} aria-pressed={on}>
        <Img src={photo} className="h-[88px] w-[88px] flex-none !rounded-[16px]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[21px] font-bold tracking-[-0.3px]">{sv.name}</span>
          <span className="block text-[16px] text-muted">
            {[formatDuration(sv.durationMinutes), boxed ? sv.description : null, formatDA(sv.priceDa)].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className={`chk${on ? ' on' : ''}`} aria-hidden>
          {on && <I icon={Check} size={16} />}
        </span>
      </button>
    );
  };

  return (
    <Screen bottom={SHEET_PAD} gap={14}>
      <TopBar backTo={`/s/${s.slug}`} right={<span className="pill soft !text-[15px] !font-semibold">{s.name} · {s.genderTarget === 'men' ? 'Homme' : 'Femme'}</span>} />
      <h1 className="h1">Prestations</h1>
      {formulas.length > 0 && (
        <>
          <SectionLabel>Formule</SectionLabel>
          {formulas.map((sv) => (
            <Row key={sv.id} sv={sv} boxed />
          ))}
        </>
      )}
      <SectionLabel>À la carte</SectionLabel>
      <div className="crd !gap-0 !py-1">
        {carte.map((sv) => (
          <Row key={sv.id} sv={sv} />
        ))}
        {carte.length === 0 && <p className="p py-3">Aucune prestation pour le moment.</p>}
      </div>

      <BottomSheet>
        {chosen.length > 0 ? (
          <>
            <p className="p">{chosen.map((x) => `${x.name} ${shortDuration(x.durationMinutes)}`).join(' + ')}</p>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[28px] font-bold tracking-[-0.6px]">{formatDA(total)}</div>
                <div className="p">
                  {chosen.length} prestation{chosen.length > 1 ? 's' : ''} · {formatDuration(minutes)} au total
                </div>
              </div>
              <Button auto className="!rounded-full !px-6 !py-4" onClick={() => navigate(`/s/${s.slug}/reserver/quand`)}>
                Choisir un créneau
              </Button>
            </div>
          </>
        ) : (
          <p className="p py-2 text-center">Cochez une ou plusieurs prestations.</p>
        )}
      </BottomSheet>
    </Screen>
  );
}
