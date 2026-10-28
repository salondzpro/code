/**
 * `/home` — page de PRÉSENTATION de Salon DZ, et page d'accueil du site.
 *
 * RÈGLE DE CONTENU (resserrée le 28 oct. 2026) : MONTRER plutôt qu'expliquer. Des photos, des
 * icônes, des titres de deux ou trois mots ; une ligne au plus. Ancienne règle : des BÉNÉFICES, pas de la prose. Chaque carte tient en un titre court et une
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
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  CalendarDays,
  CheckCheck,
  MapPin,
  Share2,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { InstagramLogo, SnapchatLogo, TikTokLogo, WhatsAppLogo } from '@/components/BrandIcons';
import { useReveal } from '@/lib/reveal';
import { Wordmark } from '@/components/Wordmark';
import { ProPreview } from '@/components/AuthShell';
import { LangSwitch } from '@/components/LangSwitch';
import { HeroSlides } from '@/components/HeroSlides';
import { I } from '@/components/ui';
import { t } from '@/i18n';

const img = (cle: string) => `/demo/${cle}.webp`;

/** Les métiers servis. L'ORDRE compte : sur quatre colonnes, chaque rangée doit faire 4 (2+1+1). */
const METIERS: { nom: string; photo: string; large?: boolean }[] = [
  // Femmes et hommes MÊLÉS, une femme d'abord : la place de marché sert les deux.
  { nom: 'Coiffeuses', photo: 'f-balayage', large: true },
  { nom: 'Barbiers', photo: 'h-barbe' },
  { nom: 'Ongles', photo: 'f-pose-gel' },
  { nom: 'Coiffeurs', photo: 'h-coupe', large: true },
  { nom: 'Cils', photo: 'f-extension-cils' },
  { nom: 'Soins visage', photo: 'f-nettoyage-peau' },
  { nom: 'Mariage', photo: 'f-chignon-mariee', large: true },
  { nom: 'Instituts', photo: 'cover-femmes', large: true },
];

/**
 * Côté professionnel : QUATRE tuiles, un mot ou deux chacune (28 oct. 2026, « montrer plutôt
 * qu'expliquer »). Chaque tuile correspond à un écran qui existe.
 */
const PRO: { icone: LucideIcon; titre: string; marques?: boolean }[] = [
  { icone: Share2, titre: 'Votre lien partout', marques: true },
  { icone: CalendarDays, titre: 'Agenda d’équipe' },
  { icone: Users, titre: 'Fichier clients' },
  { icone: Wallet, titre: 'Chiffre d’affaires' },
];

/** Côté client : trois promesses, trois mots. Les rappels partent 1 h et 30 min avant. */
const CLIENT: { icone: LucideIcon; titre: string; texte: string }[] = [
  { icone: MapPin, titre: 'Autour de vous', texte: 'Créneaux libres du jour' },
  { icone: CalendarCheck, titre: 'En 3 taps', texte: 'Prix en dinars' },
  { icone: BellRing, titre: 'Rappel avant', texte: '1 h et 30 min avant' },
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

/** Tuile : une icône (ou les logos des réseaux), un titre de deux mots, au plus une ligne courte. */
function Tuile({
  icone,
  titre,
  texte,
  marques = false,
  sombre = false,
  delai = 0,
}: {
  icone: LucideIcon;
  titre: string;
  texte?: string;
  /** Les logos des réseaux à la place de l'icône : ils se comprennent avant d'être lus. */
  marques?: boolean;
  sombre?: boolean;
  delai?: number;
}) {
  return (
    <div
      data-reveal
      style={{ ['--d' as string]: `${delai}ms` }}
      className={`group flex min-w-0 flex-col items-start gap-3 rounded-[var(--radius-card)] border p-3 transition-colors sm:p-4 duration-300 ${
        sombre ? 'border-white/10 bg-white/[0.04] hover:border-white/25' : 'border-line bg-surface hover:border-ink/30'
      }`}
    >
      {marques ? (
        <span className="flex h-11 items-center gap-1.5">
          {[InstagramLogo, WhatsAppLogo, SnapchatLogo, TikTokLogo].map((Logo, i) => (
            <span key={i} className="transition-transform duration-300 group-hover:-translate-y-0.5" style={{ transitionDelay: `${i * 45}ms` }}>
              <Logo size={26} />
            </span>
          ))}
        </span>
      ) : (
        <span
          className={`flex size-11 items-center justify-center rounded-[var(--radius-card-sm)] transition-transform duration-300 group-hover:-translate-y-0.5 ${
            sombre ? 'bg-white/10' : 'bg-ink text-white'
          }`}
        >
          <I icon={icone} size={21} strokeWidth={1.8} />
        </span>
      )}
      <span>
        <span className="block text-[1.143rem] font-semibold leading-tight tracking-[-0.2px]">{t(titre)}</span>
        {texte && <span className={`mt-1 block text-[0.857rem] sm:text-[0.938rem] ${sombre ? 'text-white/60' : 'text-muted'}`}>{t(texte)}</span>}
      </span>
    </div>
  );
}

/** Le mot qui tourne dans le titre : les métiers qu'on réserve ici. */
const MOTS = ['Votre coiffeuse', 'Votre barbier', 'Votre onglerie', 'Votre coiffeur', 'Votre esthéticienne', 'Votre salon'];

function useMotTournant(): number {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % MOTS.length), 2200);
    return () => window.clearInterval(id);
  }, []);
  return i;
}

export function Home() {
  useReveal();
  const mot = useMotTournant();

  return (
    <div className="bg-bg">
      {/* ------------------------------------------------------------------ Ouverture */}
      <header className="relative isolate flex min-h-[32rem] flex-col justify-end overflow-hidden text-white sm:min-h-[38rem]">
        {/* Femmes ET hommes : les photos alternent en fondu enchaîné. */}
        <HeroSlides className="-z-10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/70 to-ink/30" />

        {/* Barre du haut : la marque, la langue, l'accès à son compte. */}
        <div className="hm-bar">
          <Wordmark size={1.429} light />
          <div className="flex items-center gap-2">
            <LangSwitch />
            <Link to="/intro" className="hm-bar-a">
              {t('Connexion')}
            </Link>
          </div>
        </div>
        {/* Deux pastilles qui flottent : ce que l'on reçoit après avoir réservé. */}
        <div className="hm-float" aria-hidden>
          <span className="hm-chip">
            <I icon={CheckCheck} size={16} className="text-[#3ddc97]" /> {t('Rendez-vous confirmé')}
          </span>
          <span className="hm-chip b">
            <I icon={BellRing} size={16} className="text-[#ffb877]" /> {t('Rappel 1 h avant')}
          </span>
        </div>

        <div className="mx-auto w-full max-w-[72rem] px-5 pb-14 pt-28 sm:px-8 sm:pb-16">
          <h1
            className="hm-in max-w-[16ch] text-[2.286rem] font-bold leading-[1.05] tracking-[-1.4px] sm:text-[3.4rem]"
            style={{ ['--d' as string]: '200ms' }}
          >
            {/* La phrase entière tourne (« Votre barbier ») : traduite d'un bloc, l'ordre des mots
                reste juste en arabe (« حلاقك »). */}
            <span className="hm-mot">
              <span key={mot} className="hm-mot-i">
                {t(MOTS[mot]!)}
              </span>
            </span>
            <br />
            <span className="text-[#e8dacb]">{t('en 3 taps.')}</span>
          </h1>
          <p className="hm-in mt-4 text-[1.143rem] text-white/75 sm:text-[1.286rem]" style={{ ['--d' as string]: '320ms' }}>
            {t('Partout en Algérie. Sans appeler.')}
          </p>
          <div className="hm-in mt-8 flex flex-wrap gap-3" style={{ ['--d' as string]: '440ms' }}>
            <Link
              to="/intro"
              className="inline-flex items-center gap-2 rounded-[var(--radius-btn)] bg-white px-6 py-3.5 font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              {t('Réserver')} <I icon={ArrowRight} size={18} className="rtl:-scale-x-100" />
            </Link>
            <Link
              to="/pro/bienvenue"
              className="inline-flex items-center gap-2 rounded-[var(--radius-btn)] border border-white/35 px-6 py-3.5 font-semibold text-white transition-colors duration-200 hover:bg-white/10"
            >
              <I icon={Store} size={18} /> {t('Je suis pro')}
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ Les métiers : des photos, un mot */}
      <Section sombre>
        <Titre sur="Les professionnels" sombre>
          {t('Toute la beauté, au même endroit.')}
        </Titre>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {METIERS.map((m, i) => (
            <Link
              key={m.nom}
              to="/intro"
              data-reveal
              style={{ ['--d' as string]: `${(i % 4) * 80}ms` }}
              className={`hm-cat ${m.large ? 'col-span-2 aspect-[16/10]' : 'aspect-[3/4] sm:aspect-auto sm:h-full'}`}
              aria-label={t(m.nom)}
            >
              <img src={img(m.photo)} alt="" loading="lazy" decoding="async" />
              <span className="hm-cat-txt">
                <span className="block text-[1.143rem] font-semibold leading-tight">{t(m.nom)}</span>
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------------ Pour les professionnels : on MONTRE */}
      <Section>
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <Titre sur="Pour les professionnels">{t('Votre salon se remplit pendant que vous coiffez.')}</Titre>
            <Link
              data-reveal
              to="/pro/bienvenue"
              className="mt-7 inline-flex items-center gap-2 rounded-[var(--radius-btn)] bg-ink px-6 py-3.5 font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              {t('Ouvrir mon espace pro — gratuit')} <I icon={ArrowRight} size={18} className="rtl:-scale-x-100" />
            </Link>
          </div>
          {/* L'aperçu : ce que le professionnel reçoit, dessiné avec les jetons de l'application. */}
          <div data-reveal className="hm-pro-show">
            <ProPreview />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {PRO.map((c, i) => (
            <Tuile key={c.titre} {...c} delai={(i % 4) * 70} />
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------------ Pour les clients */}
      <Section sombre>
        <Titre sur="Pour les clients" sombre>
          {t('Trouvez. Réservez. C’est tout.')}
        </Titre>
        <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-3">
          {CLIENT.map((c, i) => (
            <Tuile key={c.titre} {...c} sombre delai={(i % 3) * 70} />
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------------ Pied */}
      <Section>
        <div data-reveal className="flex flex-col items-center gap-5 text-center">
          <Wordmark size={1.714} />
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/intro"
              className="inline-flex items-center gap-2 rounded-[var(--radius-btn)] bg-ink px-6 py-3.5 font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              {t('Réserver')} <I icon={ArrowRight} size={18} className="rtl:-scale-x-100" />
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
