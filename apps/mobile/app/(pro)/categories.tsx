/**
 * Catalogue → Catégories : une catégorie n'est qu'un titre qui range les prestations (ni image, ni description).
 * Le pro la renomme sur place, ou la supprime avec un choix explicite : emporter les prestations, ou les garder
 * en « Sans catégorie ». Une prestation déjà réservée n'est jamais effacée : elle est archivée, l'historique
 * financier (chiffre d'affaires, fiches client) reste intact.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Pencil, Plus, Tags, Trash2, X } from 'lucide-react-native';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { groupServices } from '@salondz/constants';
import { errorText } from '@/lib/errors';
import {
  Alert,
  Button,
  Grid,
  H1,
  I,
  IconButton,
  Input,
  ListCard,
  ModalSheet,
  P,
  Row,
  TopBar,
  Tx,
} from '@/ui';
import { RowText } from '@/ui/ProRows';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

type Mode = 'with-services' | 'keep-services';

export default function ProCategories() {
  const router = useRouter();
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
    <Screen gap={13}>
      <TopBar backTo="/prestations" right="Catalogue" />
      <H1>Catégories</H1>
      {groups.length === 0 ? (
        <P>Une catégorie apparaît dès que vous ajoutez une prestation.</P>
      ) : (
        <ListCard>
          {groups.map((g) =>
            editing === g.name ? (
              <View
                key={g.name}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}
              >
                <View style={{ flex: 1 }}>
                  <Input
                    value={draft}
                    onChangeText={setDraft}
                    maxLength={60}
                    autoFocus
                    accessibilityLabel={`Nouveau nom de ${g.name}`}
                    onSubmitEditing={() => void save(g.name)}
                  />
                </View>
                <IconButton
                  ink
                  accessibilityLabel="Enregistrer"
                  onPress={() => void save(g.name)}
                  disabled={renameCategory.isPending}
                >
                  <I icon={Check} size={16} color={C.onInk} />
                </IconButton>
                <IconButton accessibilityLabel="Annuler" onPress={() => setEditing(null)}>
                  <I icon={X} size={16} color={C.text} />
                </IconButton>
              </View>
            ) : (
              <Row
                key={g.name}
                py={10}
                chevron={false}
                right={
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <IconButton
                      accessibilityLabel={`Renommer ${g.name}`}
                      onPress={() => {
                        setDraft(g.name);
                        setEditing(g.name);
                        setError(null);
                      }}
                    >
                      <I icon={Pencil} size={14} color={C.text} />
                    </IconButton>
                    <IconButton
                      accessibilityLabel={`Supprimer ${g.name}`}
                      onPress={() => {
                        setDel({ name: g.name, count: g.services.length });
                        setError(null);
                      }}
                    >
                      <I icon={Trash2} size={14} color={C.danger} />
                    </IconButton>
                  </View>
                }
              >
                <RowText
                  icon={Tags}
                  title={g.name}
                  sub={`${g.services.length} prestation${g.services.length > 1 ? 's' : ''}`}
                />
              </Row>
            ),
          )}
        </ListCard>
      )}
      {error && <Alert>{error}</Alert>}
      <Button variant="g" onPress={() => router.push('/onboarding/6' as never)}>
        <I icon={Plus} size={14.5} />
        <Tx size={12} weight={600} lh={16}>
          Nouvelle catégorie avec une prestation
        </Tx>
      </Button>

      <ModalSheet open={!!del} onClose={() => setDel(null)}>
        <Tx size={16} weight={700} ls={-0.5} lh={20} center>
          Supprimer « {del?.name} » ?
        </Tx>
        {del?.mode ? (
          <>
            <P center>
              {del.mode === 'with-services'
                ? `Les ${del.count} prestation${del.count > 1 ? 's' : ''} de cette catégorie seront retirées du catalogue. Celles déjà réservées sont archivées : vos rendez-vous, revenus et statistiques ne changent pas.`
                : `La catégorie disparaît, ses ${del.count} prestation${del.count > 1 ? 's' : ''} restent réservables dans « Sans catégorie ».`}
            </P>
            <Grid cols={2} gap={8}>
              <Button variant="g" onPress={() => setDel({ ...del, mode: undefined })}>
                Retour
              </Button>
              <Button
                variant="d"
                onPress={() => void confirmDelete()}
                disabled={deleteCategory.isPending}
                loading={deleteCategory.isPending}
              >
                <I icon={Trash2} size={14} color={C.danger} />
                <Tx size={12} weight={600} lh={16} color={C.danger}>
                  Confirmer
                </Tx>
              </Button>
            </Grid>
          </>
        ) : (
          <>
            <Button variant="g" onPress={() => del && setDel({ ...del, mode: 'keep-services' })}>
              Supprimer la catégorie seulement
            </Button>
            <Tx size={11} color={C.muted} lh={15} center style={{ marginTop: -4 }}>
              Les prestations restent réservables, sans catégorie.
            </Tx>
            <Button variant="d" onPress={() => del && setDel({ ...del, mode: 'with-services' })}>
              <Tx size={12} weight={600} lh={16} color={C.danger}>
                Supprimer avec les {del?.count} prestation{(del?.count ?? 0) > 1 ? 's' : ''}
              </Tx>
            </Button>
          </>
        )}
      </ModalSheet>
    </Screen>
  );
}
