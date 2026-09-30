/**
 * `/home` — page de PRÉSENTATION de Salon DZ : ce qu'est la plateforme, d'où elle vient, à qui
 * elle s'adresse. C'est la page qu'on envoie à un professionnel qui hésite, ou à quelqu'un qui
 * découvre le service ailleurs que dans l'application.
 *
 * Elle est délibérément HORS du cadre d'application (`AppFrame`) : celui-ci borne la largeur à la
 * colonne du téléphone, ce qui convient aux écrans de travail mais pas à une page qui doit
 * respirer sur un grand écran. Les marges système restent assurées par `#root`.
 *
 * Les photos sont celles de la démonstration (`/demo/*.webp`) : de VRAIES photos de métier, déjà
 * dans le projet, déjà optimisées en WebP. Aucune image nouvelle à télécharger, aucun poids ajouté
 * au reste de l'application — cette page est chargée à la demande comme les autres.
 *
 * Les animations n'utilisent AUCUNE bibliothèque : un seul `IntersectionObserver` (`lib/reveal.ts`)
 * et des transitions CSS sur `opacity` / `transform`, les deux seules propriétés qu'un navigateur
 * anime sans refaire la mise en page. `prefers-reduced-motion` est respecté.
 */
import { Link } from 'react-router';
import { ArrowRight, CalendarCheck, CalendarDays, MapPin, Search, Sparkles, Store, Wallet } from 'lucide-react';
import { useReveal } from '@/lib/reveal';
import { Wordmark } from '@/components/Wordmark';
import { I } from '@/components/ui';
import { t } from '@/i18n';

const img = (cle: string) => `/demo/${cle}.webp`;

/** Les métiers que la plateforme sert, chacun avec une photo de son geste. */
const METIERS: { nom: string; detail: string; photo: string; large?: boolean }[] = [
  // L'ORDRE compte : sur quatre colonnes, chaque rangée doit faire exactement 4 (2+1+1, 2+1+1,
  // 2+2). Une somme qui ne tombe pas juste laisse un trou au milieu de la grille.
  { nom: 'Coiffeurs', detail: 'Coupe, dégradé, brushing', photo: 'h-coupe', large: true },
  { nom: 'Barbiers', detail: 'Barbe, traçage, serviette chaude', photo: 'h-barbe' },
  { nom: 'Ongleristes', detail: 'Manucure, pose gel, nail art', photo: 'f-pose-gel' },
  { nom: 'Coiffeuses', detail: 'Coupe, couleur, balayage, lissage', photo: 'f-balayage', large: true },
  { nom: 'Esthéticiennes', detail: 'Soins du visage, épilation', photo: 'f-nettoyage-peau' },
  { nom: 'Cils et sourcils', detail: 'Extensions, rehaussement, teinture', photo: 'f-extension-cils' },
  { nom: 'Instituts de beauté', detail: 'Toute une équipe, un seul rendez-vous', photo: 'cover-femmes', large: true },
  { nom: 'Coiffure événement', detail: 'Mariage, chignon, mise en beauté', photo: 'f-chignon-mariee', large: true },
];

/** L'histoire de la plateforme, dans l'ordre où elle s'est faite. */
const HISTOIRE = [
  {
    date: 'Le constat',
    titre: 'Réserver, c’était appeler',
    texte:
      'En Algérie, prendre rendez-vous chez un coiffeur ou dans un institut passait par un appel, un message, parfois plusieurs. Le salon notait sur un carnet, et personne ne savait vraiment ce qui était libre.',
  },
  {
    date: 'La décision',
    titre: 'Une plateforme pensée ici',
    texte:
      'Salon DZ est née de ce constat : des disponibilités réelles, des prix en dinars, des horaires algériens, la semaine qui commence le dimanche. Pas un service étranger traduit à la hâte.',
  },
  {
    date: 'Le métier d’abord',
    titre: 'Construite avec les professionnels',
    texte:
      'Agenda par membre d’équipe, demandes à confirmer, fermetures, règles d’annulation, fiche client, chiffre d’affaires. Chaque écran répond à une contrainte réelle de salon, pas à une idée de tableau de bord.',
  },
  {
    date: 'Aujourd’hui',
    titre: 'Sur le web et dans la poche',
    texte:
      'Le site et les applications Android et iPhone partagent exactement la même base : ce qui est livré en ligne l’est aussi sur le téléphone, en français, en arabe et en anglais.',
  },
] as const;

const ETAPES = [
  { icone: Search, titre: 'Trouvez', texte: 'Les salons autour de vous, avec leurs disponibilités du jour.' },
  { icone: CalendarCheck, titre: 'Réservez', texte: 'La prestation, le jour, l’heure. En quelques secondes, sans appeler.' },
  { icone: Sparkles, titre: 'Venez', texte: 'Confirmation du salon, rappel la veille et deux heures avant.' },
] as const;

const POUR_LES_PROS = [
  { icone: CalendarDays, titre: 'Votre agenda', texte: 'Par membre d’équipe, heure par heure, avec les demandes à confirmer.' },
  { icone: MapPin, titre: 'Votre page', texte: 'Une adresse publique, un lien et un QR code à partager avec vos clients.' },
  { icone: Wallet, titre: 'Vos chiffres', texte: 'Fiche client, historique, chiffre d’affaires. Paiement sur place, rien à encaisser ici.' },
] as const;

/** Section pleine largeur, avec une colonne de lecture centrée. */
function Section({ children, sombre = false }: { children: React.ReactNode; sombre?: boolean }) {
  return (
    <section className={sombre ? 'bg-ink text-white' : 'bg-bg'}>
      <div className="mx-auto w-full max-w-[72rem] px-5 py-14 sm:px-8 sm:py-20">{children}</div>
    </section>
  );
}

export function Home() {
  useReveal();

  return (
    <div className="bg-bg">
      {/* ------------------------------------------------------------------ Ouverture */}
      <header className="relative isolate flex min-h-[32rem] flex-col justify-end overflow-hidden text-white sm:min-h-[38rem]">
        <img
          src={img('cover-hommes')}
          alt=""
          className="hm-hero-img absolute inset-0 -z-10 h-full w-full object-cover"
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/75 to-ink/40" />

        <div className="mx-auto w-full max-w-[72rem] px-5 pb-14 pt-24 sm:px-8 sm:pb-20">
          <div className="hm-in mb-8" style={{ ['--d' as string]: '80ms' }}>
            <Wordmark size={1.714} light />
          </div>
          <h1
            className="hm-in max-w-[20ch] text-[2.286rem] font-bold leading-[1.05] tracking-[-1.4px] sm:text-[3.4rem]"
            style={{ ['--d' as string]: '200ms' }}
          >
            {t('La beauté se réserve')}{' '}
            <span className="text-[#e8dacb]">{t('en quelques secondes.')}</span>
          </h1>
          <p
            className="hm-in mt-5 max-w-[46ch] text-[1.143rem] leading-[1.5] text-white/75 sm:text-[1.286rem]"
            style={{ ['--d' as string]: '340ms' }}
          >
            {t('Salon DZ est la plateforme algérienne de réservation beauté : coiffure, barbier, onglerie, esthétique. Des disponibilités réelles, des prix en dinars, partout en Algérie.')}
          </p>
          <div className="hm-in mt-9 flex flex-wrap gap-3" style={{ ['--d' as string]: '480ms' }}>
            <Link
              to="/intro"
              className="inline-flex items-center gap-2 rounded-[var(--radius-btn)] bg-white px-6 py-3.5 font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              {t('Réserver un rendez-vous')} <I icon={ArrowRight} size={18} />
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

      {/* ------------------------------------------------------------------ Positionnement */}
      <Section>
        <p data-reveal className="h3">
          {t('La plateforme')}
        </p>
        <h2
          data-reveal
          style={{ ['--d' as string]: '80ms' }}
          className="mt-3 max-w-[24ch] text-[1.714rem] font-semibold leading-[1.15] tracking-[-0.8px] sm:text-[2.286rem]"
        >
          {t('Pensée pour l’Algérie, pas traduite depuis ailleurs.')}
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { titre: 'Les prix en dinars', texte: 'Aucune conversion, aucun euro. Le prix affiché est celui du salon.' },
            { titre: 'Les horaires d’ici', texte: 'Fuseau d’Alger, semaine du dimanche au samedi, jours de fermeture du salon.' },
            { titre: 'Trois langues', texte: 'Français, arabe et anglais — l’arabe avec une mise en page de droite à gauche.' },
          ].map((c, i) => (
            <div key={c.titre} data-reveal style={{ ['--d' as string]: `${i * 90}ms` }} className="crd">
              <h3 className="h2">{t(c.titre)}</h3>
              <p className="p">{t(c.texte)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------------ Les métiers */}
      <Section sombre>
        <p data-reveal className="h3 !text-white/50">
          {t('Les professionnels')}
        </p>
        <h2
          data-reveal
          style={{ ['--d' as string]: '80ms' }}
          className="mt-3 max-w-[26ch] text-[1.714rem] font-semibold leading-[1.15] tracking-[-0.8px] sm:text-[2.286rem]"
        >
          {t('Tous les métiers de la beauté, au même endroit.')}
        </h2>
        <p data-reveal style={{ ['--d' as string]: '160ms' }} className="mt-4 max-w-[54ch] text-[1.071rem] leading-[1.55] text-white/65">
          {t('Un salon d’un fauteuil comme un institut de dix personnes : la plateforme s’adapte à l’équipe, au catalogue et aux règles de chacun.')}
        </p>

        {/* Grille irrégulière : certaines cartes prennent deux colonnes, ce qui casse l'effet
            catalogue et guide le regard. Sur téléphone, tout retombe sur une colonne. */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {METIERS.map((m, i) => (
            <Link
              key={m.nom}
              to="/intro"
              data-reveal
              style={{ ['--d' as string]: `${(i % 4) * 80}ms` }}
              // C'est la carte LARGE qui donne sa hauteur à la rangée ; les petites la remplissent
              // (`h-full`). L'inverse — un rapport fixe sur chacune — laissait du vide sous les
              // petites, les deux tailles ne tombant jamais juste.
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

      {/* ------------------------------------------------------------------ L'histoire */}
      <Section>
        <p data-reveal className="h3">
          {t('Notre histoire')}
        </p>
        <h2
          data-reveal
          style={{ ['--d' as string]: '80ms' }}
          className="mt-3 max-w-[22ch] text-[1.714rem] font-semibold leading-[1.15] tracking-[-0.8px] sm:text-[2.286rem]"
        >
          {t('D’un carnet de rendez-vous à une plateforme.')}
        </h2>

        <div className="hm-fil mt-10 flex flex-col gap-8 sm:gap-10">
          {HISTOIRE.map((e, i) => (
            <div key={e.titre} data-reveal style={{ ['--d' as string]: `${i * 70}ms` }} className="hm-etape relative">
              <p className="h3 !text-ink">{t(e.date)}</p>
              <h3 className="mt-1.5 text-[1.286rem] font-semibold tracking-[-0.4px] sm:text-[1.5rem]">{t(e.titre)}</h3>
              <p className="p mt-2 max-w-[62ch]">{t(e.texte)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------------ Comment ça marche */}
      <Section>
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-10">
          <p data-reveal className="h3">
            {t('Côté client')}
          </p>
          <h2 data-reveal style={{ ['--d' as string]: '80ms' }} className="mt-3 text-[1.714rem] font-semibold tracking-[-0.8px]">
            {t('Trois gestes, et c’est réservé.')}
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3 sm:gap-8">
            {ETAPES.map((e, i) => (
              <div key={e.titre} data-reveal style={{ ['--d' as string]: `${i * 110}ms` }}>
                <span className="flex size-12 items-center justify-center rounded-full bg-ink text-white">
                  <I icon={e.icone} size={22} strokeWidth={1.7} />
                </span>
                <h3 className="mt-4 text-[1.286rem] font-semibold tracking-[-0.3px]">
                  <span className="text-muted">{i + 1}. </span>
                  {t(e.titre)}
                </h3>
                <p className="p mt-1.5">{t(e.texte)}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ Pour les professionnels */}
      <Section sombre>
        <div className="grid items-start gap-10 sm:grid-cols-2 sm:gap-16">
          <div>
            <p data-reveal className="h3 !text-white/50">
              {t('Côté professionnel')}
            </p>
            <h2
              data-reveal
              style={{ ['--d' as string]: '80ms' }}
              className="mt-3 text-[1.714rem] font-semibold leading-[1.15] tracking-[-0.8px] sm:text-[2.286rem]"
            >
              {t('Votre salon tient dans votre poche.')}
            </h2>
            <p data-reveal style={{ ['--d' as string]: '160ms' }} className="mt-4 max-w-[48ch] text-[1.071rem] leading-[1.55] text-white/65">
              {t('L’inscription est gratuite et prend quelques minutes. Vous gardez la main sur vos horaires, vos prix et vos règles d’annulation.')}
            </p>
            <Link
              data-reveal
              style={{ ['--d' as string]: '240ms' }}
              to="/pro/bienvenue"
              className="mt-8 inline-flex items-center gap-2 rounded-[var(--radius-btn)] bg-white px-6 py-3.5 font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              {t('Ouvrir mon espace professionnel')} <I icon={ArrowRight} size={18} />
            </Link>
          </div>
          <div className="flex flex-col gap-5">
            {POUR_LES_PROS.map((c, i) => (
              <div key={c.titre} data-reveal style={{ ['--d' as string]: `${i * 90}ms` }} className="flex gap-4">
                <span className="mt-0.5 flex size-10 flex-none items-center justify-center rounded-[var(--radius-card-sm)] bg-white/10">
                  <I icon={c.icone} size={20} strokeWidth={1.7} />
                </span>
                <div>
                  <h3 className="text-[1.143rem] font-semibold">{t(c.titre)}</h3>
                  <p className="mt-1 text-[1rem] leading-[1.5] text-white/60">{t(c.texte)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ Pied */}
      <Section>
        <div data-reveal className="flex flex-col items-center gap-5 text-center">
          <Wordmark size={1.714} />
          <p className="p max-w-[44ch]">{t('La réservation beauté en Algérie, sans avoir à appeler.')}</p>
          <Link
            to="/intro"
            className="inline-flex items-center gap-2 rounded-[var(--radius-btn)] bg-ink px-6 py-3.5 font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            {t('Commencer')} <I icon={ArrowRight} size={18} />
          </Link>
          <nav className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[0.875rem] text-muted">
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
