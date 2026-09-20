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
import { pushAfterBooking } from './push';
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
    throw conflict('HAS_SALON', 'Ce compte porte un salon : fermez le salon avant de supprimer le compte.');
  const anonymized = { client_id: null, client_name: 'Client supprimé', client_phone: null, notes: null };
  const steps = [
    db.from('bookings').update(anonymized).eq('client_id', uid),
    db.from('bookings').update({ booked_by: null, booked_by_name: null }).eq('booked_by', uid),
    db.from('reviews').delete().eq('client_id', uid),
    db.from('favorites').delete().eq('client_id', uid),
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
