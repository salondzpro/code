/**
 * NUMÉRO DU SALON VISIBLE PAR LES CLIENTS — choix du PROFESSIONNEL (26 nov. 2026, demande du
 * propriétaire). Remplace l'ancien drapeau global `SHOW_SALON_CONTACT_TO_CLIENTS` (toujours faux) :
 * chaque pro décide dans « Règles de réservation ». Désactivé par défaut : aucun numéro ne part
 * sans son accord. Sans migration : `app_settings` `salon_contact:<salon>` = `{ showPhone }`.
 * Le serveur seul décide : un numéro non autorisé n'est jamais dans la réponse (page du salon,
 * rendez-vous du client), l'écran ne fait qu'afficher ce qu'il reçoit.
 */
import { db } from './supabase';

const key = (salonId: string) => `salon_contact:${salonId}`;

export async function readShowPhone(salonId: string): Promise<boolean> {
  const r = await db.from('app_settings').select('value').eq('key', key(salonId)).maybeSingle();
  if (r.error || !r.data?.value) return false;
  try {
    return (JSON.parse(String(r.data.value)) as { showPhone?: unknown }).showPhone === true;
  } catch {
    return false;
  }
}

export async function writeShowPhone(salonId: string, showPhone: boolean): Promise<{ showPhone: boolean }> {
  const r = await db
    .from('app_settings')
    .upsert({ key: key(salonId), value: JSON.stringify({ showPhone }), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (r.error) throw r.error;
  return { showPhone };
}

/** Salons (parmi `ids`) qui montrent leur numéro. */
async function showingPhone(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const r = await db.from('app_settings').select('key, value').in('key', ids.map(key));
  if (r.error) throw r.error;
  const out = new Set<string>();
  for (const row of r.data ?? []) {
    try {
      if ((JSON.parse(String(row.value)) as { showPhone?: unknown }).showPhone === true) out.add(String(row.key).slice('salon_contact:'.length));
    } catch {
      /* valeur illisible : numéro caché */
    }
  }
  return out;
}

/** Retire le numéro des salons qui ne l'ont pas autorisé (rendez-vous vus par le client). */
export async function maskSalonPhones<T extends { salon: { id: string; phone?: string | null } }>(items: T[]): Promise<T[]> {
  const ok = await showingPhone([...new Set(items.map((b) => b.salon.id))]);
  for (const b of items) b.salon.phone = ok.has(b.salon.id) ? (b.salon.phone ?? null) : null;
  return items;
}
