/**
 * Catalogue → Catégories : une catégorie n'est qu'un titre qui organise les prestations (ni image, ni description).
 * Le pro renomme librement ses catégories ; une catégorie existe dès qu'une prestation l'utilise.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Pencil, Plus, Tags, X } from 'lucide-react-native';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { groupServices } from '@salondz/constants';
import { errorText } from '@/lib/errors';
import {
  Alert,
  Button,
  H1,
  I,
  IconButton,
  InfoBox,
  Input,
  ListCard,
  P,
  Row,
  TopBar,
  Tx,
} from '@/ui';
import { RowText } from '@/ui/ProRows';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

export default function ProCategories() {
  const router = useRouter();
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
    <Screen gap={13}>
      <TopBar backTo="/prestations" right="Catalogue" />
      <H1>Catégories</H1>
      <P>
        Un titre, rien d'autre : les catégories servent à ranger vos prestations sur votre page.
      </P>
      {groups.length === 0 ? (
        <P>Aucune catégorie pour l'instant : elle apparaît dès que vous ajoutez une prestation.</P>
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
      <InfoBox>
        Renommer une catégorie déplace toutes ses prestations sous le nouveau nom, sur votre page
        comme dans l'agenda.
      </InfoBox>
    </Screen>
  );
}
