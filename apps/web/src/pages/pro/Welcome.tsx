/**
 * AUTH 16 / PRO-F 01 — Bienvenue professionnel. Refonte du 28 oct. 2026.
 *
 * Dans l'ordre : un bandeau d'encre (retour, marque PRO, promesse) avec un APERÇU de l'agenda tel
 * que le professionnel le verra — on montre le produit au lieu de le décrire ; LE CHOIX tout de
 * suite (créer mon espace / me connecter — ou « Ouvrir mon espace pro » si déjà connecté) ; les
 * avantages en mosaïque ; les quatre étapes en frise ; un dernier appel en bas de page, pour qui a
 * tout lu.
 *
 * L'aperçu est dessiné avec les jetons de l'application (couleurs de catégories, pastilles de
 * statut), pas une capture : il ne vieillit pas au premier changement d'interface. Décoratif,
 * donc masqué aux lecteurs d'écran. Aucun chiffre inventé (nombre de salons, d'avis…) : rien que
 * ce que le produit fait.
 */
import { useNavigate } from 'react-router';
import { ArrowRight, BellRing, CalendarCheck, ChevronLeft, Link2, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { DESIGN_IMAGES, writeAuthFlow } from '@/lib/authFlow';
import { useBack } from '@/lib/useBack';
import { Button, I, IconButton, LinkButton } from '@/components/ui';
import { Wordmark } from '@/components/Wordmark';
import { LangSwitch } from '@/components/LangSwitch';
import { t } from '@/i18n';

const PROMISES: { icon: LucideIcon; title: string; sub: string }[] = [
  { icon: CalendarCheck, title: 'Réservations en ligne 24 h/24', sub: 'Vos clients réservent seuls, même quand le salon est fermé.' },
  { icon: Link2, title: 'Votre page et votre lien', sub: 'À partager sur WhatsApp, Instagram et en vitrine avec le QR code.' },
  { icon: BellRing, title: 'Rappels automatiques', sub: 'Moins d’oublis, moins de créneaux perdus.' },
  { icon: Users, title: 'Votre clientèle en main', sub: 'Agenda par membre, fiches clients, historique et chiffre d’affaires.' },
];

const STEPS = ['Votre salon : nom, photo, adresse', 'Vos prestations et vos prix', 'Vos horaires et vos règles', 'Publiez et partagez votre lien'];

/** L'aperçu de l'agenda : trois rendez-vous d'une journée type, couleurs des catégories. */
const PREVIEW: { time: string; name: string; service: string; tone: string; pending?: boolean }[] = [
  { time: '09:30', name: 'Riad', service: 'Défrisage · 1 h', tone: 'hair' },
  { time: '11:00', name: 'Islam', service: 'Taille de barbe · 30 min', tone: 'barb' },
  { time: '15:30', name: 'Yacine', service: 'Coupe + barbe · 45 min', tone: 'skin', pending: true },
];

export function ProWelcome() {
  const navigate = useNavigate();
  const back = useBack('/profil');
  const { session } = useAuth();
  const start = () => {
    writeAuthFlow({ role: 'pro', next: '/pro' });
    navigate(session ? '/pro' : '/inscription?role=pro');
  };
  const cta = session ? t('Ouvrir mon espace pro') : t('Créer mon espace pro');

  // La démonstration n'est plus proposée ici : elle s'ouvre depuis l'écran de connexion, en saisissant
  // une adresse de démonstration et le même mot de passe qu'elle.
  return (
    <div className="pwl rd flex h-app flex-col">
      {/* ------------------------------------------------------------ bandeau */}
      <header className="pwl-hero">
        <img src={DESIGN_IMAGES.pro.src} alt="" className="pwl-photo" />
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
            {t('Votre agenda,')}
            <br />
            {t('votre page, votre lien.')}
          </h1>
          <p className="pwl-sub">{t('Gratuit · Sans engagement · Votre page prête en 5 minutes')}</p>
        </div>

        {/* Aperçu du produit : la journée telle qu'elle s'affiche dans l'application. */}
        <div className="pwl-mock" aria-hidden>
          <div className="pwl-mock-h">
            <span>{t('Aujourd’hui')}</span>
            <span className="pwl-mock-n">{t('{n} rendez-vous', { n: PREVIEW.length })}</span>
          </div>
          {PREVIEW.map((r) => (
            <div key={r.time} className="pwl-mock-r" style={{ ['--tone' as string]: `var(--color-cat-${r.tone}-line)` }}>
              <span className="pwl-mock-time" dir="ltr">{r.time}</span>
              <span className="pwl-mock-bar" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[1rem] font-semibold">{r.name}</span>
                <span className="block truncate text-[0.857rem] text-muted">{t(r.service)}</span>
              </span>
              {r.pending ? (
                <span className="pwl-mock-badge">{t('À valider')}</span>
              ) : (
                <span className="pwl-mock-ok" />
              )}
            </div>
          ))}
        </div>
        <span className="pwl-credit">{DESIGN_IMAGES.pro.credit}</span>
      </header>

      {/* ------------------------------------------------------------ le choix */}
      <main className="pwl-main">
        <div className="flex flex-col gap-2.5">
          <Button onClick={start}>
            {cta} <I icon={ArrowRight} size={18} className="rtl:-scale-x-100" />
          </Button>
          {!session && (
            <LinkButton to="/connexion?role=pro" variant="g">
              {t('J’ai déjà un compte · Se connecter')}
            </LinkButton>
          )}
        </div>

        <section className="flex flex-col gap-3" aria-labelledby="pwl-why">
          <h2 id="pwl-why" className="h3">{t('Pourquoi Salon DZ')}</h2>
          <ul className="pwl-grid">
            {PROMISES.map((p, i) => (
              <li key={p.title} className={`pwl-card ${i === 0 ? 'ink' : ''}`}>
                <span className="pwl-card-i">
                  <I icon={p.icon} size={20} />
                </span>
                <span className="block text-[1.143rem] font-semibold leading-[1.25] tracking-[-0.2px]">{t(p.title)}</span>
                <span className="pwl-card-s">{t(p.sub)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="pwl-how">
          <h2 id="pwl-how" className="h3">{t('Comment ça marche')}</h2>
          <ol className="pwl-steps">
            {STEPS.map((s, i) => (
              <li key={s}>
                <span className="pwl-step-n mono">{i + 1}</span>
                <span className="text-[1.143rem] font-medium">{t(s)}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Pour qui a tout lu : la décision, sans remonter. */}
        <section className="pwl-end">
          <p className="text-[1.429rem] font-semibold leading-[1.2] tracking-[-0.4px]">{t('Prêt à remplir votre agenda ?')}</p>
          <p className="text-[1rem] text-white/65">{t('Votre page est en ligne dès la dernière étape.')}</p>
          <button type="button" className="btn pwl-end-btn" onClick={start}>
            {cta} <I icon={ArrowRight} size={18} className="rtl:-scale-x-100" />
          </button>
        </section>
      </main>
    </div>
  );
}
