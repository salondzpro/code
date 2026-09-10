/**
 * Catalogue → Catégories : une catégorie n'est qu'un titre qui organise les prestations (ni image, ni description).
 * Le pro renomme librement ses catégories ; une catégorie existe dès qu'une prestation l'utilise (on la crée en
 * ajoutant une prestation), et disparaît quand plus aucune prestation ne la porte.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Pencil, Plus, Tags, X } from 'lucide-react';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { groupServices } from '@salondz/constants';
import { errorText } from '@/components/ErrorMessage';
import { Button, I, InfoBox, Input, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';

export function ProCategories() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const { renameCategory } = useProServiceMutations();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const groups = groupServices(salon.services);

  const save = async (from: string) => {
    const name = draft.trim();
    if (name.length < 2) return setError('Indiquez un nom de catégorie (2 caractères minimum).');
    setError(null);
    try {
      if (name !== from) await renameCategory.mutateAsync({ from, name });
      setEditing(null);
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo="/pro/catalogue" right="Catalogue" />
      <h1 className="h1">Catégories</h1>
      <p className="p -mt-2">
        Un titre, rien d'autre : les catégories servent à ranger vos prestations sur votre page.
      </p>
      {groups.length === 0 ? (
        <p className="p">
          Aucune catégorie pour l'instant : elle apparaît dès que vous ajoutez une prestation.
        </p>
      ) : (
        <div className="crd !gap-0 !py-1">
          {groups.map((g) => (
            <div key={g.name} className="li !py-3">
              {editing === g.name ? (
                <div className="flex w-full items-center gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={60}
                    autoFocus
                    aria-label={`Nouveau nom de ${g.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void save(g.name);
                      if (e.key === 'Escape') setEditing(null);
                    }}
                  />
                  <button
                    type="button"
                    className="ib flex-none !bg-ink !text-white"
                    aria-label="Enregistrer"
                    onClick={() => void save(g.name)}
                    disabled={renameCategory.isPending}
                  >
                    <I icon={Check} size={16} />
                  </button>
                  <button
                    type="button"
                    className="ib flex-none"
                    aria-label="Annuler"
                    onClick={() => setEditing(null)}
                  >
                    <I icon={X} size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex min-w-0 items-center gap-3.5">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-fill">
                      <I icon={Tags} size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[1rem] font-semibold">{g.name}</span>
                      <span className="block text-[0.875rem] text-muted">
                        {g.services.length} prestation{g.services.length > 1 ? 's' : ''}
                      </span>
                    </span>
                  </span>
                  <button
                    type="button"
                    className="ib flex-none"
                    aria-label={`Renommer ${g.name}`}
                    onClick={() => {
                      setDraft(g.name);
                      setEditing(g.name);
                      setError(null);
                    }}
                  >
                    <I icon={Pencil} size={16} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <Button variant="g" onClick={() => navigate('/pro/onboarding/6')}>
        <I icon={Plus} size={18} /> Nouvelle catégorie avec une prestation
      </Button>
      <InfoBox>
        Renommer une catégorie déplace toutes ses prestations sous le nouveau nom, sur votre page
        comme dans l'agenda.
      </InfoBox>
    </Screen>
  );
}
