/**
 * Ouvrir une adresse HORS de l'application.
 *
 * POURQUOI : l'aperçu de sa propre page est un écran de CLIENT. Ouvert dans l'application, le
 * professionnel se retrouve dans un parcours de réservation — avec sa barre d'onglets pro autour,
 * et aucun moyen évident d'en sortir. Un rôle, un espace : l'aperçu part donc dans le navigateur
 * du téléphone, qui a son propre bouton « retour à l'application ».
 *
 * Sur le site, c'est un simple nouvel onglet. Dans l'application, le navigateur système s'ouvre
 * par-dessus (`@capacitor/browser`) ; le greffon est importé à la demande, un visiteur du site ne
 * télécharge rien.
 */
const enCoque = (): boolean =>
  Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

export async function openExternal(url: string): Promise<void> {
  if (!enCoque()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } catch {
    // Greffon indisponible : mieux vaut ouvrir dans la WebView que de ne rien faire du tout.
    window.location.href = url;
  }
}
