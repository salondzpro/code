/**
 * FILTRE PAR MEMBRE DE L'AGENDA — RONDS D'INITIALES (16 nov. 2026, demande du propriétaire ; remplace
 * la liste déroulante du 15 nov.). Un rond « Tous » (toute l'équipe, par défaut) puis un rond par
 * membre : ses initiales sur une couleur CLAIRE qui lui est propre. Toucher un rond = ne voir que lui ;
 * le rond choisi est cerclé d'encre. Rien sans équipe (< 2 membres actifs).
 *
 * Initiales (règle du propriétaire), sur le PRÉNOM :
 *   1. la première lettre ;
 *   2. si un autre prénom commence par la même lettre : la première ET la deuxième (« Sa », « So ») ;
 *   3. si un autre prénom a les mêmes deux premières lettres : la première ET la dernière (« Sa », « Sm »).
 */
import { Users } from 'lucide-react';
import type { Staff } from '@salondz/types';
import { I } from '@/components/ui';
import { t } from '@/i18n';

/** Couleurs claires, bien distinctes, texte en encre lisible dessus. */
const COULEURS = ['#ffd6e0', '#cfe4ff', '#d3f4dd', '#ffe3bd', '#e5dbff', '#c9f0f2', '#fff1b0', '#f9d6ca', '#dcebc6', '#f3d9f7'];

/** Couleur du rond du membre n° `i` (ordre de l'équipe : actifs, triés). */
export const couleurMembre = (i: number) => COULEURS[Math.max(0, i) % COULEURS.length]!;

/**
 * Fond de SA colonne dans l'agenda : la même couleur, à 35 % seulement (16 nov. 2026, demande du
 * propriétaire : « pas trop forcé, qu'on voie bien ce qui est écrit dessus »).
 */
export const teinteColonne = (i: number) => `${couleurMembre(i)}59`;

const prenom = (nom: string) => nom.trim().split(/\s+/)[0] || '?';
const bas = (s: string) => s.toLocaleLowerCase('fr');

/** Les initiales de chaque nom, selon la règle ci-dessus (même ordre que `noms`). */
export function initialesEquipe(noms: string[]): string[] {
  const prenoms = noms.map(prenom);
  return prenoms.map((p, i) => {
    const autres = prenoms.filter((_, j) => j !== i);
    const une = p.charAt(0).toLocaleUpperCase('fr');
    const memeLettre = autres.filter((q) => bas(q.charAt(0)) === bas(p.charAt(0)));
    if (!memeLettre.length || p.length < 2) return une;
    const deux = une + bas(p.charAt(1));
    if (!memeLettre.some((q) => bas(q.slice(0, 2)) === bas(p.slice(0, 2)))) return deux;
    return une + bas(p.charAt(p.length - 1));
  });
}

export function StaffFilter({
  staff,
  value,
  onChange,
  nameOf = (m) => m.displayName,
}: {
  staff: Staff[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Gardé pour compatibilité : les ronds n'affichent plus de compteur. */
  counts?: Record<string, number>;
  /** Nom lu par la synthèse vocale (« Vous » pour soi). */
  nameOf?: (m: Staff) => string;
}) {
  const members = staff.filter((m) => m.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  if (members.length < 2) return null;
  const initiales = initialesEquipe(members.map((m) => m.displayName));
  const current = members.find((m) => m.id === value) ?? null;

  return (
    <div className="stc" role="radiogroup" aria-label={t('Filtrer par membre')}>
      <button
        type="button"
        role="radio"
        aria-checked={!current}
        aria-label={t("Toute l'équipe")}
        className={`stc-r tous${!current ? ' on' : ''}`}
        onClick={() => onChange(null)}
      >
        <I icon={Users} size={18} />
      </button>
      {members.map((m, i) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={current?.id === m.id}
          aria-label={nameOf(m)}
          title={nameOf(m)}
          className={`stc-r${current?.id === m.id ? ' on' : ''}`}
          style={{ background: couleurMembre(i) }}
          onClick={() => onChange(current?.id === m.id ? null : m.id)}
        >
          {initiales[i]}
        </button>
      ))}
    </div>
  );
}
