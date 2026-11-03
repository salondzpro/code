/**
 * Espace pro — PROFIL, quatrième onglet de la barre du bas (3 nov. 2026) : la porte d'entrée de toute
 * la gestion, en une page. En tête, le salon tel que les clientes le voient (logo, nom, lien, en ligne
 * ou non, Aperçu, Partager) ; puis ce qu'on gère au fil des semaines (clientèle, prestations, page,
 * avis, chiffre d'affaires, équipe), puis les réglages et l'aide, puis la déconnexion.
 *
 * Il remplace l'onglet « Clientes » et la feuille « Plus » du 1er nov. : la barre du bas ne garde que
 * le quotidien (Accueil · Agenda · Demandes · Profil) et rien de la gestion n'est perdu — tout est ICI,
 * une ligne par destination, sans sous-menu. « Équipe » n'apparaît qu'à partir de deux personnes
 * actives (une indépendante la trouve dans Paramètres, « Travailler à plusieurs »).
 */
import { useRef, useState } from 'react';
import {
  Bell,
  Camera,
  ChartColumn,
  ChevronRight,
  CircleHelp,
  Clock,
  ContactRound,
  Eye,
  Link2,
  LogOut,
  Scissors,
  Settings,
  Share2,
  Star,
  Users,
} from 'lucide-react';
import { useProReviewsUnanswered, useProSalon, useProSalonMutations, useUnreadNotifications } from '@salondz/api-client';
import { DAY_LABELS_FR, dayOfWeekFromKey, toLocalDateKey } from '@salondz/constants';
import { uploadSalonPhoto } from '@/lib/upload';
import { useSignOut } from '@/lib/auth';
import { errorText } from '@/components/ErrorMessage';
import { Avatar, Badge, Button, I, PageHead, SettingRow } from '@/components/ui';
import { BrandFooter } from '@/components/BrandFooter';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { PageLoading } from '@/components/PageLoading';
import { ShareSheet, usePublicUrl } from './Link';
import { ImageCropper } from '@/components/ImageCropper';
import { env } from '@/lib/env';
import { openExternal } from '@/lib/openExternal';
import { t } from '@/i18n';

/** Compteur d'une ligne (avis sans réponse, notifications non lues) : abricot, chiffre noir, puis le chevron. */
function Count({ n }: { n: number }) {
  return (
    <span className="flex flex-none items-center gap-2">
      {n > 0 && <span className="pf-n">{n > 9 ? '9+' : n}</span>}
      <I icon={ChevronRight} size={18} className="text-disabled rtl:rotate-180" />
    </span>
  );
}

export function ProProfile() {
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const unanswered = useProReviewsUnanswered(!!salon).data?.count ?? 0;
  const unread = useUnreadNotifications(!!salon);
  const { seDeconnecter, enCours } = useSignOut();
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [crop, setCrop] = useState<File | null>(null);
  const logoInput = useRef<HTMLInputElement | null>(null);
  const { url, short } = usePublicUrl(salon?.slug ?? '');
  if (!salon) return <PageLoading />;
  const team = salon.staff.filter((m) => m.isActive).length > 1;
  const services = salon.services.filter((s) => s.isActive).length;
  const todayDow = dayOfWeekFromKey(toLocalDateKey());
  const todayHours = salon.openingHours.filter((h) => h.dayOfWeek === todayDow && !h.isClosed);

  const uploadLogo = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const u = await uploadSalonPhoto(salon.id, file);
      await updateSalon.mutateAsync({ logoUrl: u });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <PageHead title={t('Profil')} />

      {/* Le salon, tel que les clientes le voient */}
      <div className="crd !gap-4">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            className="relative flex-none"
            onClick={() => logoInput.current?.click()}
            aria-label={t('Changer la photo de profil')}
            disabled={busy}
          >
            <Avatar src={salon.logoUrl ?? salon.coverUrl} name={salon.name} size={72} />
            <span className="absolute -bottom-0.5 -end-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-ink text-white">
              {busy ? <span className="btn-spin" aria-hidden /> : <I icon={Camera} size={15} />}
            </span>
          </button>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block font-display text-[1.357rem] font-semibold leading-tight tracking-[-0.3px]">{salon.name}</span>
            <span className="block truncate text-[0.964rem] text-muted" dir="ltr">
              {short}
            </span>
          </span>
          <Badge tone={salon.isPublished ? 'ok' : 'pd'} md>
            {salon.isPublished ? t('En ligne') : t('Non publiée')}
          </Badge>
        </div>
        <input
          ref={logoInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setCrop(f);
            e.target.value = '';
          }}
        />
        <div className="g2">
          <Button variant="g" sm onClick={() => void openExternal(`${env.siteUrl}/s/${salon.slug}`)}>
            <I icon={Eye} size={18} /> {t('Aperçu')}
          </Button>
          <Button sm onClick={() => setSheet(true)}>
            <I icon={Share2} size={18} /> {t('Partager')}
          </Button>
        </div>
        {error && (
          <p className="text-[1rem] text-danger" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Ce qu'on gère au fil des semaines */}
      <nav className="lst" aria-label={t('Gérer mon activité')}>
        <SettingRow
          to="/pro/clients"
          icon={ContactRound}
          title={salon.genderTarget === 'women' ? t('Clientes') : t('Clients')}
          sub={t('Fiches, historique, notes')}
        />
        <SettingRow
          to="/pro/catalogue"
          icon={Scissors}
          title={t('Prestations')}
          sub={services === 1 ? t('1 prestation · prix, durée') : t('{n} prestations · prix, durée', { n: services })}
        />
        <SettingRow to="/pro/lien" icon={Link2} title={t('Ma page')} sub={t('Lien, code QR, étiquettes')} />
        <SettingRow
          to="/pro/avis"
          icon={Star}
          title={t('Avis')}
          sub={
            unanswered
              ? t('{n} sans réponse', { n: unanswered })
              : salon.genderTarget === 'women'
                ? t('Ce que disent vos clientes')
                : t('Ce que disent vos clients')
          }
          right={<Count n={unanswered} />}
        />
        <SettingRow to="/pro/chiffre-affaires" icon={ChartColumn} title={t("Chiffre d'affaires")} sub={t('Jour, semaine, mois')} />
        {team && <SettingRow to="/pro/equipe" icon={Users} title={t('Équipe')} sub={t('Membres, leurs horaires et prestations')} />}
      </nav>

      {/* Réglages et aide */}
      <nav className="lst" aria-label={t('Paramètres')}>
        <SettingRow
          to="/pro/profil/horaires"
          icon={Clock}
          title={t("Horaires d'ouverture")}
          sub={
            todayHours.length
              ? `${t('Aujourd’hui')} · ${todayHours.map((h) => `${h.opensAt.slice(0, 5)} – ${h.closesAt.slice(0, 5)}`).join(', ')}`
              : `${t(DAY_LABELS_FR[todayDow])} · ${t('Fermé')}`
          }
        />
        <SettingRow to="/pro/parametres" icon={Settings} title={t('Paramètres')} sub={t('Salon, fermetures, règles, compte')} />
        <SettingRow to="/pro/notifications" icon={Bell} title={t('Notifications')} right={<Count n={unread} />} />
        <SettingRow to="/aide" icon={CircleHelp} title={t('Aide')} />
      </nav>

      <div className="lst">
        <SettingRow
          onClick={() => void seDeconnecter()}
          icon={LogOut}
          title={enCours ? t('Déconnexion…') : t('Se déconnecter')}
          danger
          right={enCours ? <span className="btn-spin text-danger" aria-hidden /> : <span />}
        />
      </div>

      <BrandFooter />
      {crop && (
        <ImageCropper
          file={crop}
          aspect={1}
          round
          title={t('Recadrer le logo')}
          onCancel={() => setCrop(null)}
          onDone={(f) => {
            setCrop(null);
            void uploadLogo(f);
          }}
        />
      )}
      {sheet && <ShareSheet name={salon.name} url={url} short={short} logo={salon.logoUrl} onClose={() => setSheet(false)} />}
    </Screen>
  );
}
