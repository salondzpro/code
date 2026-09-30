/**
 * Coque commune à TOUS les écrans d'authentification : connexion, inscription, lien par e-mail,
 * mot de passe oublié, nouveau mot de passe, vérification, coordonnées.
 *
 * POURQUOI UNE COQUE : ces écrans partageaient une structure recopiée sept fois, qui divergeait à
 * chaque retouche — un bandeau ici, un bouton retour là, des marges différentes. Ici, une seule
 * définition : la marque, le retour, le titre, la colonne de formulaire et le pied.
 *
 * DEUX VOLETS À PARTIR DE 1024 px. Le volet de gauche n'est pas décoratif : il dit à QUI l'écran
 * s'adresse. Une cliente qui réserve et un salon qui s'équipe n'ont pas les mêmes attentes, et un
 * formulaire seul au milieu d'une page blanche ne le dit jamais. En dessous de 1024 px — donc dans
 * l'application mobile, toujours — c'est une colonne unique, avec un bandeau de marque compact.
 *
 * Le contenu du volet change selon `role`, mais la mise en page ne change pas : même écran, deux
 * identités, pas deux produits.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { AlertCircle, CalendarDays, CalendarCheck, Eye, EyeOff, MapPin, Sparkles, Store, Wallet, type LucideIcon } from 'lucide-react';
import { BackButton, Field, I, Input } from './ui';
import { Wordmark } from './Wordmark';
import { LangSwitch } from './LangSwitch';
import { t } from '@/i18n';

export type AuthRole = 'client' | 'pro';

const VITRINE: Record<AuthRole, { photo: string; titre: string; points: { icone: LucideIcon; texte: string }[] }> = {
  client: {
    photo: '/demo/cover-femmes.webp',
    titre: 'Votre salon, en deux gestes.',
    points: [
      { icone: MapPin, texte: 'Les salons autour de vous, avec leurs disponibilités du jour' },
      { icone: CalendarCheck, texte: 'Réservation en quelques secondes, prix en dinars' },
      { icone: Sparkles, texte: 'Rappel la veille et deux heures avant chaque rendez-vous' },
    ],
  },
  pro: {
    photo: '/demo/cover-hommes.webp',
    titre: 'Votre salon tient dans votre poche.',
    points: [
      { icone: CalendarDays, texte: 'Votre agenda par membre d’équipe, heure par heure' },
      { icone: Store, texte: 'Votre page publique, votre lien et votre QR code' },
      { icone: Wallet, texte: 'Fiche client, historique et chiffre d’affaires' },
    ],
  },
};

export function AuthShell({
  role = 'client',
  back,
  marque = true,
  titre,
  sous,
  children,
  pied,
}: {
  role?: AuthRole;
  /** Écran parent. Absent : pas de bouton retour (première porte). */
  back?: string;
  /** Bandeau de marque en haut sur téléphone. Un écran d'étape s'en passe. */
  marque?: boolean;
  titre: string;
  sous?: ReactNode;
  children: ReactNode;
  /** Actions secondaires, séparées du formulaire par un trait. */
  pied?: ReactNode;
}) {
  const v = VITRINE[role];

  return (
    <div className="auth-shell">
      {/* ---------------------------------------------------------------- Volet de gauche (≥1024) */}
      <aside className="auth-vitrine" aria-hidden>
        <img src={v.photo} alt="" />
        <Wordmark size={1.571} light />
        <div>
          <p className="max-w-[16ch] text-[2.571rem] font-semibold leading-[1.08] tracking-[-1.2px]">{t(v.titre)}</p>
          <ul className="mt-9 flex flex-col gap-4">
            {v.points.map((p) => (
              <li key={p.texte} className="flex items-start gap-3 text-[1.071rem] leading-[1.45] text-white/75">
                <span className="mt-0.5 flex size-8 flex-none items-center justify-center rounded-[var(--radius-card-sm)] bg-white/10">
                  <I icon={p.icone} size={18} strokeWidth={1.7} />
                </span>
                {t(p.texte)}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[0.875rem] text-white/40">{t('La réservation beauté en Algérie.')}</p>
      </aside>

      {/* ---------------------------------------------------------------- Colonne du formulaire */}
      <div className="auth-col">
        {/* Bandeau de marque : sur téléphone seulement. Sur grand écran, le volet de gauche le porte
            déjà — le répéter ferait deux marques dans le même regard. */}
        {marque && (
          <div className="flex items-center justify-between gap-3 px-4 pt-3 lg:hidden">
            <div className="flex items-center gap-2">
              {back && <BackButton to={back} />}
              <Link to="/home" aria-label="Salon DZ">
                <Wordmark size={1.429} />
              </Link>
            </div>
            <LangSwitch />
          </div>
        )}
        {!marque && back && (
          <div className="px-4 pt-3 lg:hidden">
            <BackButton to={back} />
          </div>
        )}

        <div className="auth-form flex flex-1 flex-col justify-center px-4 py-6 lg:px-0 lg:py-0">
          {back && (
            <Link to={back} className="mb-6 hidden text-[0.938rem] font-medium text-muted transition-colors hover:text-ink lg:inline-block">
              ← {t('Retour')}
            </Link>
          )}
          <h1 className="text-[1.714rem] font-semibold leading-[1.15] tracking-[-0.8px] lg:text-[2rem]">{t(titre)}</h1>
          {sous && <p className="p mt-2">{sous}</p>}
          <div className="mt-7 flex flex-col gap-5">{children}</div>
          {pied && <div className="mt-7 flex flex-col gap-2.5 border-t border-line pt-6">{pied}</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * Champ de mot de passe avec bascule « afficher ». Il était recopié dans trois écrans, avec des
 * libellés d'accessibilité qui divergeaient — ici il n'existe qu'une fois.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  err,
  hint,
  action,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  err?: boolean;
  hint?: string;
  action?: ReactNode;
  autoFocus?: boolean;
}) {
  const [montre, setMontre] = useState(false);
  return (
    <Field label={label} htmlFor={id} hint={hint} action={action}>
      <div className="relative">
        <Input
          id={id}
          lg
          type={montre ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          err={err}
          className="!pe-12"
          autoFocus={autoFocus}
        />
        <button
          type="button"
          className="absolute end-3 top-1/2 -translate-y-1/2 rounded-[var(--radius-btn)] p-1 text-muted transition-colors hover:text-ink"
          aria-label={montre ? t('Masquer le mot de passe') : t('Afficher le mot de passe')}
          onClick={() => setMontre((v) => !v)}
        >
          <I icon={montre ? EyeOff : Eye} size={20} />
        </button>
      </div>
    </Field>
  );
}

/**
 * Erreur d'authentification : le message, et LA SUITE. Une erreur qui ne propose rien laisse la
 * personne devant un mur — « aucun compte » doit mener à la création, « mot de passe incorrect »
 * à la réinitialisation.
 */
export function AuthError({ texte, children }: { texte: string; children?: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex animate-[hm-monte_0.28s_ease-out] flex-col gap-3 rounded-[var(--radius-card)] border border-danger-line bg-cancel-bg p-3.5"
    >
      <p className="flex items-start gap-2.5 text-[1rem] leading-[1.45] text-cancel-fg">
        <I icon={AlertCircle} size={18} className="mt-0.5 flex-none" />
        {texte}
      </p>
      {children}
    </div>
  );
}
