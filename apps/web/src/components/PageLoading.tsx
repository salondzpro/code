/**
 * ATTENTE PENDANT LA NAVIGATION — SQUELETTES (14 nov. 2026, demande du propriétaire : « Skeleton
 * Loading premium façon Apple / Uber, et rien quand on n'en a pas besoin »).
 *
 * Trois règles :
 *
 * 1. PLUS JAMAIS D'ÉCRAN DE MARQUE EN COURS DE ROUTE. L'écran « Salon DZ · Réservation en ligne »
 *    sur fond d'encre s'affichait au premier temps d'attente de chaque session, donc à chaque
 *    actualisation et à chaque redirection : un écran noir qui dit « l'application redémarre ».
 *    L'ouverture de l'APPLICATION reste l'affaire de `lib/launchAnimation.ts` (avant React) ; ici,
 *    on ne montre que la silhouette de la page qui arrive.
 *
 * 2. RIEN PENDANT LES 150 PREMIÈRES ms. La plupart des pages arrivent plus vite ; un squelette montré
 *    puis retiré aussitôt clignote. Passé ce délai, l'attente est réelle et le squelette apparaît en
 *    fondu — jamais d'un coup.
 *
 * 3. LA SILHOUETTE EST CELLE DE LA PAGE ATTENDUE (accueil, agenda, liste, place de marché, salon,
 *    fiche, réglages), lue sur l'adresse : quand le contenu arrive, il prend la place exacte des pavés,
 *    rien ne saute. Pavés aux mêmes arrondis que les vraies cartes, lueur lente et large.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { t } from '@/i18n';

const PATIENCE_MS = 150;

type Forme = 'proHome' | 'agenda' | 'liste' | 'marche' | 'salon' | 'fiche' | 'reglages' | 'page';

function formeDe(path: string): Forme {
  if (/^\/pro\/?$/.test(path)) return 'proHome';
  if (/^\/pro\/agenda/.test(path)) return 'agenda';
  if (/^\/(pro\/)?rendez-vous\/[^/]+\/?$/.test(path)) return 'fiche';
  if (/^\/pro\/clients\/[^/]+/.test(path)) return 'fiche';
  if (/^\/(s|salon)\/[^/]+\/?$/.test(path)) return 'salon';
  if (/^\/(salons|carte|categorie\/[^/]+)?\/?$/.test(path)) return 'marche';
  if (/^\/(pro\/(reservations|clients|rappels|avis)|rendez-vous|favoris|notifications|pro\/notifications|admin(\/[a-z-]+)?)\/?$/.test(path)) return 'liste';
  if (/^\/(pro\/(parametres|profil|compte|mon-salon|reglages|equipe)|reglages|profil|compte)/.test(path)) return 'reglages';
  return 'page';
}

/** Un pavé. `r` = arrondi (carte, pilule, rond), `w`/`h` en CSS. */
function P({ w = '100%', h, r = 'card', className = '', delay = 0 }: { w?: string; h: string; r?: 'card' | 'sm' | 'pill' | 'round' | 'none'; className?: string; delay?: number }) {
  return <span className={`skx skx-${r} ${className}`} style={{ width: w, height: h, animationDelay: `${delay}ms` }} aria-hidden />;
}

/** Ligne de liste : rond, deux lignes de texte, pastille à droite. */
function Ligne({ i }: { i: number }) {
  return (
    <div className="skx-row">
      <P w="2.75rem" h="2.75rem" r="round" delay={i * 60} />
      <span className="skx-col">
        <P w={`${62 - (i % 3) * 9}%`} h="0.95rem" r="sm" delay={i * 60} />
        <P w={`${40 + (i % 2) * 12}%`} h="0.75rem" r="sm" delay={i * 60 + 30} />
      </span>
      <P w="3.4rem" h="1.75rem" r="pill" delay={i * 60} />
    </div>
  );
}

function Titre() {
  return (
    <div className="skx-col !gap-2">
      <P w="46%" h="1.75rem" r="sm" />
      <P w="64%" h="0.85rem" r="sm" delay={40} />
    </div>
  );
}

function Silhouette({ forme }: { forme: Forme }): ReactNode {
  switch (forme) {
    case 'proHome':
      return (
        <>
          <div className="skx-hero">
            <P w="38%" h="0.8rem" r="sm" />
            <P w="56%" h="2rem" r="sm" delay={40} />
            <div className="skx-line">
              {[0, 1, 2, 3, 4].map((i) => (
                <P key={i} w="3.75rem" h="3.75rem" r="round" delay={80 + i * 40} />
              ))}
            </div>
          </div>
          <div className="skx-pad">
            <div className="skx-card">
              <P w="40%" h="0.85rem" r="sm" />
              <P w="72%" h="1.4rem" r="sm" delay={40} />
              <P h="3.2rem" r="sm" delay={80} />
            </div>
            <div className="skx-card">
              <Ligne i={0} />
              <Ligne i={1} />
            </div>
          </div>
        </>
      );
    case 'agenda':
      return (
        <div className="skx-pad">
          <div className="skx-line justify-between">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <P key={i} w="2.6rem" h="3.6rem" r="sm" delay={i * 35} />
            ))}
          </div>
          <div className="skx-grid">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skx-hour">
                <P w="2.4rem" h="0.75rem" r="sm" delay={i * 50} />
                {i % 3 !== 2 && <P w={`${70 - (i % 2) * 18}%`} h={i % 2 ? '3.2rem' : '4.6rem'} r="sm" delay={i * 50 + 40} />}
              </div>
            ))}
          </div>
        </div>
      );
    case 'liste':
      return (
        <div className="skx-pad">
          <Titre />
          <div className="skx-line">
            <P w="6rem" h="2.25rem" r="pill" />
            <P w="5rem" h="2.25rem" r="pill" delay={40} />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skx-card !py-3">
              <Ligne i={i} />
            </div>
          ))}
        </div>
      );
    case 'marche':
      return (
        <div className="skx-pad">
          <div className="skx-col !gap-2">
            <P w="34%" h="0.8rem" r="sm" />
            <P w="50%" h="2rem" r="sm" delay={40} />
          </div>
          <P h="3.25rem" r="pill" delay={80} />
          <div className="skx-line">
            {[0, 1, 2, 3].map((i) => (
              <P key={i} w={`${5 + (i % 2)}rem`} h="2.25rem" r="pill" delay={120 + i * 40} />
            ))}
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="skx-col !gap-2.5">
              <P h="11.5rem" delay={160 + i * 80} />
              <P w="58%" h="1.05rem" r="sm" delay={200 + i * 80} />
              <P w="38%" h="0.8rem" r="sm" delay={230 + i * 80} />
            </div>
          ))}
        </div>
      );
    case 'salon':
      return (
        <>
          <P h="15rem" r="none" />
          <div className="skx-pad">
            <div className="skx-col !gap-2">
              <P w="62%" h="1.75rem" r="sm" delay={60} />
              <P w="44%" h="0.85rem" r="sm" delay={90} />
            </div>
            <div className="skx-line">
              {[0, 1, 2].map((i) => (
                <P key={i} w="6.5rem" h="2.25rem" r="pill" delay={120 + i * 40} />
              ))}
            </div>
            <div className="skx-card">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skx-row">
                  <span className="skx-col">
                    <P w={`${58 - (i % 2) * 14}%`} h="0.95rem" r="sm" delay={160 + i * 50} />
                    <P w="28%" h="0.75rem" r="sm" delay={190 + i * 50} />
                  </span>
                  <P w="4.5rem" h="2.1rem" r="pill" delay={160 + i * 50} />
                </div>
              ))}
            </div>
          </div>
        </>
      );
    case 'fiche':
      return (
        <div className="skx-pad">
          <P w="2.75rem" h="2.75rem" r="round" />
          <div className="skx-card">
            <div className="skx-row">
              <P w="3.25rem" h="3.25rem" r="round" delay={40} />
              <span className="skx-col">
                <P w="54%" h="1.1rem" r="sm" delay={60} />
                <P w="36%" h="0.8rem" r="sm" delay={90} />
              </span>
            </div>
            <P h="4.25rem" r="sm" delay={120} />
          </div>
          <div className="skx-card">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skx-row">
                <P w="2.5rem" h="2.5rem" r="round" delay={160 + i * 50} />
                <span className="skx-col">
                  <P w={`${60 - i * 10}%`} h="0.95rem" r="sm" delay={170 + i * 50} />
                  <P w="40%" h="0.75rem" r="sm" delay={200 + i * 50} />
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    case 'reglages':
      return (
        <div className="skx-pad">
          <Titre />
          {[3, 2].map((n, c) => (
            <div key={c} className="skx-card">
              {Array.from({ length: n }, (_, i) => (
                <div key={i} className="skx-row">
                  <P w="2.5rem" h="2.5rem" r="round" delay={c * 120 + i * 50} />
                  <span className="skx-col">
                    <P w={`${52 - i * 8}%`} h="0.95rem" r="sm" delay={c * 120 + i * 50 + 20} />
                    <P w="68%" h="0.75rem" r="sm" delay={c * 120 + i * 50 + 50} />
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    default:
      return (
        <div className="skx-pad">
          <Titre />
          <P h="8.5rem" delay={60} />
          <P h="8.5rem" delay={120} />
          <P h="8.5rem" delay={180} className="opacity-60" />
        </div>
      );
  }
}

/** Le repli de tout chargement : rien, puis la silhouette de la page attendue. */
export function PageLoading() {
  // Squelette d'actualisation (index.html) déjà à l'écran : on enchaîne SANS patience ni fondu.
  const [relais] = useState(() => typeof document !== 'undefined' && document.documentElement.dataset.skx === 'on');
  const [visible, setVisible] = useState(relais);
  // La forme est arrêtée au montage : une page qui tarde ne change pas de silhouette en cours de route.
  const [forme] = useState<Forme>(() => formeDe(typeof window === 'undefined' ? '/' : window.location.pathname));
  useEffect(() => {
    if (relais) delete document.documentElement.dataset.skx;
    const minuteur = setTimeout(() => setVisible(true), PATIENCE_MS);
    return () => clearTimeout(minuteur);
  }, []);
  // Pendant la patience le bloc est VIDE, donc sans hauteur : rien ne bouge à l'écran.
  return (
    <div role="status" aria-busy="true" aria-label={t('Chargement')}>
      {visible && (
        <div className={`skx-wrap${relais ? ' now' : ''}`}>
          <Silhouette forme={forme} />
        </div>
      )}
    </div>
  );
}
