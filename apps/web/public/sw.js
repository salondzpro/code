/**
 * Service worker Salon DZ — notifications navigateur uniquement.
 *
 * Il ne met rien en cache et n'intercepte aucune requête : mettre l'application en cache
 * demanderait une stratégie de version et d'invalidation, et le moindre faux pas y sert une
 * version périmée. Ce fichier ne fait donc qu'une chose : recevoir un message poussé et
 * l'afficher, puis ouvrir le bon écran au clic.
 *
 * Servi depuis la racine (/sw.js) pour pouvoir couvrir tout le site.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Salon DZ', body: event.data.text() };
  }
  const data = payload.data || {};
  // Le tap doit mener là où la notification a du sens : le rendez-vous concerné.
  const url = data.bookingId
    ? `/rendez-vous/${data.bookingId}`
    : data.salonId
      ? '/rendez-vous'
      : '/notifications';
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Salon DZ', {
      body: payload.body || '',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      // Une seule notification par rendez-vous : la nouvelle remplace l'ancienne au lieu
      // d'empiler « demande envoyée », « confirmée », « déplacée » pour le même créneau.
      tag: data.bookingId ? `booking-${data.bookingId}` : undefined,
      renotify: true,
      data: { ...data, url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/rendez-vous';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Onglet déjà ouvert : on le réutilise et on navigue, plutôt qu'un doublon d'onglet.
      for (const client of all) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(url).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
