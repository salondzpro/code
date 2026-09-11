/**
 * Espace pro — Profil = porte d'entrée de la gestion, en six rubriques métier (une sous-page dédiée chacune) :
 * Mon salon · Catalogue · Équipe · Clients · Rendez-vous · Compte. En tête, la page publique (logo, couverture,
 * en ligne / non publiée, Aperçu, Partager). La navigation basse ne garde que Accueil / Agenda / Réservations / Profil.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarCog, Camera, Clock, ContactRound, Eye, Share2, Store, Tag, CircleUser, Users } from 'lucide-react-native';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { DAY_LABELS_FR, SALON_MAX_PHOTOS, dayOfWeekFromKey, toLocalDateKey } from '@salondz/constants';
import { COVER_ASPECT_RN, pickImages, uploadSalonImage } from '@/lib/images';
import { errorText } from '@/lib/errors';
import { publicHost } from '@/lib/salon';
import { Alert, Avatar, Badge, Button, Card, Grid, H1, I, Img, ListCard, Row, SectionLabel, Tx } from '@/ui';
import { RowText, Tile } from '@/ui/ProRows';
import { BrandFooter } from '@/ui/BrandFooter';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { ShareSheet } from '@/ui/ShareSheet';
import { C, NAV_PAD } from '@/theme/design';

export default function ProProfile() {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon, setPhotos } = useProSalonMutations();
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'cover' | 'logo' | null>(null);
  if (!salon) return <Splash />;
  const short = `${publicHost()}/s/${salon.slug}`;
  const active = salon.staff.filter((m) => m.isActive).length;
  const services = salon.services.filter((s) => s.isActive).length;
  const todayDow = dayOfWeekFromKey(toLocalDateKey());
  const todayHours = salon.openingHours.filter((h) => h.dayOfWeek === todayDow && !h.isClosed);
  const todayLabel = todayHours.length
    ? todayHours.map((h) => `${h.opensAt} – ${h.closesAt}`).join(' · ')
    : 'Fermé aujourd’hui';

  const upload = async (kind: 'cover' | 'logo') => {
    setError(null);
    try {
      const [img] = await pickImages(kind === 'logo' ? { square: true } : { aspect: COVER_ASPECT_RN });
      if (!img) return;
      setBusy(kind);
      const u = await uploadSalonImage(salon.id, img);
      if (kind === 'logo') await updateSalon.mutateAsync({ logoUrl: u });
      // Nouvelle couverture = première photo ; les anciennes couvertures restent dans la galerie.
      else await setPhotos.mutateAsync([{ url: u }, ...salon.photos.map((p) => ({ url: p.url }))].slice(0, SALON_MAX_PHOTOS));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen gap={13} bottom={NAV_PAD}>
      <H1 size={23} lh={26} ls={-0.8}>
        Profil
      </H1>

      {/* Page publique */}
      <Card gap={13}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Changer la photo de profil" disabled={busy !== null} onPress={() => void upload('logo')}>
            <Avatar src={salon.logoUrl ?? salon.coverUrl} name={salon.name} size={58.5} />
            <View style={{ position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: C.ink, borderWidth: 2, borderColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
              <I icon={Camera} size={11} color={C.onInk} />
            </View>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx size={16} weight={700} ls={-0.4} lh={20}>
              {salon.name}
            </Tx>
            <Tx size={11.5} color={C.muted} lh={15.5} numberOfLines={1}>
              {short}
            </Tx>
          </View>
          <Badge tone={salon.isPublished ? 'ok' : 'pd'} md>
            {salon.isPublished ? 'En ligne' : 'Non publiée'}
          </Badge>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Changer la photo de couverture" disabled={busy !== null} onPress={() => void upload('cover')}>
          <Img src={salon.coverUrl} radius={13} style={{ height: 114, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
            {!salon.coverUrl && <I icon={Camera} size={23} color={C.subtle} />}
            <View style={{ position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
              <I icon={Camera} size={11} />
              <Tx size={9.5} weight={600} lh={12}>
                {busy === 'cover' ? 'Envoi…' : 'Changer la couverture'}
              </Tx>
            </View>
          </Img>
        </Pressable>
        <Grid cols={2}>
          <Button variant="g" sm onPress={() => router.push(`/s/${salon.slug}` as never)}>
            <I icon={Eye} size={14.5} />
            <Tx size={11.5} weight={600} ls={-0.2}>
              Aperçu
            </Tx>
          </Button>
          <Button sm onPress={() => setSheet(true)}>
            <I icon={Share2} size={14.5} color="#fff" />
            <Tx size={11.5} weight={600} color="#fff" ls={-0.2}>
              Partager
            </Tx>
          </Button>
        </Grid>
        {error && <Alert>{error}</Alert>}
      </Card>

      {/* Six rubriques métier */}
      <SectionLabel>Gérer mon activité</SectionLabel>
      <Grid cols={2} gap={8}>
        <Tile onPress={() => router.push('/mon-salon' as never)} icon={Store} title="Mon salon" sub="Photos, réalisations, adresse" />
        <Tile onPress={() => router.push('/prestations' as never)} icon={Tag} title="Catalogue" sub={`${services} prestation${services > 1 ? 's' : ''} · catégories, prix, durée`} />
        <Tile onPress={() => router.push('/equipe' as never)} icon={Users} title="Équipe" sub={`${active} membre${active > 1 ? 's' : ''} actif${active > 1 ? 's' : ''} · horaires, absences`} />
        <Tile onPress={() => router.push('/clients' as never)} icon={ContactRound} title="Clients" sub="Fiches, historique, bloqués" />
        <Tile onPress={() => router.push('/reglages-pro/rendez-vous' as never)} icon={CalendarCog} title="Rendez-vous" sub="Règles de réservation, annulation, retard" />
        <Tile onPress={() => router.push('/compte' as never)} icon={CircleUser} title="Compte" sub="Profil, notifications, paramètres" />
      </Grid>

      {/* Horaires d’ouverture : la question du quotidien, à un tap depuis Profil. */}
      <SectionLabel>Horaires d’ouverture</SectionLabel>
      <ListCard>
        <Row py={12} to="/reglages-pro/horaires">
          <RowText icon={Clock} title={todayLabel} sub={`Aujourd’hui · ${DAY_LABELS_FR[todayDow]}`} />
        </Row>
      </ListCard>

      <ShareSheet open={sheet} onClose={() => setSheet(false)} name={salon.name} slug={salon.slug} />
      <BrandFooter />
    </Screen>
  );
}
