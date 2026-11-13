/**
 * OUVERTURE DE L'ESPACE PROFESSIONNEL (13 nov. 2026, maquette validée par le propriétaire,
 * « comme les grandes entreprises »). C'est le premier écran de l'application Salon DZ Pro après
 * l'installation, et la porte pro du site.
 *
 * Une photo de salon très floutée qui se fond dans le blanc cassé du thème, « Bienvenue sur /
 * Salon DZ Pro », une phrase, et UN bouton : « Commencer ». Le reste — se connecter ou créer son
 * espace — se décide sur l'écran suivant, d'après l'adresse e-mail (`pages/pro/Acces.tsx`).
 * Remplace la page du 28 oct. (bandeau animé, carte d'accès à deux portes, promesses, étapes).
 *
 * Langue : le sélecteur commun « drapeau + langue » en liste déroulante (`LangSwitch`).
 * Démonstration : deux salons à ouvrir sans compte, dépliés sous le bouton.
 */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { DEMO_ACCOUNTS } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { writeAuthFlow } from '@/lib/authFlow';
import { HeroSlides } from '@/components/HeroSlides';
import { LangSwitch } from '@/components/LangSwitch';
import { Wordmark } from '@/components/Wordmark';
import { I } from '@/components/ui';
import { ICONE } from '@/lib/actionIcons';
import { t } from '@/i18n';

const PHOTOS = ['cover-femmes', 'cover-hommes'];

export function ProWelcome() {
  const { session, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/pro';
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const commencer = () => {
    if (session) return navigate(next);
    writeAuthFlow({ role: 'pro', next, identifier: '', channel: 'email' });
    navigate(`/pro/acces?next=${encodeURIComponent(next)}`);
  };

  const ouvrirDemo = async (email: string) => {
    setBusy(email);
    try {
      writeAuthFlow({ role: 'pro', next: '/pro', identifier: email, channel: 'email' });
      await demoLogin(email);
      navigate('/connexion/retour?next=%2Fpro', { replace: true });
    } finally {
      setBusy(null);
    }
  };

  const demos = DEMO_ACCOUNTS.filter((a) => a.role === 'pro' && a.login);

  return (
    <div className="pwo rd h-app">
      <div className="pwo-ph" aria-hidden>
        <HeroSlides photos={PHOTOS} intervalle={7000} />
      </div>
      <span className="pwo-voile" aria-hidden />

      <header className="pwo-bar">
        <span className="flex items-center gap-2">
          <Wordmark size={1.143} light />
          <span className="aph-pro">PRO</span>
        </span>
        <LangSwitch />
      </header>

      <main className="pwo-copy">
        <p className="pwo-k">{t('Bienvenue sur')}</p>
        <h1 className="pwo-t">Salon DZ Pro</h1>
        <p className="pwo-s">{t('Votre agenda, votre page de réservation et vos clientes, au même endroit.')}</p>
      </main>

      <footer className="pwo-bas">
        <button type="button" className="pa-btn" onClick={commencer}>
          <I icon={ICONE.continuer} size={18} className="rtl:-scale-x-100" />
          {session ? t('Ouvrir mon espace') : t('Commencer')}
        </button>
        {!session &&
          (demo ? (
            <div className="pwo-demos">
              {demos.map((a) => (
                <button key={a.key} type="button" className="pa-btn g" disabled={busy !== null} onClick={() => void ouvrirDemo(a.email)}>
                  <I icon={ICONE.apercu} size={18} />
                  {busy === a.email ? t('Ouverture…') : a.key === 'hommes' ? t('Démonstration · Barbier') : t('Démonstration · Salon de beauté')}
                </button>
              ))}
            </div>
          ) : (
            <button type="button" className="pa-lien" onClick={() => setDemo(true)}>
              {t('Voir une démonstration')}
            </button>
          ))}
        <p className="pa-note centre">
          {t('En continuant, vous acceptez les')} <Link to="/cgu">{t('conditions d’utilisation')}</Link> {t('et la')}{' '}
          <Link to="/confidentialite">{t('politique de confidentialité')}</Link>.
        </p>
      </footer>
    </div>
  );
}
