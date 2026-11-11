/**
 * Thème « minimal éditorial » de l'espace professionnel (validé par le propriétaire le 11 nov. 2026) :
 * noir sur blanc cassé, Plus Jakarta Sans, cartes blanches à ombre légère, aucun accent de couleur.
 *
 * Il se pose en classe `pro-theme` sur `<html>` — et non sur un conteneur — pour que les feuilles,
 * fenêtres et messages rendus hors de la page (portails dans `body`) le reçoivent aussi. Les règles
 * vivent dans `index.css`, bloc « THÈME PRO ». Tout l'espace pro (inscription comprise) et toute
 * l'application professionnelle le portent ; le côté client n'est pas touché.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { PRO_ONLY } from './flavor';

export function useProTheme() {
  const { pathname } = useLocation();
  const on = PRO_ONLY || pathname === '/pro' || pathname.startsWith('/pro/');
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('pro-theme', on);
  }, [on]);
}
