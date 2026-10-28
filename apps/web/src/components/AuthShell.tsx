/**
 * Coque commune à TOUS les écrans d'authentification : connexion, inscription, lien par e-mail,
 * mot de passe oublié, nouveau mot de passe, vérification, coordonnées.
 *
 * POURQUOI UNE COQUE : ces écrans partageaient une structure recopiée sept fois, qui divergeait à
 * chaque retouche. Ici, une seule définition : la marque, le retour, le titre, la colonne de
 * formulaire et le pied. TOUTE la densité de ces écrans se règle ici et dans `.auth-*`
 * (`styles/index.css`), jamais écran par écran.
 *
 * COMPACT ET IMMOBILE (refonte du 24 oct. 2026) :
 *   - le contenu est calé EN HAUT sur téléphone et tablette, plus centré verticalement. Centré, il
 *     sautait vers le haut à chaque ouverture du clavier (la zone visible rétrécit, le centre
 *     bouge) ; calé en haut, le champ touché ne bouge pas ;
 *   - un rythme vertical serré et unique : 4 px entre une étiquette et son champ, 12 px entre deux
 *     champs, 20 px entre le titre et le formulaire. L'écran de connexion tient avec le clavier
 *     ouvert sur un téléphone de 360 × 740 ;
 *   - les champs sont à 16 px : sous 16 px, iOS zoome la page au toucher d'un champ.
 *
 * DEUX VOLETS À PARTIR DE 1024 px. Le volet de gauche dit à QUI l'écran s'adresse : une cliente
 * qui réserve et un salon qui s'équipe n'ont pas les mêmes attentes. En dessous — donc dans
 * l'application mobile, toujours — une colonne unique avec un bandeau de marque compact.
 *
 * IDENTITÉ : noir, blanc, gris. La seule couleur est le ROSE de l'espace féminin (`--color-women`),
 * en touche discrète côté client (pastille du surtitre) ; l'espace professionnel reste monochrome.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { AlertCircle, BellRing, CalendarDays, CalendarCheck, Check, CheckCircle2, Eye, EyeOff, MapPin, Sparkles, Store, Wallet, XCircle, type LucideIcon } from 'lucide-react';
import { BackButton, Field, I, Input } from './ui';
import { Wordmark } from './Wordmark';
import { HeroSlides } from './HeroSlides';
import { LangSwitch } from './LangSwitch';
import { t } from '@/i18n';

export type AuthRole = 'client' | 'pro';

const VITRINE: Record<AuthRole, { titre: string; points: { icone: LucideIcon; texte: string }[] }> = {
  client: {
    titre: 'Votre salon, en deux gestes.',
    points: [
      { icone: MapPin, texte: 'Les salons autour de vous' },
      { icone: CalendarCheck, texte: 'Réservé en 3 taps' },
      { icone: Sparkles, texte: 'Rappel avant le rendez-vous' },
    ],
  },
  pro: {
    titre: 'Votre salon tient dans votre poche.',
    points: [
      { icone: CalendarDays, texte: 'Agenda d’équipe' },
      { icone: Store, texte: 'Votre page, votre lien' },
      { icone: Wallet, texte: 'Clients et chiffre d’affaires' },
    ],
  },
};

const ESPACE: Record<AuthRole, string> = { client: 'Espace client', pro: 'Espace professionnel' };

export function AuthShell({
  role = 'client',
  back,
  marque = true,
  etape,
  etapes,
  surtitre,
  icone,
  onglets,
  titre,
  sous,
  children,
  pied,
}: {
  role?: AuthRole;
  /** Écran parent. Absent : pas de bouton retour (première porte). */
  back?: string;
  /** Bandeau de marque en haut sur téléphone. Un écran d'étape s'en passe. */
  marque?: boolean;
  /** Parcours en plusieurs temps : où l'on en est, sur combien. */
  etape?: number;
  etapes?: number;
  /** Petite ligne au-dessus du titre. Par défaut, l'espace visé (« Espace client »). */
  surtitre?: string;
  /** Pictogramme posé au-dessus du titre (écrans de confirmation : « vérifiez vos e-mails »). */
  icone?: LucideIcon;
  /** Portail : onglets Connexion ⇄ Inscription (toucher ou glisser), avec l'adresse de chacun. */
  onglets?: { actif: OngletAuth; liens: Record<OngletAuth, string> };
  titre: string;
  sous?: ReactNode;
  children: ReactNode;
  /** Actions secondaires, séparées du formulaire par un trait. */
  pied?: ReactNode;
}) {
  const v = VITRINE[role];
  const etat = useLocation().state as { authSens?: 'suivant' | 'precedent'; authDe?: OngletAuth } | null;
  const glisse = useGlissement(onglets);
  // Arrivée par un changement d'onglet : le contenu entre du côté d'où l'on a tiré.
  const entree = onglets && etat?.authSens ? `auth-entre-${etat.authSens}` : '';
  // Espace PRO : la porte d'entrée a son bandeau d'encre (téléphone et tablette). Les écrans
  // d'étape (`marque={false}`) gardent la barre claire : on y est déjà entré.
  const heroPro = role === 'pro' && marque;

  return (
    <div className={`auth-shell ${heroPro ? 'auth-pro' : ''}`} data-role={role}>
      {/* ---------------------------------------------------------------- Volet de gauche (≥1024) */}
      <aside className="auth-vitrine" aria-hidden>
        <HeroSlides className="auth-vitrine-ph" />
        <Wordmark size={1.429} light />
        <div>
          <p className="auth-surtitre !text-white/70">
            <span className="auth-point" /> {t(ESPACE[role])}
          </p>
          <p className="mt-3 max-w-[16ch] text-[2.286rem] font-semibold leading-[1.1] tracking-[-1px]">{t(v.titre)}</p>
          {role === 'pro' && <ProPreview className="mt-6" />}
          <ul className="mt-6 flex flex-col gap-3">
            {v.points.map((p) => (
              <li key={p.texte} className="flex items-center gap-3 text-[1rem] leading-[1.4] text-white/80">
                <span className="flex size-8 flex-none items-center justify-center rounded-[var(--radius-card-sm)] bg-white/10">
                  <I icon={p.icone} size={17} strokeWidth={1.7} />
                </span>
                {t(p.texte)}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[0.857rem] text-white/45">{t('La réservation beauté en Algérie.')}</p>
      </aside>

      {/* ---------------------------------------------------------------- Colonne du formulaire */}
      {/* Le geste se fait n'importe où dans la colonne, y compris sous le formulaire : seul le
          contenu bouge. */}
      <div className="auth-col" {...glisse.handlers}>
        {/* Bandeau de marque : sur téléphone et tablette. Sur grand écran, le volet de gauche le
            porte déjà — le répéter ferait deux marques dans le même regard. */}
        {heroPro && <ProHero back={back} />}
        {!heroPro && (marque || back) && (
          <header className="auth-top">
            <div className="flex min-w-0 items-center gap-1">
              {back && <BackButton to={back} />}
              {marque && (
                <Link to="/home" aria-label="Salon DZ" className={back ? '' : 'ps-1'}>
                  <Wordmark size={1.286} />
                </Link>
              )}
            </div>
            {marque && <LangSwitch tone="light" />}
          </header>
        )}

        <main className="auth-form">
          {back && (
            <Link to={back} className="auth-retour">
              ← {t('Retour')}
            </Link>
          )}
          {/* Progression : on sait combien il reste AVANT de commencer à taper. */}
          {etape !== undefined && etapes !== undefined && (
            <div
              className="mb-4 flex gap-1"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={etapes}
              aria-valuenow={etape}
              aria-label={t('Étape {n} sur {total}', { n: etape, total: etapes })}
            >
              {Array.from({ length: etapes }, (_, i) => (
                <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < etape ? 'bg-ink' : 'bg-line'}`} />
              ))}
            </div>
          )}
          {icone && (
            <span className="auth-icone" aria-hidden>
              <I icon={icone} size={22} strokeWidth={1.7} />
            </span>
          )}
          {/* Avec le bandeau pro, l'espace est déjà nommé au-dessus : on ne le répète pas. */}
          <p className={`auth-surtitre ${heroPro && !surtitre ? 'auth-surtitre-hero' : ''}`}>
            <span className="auth-point" aria-hidden /> {t(surtitre ?? ESPACE[role])}
          </p>
          {onglets && <AuthOnglets actif={onglets.actif} liens={onglets.liens} de={etat?.authDe} />}
          <div ref={glisse.corps} className={`auth-glisse ${entree}`}>
            {/* Avec les onglets, le titre visible est l'onglet lui-même : le répéter en grand
                ferait deux fois « Connexion » l'un sous l'autre. Il reste pour les lecteurs d'écran. */}
            <h1 className={onglets ? 'sr-only' : 'auth-titre'}>{t(titre)}</h1>
            {sous && <p className={onglets ? 'auth-sous !mt-3' : 'auth-sous'}>{sous}</p>}
            <div className="auth-corps">{children}</div>
            {pied && <div className="auth-pied">{pied}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * BANDEAU DE LA PORTE PRO (28 oct. 2026). Sur téléphone, l'espace professionnel s'ouvrait sur le
 * même écran gris que l'espace client : rien ne disait « ici, on gère un salon ». Le bandeau d'encre
 * porte la marque, la promesse et un APERÇU du produit — la notification qu'un professionnel
 * reçoit quand on réserve chez lui. Le formulaire monte par-dessus comme une feuille.
 * Compact (≈ 15 rem) : l'écran de connexion tient toujours sur 360 × 740.
 */
function ProHero({ back }: { back?: string }) {
  return (
    <header className="aph">
      <div className="aph-bar">
        <div className="flex min-w-0 items-center gap-1">
          {back && (
            <span className="aph-back">
              <BackButton to={back} />
            </span>
          )}
          <Link to={PRO_HOME_LINK} aria-label="Salon DZ Pro" className={`flex items-center gap-2 ${back ? '' : 'ps-1'}`}>
            <Wordmark size={1.286} light />
            <span className="aph-pro">PRO</span>
          </Link>
        </div>
        <LangSwitch />
      </div>
      <div className="aph-body">
        <p className="aph-k">
          <span className="aph-dot" aria-hidden /> {t(ESPACE.pro)}
        </p>
        <p className="aph-t">{t(VITRINE.pro.titre)}</p>
      </div>
      <ProPreview compact />
    </header>
  );
}

const PRO_HOME_LINK = '/pro/bienvenue';

/**
 * Aperçu du produit : deux notifications empilées, telles que le professionnel les reçoit. Pas de
 * capture d'écran (elle vieillirait au premier changement d'interface) : des éléments dessinés avec
 * les mêmes jetons que l'application. Décoratif, donc masqué aux lecteurs d'écran.
 */
export function ProPreview({ compact, className = '' }: { compact?: boolean; className?: string }) {
  return (
    <div className={`apv ${compact ? 'compact' : ''} ${className}`} aria-hidden>
      <div className="apv-n">
        <span className="apv-i">
          <I icon={BellRing} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="apv-h">{t('Nouvelle réservation')}</span>
          <span className="apv-s">{t('Yacine · Coupe + barbe · demain')}</span>
        </span>
        <span className="apv-t" dir="ltr">15:30</span>
      </div>
      <div className="apv-n apv-2">
        <span className="apv-i ok">
          <I icon={Check} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="apv-h">{t('Rendez-vous confirmé')}</span>
          <span className="apv-s">{t('Lina · Pose gel · 1 h')}</span>
        </span>
        <span className="apv-t" dir="ltr">09:30</span>
      </div>
    </div>
  );
}

/**
 * CONNEXION ⇄ INSCRIPTION : deux onglets d'un même portail, et non deux portes reliées par un bouton
 * en bas de page (24 oct. 2026). Un sélecteur en tête dit d'emblée qu'il y a deux chemins et lequel
 * est ouvert ; on change d'un toucher, ou d'un GLISSEMENT du doigt sur le formulaire — le contenu
 * suit le doigt, puis l'autre onglet arrive du côté d'où l'on a tiré.
 *
 * Les deux restent des PAGES distinctes (`/intro` ou `/connexion?role=pro`, et `/inscription`) :
 * liens partagés, retour arrière et rechargement continuent de marcher. Le passage se fait en
 * remplaçant l'entrée d'historique, pour que « retour » ne fasse pas l'aller-retour entre onglets.
 *
 * En arabe, le sens de lecture s'inverse : « suivant » est à gauche, le glissement aussi.
 */
export type OngletAuth = 'connexion' | 'inscription';
type Sens = 'suivant' | 'precedent';

const ORDRE: OngletAuth[] = ['connexion', 'inscription'];

function useAllerA(onglets: { actif: OngletAuth; liens: Record<OngletAuth, string> }) {
  const navigate = useNavigate();
  return useCallback(
    (cible: OngletAuth) => {
      if (cible === onglets.actif) return;
      const sens: Sens = ORDRE.indexOf(cible) > ORDRE.indexOf(onglets.actif) ? 'suivant' : 'precedent';
      navigate(onglets.liens[cible], { replace: true, state: { authSens: sens, authDe: onglets.actif } });
    },
    [navigate, onglets],
  );
}

function AuthOnglets({ actif, liens, de }: { actif: OngletAuth; liens: Record<OngletAuth, string>; de?: OngletAuth }) {
  const allerA = useAllerA({ actif, liens });
  // La pastille part de l'onglet quitté et glisse jusqu'au nouveau : le changement se VOIT.
  const [pos, setPos] = useState<OngletAuth>(de ?? actif);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPos(actif));
    return () => cancelAnimationFrame(id);
  }, [actif]);
  return (
    <div className="auth-onglets" role="tablist" aria-label={t('Connexion ou inscription')} data-pos={pos}>
      <span className="auth-onglets-pastille" aria-hidden />
      {ORDRE.map((o) => (
        <button
          key={o}
          type="button"
          role="tab"
          aria-selected={o === actif}
          className={o === actif ? 'on' : ''}
          onClick={() => allerA(o)}
        >
          {o === 'connexion' ? t('Connexion') : t('Inscription')}
        </button>
      ))}
    </div>
  );
}

/**
 * Glissement horizontal sur le formulaire. Le contenu suit le doigt (avec résistance), et au-delà
 * d'un quart de largeur — ou d'un geste vif — on passe à l'autre onglet ; sinon il revient en place.
 * Ignoré quand le geste part du champ en cours de saisie (on y déplace le curseur) ou qu'il est
 * surtout vertical (on fait défiler la page).
 */
function useGlissement(onglets: { actif: OngletAuth; liens: Record<OngletAuth, string> } | undefined) {
  const corps = useRef<HTMLDivElement>(null);
  const allerA = useAllerA(onglets ?? { actif: 'connexion', liens: { connexion: '', inscription: '' } });
  const geste = useRef<{ x: number; y: number; t: number; horizontal: boolean | null } | null>(null);

  const poser = (dx: number, anime: boolean) => {
    const el = corps.current;
    if (!el) return;
    el.style.transition = anime ? 'transform 0.22s ease, opacity 0.22s ease' : 'none';
    el.style.transform = dx ? `translateX(${dx}px)` : '';
    el.style.opacity = dx ? String(Math.max(0.55, 1 - Math.abs(dx) / 600)) : '';
  };

  if (!onglets) return { corps, handlers: {} };

  const rtl = () => document.documentElement.dir === 'rtl';
  /** Onglet atteint en tirant vers la gauche (dx < 0) ou la droite. */
  const cibleDe = (dx: number): OngletAuth | null => {
    const versSuivant = rtl() ? dx > 0 : dx < 0;
    const i = ORDRE.indexOf(onglets.actif) + (versSuivant ? 1 : -1);
    return ORDRE[i] ?? null;
  };

  return {
    corps,
    handlers: {
      onTouchStart: (e: ReactTouchEvent) => {
        const cible = e.target as HTMLElement;
        // Un champ EN COURS de saisie garde ses gestes (sélection, curseur) ; un champ simplement
        // survolé par le doigt n'empêche pas de glisser — le formulaire d'inscription en est couvert.
        if (cible.closest('[role=tablist]')) return;
        if (cible.matches('input, textarea, select') && cible === document.activeElement) return;
        const p = e.touches[0]!;
        geste.current = { x: p.clientX, y: p.clientY, t: Date.now(), horizontal: null };
      },
      onTouchMove: (e: ReactTouchEvent) => {
        const g = geste.current;
        if (!g) return;
        const p = e.touches[0]!;
        const dx = p.clientX - g.x;
        const dy = p.clientY - g.y;
        if (g.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) g.horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
        if (!g.horizontal) return;
        // Pas d'onglet de ce côté : forte résistance, le geste « bute ».
        const amorti = cibleDe(dx) ? dx * 0.6 : dx * 0.15;
        poser(amorti, false);
      },
      onTouchEnd: (e: ReactTouchEvent) => {
        const g = geste.current;
        geste.current = null;
        if (!g?.horizontal) return;
        // Un glissement n'est pas un toucher : le bouton ou le lien sous le doigt ne s'active pas.
        if (e.cancelable) e.preventDefault();
        const p = e.changedTouches[0]!;
        const dx = p.clientX - g.x;
        const vif = Math.abs(dx) > 40 && Date.now() - g.t < 250;
        const largeur = corps.current?.offsetWidth ?? 360;
        const cible = cibleDe(dx);
        if (cible && (Math.abs(dx) > largeur / 4 || vif)) {
          poser(dx < 0 ? -largeur / 3 : largeur / 3, true);
          window.setTimeout(() => allerA(cible), 120);
        } else {
          poser(0, true);
        }
      },
      onTouchCancel: () => {
        geste.current = null;
        poser(0, true);
      },
    },
  };
}

/** « ou » entre deux façons de faire la même chose (se connecter par mot de passe ou par lien). */
export function AuthOu() {
  return (
    <div className="auth-ou" role="separator">
      <span>{t('ou')}</span>
    </div>
  );
}

/**
 * Champ de mot de passe avec bascule « afficher ». Il était recopié dans trois écrans, avec des
 * libellés d'accessibilité qui divergeaient — ici il n'existe qu'une fois.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  err,
  hint,
  action,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  err?: boolean;
  hint?: string;
  action?: ReactNode;
  autoFocus?: boolean;
}) {
  const [montre, setMontre] = useState(false);
  return (
    <Field label={label} htmlFor={id} hint={hint} action={action}>
      <div className="relative">
        <Input
          id={id}
          type={montre ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          err={err}
          className="!pe-12"
          autoFocus={autoFocus}
        />
        <button
          type="button"
          className="absolute end-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-[var(--radius-btn)] text-muted transition-colors hover:text-ink"
          aria-label={montre ? t('Masquer le mot de passe') : t('Afficher le mot de passe')}
          onClick={() => setMontre((v) => !v)}
        >
          <I icon={montre ? EyeOff : Eye} size={19} />
        </button>
      </div>
    </Field>
  );
}

/**
 * CONFIRMATION DU MOT DE PASSE. Le verdict s'affiche pendant la frappe, pas à l'envoi : découvrir
 * après coup qu'on s'est trompé oblige à tout recommencer, et c'est exactement le cas où l'on se
 * retrouve avec un compte dont on ignore le mot de passe.
 *
 * `etat` vaut `null` tant que la confirmation est vide — on n'annonce pas une erreur à quelqu'un
 * qui n'a pas encore fini de taper.
 */
export function matchState(mdp: string, confirmation: string): 'vide' | 'ok' | 'different' {
  if (!confirmation) return 'vide';
  return mdp === confirmation ? 'ok' : 'different';
}

export function MatchHint({ etat }: { etat: ReturnType<typeof matchState> }) {
  if (etat === 'vide') return null;
  const ok = etat === 'ok';
  return (
    <p
      className={`-mt-1 flex items-center gap-1.5 text-[0.857rem] font-medium ${ok ? 'text-ok-fg' : 'text-danger'}`}
      role={ok ? undefined : 'alert'}
      aria-live="polite"
    >
      <I icon={ok ? CheckCircle2 : XCircle} size={15} />
      {ok ? t('Les mots de passe correspondent.') : t('Les deux mots de passe ne correspondent pas.')}
    </p>
  );
}

/**
 * Erreur d'authentification : le message, et LA SUITE. Une erreur qui ne propose rien laisse la
 * personne devant un mur — « aucun compte » doit mener à la création, « mot de passe incorrect »
 * à la réinitialisation.
 */
export function AuthError({ texte, children }: { texte: string; children?: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex animate-[hm-monte_0.28s_ease-out] flex-col gap-2.5 rounded-[var(--radius-card)] border border-danger-line bg-cancel-bg px-3 py-2.5"
    >
      <p className="flex items-start gap-2 text-[0.938rem] leading-[1.4] text-cancel-fg">
        <I icon={AlertCircle} size={17} className="mt-px flex-none" />
        {texte}
      </p>
      {children}
    </div>
  );
}
