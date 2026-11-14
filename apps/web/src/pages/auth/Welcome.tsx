/**
 * OUVERTURE DE L'ESPACE CLIENT (14 nov. 2026) : le premier écran de l'application Salon DZ après
 * l'installation, et la porte du site pour une visiteuse. Même famille que l'ouverture pro
 * (`pages/pro/Welcome.tsx`, thème « minimal éditorial ») : photo très floutée qui dérive, halos de
 * lumière, « Bienvenue sur / Salon DZ », une phrase, UN bouton.
 *
 * Le libre accès (4 nov. 2026) reste : « Découvrir les salons » ouvre la place de marché sans
 * compte (aucune démonstration côté client), la connexion ne se demande qu'à la validation d'un créneau. Le professionnel a sa porte à
 * lui, un lien en bas. L'animation d'entrée (titre mot à mot, bouton qui monte, reflet) vit dans
 * les classes `.pwo-*` d'`index.css` et s'arrête sous `prefers-reduced-motion`.
 */
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '@/lib/auth';
import { writeAuthFlow } from '@/lib/authFlow';
import { HOME, PRO_ONLY } from '@/lib/flavor';
import { isNative } from '@/lib/native';
import { HERO_MIXTE, HeroSlides } from '@/components/HeroSlides';
import { LangSwitch } from '@/components/LangSwitch';
import { Wordmark } from '@/components/Wordmark';
import { I } from '@/components/ui';
import { ICONE } from '@/lib/actionIcons';
import { Store } from 'lucide-react';
import { t } from '@/i18n';

export function ClientWelcome() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ?? HOME;

  // L'application professionnelle n'a pas d'espace client : sa porte est la sienne.
  if (PRO_ONLY) return <Navigate to="/pro/bienvenue" replace />;
  // SUR LE WEB (14 nov. 2026, demande du propriétaire) : pas d'écran d'ouverture d'application.
  // Une destination à atteindre → directement l'adresse e-mail ; sinon → le site clients (`/home`).
  // Dans l'application, l'ouverture reste telle quelle, sans redirection.
  if (!isNative()) return <Navigate to={params.get('next') ? `/acces?next=${encodeURIComponent(next)}` : session ? next : '/home'} replace />;

  const commencer = () => {
    if (session) return navigate(next);
    writeAuthFlow({ role: 'client', next, identifier: '', channel: 'email' });
    navigate(`/acces?next=${encodeURIComponent(next)}`);
  };

  const mots = t('Salon DZ').split(' ');

  return (
    <div className="pwo pwo-anim h-app">
      <div className="pwo-ph" aria-hidden>
        <HeroSlides photos={HERO_MIXTE} intervalle={6000} />
      </div>
      <span className="pwo-aura" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="pwo-voile" aria-hidden />

      <header className="pwo-bar">
        <Wordmark size={1.143} light />
        <LangSwitch />
      </header>

      <main className="pwo-copy">
        <p className="pwo-k">{t('Bienvenue sur')}</p>
        <h1 className="pwo-t" aria-label="Salon DZ">
          {mots.map((m, i) => (
            <span key={i} className="pwo-mot" style={{ animationDelay: `${0.25 + i * 0.14}s` }} aria-hidden>
              {m}
            </span>
          ))}
        </h1>
        <p className="pwo-s">{t('Les meilleurs salons près de chez vous, réservés en quelques secondes.')}</p>
      </main>

      <footer className="pwo-bas">
        <button type="button" className="pa-btn pwo-cta" onClick={commencer}>
          <I icon={ICONE.continuer} size={18} className="rtl:-scale-x-100" />
          {session ? t('Ouvrir mon espace') : t('Commencer')}
        </button>
        {!session && (
          <Link to="/" className="pa-btn g pwo-sec">
            <I icon={ICONE.apercu} size={18} />
            {t('Découvrir les salons')}
          </Link>
        )}
        <Link to="/pro/bienvenue" className="pa-lien pwo-pro">
          <I icon={Store} size={16} /> {t('Vous êtes professionnel ?')}
        </Link>
        <p className="pa-note centre">
          {t('En continuant, vous acceptez les')} <Link to="/cgu">{t('conditions d’utilisation')}</Link> {t('et la')}{' '}
          <Link to="/confidentialite">{t('politique de confidentialité')}</Link>.
        </p>
      </footer>
    </div>
  );
}
