import { Link } from 'react-router';
import { useFavorites } from '@salondz/api-client';
import { SalonCard } from '@/components/SalonCard';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';

export function AccountFavorites() {
  const favs = useFavorites();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Mes favoris</h1>
      {favs.isPending && <Spinner />}
      {favs.isError && <ErrorMessage error={favs.error} retry={() => favs.refetch()} />}
      {favs.data && favs.data.items.length === 0 && (
        <EmptyState
          title="Aucun salon en favori"
          description="Ajoutez vos salons préférés pour les retrouver en un clic."
          action={
            <Link to="/recherche" className="btn-primary">
              Trouver un salon
            </Link>
          }
        />
      )}
      {favs.data && favs.data.items.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {favs.data.items.map((s) => (
            <li key={s.id}>
              <SalonCard salon={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
