/**
 * PORTAIL PROFESSIONNEL (13 nov. 2026, maquette validée par le propriétaire) : le cadre commun des
 * écrans d'accès pro — e-mail, mot de passe, création, vérification, mot de passe oublié.
 *
 * Thème « minimal éditorial » : fond blanc cassé, rond blanc de retour, grand titre, une phrase,
 * le formulaire, puis LES ACTIONS EN BAS de l'écran (boutons noirs en pilule), à portée de pouce.
 * Le portail client garde `AuthShell` ; seul l'espace pro passe par ici.
 */
import type { ReactNode } from 'react';
import { BackButton } from './ui';
import { mailAppFor, ouvrirMessagerie, proposable, type MailAppId } from '@/lib/mailApp';
import { t } from '@/i18n';

export function ProAuthScreen({
  back,
  titre,
  sous,
  haut,
  children,
  actions,
}: {
  back?: string;
  titre: string;
  sous?: ReactNode;
  /** Élément posé au-dessus du titre (pictogramme d'un écran de confirmation). */
  haut?: ReactNode;
  children?: ReactNode;
  /** Boutons du bas de l'écran. */
  actions?: ReactNode;
}) {
  return (
    <div className="pa rd h-app">
      <div className="pa-top">{back && <BackButton to={back} />}</div>
      <main className="pa-main">
        {haut}
        <h1 className="pa-t">{titre}</h1>
        {sous && <p className="pa-s">{sous}</p>}
        <div className="pa-corps">{children}</div>
        {actions && <div className="pa-actions">{actions}</div>}
      </main>
    </div>
  );
}

/** Bouton « Ouvrir Gmail » : logo et nom de la messagerie de l'adresse, ouverture directe. */
export function MailAppButton({ email }: { email: string }) {
  const app = mailAppFor(email);
  if (!proposable(app)) return null;
  return (
    <button type="button" className="pa-btn pa-mail" onClick={() => void ouvrirMessagerie(app)}>
      <span className="pa-mail-i">
        <MailLogo id={app.id} />
      </span>
      {app.id === 'autre' ? t('Ouvrir ma messagerie') : t('Ouvrir {app}', { app: app.nom })}
    </button>
  );
}

/** Logos simplifiés des messageries, lisibles à 20 px. */
export function MailLogo({ id }: { id: MailAppId }) {
  if (id === 'gmail')
    return (
      <svg width="20" height="16" viewBox="0 0 48 36" aria-hidden>
        <path d="M3.3 36h7.6V17.5L0 9.4v23.3C0 34.5 1.5 36 3.3 36z" fill="#4285F4" />
        <path d="M37.1 36h7.6c1.8 0 3.3-1.5 3.3-3.3V9.4l-10.9 8.1z" fill="#34A853" />
        <path d="M37.1 3.5v14l10.9-8.1V5c0-4.1-4.7-6.5-8-4z" fill="#FBBC04" />
        <path d="M10.9 17.5v-14L24 13.3l13.1-9.8v14L24 27.3z" fill="#EA4335" />
        <path d="M0 5v4.4l10.9 8.1v-14L8 1C4.7-1.5 0 .9 0 5z" fill="#C5221F" />
      </svg>
    );
  if (id === 'outlook')
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <rect x="9" y="4" width="13" height="16" rx="2" fill="#28A8EA" />
        <path d="M9 9l6.5 4L22 9" stroke="#fff" strokeWidth="1.4" fill="none" />
        <rect x="2" y="6" width="11" height="12" rx="2" fill="#0F6CBD" />
        <ellipse cx="7.5" cy="12" rx="2.6" ry="3.2" fill="none" stroke="#fff" strokeWidth="1.6" />
      </svg>
    );
  if (id === 'yahoo')
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <rect x="1" y="1" width="22" height="22" rx="6" fill="#6001D2" />
        <path d="M6 7l4 6v4M14 7l-4 6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M17 7v6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="17" cy="16.5" r="1.2" fill="#fff" />
      </svg>
    );
  if (id === 'icloud')
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <rect x="1" y="1" width="22" height="22" rx="6" fill="#1E90FF" />
        <rect x="5" y="7.5" width="14" height="9.5" rx="1.5" fill="#fff" />
        <path d="M5.5 8.2l6.5 4.6 6.5-4.6" stroke="#1E90FF" strokeWidth="1.3" fill="none" />
      </svg>
    );
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}
