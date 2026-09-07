import type { FastifyBaseLogger } from 'fastify';
import { db } from './supabase';
import { loadOwnedSalon } from '../plugins/auth';

const COVER = 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=900&q=75&auto=format&fit=crop';
const LOGO = 'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=400&q=75&auto=format&fit=crop';

const DEMO_SERVICES = [
  { name: 'Coupe homme', duration_minutes: 30, price_da: 900, category_id: 'coiffure' },
  { name: 'Coupe femme', duration_minutes: 45, price_da: 1800, category_id: 'coiffure-lissage' },
  { name: 'Barbe', duration_minutes: 20, price_da: 500, category_id: 'coiffure' },
  { name: 'Brushing', duration_minutes: 30, price_da: 1200, category_id: 'coiffure-lissage' },
];

/**
 * Salon de démonstration prêt à l'emploi pour le compte pro à accès direct : publié, unisexe,
 * avec prestations, équipe (membre par défaut créé par trigger) et horaires 7j/7. Idempotent :
 * ne fait rien si le propriétaire possède déjà un salon. Best-effort : n'interrompt pas la connexion.
 */
export async function ensureDemoProSalon(log: FastifyBaseLogger, ownerId: string): Promise<void> {
  try {
    const existing = await loadOwnedSalon(ownerId);
    if (existing) return;

    const created = await db
      .from('salons')
      .insert({
        owner_id: ownerId,
        name: 'Salon Démo',
        description: 'Salon de démonstration : coupe, barbe et brushing. Réservation en ligne, paiement sur place.',
        phone: '+213551234567',
        wilaya_code: 16,
        city: 'Alger-Centre',
        zone: 'Alger-Centre',
        address: '3 rue Didouche Mourad',
        lat: 36.7728,
        lng: 3.0588,
        gender_target: 'unisex',
        is_published: true,
        auto_confirm: true,
        cover_url: COVER,
        logo_url: LOGO,
      })
      .select('id')
      .single();
    if (created.error || !created.data) {
      log.warn({ err: created.error }, 'demo salon insert');
      return;
    }
    const salonId = created.data.id as string;

    const [cats, hours, services, photo] = await Promise.all([
      db.from('salon_categories').insert([
        { salon_id: salonId, category_id: 'coiffure' },
        { salon_id: salonId, category_id: 'coiffure-lissage' },
      ]),
      db.from('opening_hours').insert(
        [0, 1, 2, 3, 4, 5, 6].map((d) => ({ salon_id: salonId, day_of_week: d, opens_at: '09:00', closes_at: '19:00', is_closed: false })),
      ),
      db.from('services').insert(DEMO_SERVICES.map((s, i) => ({ salon_id: salonId, ...s, is_active: true, sort_order: i }))),
      db.from('salon_photos').insert({ salon_id: salonId, url: COVER, sort_order: 0 }),
    ]);
    for (const r of [cats, hours, services, photo]) if (r.error) log.warn({ err: r.error }, 'demo salon content');
    log.info({ salonId }, 'demo pro salon créé');
  } catch (err) {
    log.warn({ err }, 'ensureDemoProSalon');
  }
}
