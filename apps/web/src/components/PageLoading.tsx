/**
 * ATTENTE PENDANT LA NAVIGATION.
 *
 * L'écran de marque sur fond d'encre (`Splash`) servait de repli à TOUS les chargements : chaque
 * page chargée à la demande et chaque garde en attente faisait donc surgir un écran noir « Salon DZ
 * · Réservation en ligne » au milieu d'un parcours. Un écran d'ouverture qui revient en cours de
 * route ne dit pas « ça charge », il dit « l'application vient de redémarrer ».
 *
 * Deux principes :
 *
 * 1. L'OUVERTURE N'A LIEU QU'UNE FOIS. Le premier temps d'attente de la session — le démarrage,
 *    pendant que la session se rétablit — garde l'écran de marque : il prolonge l'animation
 *    d'ouverture de l'application, sans rupture. Tous les suivants sont des navigations, et une
 *    navigation reste dans l'application.
 *
 * 2. ON N'AFFICHE RIEN PENDANT LES PREMIÈRES 150 ms. La plupart des pages arrivent plus vite que
 *    cela ; montrer un indicateur pour le retirer aussitôt produit un clignotement, qui donne
 *    l'impression d'un défaut là où il n'y avait qu'une transition. Passé ce délai, l'attente est
 *    réelle : on la montre avec une barre de progression et la silhouette de la page à venir, sur
 *    le fond habituel.
 */
import { useEffect, useState } from 'react';
import { Splash } from '@/pages/auth/Splash';
import { t } from '@/i18n';

/** Vrai dès que l'écran d'ouverture a été montré une fois dans cette session. */
let ouvertureFaite = false;

const PATIENCE_MS = 150;

function Discret() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const minuteur = setTimeout(() => setVisible(true), PATIENCE_MS);
    return () => clearTimeout(minuteur);
  }, []);

  return (
    // Pas de hauteur imposée : pendant les 150 ms de patience le bloc est VIDE, donc sans hauteur,
    // et rien ne bouge à l'écran. Ensuite, ce sont les pavés du squelette qui donnent la hauteur —
    // un `h-app` s'ajouterait à l'en-tête et à la barre d'onglets, et ferait défiler une page qui
    // n'a pas encore de contenu.
    <div role="status" aria-busy="true" aria-label={t('Chargement')}>
      {visible && (
        <>
          <div className="ldbar" />
          {/* La silhouette d'une page type : un titre, puis des cartes. Elle n'imite aucun écran en
              particulier — elle occupe la place pour que l'arrivée du contenu ne fasse pas sauter
              la mise en page. */}
          <div className="flex flex-col gap-3.5 px-5 pt-6">
            <div className="sk h-7 w-1/2" />
            <div className="sk h-[8.5rem] w-full" />
            <div className="sk h-[8.5rem] w-full" />
            <div className="sk h-[8.5rem] w-full opacity-60" />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Le repli de tout chargement : écran de marque à l'ouverture, attente discrète ensuite.
 * Le choix est arrêté au montage — une page qui met du temps à venir ne doit pas changer d'avis en
 * cours de route.
 */
export function PageLoading() {
  const [ouverture] = useState(() => {
    const premier = !ouvertureFaite;
    ouvertureFaite = true;
    return premier;
  });
  return ouverture ? <Splash /> : <Discret />;
}
