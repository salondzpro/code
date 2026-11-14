/**
 * `/home` — page de PRÉSENTATION de Salon DZ (refaite le 14 nov. 2026, demande du propriétaire :
 * « ultra élégant et premium, style Apple »).
 *
 * PARTI PRIS : une page produit. Beaucoup de blanc, de très grands titres serrés, et le PRODUIT au
 * centre — de VRAIS écrans de l'application (`public/home/*.webp`, capturés sur salondz.com avec
 * les comptes de démonstration par `node_modules/.shots/home-shots.mjs`) posés dans des téléphones
 * dessinés en CSS. Rien n'est inventé : chaque carte montre un écran qui existe.
 *
 * RÈGLE DE CONTENU (inchangée) : MONTRER plutôt qu'expliquer. Un titre court, une ligne au plus,
 * et seulement ce qui existe VRAIMENT. Une promesse qu'on ne tient pas coûte plus cher qu'une case
 * vide. Un écran de l'application qui change doit être recapturé ici.
 *
 * Elle reste HORS du cadre d'application (`AppFrame`) et hors du thème posé sur `<html>` : ses
 * couleurs et sa police vivent dans `.hx` (bloc « PAGE DE PRÉSENTATION » en fin d'`index.css`).
 *
 * ANIMATIONS, sans bibliothèque : apparitions au défilement (`lib/reveal.ts`, un seul
 * `IntersectionObserver`), entrée en scène des téléphones en CSS, et UNE variable `--s` (0 → 1)
 * posée au défilement sur la scène d'ouverture — les téléphones s'écartent pendant qu'on descend.
 * Uniquement `transform` et `opacity`. Tout s'arrête sous `prefers-reduced-motion`.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, BellRing, CalendarCheck, CalendarDays, MapPin, Share2, Store, Users, Wallet, type LucideIcon } from 'lucide-react';
import { InstagramLogo, SnapchatLogo, TikTokLogo, WhatsAppLogo } from '@/components/BrandIcons';
import { useReveal } from '@/lib/reveal';
import { Wordmark } from '@/components/Wordmark';
import { LangSwitch } from '@/components/LangSwitch';
import { useDefile } from '@/components/HeroSlides';
import { I } from '@/components/ui';
import { getLocale, t } from '@/i18n';
import { MARCHE } from '@/lib/flavor';

const photo = (cle: string) => `/demo/${cle}.webp`;
/** L'écran de l'application DANS LA LANGUE du visiteur (14 nov. 2026) : arabe et anglais ont leurs captures (`scripts/make-home-screens.mjs`). */
const ecran = (cle: string) => (getLocale() === 'fr' ? `/home/${cle}.webp` : `/home/${getLocale()}/${cle}.webp`);

/** Les métiers servis, femmes et hommes en alternance, les plus présents d'abord. */
const METIERS: { nom: string; photo: string }[] = [
  { nom: 'Ongles', photo: 'f-pose-gel' },
  { nom: 'Barbiers', photo: 'h-barbe' },
  { nom: 'Cils', photo: 'f-extension-cils' },
  { nom: 'Coiffeurs', photo: 'h-coupe' },
  { nom: 'Sourcils et tatouage', photo: 'f-sourcils' },
  { nom: 'Coiffeuses', photo: 'f-balayage' },
  { nom: 'Mariage', photo: 'f-chignon-mariee' },
  { nom: 'Instituts', photo: 'cover-femmes' },
];

/** Côté client : trois cartes, chacune montre l'écran dont elle parle. */
const CLIENT: { icone: LucideIcon; titre: string; texte: string; ecran: string }[] = [
  { icone: MapPin, titre: 'Autour de vous', texte: 'Les créneaux libres du jour, près de chez vous.', ecran: 'client-accueil' },
  { icone: CalendarCheck, titre: 'En 3 taps', texte: 'Une prestation, une heure : c’est réservé. Prix en dinars.', ecran: 'client-quand' },
  { icone: BellRing, titre: 'Rappel avant', texte: '1 h puis 30 min avant le rendez-vous.', ecran: 'client-rdv' },
];

/** Côté professionnel : quatre tuiles, un écran qui existe derrière chacune. */
const PRO: { icone: LucideIcon; titre: string; marques?: boolean }[] = [
  { icone: Share2, titre: 'Votre lien partout', marques: true },
  { icone: CalendarDays, titre: 'Agenda d’équipe' },
  { icone: Users, titre: 'Fichier clients' },
  { icone: Wallet, titre: 'Chiffre d’affaires' },
];

/** Le métier du titre tourne : « Votre onglerie », « Votre barbier »… traduit d'un bloc. */
const MOTS = ['Votre onglerie', 'Votre barbier', 'Vos cils', 'Votre coiffeur', 'Vos sourcils', 'Votre coiffeuse'];

/** Un téléphone dessiné en CSS, avec un vrai écran de l'application dedans. */
export function Phone({ src, className = '', lazy = true }: { src: string; className?: string; lazy?: boolean }) {
  return (
    <span className={`hx-ph ${className}`} aria-hidden>
      <img src={ecran(src)} alt="" width={585} height={1266} loading={lazy ? 'lazy' : 'eager'} decoding="async" draggable={false} />
    </span>
  );
}

function Titre({ sur, children }: { sur: string; children: ReactNode }) {
  return (
    <div className="hx-hd">
      <p data-reveal className="hx-k">
        {t(sur)}
      </p>
      <h2 data-reveal style={{ ['--d' as string]: '80ms' }} className="hx-h2">
        {children}
      </h2>
    </div>
  );
}

/** `--s` (0 → 1) sur la scène d'ouverture, d'après le défilement : une écriture par image au plus. */
export function useScene() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let attente = 0;
    const maj = () => {
      attente = 0;
      const s = Math.min(1, Math.max(0, window.scrollY / 520));
      el.style.setProperty('--s', s.toFixed(3));
    };
    const surDefilement = () => {
      if (!attente) attente = window.requestAnimationFrame(maj);
    };
    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => {
      window.removeEventListener('scroll', surDefilement);
      if (attente) window.cancelAnimationFrame(attente);
    };
  }, []);
  return ref;
}

export function Home() {
  useReveal();
  const mot = useDefile(MOTS.length, 3600);
  const scene = useScene();

  return (
    <div className="hx">
      {/* ------------------------------------------------------------------ Barre du haut, en verre */}
      <nav className="hx-nav" aria-label={t('Navigation')}>
        <div className="hx-nav-i">
          <Link to="/" aria-label="Salon DZ">
            <Wordmark size={1.357} />
          </Link>
          <div className="hx-nav-l">
            <a href="#metiers">{t('Métiers')}</a>
            <a href="#clientes">{t('Clientes')}</a>
            <a href="#pros">{t('Professionnels')}</a>
          </div>
          <div className="hx-nav-r">
            <LangSwitch tone="light" />
            <Link to="/acces" className="hx-nav-c">
              {t('Connexion')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ------------------------------------------------------------------ Ouverture */}
      <header className="hx-hero">
        <p className="hx-in hx-k">{t('La réservation beauté en Algérie.')}</p>
        <h1 className="hx-in hx-h1" style={{ ['--d' as string]: '120ms' }}>
          <span className="hm-mot">
            <span key={mot} className="hm-mot-i">
              {t(MOTS[mot]!)}
            </span>
          </span>
          <br />
          <span className="hx-h1-b">{t('en 3 taps.')}</span>
        </h1>
        <p className="hx-in hx-sub" style={{ ['--d' as string]: '240ms' }}>
          {t('Partout en Algérie. Sans appeler.')}
        </p>
        <div className="hx-in hx-cta" style={{ ['--d' as string]: '360ms' }}>
          <Link to={MARCHE} className="hx-btn">
            {t('Réserver')} <I icon={ArrowRight} size={18} className="rtl:-scale-x-100" />
          </Link>
          <Link to="/professionnels" className="hx-btn o">
            <I icon={Store} size={18} /> {t('Je suis pro')}
          </Link>
        </div>

        {/* La scène : trois écrans de l'application. Celui du centre monte, les deux autres
            s'écartent quand on descend (`--s`). */}
        <div ref={scene} className="hx-stage" aria-hidden>
          <span className="hx-aura">
            <i />
            <i />
            <i />
          </span>
          <div className="hx-slot g">
            <Phone src="client-salon" lazy={false} />
          </div>
          <div className="hx-slot d">
            <Phone src="client-quand" lazy={false} />
          </div>
          <div className="hx-slot c">
            <Phone src="client-accueil" lazy={false} />
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ Une phrase, en grand */}
      <section className="hx-sec">
        <p data-reveal className="hx-dit">
          <b>{t('Coiffure, ongles, cils, barbe.')}</b> {t('Tous les salons et leurs créneaux libres, au même endroit.')}
        </p>
      </section>

      {/* ------------------------------------------------------------------ Les métiers : des photos, un mot */}
      <section id="metiers" className="hx-sec plein">
        <div className="hx-col">
          <Titre sur="Les professionnels">{t('Toute la beauté, au même endroit.')}</Titre>
        </div>
        <div className="hx-rail" data-reveal>
          {METIERS.map((m) => (
            <Link key={m.nom} to={MARCHE} className="hx-met" aria-label={t(m.nom)}>
              <img src={photo(m.photo)} alt="" loading="lazy" decoding="async" draggable={false} />
              <span>{t(m.nom)}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ Pour les clientes */}
      <section id="clientes" className="hx-sec gris">
        <div className="hx-col">
          <Titre sur="Pour les clients">{t('Trouvez. Réservez. C’est tout.')}</Titre>
          <div className="hx-bento">
            {CLIENT.map((c, i) => (
              <article key={c.titre} data-reveal style={{ ['--d' as string]: `${i * 90}ms` }} className="hx-carte">
                <span className="hx-ico">
                  <I icon={c.icone} size={20} strokeWidth={1.8} />
                </span>
                <h3>{t(c.titre)}</h3>
                <p>{t(c.texte)}</p>
                <Phone src={c.ecran} className="pt" />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ Pour les professionnels */}
      <section id="pros" className="hx-sec nuit">
        <div className="hx-col">
          <Titre sur="Pour les professionnels">{t('Votre salon se remplit pendant que vous coiffez.')}</Titre>
          <p data-reveal className="hx-sub centre">
            {t('Les réservations arrivent toutes seules, jour et nuit.')}
          </p>
          <div data-reveal className="hx-cta centre">
            <Link to="/professionnels" className="hx-btn b">
              {t('Ouvrir mon espace pro — gratuit')} <I icon={ArrowRight} size={18} className="rtl:-scale-x-100" />
            </Link>
          </div>
          <div className="hx-duo" data-reveal>
            <Phone src="pro-accueil" className="a" />
            <Phone src="pro-agenda" className="b" />
            <Phone src="pro-demandes" className="c" />
          </div>
          <div className="hx-tuiles">
            {PRO.map((c, i) => (
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
            {t('Votre prochain rendez-vous commence ici.')}
          </h2>
          <div data-reveal className="hx-cta centre" style={{ ['--d' as string]: '100ms' }}>
            <Link to={MARCHE} className="hx-btn">
              {t('Réserver')} <I icon={ArrowRight} size={18} className="rtl:-scale-x-100" />
            </Link>
            <Link to="/professionnels" className="hx-btn o">
              <I icon={Store} size={18} /> {t('Espace professionnel')}
            </Link>
          </div>
        </div>
      </section>

      <footer className="hx-pied">
        <Wordmark size={1.286} />
        <nav>
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
