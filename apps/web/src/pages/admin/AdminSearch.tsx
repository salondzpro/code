/**
 * RECHERCHE DE L'ADMINISTRATION (14 nov. 2026, demande du propriétaire : « une barre de recherche
 * pour trouver vite une fonctionnalité, avec suggestions et tags »).
 *
 * Une seule barre, en tête de toutes les pages ; ⌘K / Ctrl K ou « / » l'ouvrent de n'importe où.
 * Elle cherche à la fois :
 *   • les FONCTIONS de la plateforme (`FONCTIONS` : un libellé, une phrase, des mots-clés) — « geler »,
 *     « supprimer », « avis », « QR »… mènent à l'écran où l'action se fait ;
 *   • les PROFESSIONNELS et les COMPTES, en direct, dès deux lettres (mêmes routes serveur que les
 *     listes : `requireAdmin`, rien de plus n'est exposé).
 * Des TAGS filtrent les résultats (Tout · Fonctions · Professionnels · Comptes). Clavier : ↑ ↓ pour
 * choisir, Entrée pour ouvrir, Échap pour fermer. Sans rien taper, les fonctions les plus utiles.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import {
  Activity,
  CalendarSearch,
  ContactRound,
  Flag,
  LayoutGrid,
  QrCode,
  ScrollText,
  Search,
  ShieldCheck,
  Store,
  UserX,
  EyeOff,
  Snowflake,
  Ban,
  MonitorSmartphone,
  Trash2,
  PenLine,
  type LucideIcon,
} from 'lucide-react';
import { pagesItems, useAdminProfiles, useAdminSalons } from '@salondz/api-client';
import { useDebounced } from '@/lib/useDebounced';
import { I } from '@/components/ui';
import { t } from '@/i18n';

type Tag = 'tout' | 'fonction' | 'salon' | 'compte';

interface Fonction {
  titre: string;
  texte: string;
  to: string;
  icone: LucideIcon;
  /** Mots-clés : ce qu'on tape quand on cherche cette fonction sans connaître son nom. */
  mots: string;
  owner?: boolean;
}

/** Le catalogue des fonctions de la plateforme. Une entrée = un écran qui existe. */
export const FONCTIONS: Fonction[] = [
  { titre: 'Vue d’ensemble', texte: 'Chiffres du jour, salons, rendez-vous', to: '/admin', icone: LayoutGrid, mots: 'tableau bord accueil chiffres statistiques kpi' },
  { titre: 'Santé de la plateforme', texte: 'Base, site, e-mails, notifications, activité', to: '/admin/sante', icone: Activity, mots: 'santé statut panne service serveur api domaine site notification push email resend cron erreur' },
  { titre: 'Professionnels', texte: 'Tous les salons, publiés ou en brouillon', to: '/admin/salons', icone: Store, mots: 'salon pro professionnel barbier liste publier brouillon' },
  { titre: 'Geler les réservations d’un salon', texte: 'Ouvrez la fiche du salon, puis « Suspendre »', to: '/admin/salons', icone: Snowflake, mots: 'geler suspendre bloquer salon réservation arrêter' },
  { titre: 'Masquer un salon', texte: 'Le retirer de la place de marché', to: '/admin/salons', icone: EyeOff, mots: 'masquer cacher retirer salon marketplace invisible' },
  { titre: 'Ouvrir l’espace d’un professionnel', texte: 'Dépanner un pro, accès daté de 2 h', to: '/admin/salons', icone: MonitorSmartphone, mots: 'piloter contrôler dépanner espace pro aider connexion' },
  { titre: 'Comptes', texte: 'Clients et professionnels', to: '/admin/comptes', icone: ContactRound, mots: 'compte client utilisateur profil numéro email' },
  { titre: 'Suspendre un compte', texte: 'Plus de réservation en ligne', to: '/admin/comptes', icone: UserX, mots: 'suspendre bloquer client abus compte' },
  { titre: 'Corriger un compte', texte: 'Nom ou numéro, avec motif', to: '/admin/comptes', icone: PenLine, mots: 'corriger modifier nom numéro téléphone identité' },
  { titre: 'Supprimer un compte', texte: 'À la demande du titulaire', to: '/admin/comptes', icone: Trash2, mots: 'supprimer effacer compte rgpd données suppression', owner: true },
  { titre: 'Rendez-vous', texte: 'Chercher, annuler au nom de la plateforme', to: '/admin/rendez-vous', icone: CalendarSearch, mots: 'rendez-vous réservation annuler booking créneau' },
  { titre: 'Annuler un rendez-vous', texte: 'Les deux parties sont prévenues', to: '/admin/rendez-vous', icone: Ban, mots: 'annuler rendez-vous plateforme litige' },
  { titre: 'Signalements', texte: 'Avis signalés à traiter', to: '/admin/signalements', icone: Flag, mots: 'signalement avis modération masquer avis report' },
  { titre: 'Étiquettes et QR', texte: 'Modèles d’affiche, étiquette d’un salon', to: '/admin/etiquettes', icone: QrCode, mots: 'étiquette qr code affiche autocollant imprimer modèle' },
  { titre: 'Équipe de la plateforme', texte: 'Nommer ou retirer un administrateur', to: '/admin/equipe', icone: ShieldCheck, mots: 'équipe administrateur admin accès droit niveau owner support sécurité', owner: true },
  { titre: 'Journal', texte: 'Qui a fait quoi, quand, pourquoi', to: '/admin/journal', icone: ScrollText, mots: 'journal audit historique trace sécurité action' },
];

const norme = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

type Ligne = { cle: string; titre: string; texte: string; to: string; icone: LucideIcon; tag: Exclude<Tag, 'tout'> };

export function AdminSearch({ owner }: { owner: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<Tag>('tout');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement | null>(null);
  const terme = useDebounced(q.trim(), 250);
  const direct = open && terme.length >= 2;
  const salons = useAdminSalons({ q: terme }, direct && (tag === 'tout' || tag === 'salon'));
  const comptes = useAdminProfiles({ q: terme }, direct && (tag === 'tout' || tag === 'compte'));

  // ⌘K / Ctrl K et « / » ouvrent la recherche de n'importe où.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const champ = (e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !champ)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    // Pas de focus automatique au toucher (règle du projet : le clavier du téléphone cacherait la
    // liste) ; à la souris et au clavier d'un ordinateur, on tape tout de suite.
    if (open && window.matchMedia('(pointer: fine)').matches) window.setTimeout(() => input.current?.focus(), 30);
    else {
      setQ('');
      setTag('tout');
    }
  }, [open]);

  const lignes = useMemo<Ligne[]>(() => {
    const n = norme(terme);
    const fonctions: Ligne[] = FONCTIONS.filter((f) => owner || !f.owner)
      .filter((f) => !n || norme(`${f.titre} ${f.texte} ${f.mots}`).includes(n))
      .slice(0, n ? 8 : 6)
      .map((f) => ({ cle: `f:${f.titre}`, titre: t(f.titre), texte: t(f.texte), to: f.to, icone: f.icone, tag: 'fonction' }));
    const s: Ligne[] = direct
      ? pagesItems(salons.data)
          .slice(0, 5)
          .map((x) => ({ cle: `s:${x.id}`, titre: x.name, texte: `${t('Professionnel')} · ${x.slug}`, to: `/admin/salons/${x.id}`, icone: Store, tag: 'salon' }))
      : [];
    const c: Ligne[] = direct
      ? pagesItems(comptes.data)
          .slice(0, 5)
          .map((x) => ({
            cle: `c:${x.id}`,
            titre: x.fullName ?? t('(sans nom)'),
            texte: [x.role === 'pro' ? t('Professionnel') : t('Client'), x.phone].filter(Boolean).join(' · '),
            to: `/admin/comptes/${x.id}`,
            icone: ContactRound,
            tag: 'compte',
          }))
      : [];
    return [...fonctions, ...s, ...c].filter((l) => tag === 'tout' || l.tag === tag);
  }, [terme, owner, direct, salons.data, comptes.data, tag]);

  useEffect(() => setSel(0), [terme, tag]);

  const ouvrir = (l: Ligne | undefined) => {
    if (!l) return;
    setOpen(false);
    navigate(l.to);
  };

  const TAGS: { v: Tag; label: string }[] = [
    { v: 'tout', label: t('Tout') },
    { v: 'fonction', label: t('Fonctions') },
    { v: 'salon', label: t('Professionnels') },
    { v: 'compte', label: t('Comptes') },
  ];
  const cherche = direct && (salons.isFetching || comptes.isFetching);

  return (
    <>
      <button type="button" className="ad-srch" onClick={() => setOpen(true)} aria-label={t('Rechercher')}>
        <I icon={Search} size={17} />
        <span className="ad-srch-t">{t('Rechercher une fonction, un salon, un compte…')}</span>
        <kbd>⌘K</kbd>
      </button>
      {open &&
        createPortal(
          <div className="ad-pal-w" role="dialog" aria-modal="true" aria-label={t('Recherche')} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div className="ad-pal">
              <div className="ad-pal-in">
                <I icon={Search} size={19} />
                <input
                  ref={input}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('Rechercher une fonction, un salon, un compte…')}
                  autoComplete="off"
                  spellCheck={false}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setOpen(false);
                    else if (e.key === 'ArrowDown') (e.preventDefault(), setSel((v) => Math.min(lignes.length - 1, v + 1)));
                    else if (e.key === 'ArrowUp') (e.preventDefault(), setSel((v) => Math.max(0, v - 1)));
                    else if (e.key === 'Enter') ouvrir(lignes[sel]);
                  }}
                />
                {cherche && <span className="ad-pal-dot" aria-hidden />}
                <kbd onClick={() => setOpen(false)}>Échap</kbd>
              </div>
              <div className="ad-pal-tags" role="tablist">
                {TAGS.map((x) => (
                  <button key={x.v} type="button" role="tab" aria-selected={tag === x.v} className={tag === x.v ? 'on' : ''} onClick={() => setTag(x.v)}>
                    {x.label}
                  </button>
                ))}
              </div>
              <ul className="ad-pal-l">
                {!terme && <li className="ad-pal-h">{t('Suggestions')}</li>}
                {lignes.map((l, i) => (
                  <li key={l.cle}>
                    <button type="button" className={i === sel ? 'on' : ''} onMouseEnter={() => setSel(i)} onClick={() => ouvrir(l)}>
                      <span className="ad-pal-i">
                        <I icon={l.icone} size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="ad-pal-t">{l.titre}</span>
                        <span className="ad-pal-s">{l.texte}</span>
                      </span>
                      <span className="ad-pal-g">{l.tag === 'fonction' ? t('Fonction') : l.tag === 'salon' ? t('Pro') : t('Compte')}</span>
                    </button>
                  </li>
                ))}
                {lignes.length === 0 && <li className="ad-pal-v">{terme.length < 2 && tag !== 'fonction' ? t('Tapez au moins deux lettres.') : t('Aucun résultat.')}</li>}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
