import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useSalonSearch } from '@salondz/api-client';
import { CATEGORIES, GENDER_TARGETS, GENDER_TARGET_LABELS_FR, WILAYAS, type CategoryId, type GenderTarget } from '@salondz/constants';
import { SalonCard } from '@/components/SalonCard';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((c) => c.id));

export function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const wilayaRaw = Number(params.get('wilaya'));
  const wilaya = wilayaRaw >= 1 && wilayaRaw <= 58 ? wilayaRaw : undefined;
  const categoryRaw = params.get('category') ?? '';
  const category = CATEGORY_IDS.has(categoryRaw) ? (categoryRaw as CategoryId) : undefined;
  const genderRaw = params.get('gender') ?? '';
  const gender = (GENDER_TARGETS as readonly string[]).includes(genderRaw) ? (genderRaw as GenderTarget) : undefined;

  const latRaw = Number(params.get('lat'));
  const lngRaw = Number(params.get('lng'));
  const near = params.has('lat') && params.has('lng') && Number.isFinite(latRaw) && Number.isFinite(lngRaw) ? { lat: latRaw, lng: lngRaw } : undefined;
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const query = useSalonSearch({ q: q || undefined, wilaya, category, gender, lat: near?.lat, lng: near?.lng });

  /** « Autour de moi » : position du navigateur → tri par distance côté API (distanceKm sur les cartes). */
  const locate = () => {
    if (!('geolocation' in navigator)) return setGeoError("La géolocalisation n'est pas disponible sur cet appareil.");
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = new URLSearchParams(params);
        next.set('lat', pos.coords.latitude.toFixed(4));
        next.set('lng', pos.coords.longitude.toFixed(4));
        setParams(next, { replace: true });
        setLocating(false);
      },
      () => {
        setGeoError("Position indisponible. Autorisez la localisation puis réessayez.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };
  const clearNear = () => {
    const next = new URLSearchParams(params);
    next.delete('lat');
    next.delete('lng');
    setParams(next, { replace: true });
  };

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Salons</h1>
      <form className="grid gap-2 md:grid-cols-4" onSubmit={(e) => e.preventDefault()}>
        <input className="input" placeholder="Nom, service…" defaultValue={q} onBlur={(e) => set('q', e.target.value.trim())} onKeyDown={(e) => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value.trim())} aria-label="Recherche" />
        <select className="input" value={wilaya ?? ''} onChange={(e) => set('wilaya', e.target.value)} aria-label="Wilaya">
          <option value="">Toutes les wilayas</option>
          {WILAYAS.map((w) => (
            <option key={w.code} value={w.code}>
              {w.code} – {w.name}
            </option>
          ))}
        </select>
        <select className="input" value={category ?? ''} onChange={(e) => set('category', e.target.value)} aria-label="Catégorie">
          <option value="">Toutes les catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.labelFr}
            </option>
          ))}
        </select>
        <select className="input" value={gender ?? ''} onChange={(e) => set('gender', e.target.value)} aria-label="Public">
          <option value="">Hommes & femmes</option>
          {GENDER_TARGETS.map((g) => (
            <option key={g} value={g}>
              {GENDER_TARGET_LABELS_FR[g]}
            </option>
          ))}
        </select>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        {near ? (
          <button type="button" className="chip-active" onClick={clearNear} aria-label="Désactiver le tri par distance">
            Autour de moi ✕
          </button>
        ) : (
          <button type="button" className="chip" disabled={locating} onClick={locate}>
            {locating ? 'Localisation…' : '📍 Autour de moi'}
          </button>
        )}
        {geoError && <span className="text-sm text-danger">{geoError}</span>}
      </div>

      {query.isPending && <Spinner label="Recherche…" />}
      {query.isError && <ErrorMessage error={query.error} retry={() => query.refetch()} />}
      {query.data && query.data.items.length === 0 && (
        <EmptyState title="Aucun salon trouvé" description="Essayez une autre wilaya ou une autre catégorie." />
      )}
      {query.data && query.data.items.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {query.data.items.map((s) => (
            <li key={s.id}>
              <SalonCard salon={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
