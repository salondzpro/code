/**
 * Créneau libéré (annulation, report, expiration d'une demande, blocage retiré) : on prévient, par
 * notification in-app + push, les clients qui l'attendaient. Deux publics, façon Planity :
 *   1. les inscrits à l'alerte « prévenez-moi si un créneau se libère » pour ce salon et ce jour ;
 *   2. les clients qui ont déjà un rendez-vous PLUS TARD dans ce salon (les plus éloignés d'abord :
 *      ce sont eux qui gagnent le plus à avancer), pour la même prestation quand on la connaît.
 * Premier arrivé, premier servi : la notification mène à la réservation, elle ne réserve pas.
 * Jamais bloquant : une erreur ici se journalise, l'annulation qui l'a déclenchée reste faite.
 */
import type { FastifyBaseLogger } from 'fastify';
import { SLOT_FREED_MAX_LATER_CLIENTS, toLocalDateKey } from '@salondz/constants';
import { db } from './supabase';
import { dispatchPendingPush } from './push';

export interface FreedSlot {
  salonId: string;
  staffId?: string | null;
  startsAt: string;
  endsAt: string;
  serviceId?: string | null;
  /** Le rendez-vous qui vient d'être annulé : ses propres clients ne sont pas « plus tard ». */
  excludeBookingId?: string | null;
}

const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat('fr-DZ', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Algiers' }).format(new Date(iso));

export async function notifySlotFreed(log: FastifyBaseLogger, slot: FreedSlot): Promise<void> {
  try {
    // Un créneau passé ne se libère pour personne.
    if (new Date(slot.startsAt).getTime() < Date.now()) return;
    const salon = await db.from('salons').select('id, slug, name, is_published').eq('id', slot.salonId).maybeSingle();
    if (salon.error) throw salon.error;
    if (!salon.data?.is_published) return;
    const day = toLocalDateKey(new Date(slot.startsAt));
    const url = `/s/${salon.data.slug}/prestations?date=${day}`;
    const when = fmtWhen(slot.startsAt);

    const alerts = await db.from('slot_alerts').select('id, client_id').eq('salon_id', slot.salonId).eq('day', day).is('notified_at', null);
    if (alerts.error) throw alerts.error;
    const alerted = new Set((alerts.data ?? []).map((a) => a.client_id as string));

    let later = db
      .from('bookings')
      .select('client_id, starts_at')
      .eq('salon_id', slot.salonId)
      .in('status', ['pending', 'confirmed'])
      .not('client_id', 'is', null)
      .gt('starts_at', slot.endsAt)
      .order('starts_at', { ascending: false })
      .limit(SLOT_FREED_MAX_LATER_CLIENTS * 3);
    if (slot.serviceId) later = later.eq('service_id', slot.serviceId);
    if (slot.excludeBookingId) later = later.neq('id', slot.excludeBookingId);
    const laterRes = await later;
    if (laterRes.error) throw laterRes.error;
    const laterClients: string[] = [];
    for (const b of laterRes.data ?? []) {
      const id = b.client_id as string;
      if (alerted.has(id) || laterClients.includes(id)) continue;
      laterClients.push(id);
      if (laterClients.length >= SLOT_FREED_MAX_LATER_CLIENTS) break;
    }
    if (alerted.size === 0 && laterClients.length === 0) return;

    const base = { salon_id: slot.salonId, salon_slug: salon.data.slug, starts_at: slot.startsAt, url, type: 'slot_freed' };
    const rows = [
      ...[...alerted].map((user_id) => ({
        user_id,
        type: 'slot_freed',
        title: 'Un créneau s’est libéré',
        body: `${salon.data!.name} · ${when} · premier arrivé, premier servi`,
        data: base,
        booking_id: null,
      })),
      ...laterClients.map((user_id) => ({
        user_id,
        type: 'slot_freed',
        title: 'Un créneau plus tôt s’est libéré',
        body: `${salon.data!.name} · ${when} · avancez votre rendez-vous si vous le souhaitez`,
        data: base,
        booking_id: null,
      })),
    ];
    const ins = await db.from('notifications').insert(rows);
    if (ins.error) throw ins.error;
    if (alerts.data?.length) {
      const upd = await db.from('slot_alerts').update({ notified_at: new Date().toISOString() }).in('id', alerts.data.map((a) => a.id));
      if (upd.error) throw upd.error;
    }
    await dispatchPendingPush(log);
    log.info({ salonId: slot.salonId, day, alerted: alerted.size, later: laterClients.length }, 'créneau libéré : clients prévenus');
  } catch (err) {
    log.error({ err, slot }, 'notifySlotFreed');
  }
}
