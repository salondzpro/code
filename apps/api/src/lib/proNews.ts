/**
 * CONSEILS & NOUVEAUTÉS publiés par l'administration pour les professionnels (20 nov. 2026, demande du
 * propriétaire). Ils s'affichent EN TÊTE du rond « Conseil » de l'accueil pro, et une publication peut
 * prévenir tous les professionnels par une notification 📣 « Nouveauté Salon DZ ».
 *
 * Sans migration : la liste vit dans `app_settings` (`pro_news`, la plus récente d'abord, 30 au plus),
 * et la notification réutilise le type `booking_completed` avec `data.kind = 'news'` — même procédé
 * que la fidélité (`lib/loyalty.ts`) ; `lib/pushContent.ts` lui donne son emoji.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import { db } from './supabase';
import { dispatchPendingPush } from './push';

export interface ProNews {
  id: string;
  title: string;
  body: string;
  /** Destination dans l'espace pro (« /pro/… ») ou adresse web complète, facultative. */
  url: string | null;
  /** Texte du bouton qui mène à `url`. */
  action: string | null;
  createdAt: string;
}

const KEY = 'pro_news';
const MAX = 30;

export async function readProNews(): Promise<ProNews[]> {
  const res = await db.from('app_settings').select('value').eq('key', KEY).maybeSingle();
  if (res.error || !res.data?.value) return [];
  try {
    const v = JSON.parse(res.data.value as string) as ProNews[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function writeProNews(items: ProNews[]): Promise<void> {
  const res = await db
    .from('app_settings')
    .upsert({ key: KEY, value: JSON.stringify(items.slice(0, MAX)), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (res.error) throw res.error;
}

export async function addProNews(input: { title: string; body: string; url?: string | null; action?: string | null }): Promise<ProNews> {
  const item: ProNews = {
    id: randomUUID(),
    title: input.title.trim(),
    body: input.body.trim(),
    url: input.url?.trim() || null,
    action: input.url?.trim() ? input.action?.trim() || null : null,
    createdAt: new Date().toISOString(),
  };
  await writeProNews([item, ...(await readProNews())]);
  return item;
}

export async function removeProNews(id: string): Promise<boolean> {
  const items = await readProNews();
  const rest = items.filter((x) => x.id !== id);
  if (rest.length === items.length) return false;
  await writeProNews(rest);
  return true;
}

/**
 * Prévient TOUS les professionnels (comptes `pro`) : une notification chacun, puis l'envoi poussé.
 * Rend le nombre de professionnels prévenus. Jamais bloquant pour l'appelant au-delà de l'insertion.
 */
export async function notifyProsOfNews(log: FastifyBaseLogger, item: ProNews): Promise<number> {
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await db.from('profiles').select('id').eq('role', 'pro').range(from, from + 999);
    if (r.error) throw r.error;
    ids.push(...(r.data ?? []).map((p) => p.id as string));
    if ((r.data ?? []).length < 1000) break;
  }
  if (!ids.length) return 0;
  const rows = ids.map((user_id) => ({
    user_id,
    type: 'booking_completed',
    title: 'Nouveauté Salon DZ',
    body: item.title,
    data: { kind: 'news', audience: 'pro', newsId: item.id, url: '/pro?conseil=1' },
    booking_id: null,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const ins = await db.from('notifications').insert(rows.slice(i, i + 500));
    if (ins.error) throw ins.error;
  }
  void dispatchPendingPush(log).catch((err) => log.error({ err }, 'nouveautés : envoi poussé'));
  return ids.length;
}
