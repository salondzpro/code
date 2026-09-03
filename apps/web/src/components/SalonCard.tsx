import { Link } from 'react-router';
import type { SalonSummary } from '@salondz/types';
import { categoryLabel, formatFromPrice, GENDER_TARGET_LABELS_FR, wilayaName } from '@salondz/constants';

export function SalonCard({ salon }: { salon: SalonSummary }) {
  return (
    <Link to={`/s/${salon.slug}`} className="card flex gap-3 overflow-hidden p-3 transition hover:shadow-md">
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-line">
        {salon.coverUrl && <img src={salon.coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold">{salon.name}</h3>
        <p className="truncate text-sm text-muted">
          {salon.city}, {wilayaName(salon.wilayaCode)} · {GENDER_TARGET_LABELS_FR[salon.genderTarget]}
        </p>
        <p className="mt-1 text-sm">
          {salon.ratingCount > 0 ? (
            <span aria-label={`Note ${salon.ratingAvg} sur 5`}>★ {salon.ratingAvg.toFixed(1)} ({salon.ratingCount})</span>
          ) : (
            <span className="text-muted">Nouveau</span>
          )}
          {salon.minPriceDa != null && <span className="text-muted"> · {formatFromPrice(salon.minPriceDa)}</span>}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {salon.categoryIds.slice(0, 3).map((c) => (
            <span key={c} className="chip text-xs">
              {categoryLabel(c)}
            </span>
          ))}
          {salon.distanceKm != null && <span className="chip text-xs">{salon.distanceKm.toFixed(1)} km</span>}
        </div>
      </div>
    </Link>
  );
}
