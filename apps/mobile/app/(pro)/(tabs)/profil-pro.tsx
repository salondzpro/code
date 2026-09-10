/**
 * Espace pro — Profil, ordonné par ce qui sert tous les jours :
 *   1. la page publique (logo, couverture, en ligne / non publiée, Aperçu, Partager) ;
 *   2. quatre raccourcis du quotidien en tuiles : Fermetures, Horaires, Équipe, QR code & lien ;
 *   3. la réservation en ligne (page publiée, validation manuelle, règles) ;
 *   4. l'établissement (photos, adresse, catalogue, description) ;
 *   5. le compte. Une icône par ligne, une page dédiée par sujet.
 */
import React, { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeftRight,
  CalendarOff,
  Camera,
  Clock,
  Eye,
  FileText,
  Globe,
  Images,
  LogOut,
  MapPin,
  Pencil,
  QrCode,
  Save,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useMe, useProSalon, useProSalonMutations } from '@salondz/api-client';
import { MARKET_LABELS_FR, SALON_MAX_PHOTOS, formatDZPhone, wilayaName } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { COVER_ASPECT_RN, pickImages, uploadSalonImage } from '@/lib/images';
import { errorText } from '@/lib/errors';
import { publicHost } from '@/lib/salon';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Grid,
  H1,
  I,
  IconButton,
  Img,
  Input,
  ListCard,
  Row,
  SectionLabel,
  Toggle,
  Tx,
} from '@/ui';
import { BrandFooter } from '@/ui/BrandFooter';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { ShareSheet } from '@/ui/ShareSheet';
import { C, NAV_PAD } from '@/theme/design';

/** Icône dans une pastille, à gauche d'une ligne ou d'une tuile. */
function Ic({ icon, ink, danger }: { icon: LucideIcon; ink?: boolean; danger?: boolean }) {
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: ink ? C.ink : danger ? C.cancelBg : C.fill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <I icon={icon} size={14.5} color={ink ? C.onInk : danger ? C.danger : C.text} />
    </View>
  );
}

/** Ligne de réglage : icône, titre, sous-titre. */
function RowText({ icon, title, sub }: { icon: LucideIcon; title: string; sub?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      <Ic icon={icon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tx size={13} weight={600} lh={17}>
          {title}
        </Tx>
        {!!sub && (
          <Tx size={11.5} color={C.muted} lh={15} numberOfLines={1}>
            {sub}
          </Tx>
        )}
      </View>
    </View>
  );
}

/** Tuile de raccourci (2 par ligne) pour les gestes du quotidien. */
function Tile({
  onPress,
  icon,
  title,
  sub,
}: {
  onPress: () => void;
  icon: LucideIcon;
  title: string;
  sub: string;
}) {
  return (
    <Card gap={10} pad={13} onPress={onPress} accessibilityLabel={title}>
      <Ic icon={icon} ink />
      <View>
        <Tx size={13} weight={700} ls={-0.2} lh={17}>
          {title}
        </Tx>
        <Tx size={10.5} color={C.muted} lh={14}>
          {sub}
        </Tx>
      </View>
    </Card>
  );
}

export default function ProProfile() {
  const router = useRouter();
  const { signOut } = useAuth();
  const me = useMe();
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon, setPhotos } = useProSalonMutations();
  const [sheet, setSheet] = useState(false);
  const [desc, setDesc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'cover' | 'logo' | null>(null);
  if (!salon) return <Splash />;
  const market = salon.genderTarget === 'men' ? 'men' : 'women';
  const short = `${publicHost()}/s/${salon.slug}`;
  const active = salon.staff.filter((m) => m.isActive).length;

  const upload = async (kind: 'cover' | 'logo') => {
    setError(null);
    try {
      const [img] = await pickImages(
        kind === 'logo' ? { square: true } : { aspect: COVER_ASPECT_RN },
      );
      if (!img) return;
      setBusy(kind);
      const u = await uploadSalonImage(salon.id, img);
      if (kind === 'logo') await updateSalon.mutateAsync({ logoUrl: u });
      // Nouvelle couverture = première photo ; les anciennes couvertures restent dans la galerie.
      else
        await setPhotos.mutateAsync(
          [{ url: u }, ...salon.photos.map((p) => ({ url: p.url }))].slice(0, SALON_MAX_PHOTOS),
        );
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

      {/* 1. Page publique */}
      <Card gap={13}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Changer la photo de profil"
            disabled={busy !== null}
            onPress={() => void upload('logo')}
          >
            <Avatar src={salon.logoUrl ?? salon.coverUrl} name={salon.name} size={58.5} />
            <View
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: C.ink,
                borderWidth: 2,
                borderColor: C.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Changer la photo de couverture"
          disabled={busy !== null}
          onPress={() => void upload('cover')}
        >
          <Img
            src={salon.coverUrl}
            radius={13}
            style={{ height: 114, width: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            {!salon.coverUrl && <I icon={Camera} size={23} color={C.subtle} />}
            <View
              style={{
                position: 'absolute',
                right: 8,
                bottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
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
      </Card>

      {/* 2. Les gestes du quotidien */}
      <SectionLabel>Au quotidien</SectionLabel>
      <Grid cols={2} gap={8}>
        <Tile
          onPress={() => router.push('/blocages' as never)}
          icon={CalendarOff}
          title="Fermetures"
          sub="Congés, pauses, exceptions"
        />
        <Tile
          onPress={() => router.push('/reglages-pro/horaires' as never)}
          icon={Clock}
          title="Horaires"
          sub="Jours et heures d'ouverture"
        />
        <Tile
          onPress={() => router.push('/(pro)/(tabs)/equipe')}
          icon={Users}
          title="Équipe"
          sub={`${active} membre${active > 1 ? 's' : ''} actif${active > 1 ? 's' : ''}`}
        />
        <Tile
          onPress={() => router.push('/lien' as never)}
          icon={QrCode}
          title="QR code & lien"
          sub="Affiche, partage, copie"
        />
      </Grid>

      {/* 3. Réservation en ligne */}
      <SectionLabel>Réservation en ligne</SectionLabel>
      <ListCard>
        <Row
          py={12}
          chevron={false}
          right={
            <Toggle
              on={salon.isPublished}
              onChange={(v) =>
                updateSalon.mutate({ isPublished: v }, { onError: (e) => setError(errorText(e)) })
              }
              label="Page publiée"
            />
          }
        >
          <RowText icon={Globe} title="Page publiée" sub="Visible dans la marketplace" />
        </Row>
        <Row
          py={12}
          chevron={false}
          right={
            <Toggle
              on={!salon.autoConfirm}
              onChange={(v) => updateSalon.mutate({ autoConfirm: !v })}
              label="Validation manuelle"
            />
          }
        >
          <RowText
            icon={ShieldCheck}
            title="Validation manuelle"
            sub="Vous confirmez chaque demande"
          />
        </Row>
        <Row py={12} to="/reglages-pro/regles">
          <RowText
            icon={SlidersHorizontal}
            title="Créneaux et règles"
            sub="Délai minimum, annulation, report"
          />
        </Row>
      </ListCard>
      {error && <Alert>{error}</Alert>}

      {/* 4. Établissement */}
      <SectionLabel>Établissement</SectionLabel>
      <ListCard>
        <Row py={12} to="/photos">
          <RowText
            icon={Images}
            title="Photos du salon"
            sub={`${salon.logoUrl ? 'Logo' : 'Sans logo'} · ${salon.photos.length} photo${salon.photos.length > 1 ? 's' : ''} de couverture`}
          />
        </Row>
        <Row py={12} to="/salon">
          <RowText
            icon={MapPin}
            title="Adresse et zone"
            sub={[salon.address, salon.zone ?? salon.city, wilayaName(salon.wilayaCode)]
              .filter(Boolean)
              .join(', ')}
          />
        </Row>
        <Row py={12} to="/onboarding/5">
          <RowText
            icon={Tag}
            title="Catalogue"
            sub={`${MARKET_LABELS_FR[market]} · ${salon.categoryIds.length} catégorie${salon.categoryIds.length > 1 ? 's' : ''}`}
          />
        </Row>
        <Row
          py={12}
          chevron={false}
          right={
            desc === null ? (
              <IconButton
                accessibilityLabel="Modifier la description"
                onPress={() => setDesc(salon.description ?? '')}
              >
                <I icon={Pencil} size={14} color={C.text} />
              </IconButton>
            ) : undefined
          }
        >
          <RowText
            icon={FileText}
            title="Description du salon"
            sub={
              desc === null
                ? salon.description || 'Recommandé — améliore votre visibilité'
                : undefined
            }
          />
        </Row>
        {desc !== null && (
          <View style={{ gap: 6, paddingBottom: 10 }}>
            <Input
              multiline
              value={desc}
              onChangeText={setDesc}
              maxLength={1500}
              placeholder="Salon calme, produits sans parabène…"
              accessibilityLabel="Description du salon"
            />
            <Grid cols={2}>
              <Button variant="g" sm onPress={() => setDesc(null)}>
                Annuler
              </Button>
              <Button
                sm
                disabled={updateSalon.isPending}
                loading={updateSalon.isPending}
                onPress={async () => {
                  await updateSalon.mutateAsync({ description: desc.trim() || undefined });
                  setDesc(null);
                }}
              >
                <I icon={Save} size={14} color={C.onInk} />
                <Tx size={11.5} weight={600} color={C.onInk} lh={15}>
                  Enregistrer
                </Tx>
              </Button>
            </Grid>
          </View>
        )}
      </ListCard>

      {/* 5. Compte */}
      <SectionLabel>Compte</SectionLabel>
      <ListCard>
        <Row
          py={12}
          chevron={false}
          right={
            <Badge tone="ok" md>
              Actif
            </Badge>
          }
        >
          <RowText
            icon={User}
            title={me.data?.profile.fullName ?? 'Vous'}
            sub={me.data?.profile.phone ? formatDZPhone(me.data.profile.phone) : ''}
          />
        </Row>
        <Row py={12} onPress={() => router.replace('/(client)/(tabs)')}>
          <RowText icon={ArrowLeftRight} title="Espace client" sub="Réserver comme un client" />
        </Row>
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            await signOut();
            router.replace('/intro');
          }}
          style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 11 }}
        >
          <Ic icon={LogOut} danger />
          <Tx size={13} weight={600} lh={17} color={C.danger}>
            Se déconnecter
          </Tx>
        </Pressable>
      </ListCard>
      <ShareSheet
        open={sheet}
        onClose={() => setSheet(false)}
        name={salon.name}
        slug={salon.slug}
      />
      <BrandFooter />
    </Screen>
  );
}
