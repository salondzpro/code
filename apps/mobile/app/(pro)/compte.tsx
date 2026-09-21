/** Profil → Compte : profil professionnel (nom, téléphone), notifications, paramètres (page publiée, espace client), déconnexion. */
import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeftRight, Bell, Globe, LogOut, Trash2, User } from 'lucide-react-native';
import { useMe, useProSalon, useProSalonMutations } from '@salondz/api-client';
import { formatDZPhone } from '@salondz/constants';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { Alert, Badge, Button, H1, H2, ListCard, ModalSheet, P, Row, SectionLabel, Toggle, TopBar, Tx } from '@/ui';
import { Ic, RowText } from '@/ui/ProRows';
import { BrandFooter } from '@/ui/BrandFooter';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

export default function ProAccount() {
  const router = useRouter();
  const { signOut } = useAuth();
  const me = useMe();
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** '…' = suppression en cours ; sinon le message d'erreur à montrer dans la feuille. */
  const [deleting, setDeleting] = useState<string | null>(null);
  if (!salon) return <Splash />;

  /** Exigé par Apple et Google : la suppression se fait DANS l'application. Ferme aussi le salon. */
  const deleteAccount = async () => {
    setDeleting('…');
    try {
      await api.me.deleteAccount({ withSalon: true });
      await signOut();
      router.replace('/intro');
    } catch (err) {
      setDeleting(errorText(err));
    }
  };

  return (
    <Screen gap={13}>
      <TopBar backTo="/(pro)/(tabs)/profil-pro" right="Profil" />
      <H1>Compte</H1>

      <SectionLabel>Profil professionnel</SectionLabel>
      <ListCard>
        <Row py={12} chevron={false} right={<Badge tone="ok" md>Actif</Badge>}>
          <RowText icon={User} title={me.data?.profile.fullName ?? 'Vous'} sub={me.data?.profile.phone ? formatDZPhone(me.data.profile.phone) : 'Numéro non renseigné'} />
        </Row>
        <Row py={12} to="/notifications">
          <RowText icon={Bell} title="Notifications" sub="Demandes, confirmations, annulations" />
        </Row>
      </ListCard>

      <SectionLabel>Paramètres</SectionLabel>
      <ListCard>
        <Row py={12} chevron={false} right={<Toggle on={salon.isPublished} onChange={(v) => updateSalon.mutate({ isPublished: v }, { onError: (e) => setError(errorText(e)) })} label="Page publiée" />}>
          <RowText icon={Globe} title="Page publiée" sub="Visible dans la marketplace" />
        </Row>
        <Row py={12} onPress={() => router.replace('/(client)/(tabs)')}>
          <RowText icon={ArrowLeftRight} title="Espace client" sub="Réserver comme un client" />
        </Row>
      </ListCard>
      {error && <Alert>{error}</Alert>}

      <ListCard>
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            await signOut();
            router.replace('/intro');
          }}
          style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 11 }}
        >
          <Ic icon={LogOut} danger />
          <Tx size={14} weight={600} lh={17} color={C.danger}>
            Se déconnecter
          </Tx>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Supprimer mon compte et mon salon"
          onPress={() => setConfirmDelete(true)}
          style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 11 }}
        >
          <Ic icon={Trash2} danger />
          <Tx size={14} weight={600} lh={17} color={C.danger}>
            Supprimer mon compte et mon salon
          </Tx>
        </Pressable>
      </ListCard>
      <BrandFooter />

      <ModalSheet open={confirmDelete} onClose={() => deleting === '…' || setConfirmDelete(false)}>
        <H2>Supprimer mon compte et mon salon ?</H2>
        <P>
          Vos rendez-vous à venir seront annulés et vos clients prévenus. Votre page, votre catalogue, votre équipe, vos avis et l’historique de vos rendez-vous seront supprimés, chez vous comme chez vos clients. Cette action est définitive.
        </P>
        {deleting && deleting !== '…' ? <Alert>{deleting}</Alert> : null}
        <Button variant="d" onPress={() => void deleteAccount()} disabled={deleting === '…'} loading={deleting === '…'}>
          Supprimer définitivement
        </Button>
        <Button variant="g" onPress={() => setConfirmDelete(false)} disabled={deleting === '…'}>
          Garder mon compte
        </Button>
      </ModalSheet>
    </Screen>
  );
}
