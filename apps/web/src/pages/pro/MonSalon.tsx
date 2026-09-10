/**
 * Profil → Mon salon : tout ce qui fait la présence du salon sur Salon DZ — informations (nom, description),
 * photos de couverture, réalisations, adresse et localisation, horaires d'ouverture, lien et QR code.
 */
import { useState } from 'react';
import {
  Clock,
  FileText,
  Images,
  MapPin,
  Pencil,
  QrCode,
  Save,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { wilayaName } from '@salondz/constants';
import { errorText } from '@/components/ErrorMessage';
import { Button, I, ListRow, SectionLabel, Textarea, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';

export function RowText({ icon, title, sub }: { icon: LucideIcon; title: string; sub?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-3.5">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-fill">
        <I icon={icon} size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[1rem] font-semibold">{title}</span>
        {sub && <span className="block truncate text-[0.875rem] text-muted">{sub}</span>}
      </span>
    </span>
  );
}

export function MonSalon() {
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [desc, setDesc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const place = [salon.address, salon.zone ?? salon.city, wilayaName(salon.wilayaCode)]
    .filter(Boolean)
    .join(', ');
  const openDays = new Set(salon.openingHours.filter((h) => !h.isClosed).map((h) => h.dayOfWeek))
    .size;

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo="/pro/profil" right="Profil" />
      <h1 className="h1">Mon salon</h1>

      <SectionLabel>Informations</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <div className="li !py-4">
          <RowText
            icon={FileText}
            title={salon.name}
            sub={
              desc === null
                ? salon.description || 'Ajoutez une description : elle améliore votre visibilité'
                : undefined
            }
          />
          {desc === null && (
            <button
              type="button"
              className="ib flex-none"
              aria-label="Modifier la description"
              onClick={() => setDesc(salon.description ?? '')}
            >
              <I icon={Pencil} size={16} />
            </button>
          )}
        </div>
        {desc !== null && (
          <div className="flex flex-col gap-2 pb-3">
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={1500}
              placeholder="Salon calme, produits sans parabène…"
              aria-label="Description du salon"
            />
            <div className="g2">
              <Button variant="g" sm onClick={() => setDesc(null)}>
                Annuler
              </Button>
              <Button
                sm
                disabled={updateSalon.isPending}
                onClick={async () => {
                  try {
                    await updateSalon.mutateAsync({ description: desc.trim() || undefined });
                    setDesc(null);
                  } catch (e) {
                    setError(errorText(e));
                  }
                }}
              >
                <I icon={Save} size={16} /> Enregistrer
              </Button>
            </div>
          </div>
        )}
      </div>

      <SectionLabel>Présence en ligne</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <ListRow to="/pro/photos">
          <RowText
            icon={Images}
            title="Photos du salon"
            sub={`${salon.logoUrl ? 'Logo' : 'Sans logo'} · ${salon.photos.length} photo${salon.photos.length > 1 ? 's' : ''} de couverture`}
          />
        </ListRow>
        <ListRow to="/pro/realisations">
          <RowText
            icon={Sparkles}
            title="Réalisations"
            sub={
              salon.works.length
                ? `${salon.works.length} photo${salon.works.length > 1 ? 's' : ''} de votre travail`
                : 'Montrez vos coupes, coiffures, barbes, colorations…'
            }
          />
        </ListRow>
        <ListRow to="/pro/lien">
          <RowText icon={QrCode} title="Lien et QR code" sub="Affiche à imprimer, partage" />
        </ListRow>
      </div>

      <SectionLabel>Adresse et horaires</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <ListRow to="/pro/salon">
          <RowText icon={MapPin} title="Adresse et localisation" sub={place} />
        </ListRow>
        <ListRow to="/pro/profil/horaires">
          <RowText
            icon={Clock}
            title="Horaires d'ouverture"
            sub={`Ouvert ${openDays} jour${openDays > 1 ? 's' : ''} sur 7`}
          />
        </ListRow>
      </div>
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
    </Screen>
  );
}
