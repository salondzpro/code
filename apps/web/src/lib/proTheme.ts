/**
 * Thème « minimal éditorial » (validé par le propriétaire le 11 nov. 2026 pour l'espace pro, étendu
 * à l'espace CLIENT le 14 nov. 2026) : noir sur blanc cassé, Plus Jakarta Sans, cartes blanches à
 * ombre légère, aucun accent de couleur.
 *
 * Il se pose en classe `pro-theme` sur `<html>` — et non sur un conteneur — pour que les feuilles,
 * fenêtres et messages rendus hors de la page (portails dans `body`) le reçoivent aussi. Les règles
 * vivent dans `index.css` : bloc « THÈME PRO » (jetons, pro) puis « THÈME CLIENT » (les écrans de
 * l'espace client). Le nom `pro-theme` est resté : il désigne le THÈME, plus l'espace.
 *
 * Seules l'administration (outil interne, sa propre feuille) et la page de présentation `/home`
 * (marketing, ses propres couleurs) n'en font pas partie.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { PRO_ONLY } from './flavor';

export function useProTheme() {
  const { pathname } = useLocation();
  const on = !(pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/home' || pathname === '/professionnels');
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('pro-theme', on);
    // L'espace client reçoit en plus ses propres réglages (cartes, champs) : `client-theme`.
    root.classList.toggle('client-theme', on && !PRO_ONLY && !(pathname === '/pro' || pathname.startsWith('/pro/')));
  }, [on, pathname]);
}
