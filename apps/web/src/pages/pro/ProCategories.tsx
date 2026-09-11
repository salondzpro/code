/**
 * Catalogue → Catégories : une catégorie n'est qu'un titre qui range les prestations (ni image, ni description).
 * Le pro la renomme sur place, ou la supprime avec un choix explicite : emporter les prestations, ou les garder
 * en « Sans catégorie ». Une prestation déjà réservée n'est jamais effacée : elle est archivée, l'historique
 * financier (chiffre d'affaires, fiches client) reste intact.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { groupServices } from '@salondz/constants';
import { errorText } from '@/components/ErrorMessage';
import { BottomSheet, Button, I, Input, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';

type Mode = 'with-services' | 'keep-services';

export function ProCategories() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const { renameCategory, deleteCategory } = useProServiceMutations();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [del, setDel] = useState<{ name: string; count: number; mode?: Mode } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const groups = groupServices(salon.services.filter((sv) => sv.isActive));

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

  const confirmDelete = async () => {
    if (!del?.mode) return;
    setError(null);
    try {
      await deleteCategory.mutateAsync({ name: del.name, mode: del.mode });
      setDel(null);
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo="/pro/catalogue" right="Catalogue" />
      <h1 className="h1">Catégories</h1>
      {groups.length === 0 ? (
        <p className="p">Une catégorie apparaît dès que vous ajoutez une prestation.</p>
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
                  <span className="flex flex-none gap-2">
                    <button
                      type="button"
                      className="ib"
                      aria-label={`Renommer ${g.name}`}
                      onClick={() => {
                        setDraft(g.name);
                        setEditing(g.name);
                        setError(null);
                      }}
                    >
                      <I icon={Pencil} size={16} />
                    </button>
                    <button
                      type="button"
                      className="ib !text-danger"
                      aria-label={`Supprimer ${g.name}`}
                      onClick={() => {
                        setDel({ name: g.name, count: g.services.length });
                        setError(null);
                      }}
                    >
                      <I icon={Trash2} size={16} />
                    </button>
                  </span>
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

      {del && (
        <>
          <div className="dim" onClick={() => setDel(null)} />
          <BottomSheet className="!z-50">
            <div className="h2 text-center !text-[1.125rem]">Supprimer « {del.name} » ?</div>
            {del.mode ? (
              <>
                <p className="p text-center">
                  {del.mode === 'with-services'
                    ? `Les ${del.count} prestation${del.count > 1 ? 's' : ''} de cette catégorie seront retirées du catalogue. Celles déjà réservées sont archivées : vos rendez-vous, revenus et statistiques ne changent pas.`
                    : `La catégorie disparaît, ses ${del.count} prestation${del.count > 1 ? 's' : ''} restent réservables dans « Sans catégorie ».`}
                </p>
                <div className="g2">
                  <Button variant="g" onClick={() => setDel({ ...del, mode: undefined })}>
                    Retour
                  </Button>
                  <Button
                    variant="d"
                    onClick={() => void confirmDelete()}
                    disabled={deleteCategory.isPending}
                  >
                    <I icon={Trash2} size={18} />{' '}
                    {deleteCategory.isPending ? 'Suppression…' : 'Confirmer'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button variant="g" onClick={() => setDel({ ...del, mode: 'keep-services' })}>
                  Supprimer la catégorie seulement
                </Button>
                <p className="s -mt-2 text-center">
                  Les prestations restent réservables, sans catégorie.
                </p>
                <Button variant="d" onClick={() => setDel({ ...del, mode: 'with-services' })}>
                  Supprimer avec les {del.count} prestation{del.count > 1 ? 's' : ''}
                </Button>
                <button type="button" className="py-2 text-[1rem]" onClick={() => setDel(null)}>
                  Annuler
                </button>
              </>
            )}
          </BottomSheet>
        </>
      )}
    </Screen>
  );
}
