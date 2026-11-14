/**
 * `/professionnels` — PAGE D'ACCUEIL DU SITE PROFESSIONNEL (14 nov. 2026, demande du propriétaire).
 *
 * Sur le WEB, la porte pro (`/pro/bienvenue`) mène ici : un salon qui découvre Salon DZ depuis un
 * navigateur doit voir ce qu'il y gagne avant un formulaire. Dans l'APPLICATION, rien ne change :
 * l'ouverture pro reste l'écran de bienvenue (`pages/pro/Welcome.tsx`).
 *
 * Même facture que la page clients (`pages/Home.tsx`, classes `hx-*`) : blanc, très grands titres,
 * de VRAIS écrans de l'espace pro dans des téléphones (`public/home/pro-*.webp`, refaits par
 * `node scripts/make-home-screens.mjs`). Chaque carte montre un écran qui existe ; aucun chiffre
 * ni promesse inventés — les montants visibles sont ceux de la démonstration.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, CalendarDays, Inbox, LineChart, Send, Users, Wallet, QrCode, Share2, type LucideIcon } from 'lucide-react';
import { DEMO_ACCOUNTS } from '@salondz/constants';
import { InstagramLogo, SnapchatLogo, TikTokLogo, WhatsAppLogo } from '@/components/BrandIcons';
import { useAuth } from '@/lib/auth';
import { writeAuthFlow } from '@/lib/authFlow';
import { useReveal } from '@/lib/reveal';
import { Wordmark } from '@/components/Wordmark';
import { LangSwitch } from '@/components/LangSwitch';
import { I } from '@/components/ui';
import { Phone, useScene } from '@/pages/Home';
import { t } from '@/i18n';

/** Quatre écrans de l'espace pro, quatre gestes du quotidien. */
const ECRANS: { icone: LucideIcon; titre: string; texte: string; ecran: string }[] = [
  { icone: CalendarDays, titre: 'Agenda d’équipe', texte: 'Chaque membre dans sa colonne, chaque statut dans sa couleur.', ecran: 'pro-agenda' },
  { icone: Inbox, titre: 'Demandes', texte: 'Accepter ou refuser d’un geste.', ecran: 'pro-demandes' },
  { icone: Send, titre: 'Rappels', texte: 'WhatsApp, SMS ou appel, le message déjà écrit.', ecran: 'pro-rappels' },
  { icone: LineChart, titre: 'Ma page', texte: 'D’où viennent vos clientes, et ce que Salon DZ vous rapporte.', ecran: 'pro-mapage' },
];

/** Le reste de l'outil, en tuiles : un écran existe derrière chacune. */
const TUILES: { icone: LucideIcon; titre: string; marques?: boolean }[] = [
  { icone: Share2, titre: 'Votre lien partout', marques: true },
  { icone: QrCode, titre: 'Code QR et affiche' },
  { icone: Users, titre: 'Fichier clients' },
  { icone: Wallet, titre: 'Chiffre d’affaires' },
];

export function ProSite() {
  useReveal();
  const scene = useScene();
  const navigate = useNavigate();
  const { session, demoLogin } = useAuth();
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const demos = DEMO_ACCOUNTS.filter((a) => a.role === 'pro' && a.login);

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

  const entrer = session ? '/pro' : '/pro/acces';

  return (
    <div className="hx">
      <nav className="hx-nav" aria-label={t('Navigation')}>
        <div className="hx-nav-i">
          <Link to="/professionnels" aria-label="Salon DZ Pro" className="flex items-center gap-2">
            <Wordmark size={1.357} />
            <span className="hx-pro">PRO</span>
          </Link>
          <div className="hx-nav-l">
            <a href="#outil">{t('L’outil')}</a>
            <Link to="/home">{t('Pour les clients')}</Link>
          </div>
          <div className="hx-nav-r">
            <LangSwitch tone="light" />
            <Link to={entrer} className="hx-nav-c">
              {session ? t('Mon espace') : t('Connexion')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ------------------------------------------------------------------ Ouverture */}
      <header className="hx-hero">
        <p className="hx-in hx-k">{t('Salon DZ pour les professionnels de la beauté.')}</p>
        <h1 className="hx-in hx-h1 pro" style={{ ['--d' as string]: '120ms' }}>
          {t('Votre salon se remplit')} <span className="hx-h1-b">{t('pendant que vous coiffez.')}</span>
        </h1>
        <p className="hx-in hx-sub" style={{ ['--d' as string]: '240ms' }}>
          {t('Votre agenda, votre page de réservation et vos clientes, au même endroit.')}
        </p>
        <div className="hx-in hx-cta" style={{ ['--d' as string]: '360ms' }}>
          <Link to={entrer} className="hx-btn">
            {session ? t('Ouvrir mon espace') : t('Créer mon espace — gratuit')} <I icon={ArrowRight} size={18} className="rtl:-scale-x-100" />
          </Link>
          {!session && (
            <button type="button" className="hx-btn o" onClick={() => setDemo((v) => !v)} aria-expanded={demo}>
              {t('Voir une démonstration')}
            </button>
          )}
        </div>
        {demo && !session && (
          <div className="hx-demos">
            {demos.map((a) => (
              <button key={a.key} type="button" className="hx-btn o" disabled={busy !== null} onClick={() => void ouvrirDemo(a.email)}>
                {busy === a.email ? t('Ouverture…') : a.key === 'hommes' ? t('Démonstration · Barbier') : t('Démonstration · Salon de beauté')}
              </button>
            ))}
          </div>
        )}

        <div ref={scene} className="hx-stage" aria-hidden>
          <span className="hx-aura">
            <i />
            <i />
            <i />
          </span>
          <div className="hx-slot g">
            <Phone src="pro-agenda" lazy={false} />
          </div>
          <div className="hx-slot d">
            <Phone src="pro-demandes" lazy={false} />
          </div>
          <div className="hx-slot c">
            <Phone src="pro-accueil" lazy={false} />
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ Une phrase, en grand */}
      <section className="hx-sec">
        <p data-reveal className="hx-dit">
          <b>{t('Les réservations arrivent toutes seules, jour et nuit.')}</b> {t('Vous confirmez d’un geste, vos clientes sont prévenues.')}
        </p>
      </section>

      {/* ------------------------------------------------------------------ L'outil, écran par écran */}
      <section id="outil" className="hx-sec gris">
        <div className="hx-col">
          <div className="hx-hd">
            <p data-reveal className="hx-k">
              {t('L’outil')}
            </p>
            <h2 data-reveal style={{ ['--d' as string]: '80ms' }} className="hx-h2">
              {t('Tout votre salon, dans votre poche.')}
            </h2>
          </div>
          <div className="hx-bento quatre">
            {ECRANS.map((c, i) => (
              <article key={c.titre} data-reveal style={{ ['--d' as string]: `${(i % 2) * 90}ms` }} className="hx-carte">
                <span className="hx-ico">
                  <I icon={c.icone} size={20} strokeWidth={1.8} />
                </span>
                <h3>{t(c.titre)}</h3>
                <p>{t(c.texte)}</p>
                <Phone src={c.ecran} />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ Le reste, en tuiles */}
      <section className="hx-sec nuit">
        <div className="hx-col">
          <div className="hx-hd">
            <p data-reveal className="hx-k">
              {t('Et aussi')}
            </p>
            <h2 data-reveal style={{ ['--d' as string]: '80ms' }} className="hx-h2">
              {t('Votre lien sur Instagram, vos clientes sur Salon DZ.')}
            </h2>
          </div>
          <div className="hx-tuiles">
            {TUILES.map((c, i) => (
              <div key={c.titre} data-reveal style={{ ['--d' as string]: `${i * 70}ms` }} className="hx-tuile">
                {c.marques ? (
                  <span className="hx-marques">
                    {[InstagramLogo, WhatsAppLogo, SnapchatLogo, TikTokLogo].map((Logo, n) => (
                      <Logo key={n} size={26} />
                    ))}
                  </span>
                ) : (
                  <span className="hx-ico n">
                    <I icon={c.icone} size={20} strokeWidth={1.8} />
                  </span>
                )}
                <span className="hx-tuile-t">{t(c.titre)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ Fin : un seul geste */}
      <section className="hx-sec fin">
        <div className="hx-col">
          <h2 data-reveal className="hx-h1 petit">
            {t('Ouvrez votre espace en quelques minutes.')}
          </h2>
          <div data-reveal className="hx-cta centre" style={{ ['--d' as string]: '100ms' }}>
            <Link to={entrer} className="hx-btn">
              {session ? t('Ouvrir mon espace') : t('Créer mon espace — gratuit')} <I icon={ArrowRight} size={18} className="rtl:-scale-x-100" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="hx-pied">
        <span className="flex items-center gap-2">
          <Wordmark size={1.286} />
          <span className="hx-pro">PRO</span>
        </span>
        <nav>
          <Link to="/home">{t('Pour les clients')}</Link>
          <Link to="/cgu">{t('CGU')}</Link>
          <Link to="/confidentialite">{t('Confidentialité')}</Link>
          <Link to="/mentions-legales">{t('Mentions légales')}</Link>
          <Link to="/aide">{t('Aide')}</Link>
        </nav>
        <p>
          © {new Date().getFullYear()} {t('Salon DZ · Fait en Algérie')}
        </p>
      </footer>
    </div>
  );
}
