/**
 * Les gestes de la plateforme sur les données d'autrui (lot 2 de `docs/ADMIN.md`).
 *
 * Deux principes, tenus partout ici : **rien ne se supprime** (on suspend, on masque, on rétablit),
 * et **tout se justifie** (motif obligatoire, ligne au journal). La trace est écrite par l'appelant
 * — ces fonctions font le geste, pas le procès-verbal.
 */
import type { FastifyBaseLogger } from 'fastify';
import { db } from './supabase';
import { conflict, notFound, unwrap } from './errors';
import { getBookingWithStaff } from './queries';
import { dispatchPendingPush, pushAfterBooking } from './push';
import { notifySlotFreed } from './waitlist';
import type { BookingWithStaff } from '@salondz/types';

/**
 * Annuler un rendez-vous AU NOM DE LA PLATEFORME.
 *
 * Ni le client ni le salon n'en sont l'auteur : `cancelled_by = 'platform'` le dit, et les deux
 * parties sont prévenues. Le créneau repart en liste d'attente comme pour toute annulation — un
 * litige entre deux personnes ne doit pas coûter son créneau à une troisième.
 */
export async function cancelAsPlatform(
  log: FastifyBaseLogger,
  bookingId: string,
  reason: string,
): Promise<BookingWithStaff> {
  const b = await getBookingWithStaff(bookingId).catch(() => null);
  if (!b) throw notFound('Réservation');
  if (b.status !== 'pending' && b.status !== 'confirmed') {
    throw conflict('BOOKING_NOT_CANCELLABLE', "Ce rendez-vous n'est plus annulable.");
  }
  const res = await db
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: 'platform',
      cancellation_reason: reason,
    })
    .eq('id', b.id)
    .in('status', ['pending', 'confirmed'])
    .select('id')
    .maybeSingle();
  if (!unwrap(res)) throw conflict('BOOKING_NOT_CANCELLABLE', 'La réservation a changé entre-temps.');
  pushAfterBooking(log, b.id);
  void notifySlotFreed(log, {
    salonId: b.salonId,
    staffId: b.staffId,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    serviceId: b.serviceId,
    excludeBookingId: b.id,
  });
  return getBookingWithStaff(b.id);
}

/**
 * Effacer un compte client — le même effacement que `DELETE /v1/me`, déclenché par la plateforme
 * (loi 18-07 : la personne peut demander la suppression par courrier, pas seulement depuis l'app).
 *
 * Les rendez-vous PASSÉS ne sont pas supprimés mais ANONYMISÉS : ils appartiennent aussi à la
 * comptabilité du salon, qui n'a pas à perdre son historique parce qu'un client s'en va.
 */
export async function eraseClientAccount(log: FastifyBaseLogger, uid: string): Promise<void> {
  const owned = await db.from('salons').select('id').eq('owner_id', uid).limit(1);
  if (owned.error) throw owned.error;
  if ((owned.data ?? []).length)
    throw conflict(
      'HAS_SALON',
      'Votre compte porte un salon. Choisissez « Supprimer mon compte et mon salon » : les rendez-vous à venir seront annulés et leurs clients prévenus.',
    );
  await wipeAccount(log, uid);
}

/**
 * Effacer le compte d'un PROFESSIONNEL en fermant son salon — exigé par Apple (5.1.1) et par Google Play :
 * la suppression se fait DANS l'application, pas par courrier. Le salon n'est plus là pour recevoir ses
 * clients, donc on commence par eux :
 *
 *   • chaque rendez-vous à venir est annulé au nom de la plateforme et son client est prévenu (notification
 *     poussée AVANT la suppression, puis une trace dans l'application qui survit à celle du rendez-vous) ;
 *     la liste d'attente n'est PAS prévenue d'un créneau libéré : le salon n'existera plus ;
 *   • les photos du salon partent du stockage ;
 *   • le salon est supprimé, avec son catalogue, son équipe, ses rendez-vous et ses avis (cascades).
 *
 * L'historique des rendez-vous passés disparaît donc aussi de celui des clients : c'est le prix de la
 * fermeture d'un salon, et l'écran de confirmation le dit. Le professionnel peut télécharger ses données
 * avant. Puis le compte lui-même est effacé comme celui d'un client.
 */
export async function eraseProAccount(log: FastifyBaseLogger, uid: string): Promise<void> {
  const owned = await db.from('salons').select('id, name').eq('owner_id', uid).maybeSingle();
  if (owned.error) throw owned.error;
  const salon = owned.data as { id: string; name: string } | null;
  if (salon) {
    const now = new Date().toISOString();
    const upcoming = await db
      .from('bookings')
      .select('id, client_id, service_name, starts_at')
      .eq('salon_id', salon.id)
      .in('status', ['pending', 'confirmed'])
      .gt('ends_at', now)
      .limit(500);
    if (upcoming.error) throw upcoming.error;
    for (const b of (upcoming.data ?? []) as { id: string; client_id: string | null; service_name: string; starts_at: string }[]) {
      const cancel = await db
        .from('bookings')
        .update({ status: 'cancelled', cancelled_at: now, cancelled_by: 'platform', cancellation_reason: 'Ce salon a fermé son compte sur Salon DZ.' })
        .eq('id', b.id)
        .in('status', ['pending', 'confirmed']);
      if (cancel.error) throw cancel.error;
      if (!b.client_id) continue;
      // Le client doit être prévenu : la notification du déclencheur est poussée ici, avant que le rendez-vous
      // (et elle avec, en cascade) ne disparaisse ; la trace dans l'application est une ligne à part.
      await dispatchPendingPush(log, b.id).catch((err) => log.warn({ err, bookingId: b.id }, 'fermeture de salon : push'));
      const already = await db.from('notifications').select('id').eq('booking_id', b.id).eq('user_id', b.client_id).limit(1);
      const when = new Intl.DateTimeFormat('fr-DZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Algiers' }).format(new Date(b.starts_at));
      const trace = await db.from('notifications').insert({
        user_id: b.client_id,
        type: 'booking_cancelled',
        title: 'Rendez-vous annulé',
        body: `${salon.name} · ${b.service_name} · ${when} — ce salon a fermé son compte.`,
        data: {},
        booking_id: null,
        // Déjà poussée par la notification du déclencheur quand elle existe ; sinon elle part avec le prochain envoi.
        pushed_at: (already.data ?? []).length ? now : null,
      });
      if (trace.error) log.warn({ err: trace.error, bookingId: b.id }, 'fermeture de salon : trace');
    }
    // Photos du salon (`salons/<salonId>/…`), par pages de 100.
    for (;;) {
      const files = await db.storage.from('salons').list(salon.id, { limit: 100 });
      if (files.error || !files.data?.length) break;
      await db.storage.from('salons').remove(files.data.map((f) => `${salon.id}/${f.name}`));
      if (files.data.length < 100) break;
    }
    const gone = await db.from('salons').delete().eq('id', salon.id);
    if (gone.error) throw gone.error;
    log.info({ userId: uid, salonId: salon.id }, 'salon fermé par son professionnel');
  }
  await wipeAccount(log, uid);
}

/** Ce qui reste à effacer d'un compte une fois son salon écarté : données personnelles, puis le compte. */
async function wipeAccount(log: FastifyBaseLogger, uid: string): Promise<void> {
  // Un administrateur qu'on effacerait emporterait son journal (`admin_audit` suit son compte en cascade) :
  // on retire d'abord son accès, en connaissance de cause.
  const admin = await db.from('platform_admins').select('user_id').eq('user_id', uid).is('disabled_at', null).maybeSingle();
  if (admin.error) throw admin.error;
  if (admin.data)
    throw conflict('ADMIN_ACCOUNT', "Ce compte a un accès d'administrateur : retirez-le d'abord (scripts/admin.mjs revoke), le journal en dépend.");
  const anonymized = { client_id: null, client_name: 'Client supprimé', client_phone: null, notes: null };
  const steps = [
    db.from('bookings').update(anonymized).eq('client_id', uid),
    db.from('bookings').update({ booked_by: null, booked_by_name: null }).eq('booked_by', uid),
    db.from('reviews').delete().eq('client_id', uid),
    // `favorites` est rattachée par `user_id`, pas `client_id` : cette faute a rendu l'effacement de compte
    // impossible (500 « column favorites.client_id does not exist », APRÈS avoir anonymisé les rendez-vous et
    // supprimé les avis). Aucun test ne le couvrait ; `pnpm check:pro-deletion` le fait maintenant.
    db.from('favorites').delete().eq('user_id', uid),
    db.from('push_tokens').delete().eq('user_id', uid),
    db.from('notifications').delete().eq('user_id', uid),
    db.from('client_notes').delete().eq('client_key', uid),
    db.from('blocked_clients').delete().eq('client_id', uid),
  ];
  for (const step of steps) {
    const r = await step;
    if (r.error) throw r.error;
  }
  const files = await db.storage.from('avatars').list(uid);
  if (!files.error && files.data?.length)
    await db.storage.from('avatars').remove(files.data.map((f) => `${uid}/${f.name}`));
  const gone = await db.auth.admin.deleteUser(uid);
  if (gone.error) throw gone.error;
  log.info({ userId: uid }, 'compte supprimé');
}
