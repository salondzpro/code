/** C-F 23 — Réglages client : notifications, préférences (langue, catalogue, ville), compte (session, confidentialité, données, déconnexion). */
import React, { useEffect, useState } from 'react';
import { Linking, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useMe, useUpdateProfile } from '@salondz/api-client';
import { MARKET_LABELS_FR } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { useLocationPrefs } from '@/lib/prefs';
import { Badge, H1, ListCard, P, Row, SectionLabel, Toggle, TopBar, Tx } from '@/ui';
import { PickerSheet } from '@/ui/Pickers';
import { Screen } from '@/ui/Screen';
import { C, NAV_PAD } from '@/theme/design';

function since(iso: string): string {
  return new Intl.DateTimeFormat('fr-DZ', { day: 'numeric', month: 'long', timeZone: 'Africa/Algiers' }).format(new Date(iso));
}

export default function Settings() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const me = useMe();
  const update = useUpdateProfile();
  const [prefs, setPrefs] = useLocationPrefs();
  const [reminders, setReminders] = useState(true);
  const [sheet, setSheet] = useState<'locale' | 'market' | null>(null);
  const p = me.data?.profile;

  useEffect(() => {
    if (p) setReminders(p.whatsappReminders ?? true);
  }, [p]);

  return (
    <Screen gap={11} bottom={NAV_PAD}>
      <TopBar backTo="/(client)/(tabs)/profil" right="Réglages" />
      <H1>Réglages</H1>

      <SectionLabel>Notifications</SectionLabel>
      <ListCard>
        <Row
          py={13}
          chevron={false}
          right={
            <Toggle
              on={reminders}
              onChange={(v) => {
                setReminders(v);
                update.mutate({ whatsappReminders: v });
              }}
              label="Rappels WhatsApp"
            />
          }
        >
          <Tx size={12} lh={16}>
            Rappels WhatsApp
          </Tx>
          <Tx size={10.5} color={C.muted} lh={15.5}>
            2 h avant le rendez-vous
          </Tx>
        </Row>
        <Row py={13} chevron={false} right={<Toggle on={prefs.notifConfirmations} onChange={(v) => setPrefs({ notifConfirmations: v })} label="Confirmations" />}>
          <Tx size={12} lh={16}>
            Confirmations
          </Tx>
          <Tx size={10.5} color={C.muted} lh={15.5}>
            Réservation, report, annulation
          </Tx>
        </Row>
        <Row py={13} chevron={false} right={<Toggle on={prefs.notifNews} onChange={(v) => setPrefs({ notifNews: v })} label="Nouveautés" />}>
          <Tx size={12} lh={16}>
            Nouveautés des salons suivis
          </Tx>
          <Tx size={10.5} color={C.muted} lh={15.5}>
            Maximum une fois par semaine
          </Tx>
        </Row>
      </ListCard>

      <SectionLabel>Préférences</SectionLabel>
      <ListCard>
        <Row py={13} onPress={() => setSheet('locale')} accessibilityLabel="Langue" right={<Tx size={12} color={C.muted} lh={16}>{p?.locale === 'ar' ? 'العربية' : 'Français'}</Tx>}>
          <Tx size={12} lh={16}>
            Langue
          </Tx>
          <Tx size={10.5} color={C.muted} lh={15.5}>
            L'interface en arabe arrive bientôt
          </Tx>
        </Row>
        <Row py={13} onPress={() => setSheet('market')} accessibilityLabel="Catalogue affiché" right={<Tx size={12} color={C.muted} lh={16}>{p?.market ? MARKET_LABELS_FR[p.market].replace('Pour ', '') : '—'}</Tx>}>
          <Tx size={12} lh={16}>
            Catalogue affiché
          </Tx>
          <Tx size={10.5} color={C.muted} lh={15.5}>
            Marketplace et recherche
          </Tx>
        </Row>
        <Row py={13} to="/localisation" accessibilityLabel="Ville" right={<Tx size={12} color={C.muted} lh={16}>{prefs.label}</Tx>}>
          <Tx size={12} lh={16}>
            Ville
          </Tx>
          <Tx size={10.5} color={C.muted} lh={15.5}>
            {prefs.lat != null ? `Autour de vous · ${prefs.radiusKm} km` : prefs.city ? 'Quartier choisi' : 'Toute la wilaya'}
          </Tx>
        </Row>
      </ListCard>
      <PickerSheet
        open={sheet === 'locale'}
        onClose={() => setSheet(null)}
        title="Langue"
        options={[
          { value: 'fr', label: 'Français' },
          { value: 'ar', label: 'العربية', hint: 'Bientôt disponible · votre choix est mémorisé' },
        ]}
        value={p?.locale ?? 'fr'}
        onChange={(v) => update.mutate({ locale: v as 'fr' | 'ar' })}
      />
      <PickerSheet
        open={sheet === 'market'}
        onClose={() => setSheet(null)}
        title="Catalogue affiché"
        options={[
          { value: 'men', label: MARKET_LABELS_FR.men.replace('Pour ', ''), hint: 'Barbiers, coiffure homme' },
          { value: 'women', label: MARKET_LABELS_FR.women.replace('Pour ', ''), hint: 'Coiffure, ongles, cils, soins' },
        ]}
        value={p?.market ?? ''}
        onChange={(v) => update.mutate({ market: v as 'men' | 'women' })}
      />

      <SectionLabel>Compte</SectionLabel>
      <ListCard>
        <Row py={13} chevron={false} right={<Badge tone="ok" md>Active</Badge>}>
          <Tx size={12} lh={16}>
            Session
          </Tx>
          <Tx size={10.5} color={C.muted} lh={15.5}>
            {p ? `Ouverte depuis le ${since(p.createdAt)} · illimitée` : 'Session ouverte'}
          </Tx>
        </Row>
        <Row py={13} onPress={() => void Linking.openURL('https://salondz.pages.dev/confidentialite').catch(() => undefined)}>
          <Tx size={12} lh={16}>
            Confidentialité
          </Tx>
        </Row>
        <Row py={13} onPress={() => void Linking.openURL(`mailto:contact@salondz.dz?subject=${encodeURIComponent('Suppression de mes données')}&body=${encodeURIComponent(`Compte : ${session?.user.email ?? session?.user.phone ?? ''}`)}`).catch(() => undefined)}>
          <Tx size={12} lh={16}>
            Supprimer mes données
          </Tx>
        </Row>
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            await signOut();
            router.replace('/intro');
          }}
          style={{ paddingVertical: 13 }}
        >
          <Tx size={12} lh={16} color={C.danger}>
            Se déconnecter
          </Tx>
        </Pressable>
      </ListCard>
      <P> </P>
    </Screen>
  );
}
