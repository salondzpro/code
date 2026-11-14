/**
 * Espace d'administration de la place de marché — coque et navigation (voir `docs/ADMIN.md`).
 *
 * Le garde est SERVEUR : chaque route `/v1/admin/*` passe par `requireAdmin`. Ce qui suit ne fait
 * qu'afficher — cacher un écran ne protège rien, et une adresse devinée ne donne rien.
 *
 * L'espace reprend les primitives du design (cartes, listes, pastilles) : ce n'est pas un autre
 * produit, c'est le même outil vu de l'autre côté du comptoir. Seul l'en-tête change, pour qu'on
 * sache à tout instant qu'on agit en tant que plateforme et non en tant que salon.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router';
import { Activity, CalendarSearch, ChevronRight, ContactRound, Flag, LayoutGrid, LockKeyhole, LogOut, Menu, QrCode, ScrollText, ShieldCheck, Store } from 'lucide-react';
import { ApiError, useAdminMe } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { Button, I } from '@/components/ui';
import { ICONE } from '@/lib/actionIcons';
import { AdminSearch } from './AdminSearch';
import { PageLoading } from '@/components/PageLoading';
import { t } from '@/i18n';

/** Navigation en SECTIONS (14 nov. 2026) : piloter, la place de marché, modérer, outils, sécurité. */
const NAV: { to: string; label: string; icon: typeof Store; end?: boolean; owner?: boolean; section: string }[] = [
  { to: '/admin', label: 'Vue d’ensemble', icon: LayoutGrid, end: true, section: 'Piloter' },
  { to: '/admin/sante', label: 'Santé', icon: Activity, section: 'Piloter' },
  { to: '/admin/salons', label: 'Professionnels', icon: Store, section: 'Place de marché' },
  { to: '/admin/comptes', label: 'Comptes', icon: ContactRound, section: 'Place de marché' },
  { to: '/admin/rendez-vous', label: 'Rendez-vous', icon: CalendarSearch, section: 'Place de marché' },
  { to: '/admin/signalements', label: 'Signalements', icon: Flag, section: 'Modérer' },
  { to: '/admin/etiquettes', label: 'Étiquettes', icon: QrCode, section: 'Outils' },
  { to: '/admin/equipe', label: 'Équipe', icon: ShieldCheck, owner: true, section: 'Sécurité' },
  { to: '/admin/journal', label: 'Journal', icon: ScrollText, section: 'Sécurité' },
];

/**
 * MOBILE D'ABORD (14 nov. 2026, demande du propriétaire) : sur téléphone, une barre en bas, à portée
 * de pouce — les quatre écrans du quotidien et « Plus », qui ouvre tout le reste en feuille. Sur
 * ordinateur, le rail. Les libellés courts sont ceux de la barre ; les sections restent celles du rail.
 */
const BAS: { to: string; label: string; icon: typeof Store; end?: boolean }[] = [
  { to: '/admin', label: 'Accueil', icon: LayoutGrid, end: true },
  { to: '/admin/salons', label: 'Pros', icon: Store },
  { to: '/admin/comptes', label: 'Comptes', icon: ContactRound },
  { to: '/admin/rendez-vous', label: 'RDV', icon: CalendarSearch },
];

/** Verrouillage après inactivité (14 nov. 2026) : un poste laissé ouvert ne garde pas les clés. */
const INACTIVITE_MIN = 20;

/**
 * Le journal enregistre une clé technique — c'est ce qu'on veut y garder, stable et cherchable —
 * mais à l'écran on lit une phrase. Une clé inconnue s'affiche telle quelle : un journal ne cache
 * rien, et une ligne sans traduction vaut mieux qu'une ligne vide.
 */
export function actionLabel(action: string): string {
  switch (action) {
    case 'view_salon':
      return t('Fiche salon consultée');
    case 'view_profile':
      return t('Fiche compte consultée');
    case 'salon_control_start':
      return t('Espace du salon ouvert');
    case 'salon_control_end':
      return t('Espace du salon quitté');
    case 'acted_as_salon':
      return t('Modification faite dans l’espace du salon');
    case 'salon_frozen':
      return t('Réservations du salon gelées');
    case 'salon_hidden':
      return t('Salon masqué');
    case 'salon_unsuspended':
      return t('Suspension du salon levée');
    case 'profile_suspended':
      return t('Compte suspendu');
    case 'profile_unsuspended':
      return t('Suspension du compte levée');
    case 'profile_edited':
      return t('Compte corrigé');
    case 'profile_deleted':
      return t('Compte supprimé');
    case 'review_hidden':
      return t('Avis masqué');
    case 'review_unhidden':
      return t('Avis rétabli');
    case 'report_handled':
      return t('Signalement traité');
    case 'report_rejected':
      return t('Signalement classé sans suite');
    case 'booking_cancelled':
      return t('Rendez-vous annulé au nom de la plateforme');
    case 'admin_granted':
      return t('Administrateur nommé');
    case 'admin_revoked':
      return t('Accès administrateur retiré');
    default:
      return action;
  }
}

/**
 * Garde d'affichage. Une réponse 403 n'est pas une panne : c'est la réponse normale pour qui n'est
 * pas administrateur. On renvoie à l'accueil sans message d'erreur — inutile d'apprendre à
 * quelqu'un qu'une porte existe.
 */
export function AdminLayout() {
  const { session, loading, signOut } = useAuth();
  const me = useAdminMe(!!session);
  const { pathname } = useLocation();
  const [plus, setPlus] = useState(false);
  useEffect(() => setPlus(false), [pathname]);

  // Verrouillage : sans geste pendant 20 min, la session se ferme et l'on revient à la
  // connexion, avec retour ici. Le serveur borne aussi la session d'administration à 12 h.
  useEffect(() => {
    if (!session) return;
    let dernier = Date.now();
    const geste = () => (dernier = Date.now());
    const evts = ['pointerdown', 'keydown', 'scroll', 'visibilitychange'] as const;
    evts.forEach((e) => window.addEventListener(e, geste, { passive: true }));
    const id = window.setInterval(() => {
      if (Date.now() - dernier > INACTIVITE_MIN * 60_000) {
        window.clearInterval(id);
        void signOut({ voile: false }).finally(() => window.location.assign('/acces?next=%2Fadmin'));
      }
    }, 30_000);
    return () => {
      window.clearInterval(id);
      evts.forEach((e) => window.removeEventListener(e, geste));
    };
  }, [session, signOut]);

  if (loading || (!!session && me.isPending)) return <PageLoading />;
  // Personne de connecté : l'écran de connexion, et on revient ici ensuite.
  if (!session) return <Navigate to="/connexion?next=%2Fadmin" replace />;
  // Connexion trop ancienne (plus de 12 h, `ADMIN_REAUTH`) : on redemande le mot de passe, sans
  // renvoyer à l'accueil — c'est bien un administrateur.
  if (me.isError && me.error instanceof ApiError && me.error.code === 'ADMIN_REAUTH')
    return (
      <div className="ad-lock h-app">
        <span className="ad-lock-i">
          <I icon={LockKeyhole} size={30} strokeWidth={1.6} />
        </span>
        <h1>{t('Reconnectez-vous')}</h1>
        <p>{t('Pour votre sécurité, l’administration demande de se reconnecter toutes les 12 heures.')}</p>
        <Button icon={ICONE.seConnecter} onClick={() => void signOut({ voile: false }).finally(() => window.location.assign('/acces?next=%2Fadmin'))}>
          {t('Se reconnecter')}
        </Button>
      </div>
    );
  // Connecté mais pas administrateur : l'accueil, sans un mot.
  if (me.isError) return <Navigate to="/" replace />;

  const owner = me.data?.level === 'owner';
  const liens = NAV.filter((n) => owner || !n.owner);
  const sections = [...new Set(liens.map((n) => n.section))];
  const reste = liens.filter((n) => !BAS.some((x) => x.to === n.to));

  return (
    <div className="ad h-app">
      <aside className="ad-rail" aria-label={t('Administration')}>
        <span className="ad-marque">
          <span className="font-semibold">Salon</span>
          <span className="font-light text-muted">DZ</span>
          <span className="ad-badge">{t('Plateforme')}</span>
        </span>
        {sections.map((sec) => (
          <div key={sec} className="ad-sec">
            <span className="ad-sec-t">{t(sec)}</span>
            {liens
              .filter((n) => n.section === sec)
              .map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `ad-lien${isActive ? ' on' : ''}`}>
                  <I icon={n.icon} size={18} /> {t(n.label)}
                </NavLink>
              ))}
          </div>
        ))}
        <div className="ad-qui">
          <span>{owner ? t('Propriétaire') : t('Support')}</span>
          <button type="button" onClick={() => void signOut({ voile: false }).finally(() => window.location.assign('/acces?next=%2Fadmin'))}>
            <I icon={LogOut} size={16} /> {t('Se déconnecter')}
          </button>
        </div>
      </aside>
      <div className="ad-main">
        <header className="ad-top">
          <span className="ad-marque ad-marque-m">
            <span className="font-semibold">Salon</span>
            <span className="font-light text-muted">DZ</span>
            <span className="ad-badge">{t('Plateforme')}</span>
          </span>
          <AdminSearch owner={owner} />
          <span className="ad-niv">{owner ? t('Propriétaire') : t('Support')}</span>
        </header>
        <nav className="ad-bas" aria-label={t('Administration')}>
          {BAS.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `ad-bas-i${isActive ? ' on' : ''}`}>
              <I icon={n.icon} size={21} />
              <span>{t(n.label)}</span>
            </NavLink>
          ))}
          <button type="button" className={`ad-bas-i${plus || !BAS.some((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to))) ? ' on' : ''}`} onClick={() => setPlus(true)} aria-expanded={plus}>
            <I icon={Menu} size={21} />
            <span>{t('Plus')}</span>
          </button>
        </nav>
        {plus &&
          createPortal(
            <div className="ad-plus-w" onMouseDown={(e) => e.target === e.currentTarget && setPlus(false)}>
              <div className="ad-plus" role="dialog" aria-modal="true" aria-label={t('Administration')}>
                <span className="ad-plus-poignee" aria-hidden />
                {/* Zéro doublon : la feuille ne répète pas ce que la barre du bas donne déjà. */}
                {[...new Set(reste.map((n) => n.section))].map((sec) => (
                  <div key={sec} className="ad-plus-sec">
                    <span className="ad-sec-t">{t(sec)}</span>
                    <div className="lst">
                      {reste
                        .filter((n) => n.section === sec)
                        .map((n) => (
                          <NavLink key={n.to} to={n.to} end={n.end} className="lst-r">
                            <span className="ad-pal-i">
                              <I icon={n.icon} size={18} />
                            </span>
                            <span className="lst-t">{t(n.label)}</span>
                            <I icon={ChevronRight} size={18} className="text-muted rtl:-scale-x-100" />
                          </NavLink>
                        ))}
                    </div>
                  </div>
                ))}
                <button type="button" className="ad-plus-out" onClick={() => void signOut({ voile: false }).finally(() => window.location.assign('/acces?next=%2Fadmin'))}>
                  <I icon={LogOut} size={18} /> {t('Se déconnecter')} · {owner ? t('Propriétaire') : t('Support')}
                </button>
              </div>
            </div>,
            document.body,
          )}
        <Outlet />
      </div>
    </div>
  );
}
