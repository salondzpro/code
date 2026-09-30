/**
 * `/home` — page de PRÉSENTATION de Salon DZ, et page d'accueil du site.
 *
 * RÈGLE DE CONTENU : des BÉNÉFICES, pas de la prose. Chaque carte tient en un titre court et une
 * ligne, et ne décrit que ce qui existe VRAIMENT (lien à partager, QR code, confirmation
 * automatique ou manuelle, agenda par membre, fichier clients, avis, chiffre d'affaires,
 * fermetures). Une promesse qu'on ne tient pas coûte plus cher qu'une case vide.
 *
 * Elle est délibérément HORS du cadre d'application (`AppFrame`) : celui-ci borne la largeur à la
 * colonne du téléphone, ce qui convient aux écrans de travail mais pas à une page qui doit
 * respirer sur un grand écran. Les marges système restent assurées par `#root`.
 *
 * Les photos sont celles de la démonstration (`/demo/*.webp`) : de VRAIES photos de métier, déjà
 * dans le projet, déjà optimisées en WebP. Aucune image nouvelle, aucun poids ajouté au reste de
 * l'application — cette page est chargée à la demande.
 *
 * Les animations n'utilisent AUCUNE bibliothèque : un seul `IntersectionObserver` (`lib/reveal.ts`)
 * et des transitions CSS sur `opacity` / `transform`, les deux seules propriétés qu'un navigateur
 * anime sans refaire la mise en page. `prefers-reduced-motion` est respecté.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  CalendarDays,
  CalendarOff,
  CheckCheck,
  MapPin,
  QrCode,
  Share2,
  Sparkles,
  Star,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useReveal } from '@/lib/reveal';
import { Wordmark } from '@/components/Wordmark';
import { I } from '@/components/ui';
import { t } from '@/i18n';

const img = (cle: string) => `/demo/${cle}.webp`;

/** Les métiers servis. L'ORDRE compte : sur quatre colonnes, chaque rangée doit faire 4 (2+1+1). */
const METIERS: { nom: string; detail: string; photo: string; large?: boolean }[] = [
  { nom: 'Coiffeurs', detail: 'Coupe, dégradé, brushing', photo: 'h-coupe', large: true },
  { nom: 'Barbiers', detail: 'Barbe, traçage, serviette chaude', photo: 'h-barbe' },
  { nom: 'Ongleristes', detail: 'Manucure, pose gel, nail art', photo: 'f-pose-gel' },
  { nom: 'Coiffeuses', detail: 'Coupe, couleur, balayage, lissage', photo: 'f-balayage', large: true },
  { nom: 'Esthéticiennes', detail: 'Soins du visage, épilation', photo: 'f-nettoyage-peau' },
  { nom: 'Cils et sourcils', detail: 'Extensions, rehaussement, teinture', photo: 'f-extension-cils' },
  { nom: 'Instituts de beauté', detail: 'Toute une équipe, un seul rendez-vous', photo: 'cover-femmes', large: true },
  { nom: 'Coiffure événement', detail: 'Mariage, chignon, mise en beauté', photo: 'f-chignon-mariee', large: true },
];

/** Côté professionnel. Chaque ligne correspond à un écran qui existe. */
const PRO: { icone: LucideIcon; titre: string; texte: string }[] = [
  { icone: Share2, titre: 'Votre lien à partager', texte: 'Instagram, WhatsApp, Snap : on réserve en un tap.' },
  { icone: QrCode, titre: 'Votre QR code', texte: 'Sur la vitrine, le miroir, la carte de visite.' },
  { icone: CheckCheck, titre: 'Confirmation auto ou manuelle', texte: 'Vous validez chaque demande, ou tout passe seul.' },
  { icone: CalendarDays, titre: 'Agenda par membre', texte: 'Toute l’équipe, heure par heure, sur un écran.' },
  { icone: Users, titre: 'Fichier clients', texte: 'Historique, notes, numéro. Vous savez qui revient.' },
  { icone: Star, titre: 'Plus d’avis', texte: 'Chaque client est invité à noter après son passage.' },
  { icone: Wallet, titre: 'Chiffre d’affaires', texte: 'Ce que rapporte la journée, la semaine, le mois.' },
  { icone: CalendarOff, titre: 'Fermetures', texte: 'Congés, fêtes : plus personne ne réserve ces jours-là.' },
];

/** Côté client. */
const CLIENT: { icone: LucideIcon; titre: string; texte: string }[] = [
  { icone: MapPin, titre: 'Les salons autour de vous', texte: 'Avec les créneaux libres du jour.' },
  { icone: CalendarCheck, titre: 'Réservation en trois taps', texte: 'Prestation, jour, heure. Prix en dinars.' },
  { icone: BellRing, titre: 'Rappels automatiques', texte: 'La veille, et deux heures avant.' },
  { icone: Sparkles, titre: 'Alerte créneau libre', texte: 'On vous prévient si une place se libère.' },
];

/** L'histoire, en trois lignes. Elle situe la plateforme ; elle ne raconte pas sa vie. */
const HISTOIRE: { date: string; texte: string }[] = [
  { date: 'Avant', texte: 'On appelait, parfois plusieurs fois. Le salon notait sur un carnet.' },
  { date: 'L’idée', texte: 'Des disponibilités réelles, des prix en dinars, les horaires d’ici.' },
  { date: 'Aujourd’hui', texte: 'Le site et les applications Android et iPhone, en trois langues.' },
];

/** Section pleine largeur, avec une colonne de lecture centrée. */
function Section({ children, sombre = false }: { children: ReactNode; sombre?: boolean }) {
  return (
    <section className={sombre ? 'bg-ink text-white' : 'bg-bg'}>
      <div className="mx-auto w-full max-w-[72rem] px-5 py-14 sm:px-8 sm:py-16">{children}</div>
    </section>
  );
}

function Titre({ sur, children, sombre = false }: { sur: string; children: ReactNode; sombre?: boolean }) {
  return (
    <>
      <p data-reveal className={`h3 ${sombre ? '!text-white/50' : ''}`}>
        {t(sur)}
      </p>
      <h2
        data-reveal
        style={{ ['--d' as string]: '80ms' }}
        className="mt-3 max-w-[22ch] text-[1.714rem] font-semibold leading-[1.12] tracking-[-0.8px] sm:text-[2.286rem]"
      >
        {children}
      </h2>
    </>
  );
}

/** Carte « bénéfice » : une icône, un titre court, une ligne. Rien d'autre. */
function Atout({
  icone,
  titre,
  texte,
  sombre = false,
  delai = 0,
}: {
  icone: LucideIcon;
  titre: string;
  texte: string;
  sombre?: boolean;
  delai?: number;
}) {
  return (
    <div
      data-reveal
      style={{ ['--d' as string]: `${delai}ms` }}
      className={`group flex flex-col gap-2.5 rounded-[var(--radius-card)] border p-4 transition-colors duration-300 ${
        sombre ? 'border-white/10 bg-white/[0.04] hover:border-white/25' : 'border-line bg-surface hover:border-ink/30'
      }`}
    >
      <span
        className={`flex size-10 items-center justify-center rounded-[var(--radius-card-sm)] transition-transform duration-300 group-hover:-translate-y-0.5 ${
          sombre ? 'bg-white/10' : 'bg-fill'
        }`}
      >
        <I icon={icone} size={20} strokeWidth={1.7} />
      </span>
      <h3 className="text-[1.071rem] font-semibold leading-tight tracking-[-0.2px]">{t(titre)}</h3>
      <p className={`text-[0.938rem] leading-[1.45] ${sombre ? 'text-white/60' : 'text-muted'}`}>{t(texte)}</p>
    </div>
  );
}

export function Home() {
  useReveal();

  return (
    <div className="bg-bg">
      {/* ------------------------------------------------------------------ Ouverture */}
      <header className="relative isolate flex min-h-[30rem] flex-col justify-end overflow-hidden text-white sm:min-h-[36rem]">
        <img
          src={img('cover-hommes')}
          alt=""
          className="hm-hero-img absolute inset-0 -z-10 h-full w-full object-cover"
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/75 to-ink/40" />

        <div className="mx-auto w-full max-w-[72rem] px-5 pb-14 pt-24 sm:px-8 sm:pb-16">
          <div className="hm-in mb-8" style={{ ['--d' as string]: '80ms' }}>
            <Wordmark size={1.714} light />
          </div>
          <h1
            className="hm-in max-w-[18ch] text-[2.286rem] font-bold leading-[1.05] tracking-[-1.4px] sm:text-[3.4rem]"
            style={{ ['--d' as string]: '200ms' }}
          >
            {t('La beauté se réserve')} <span className="text-[#e8dacb]">{t('en quelques secondes.')}</span>
          </h1>
          <p
            className="hm-in mt-4 max-w-[38ch] text-[1.143rem] leading-[1.45] text-white/75 sm:text-[1.286rem]"
            style={{ ['--d' as string]: '340ms' }}
          >
            {t('Coiffure, barbier, onglerie, esthétique. Partout en Algérie, en dinars, sans appeler.')}
          </p>
          <div className="hm-in mt-8 flex flex-wrap gap-3" style={{ ['--d' as string]: '480ms' }}>
            <Link
              to="/intro"
              className="inline-flex items-center gap-2 rounded-[var(--radius-btn)] bg-white px-6 py-3.5 font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              {t('Réserver')} <I icon={ArrowRight} size={18} />
            </Link>
            <Link
              to="/pro/bienvenue"
              className="inline-flex items-center gap-2 rounded-[var(--radius-btn)] border border-white/35 px-6 py-3.5 font-semibold text-white transition-colors duration-200 hover:bg-white/10"
            >
              <I icon={Store} size={18} /> {t('Je suis professionnel')}
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ Les métiers */}
      <Section sombre>
        <Titre sur="Les professionnels" sombre>
          {t('Tous les métiers de la beauté, au même endroit.')}
        </Titre>
        <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {METIERS.map((m, i) => (
            <Link
              key={m.nom}
              to="/intro"
              data-reveal
              style={{ ['--d' as string]: `${(i % 4) * 80}ms` }}
              className={`hm-cat ${m.large ? 'col-span-2 aspect-[16/10]' : 'aspect-[3/4] sm:aspect-auto sm:h-full'}`}
              aria-label={`${m.nom} — ${m.detail}`}
            >
              <img src={img(m.photo)} alt="" loading="lazy" decoding="async" />
              <span className="hm-cat-txt">
                <span className="block text-[1.143rem] font-semibold leading-tight">{t(m.nom)}</span>
                <span className="mt-0.5 block text-[0.875rem] text-white/70">{t(m.detail)}</span>
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------------ Pour les professionnels */}
      <Section>
        <Titre sur="Pour les professionnels">{t('Votre salon se remplit pendant que vous coiffez.')}</Titre>
        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRO.map((c, i) => (
            <Atout key={c.titre} {...c} delai={(i % 4) * 70} />
          ))}
        </div>
        <Link
          data-reveal
          to="/pro/bienvenue"
          className="mt-8 inline-flex items-center gap-2 rounded-[var(--radius-btn)] bg-ink px-6 py-3.5 font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
        >
          {t('Ouvrir mon espace pro — gratuit')} <I icon={ArrowRight} size={18} />
        </Link>
      </Section>

      {/* ------------------------------------------------------------------ Pour les clients */}
      <Section sombre>
        <Titre sur="Pour les clients" sombre>
          {t('Trouvez, réservez, on vous rappelle.')}
        </Titre>
        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CLIENT.map((c, i) => (
            <Atout key={c.titre} {...c} sombre delai={(i % 4) * 70} />
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------------ L'histoire, en trois lignes */}
      <Section>
        <Titre sur="Notre histoire">{t('D’un carnet de rendez-vous à une plateforme.')}</Titre>
        <div className="mt-9 grid gap-3 sm:grid-cols-3">
          {HISTOIRE.map((e, i) => (
            <div
              key={e.date}
              data-reveal
              style={{ ['--d' as string]: `${i * 90}ms` }}
              className="rounded-[var(--radius-card)] border border-line bg-surface p-4"
            >
              <p className="h3 !text-ink">{t(e.date)}</p>
              <p className="p mt-2">{t(e.texte)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------------ Pied */}
      <Section>
        <div data-reveal className="flex flex-col items-center gap-5 border-t border-line pt-12 text-center">
          <Wordmark size={1.714} />
          <p className="p max-w-[40ch]">{t('La réservation beauté en Algérie, sans avoir à appeler.')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/intro"
              className="inline-flex items-center gap-2 rounded-[var(--radius-btn)] bg-ink px-6 py-3.5 font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              {t('Réserver')} <I icon={ArrowRight} size={18} />
            </Link>
            <Link
              to="/pro/bienvenue"
              className="inline-flex items-center gap-2 rounded-[var(--radius-btn)] border border-line px-6 py-3.5 font-semibold transition-colors duration-200 hover:border-ink"
            >
              <I icon={Store} size={18} /> {t('Espace professionnel')}
            </Link>
          </div>
          <nav className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[0.875rem] text-muted">
            <Link to="/cgu">{t('CGU')}</Link>
            <Link to="/confidentialite">{t('Confidentialité')}</Link>
            <Link to="/mentions-legales">{t('Mentions légales')}</Link>
            <Link to="/aide">{t('Aide')}</Link>
          </nav>
        </div>
      </Section>
    </div>
  );
}
