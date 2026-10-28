/**
 * AUTH 16 / PRO-F 01 — Bienvenue professionnel. Refonte du 28 oct. 2026 : tout converge vers
 * L'ACCÈS (s'inscrire, se connecter).
 *
 *   1. un bandeau vivant : le mot qui change (« agenda », « page », « clientèle »…), un aperçu de
 *      l'agenda où une nouvelle réservation arrive en direct — on MONTRE ce que fait le produit ;
 *   2. LA CARTE D'ACCÈS, au centre du regard : bordure animée, deux grandes portes
 *      (« Créer mon espace » en encre, « Se connecter » en blanc), chacune avec son icône et sa
 *      phrase de trois mots. Connecté avec un compte client : une seule porte, « Ouvrir » ;
 *   3. quatre promesses et les quatre étapes, en icônes ;
 *   4. une BARRE D'ACCÈS collée en bas dès que la carte sort de l'écran : on ne cherche jamais
 *      comment entrer, où qu'on soit dans la page.
 *
 * Les animations sont en CSS (transform / opacity) et s'éteignent sous `prefers-reduced-motion`.
 * L'aperçu est dessiné avec les jetons de l'application, pas une capture : il ne vieillit pas.
 * Aucun chiffre inventé (nombre de salons, d'avis…) : rien que ce que le produit fait.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  ChevronLeft,
  Clock,
  LogIn,
  QrCode,
  Rocket,
  Store,
  Tag,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { writeAuthFlow } from '@/lib/authFlow';
import { useBack } from '@/lib/useBack';
import { useReveal } from '@/lib/reveal';
import { I, IconButton } from '@/components/ui';
import { Wordmark } from '@/components/Wordmark';
import { LangSwitch } from '@/components/LangSwitch';
import { HERO_PRO, HeroSlides } from '@/components/HeroSlides';
import { t } from '@/i18n';

/** Quatre promesses, deux à trois mots chacune : l'icône dit le reste. */
const PROMISES: { icon: LucideIcon; title: string }[] = [
  { icon: CalendarCheck, title: 'Réservations 24 h/24' },
  { icon: QrCode, title: 'Lien et QR code' },
  { icon: BellRing, title: 'Rappels automatiques' },
  { icon: Users, title: 'Fichier clients' },
];

/** Les quatre étapes, en un mot et une icône. */
const STEPS: { icon: LucideIcon; label: string }[] = [
  { icon: Store, label: 'Votre salon' },
  { icon: Tag, label: 'Vos prix' },
  { icon: Clock, label: 'Vos horaires' },
  { icon: Rocket, label: 'En ligne !' },
];

/** Les métiers servis, dans l'ordre où ils utilisent Salon DZ. */
const METIERS_PRO = ['Ongles', 'Cils et sourcils', 'Tatouage', 'Barbiers', 'Coiffure'];

/** Le mot qui tourne dans le titre : ce que Salon DZ met dans la poche du professionnel. */
const MOTS = ['Votre agenda', 'Votre page', 'Votre clientèle', 'Votre lien'];

/** L'aperçu de l'agenda : une journée type, couleurs des catégories. */
const PREVIEW: { time: string; name: string; service: string; tone: string }[] = [
  // Une cliente, un client : le produit sert les deux.
  { time: '09:30', name: 'Lina', service: 'Pose gel · 1 h', tone: 'nail' },
  { time: '11:00', name: 'Islam', service: 'Taille de barbe · 30 min', tone: 'barb' },
];

/** Le mot courant, qui change toutes les 2,4 s (immobile si l'on a demandé moins d'animations). */
function useMotTournant(): number {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % MOTS.length), 2400);
    return () => window.clearInterval(id);
  }, []);
  return i;
}

export function ProWelcome() {
  const navigate = useNavigate();
  const back = useBack('/profil');
  const { session } = useAuth();
  useReveal();
  const mot = useMotTournant();

  // La barre d'accès apparaît quand la carte d'accès n'est plus à l'écran.
  const carte = useRef<HTMLDivElement>(null);
  const [barre, setBarre] = useState(false);
  useEffect(() => {
    const el = carte.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => setBarre(!e!.isIntersecting && e!.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const start = () => {
    writeAuthFlow({ role: 'pro', next: '/pro' });
    navigate(session ? '/pro' : '/inscription?role=pro');
  };
  const login = '/connexion?role=pro';

  // La démonstration n'est plus proposée ici : elle s'ouvre depuis l'écran de connexion, en saisissant
  // une adresse de démonstration et le même mot de passe qu'elle.
  return (
    <div className="pwl rd flex h-app flex-col">
      {/* ------------------------------------------------------------ bandeau vivant */}
      <header className="pwl-hero">
        {/* Salons de femmes ET d'hommes : les photos alternent en fondu enchaîné. */}
        <HeroSlides className="pwl-photo" photos={HERO_PRO} />
        <span className="pwl-aurore" aria-hidden />
        <div className="pwl-bar">
          <div className="flex min-w-0 items-center gap-1.5">
            <IconButton lg aria-label={t('Retour')} onClick={back} className="pwl-ib">
              <I icon={ChevronLeft} className="rtl:-scale-x-100" />
            </IconButton>
            <span className="flex items-center gap-2">
              <Wordmark size={1.286} light />
              <span className="aph-pro">PRO</span>
            </span>
          </div>
          <LangSwitch />
        </div>

        <div className="pwl-copy">
          <p className="aph-k">
            <span className="aph-dot" aria-hidden /> {t('Espace professionnel')}
          </p>
          <h1 className="pwl-t">
            <span className="pwl-mot" aria-live="off">
              <span key={mot} className="pwl-mot-i">
                {t(MOTS[mot]!)}
              </span>
            </span>
            <br />
            {t('dans votre poche.')}
          </h1>
          <p className="pwl-sub">{t('Gratuit · Prêt en 5 min')}</p>
          {/* À qui s'adresse l'outil, d'un regard : les métiers qui l'utilisent le plus d'abord. */}
          <ul className="pwl-metiers" aria-label={t('Pour')}>
            {METIERS_PRO.map((m, i) => (
              <li key={m} style={{ ['--d' as string]: `${300 + i * 70}ms` }}>
                {t(m)}
              </li>
            ))}
          </ul>
        </div>
      </header>

      <main className="pwl-main">
        {/* ------------------------------------------------------------ LA carte d'accès */}
        <div ref={carte} className="pwl-acces">
          <div className="pwl-acces-in">
            <p className="pwl-acces-t">
              {session ? t('Votre espace pro') : t('Accédez à votre espace pro')}
            </p>
            <button type="button" className="pwl-porte ink" onClick={start}>
              <span className="pwl-porte-i">
                <I icon={session ? Store : UserPlus} size={22} />
              </span>
              <span className="min-w-0 flex-1 text-start">
                <span className="block text-[1.143rem] font-semibold">
                  {session ? t('Ouvrir mon espace pro') : t('Créer mon espace')}
                </span>
                <span className="block text-[0.857rem] opacity-70">
                  {session ? t('Vous êtes connecté') : t('Nouveau · Gratuit')}
                </span>
              </span>
              <I icon={ArrowRight} size={20} className="pwl-porte-a rtl:-scale-x-100" />
            </button>
            {!session && (
              <Link to={login} className="pwl-porte">
                <span className="pwl-porte-i">
                  <I icon={LogIn} size={21} />
                </span>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block text-[1.143rem] font-semibold">{t('Se connecter')}</span>
                  <span className="block text-[0.857rem] text-muted">
                    {t('J’ai déjà un compte')}
                  </span>
                </span>
                <I icon={ArrowRight} size={20} className="pwl-porte-a rtl:-scale-x-100" />
              </Link>
            )}
          </div>
        </div>

        {/* Aperçu vivant : la journée, puis une réservation qui ARRIVE. */}
        <div className="pwl-show" data-reveal>
          <div className="pwl-mock" aria-hidden>
            <div className="pwl-notif">
              <span className="pwl-notif-i">
                <I icon={BellRing} size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.857rem] font-semibold">
                  {t('Nouvelle réservation')}
                </span>
                <span className="block truncate text-[0.786rem] text-white/70">
                  {t('Yacine · Coupe + barbe · demain')}
                </span>
              </span>
              <span className="mono text-[0.857rem] font-semibold" dir="ltr">
                15:30
              </span>
            </div>
            <div className="pwl-mock-h">
              <span>{t('Aujourd’hui')}</span>
              <span className="pwl-live">
                <span className="pwl-live-d" /> {t('En direct')}
              </span>
            </div>
            {PREVIEW.map((r) => (
              <div
                key={r.time}
                className="pwl-mock-r"
                style={{ ['--tone' as string]: `var(--color-cat-${r.tone}-line)` }}
              >
                <span className="pwl-mock-time" dir="ltr">
                  {r.time}
                </span>
                <span className="pwl-mock-bar" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[1rem] font-semibold">{r.name}</span>
                  <span className="block truncate text-[0.857rem] text-muted">{t(r.service)}</span>
                </span>
                <span className="pwl-mock-ok" />
              </div>
            ))}
            <div
              className="pwl-mock-r pwl-mock-new"
              style={{ ['--tone' as string]: 'var(--color-cat-skin-line)' }}
            >
              <span className="pwl-mock-time" dir="ltr">
                15:30
              </span>
              <span className="pwl-mock-bar" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[1rem] font-semibold">Yacine</span>
                <span className="block truncate text-[0.857rem] text-muted">
                  {t('Coupe + barbe · 45 min')}
                </span>
              </span>
              <span className="pwl-mock-badge">{t('À valider')}</span>
            </div>
          </div>
        </div>

        <ul className="pwl-grid" aria-label={t('Pourquoi Salon DZ')}>
          {PROMISES.map((p, i) => (
            <li
              key={p.title}
              className="pwl-card"
              data-reveal
              style={{ ['--d' as string]: `${i * 70}ms` }}
            >
              <span className="pwl-card-i">
                <I icon={p.icon} size={20} />
              </span>
              <span className="text-[1rem] font-semibold leading-[1.25]">{t(p.title)}</span>
            </li>
          ))}
        </ul>

        {/* Les étapes : quatre icônes reliées, un mot sous chacune. */}
        <ol className="pwl-steps" aria-label={t('Comment ça marche')} data-reveal>
          {STEPS.map((st, i) => (
            <li key={st.label}>
              <span className="pwl-step-n">
                <I icon={st.icon} size={18} />
              </span>
              <span className="pwl-step-l">{t(st.label)}</span>
              <span className="sr-only">{i + 1}</span>
            </li>
          ))}
        </ol>
      </main>

      {/* ------------------------------------------------------------ barre d'accès collante */}
      <div className={`pwl-dock ${barre ? 'on' : ''}`} aria-hidden={!barre}>
        {!session && (
          <Link to={login} className="btn g" tabIndex={barre ? 0 : -1}>
            <I icon={LogIn} size={18} /> {t('Se connecter')}
          </Link>
        )}
        <button type="button" className="btn" onClick={start} tabIndex={barre ? 0 : -1}>
          <I icon={session ? Store : UserPlus} size={18} />{' '}
          {session ? t('Ouvrir') : t('Créer mon espace')}
        </button>
      </div>
    </div>
  );
}
