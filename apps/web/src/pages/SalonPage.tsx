import { Link, useParams } from 'react-router';
import { useSalon, useSalonReviews } from '@salondz/api-client';
import { DAY_LABELS_FR, WEEK_DAYS, categoryLabel, formatDA, formatDZPhone, GENDER_TARGET_LABELS_FR, wilayaName } from '@salondz/constants';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { formatDuration } from '@/lib/format';

export function SalonPage() {
  const { slug = '' } = useParams();
  const salon = useSalon(slug);
  const reviews = useSalonReviews(salon.data?.id ?? '');

  if (salon.isPending) return <Spinner label="Chargement du salon…" />;
  if (salon.isError) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;
  const s = salon.data;

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: s.name, url }).catch(() => undefined);
    else await navigator.clipboard.writeText(url);
  };

  return (
    <article className="flex flex-col gap-6">
      <header className="card overflow-hidden">
        <div className="h-48 bg-line">
          {s.coverUrl && <img src={s.coverUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="flex flex-col gap-2 p-5">
          <h1 className="text-2xl font-bold">{s.name}</h1>
          <p className="text-sm text-muted">
            {s.address ? `${s.address}, ` : ''}
            {s.city}, {wilayaName(s.wilayaCode)} · {GENDER_TARGET_LABELS_FR[s.genderTarget]}
          </p>
          <p className="text-sm">{s.ratingCount > 0 ? `★ ${s.ratingAvg.toFixed(1)} · ${s.ratingCount} avis` : 'Nouveau sur SalonDZ'}</p>
          <div className="flex flex-wrap gap-1">
            {s.categoryIds.map((c) => (
              <span key={c} className="chip text-xs">
                {categoryLabel(c)}
              </span>
            ))}
          </div>
          {s.description && <p className="mt-2 text-sm">{s.description}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Link to={`/s/${s.slug}/reserver`} className="btn-primary">
              Réserver
            </Link>
            {s.phone && (
              <a href={`tel:${s.phone}`} className="btn-ghost">
                Appeler · {formatDZPhone(s.phone)}
              </a>
            )}
            <button type="button" className="btn-ghost" onClick={share}>
              Partager
            </button>
          </div>
          {!s.isPublished && <p className="text-xs text-warning">Aperçu : ce salon n'est pas encore publié.</p>}
        </div>
      </header>

      {s.photos.length > 0 && (
        <section className="grid grid-cols-3 gap-2 md:grid-cols-4">
          {s.photos.map((p) => (
            <img key={p.id} src={p.url} alt="" loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xl font-semibold">Services</h2>
        <ul className="card divide-y divide-line">
          {s.services.map((sv) => (
            <li key={sv.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{sv.name}</p>
                <p className="text-sm text-muted">
                  {formatDuration(sv.durationMinutes)}
                  {sv.description ? ` · ${sv.description}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{formatDA(sv.priceDa)}</span>
                <Link to={`/s/${s.slug}/reserver?service=${sv.id}`} className="btn-ghost px-3 py-1 text-sm">
                  Réserver
                </Link>
              </div>
            </li>
          ))}
          {s.services.length === 0 && <li className="p-4 text-sm text-muted">Aucun service pour le moment.</li>}
        </ul>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl font-semibold">Horaires</h2>
          <table className="card w-full text-sm">
            <tbody>
              {WEEK_DAYS.map((d) => {
                const rows = s.openingHours.filter((h) => h.dayOfWeek === d);
                const closed = rows.length === 0 || rows.every((h) => h.isClosed);
                return (
                  <tr key={d} className="border-b border-line last:border-0">
                    <th scope="row" className="px-4 py-2 text-left font-medium">
                      {DAY_LABELS_FR[d]}
                    </th>
                    <td className="px-4 py-2 text-right">{closed ? <span className="text-muted">Fermé</span> : rows.filter((h) => !h.isClosed).map((h) => `${h.opensAt} – ${h.closesAt}`).join(', ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">Équipe</h2>
          <ul className="flex flex-wrap gap-2">
            {s.staff.map((m) => (
              <li key={m.id} className="chip">
                {m.displayName}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Avis</h2>
        {reviews.data?.items.length ? (
          <ul className="flex flex-col gap-2">
            {reviews.data.items.map((r) => (
              <li key={r.id} className="card p-4 text-sm">
                <p className="font-medium">
                  {'★'.repeat(r.rating)}
                  {'☆'.repeat(5 - r.rating)} · {r.authorName}
                </p>
                {r.comment && <p className="mt-1 text-muted">{r.comment}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Pas encore d'avis.</p>
        )}
      </section>
    </article>
  );
}
