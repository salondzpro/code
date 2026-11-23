/**
 * MARKETING (23 nov. 2026) — compteurs d'inscriptions par provenance et vidéos du propriétaire.
 *   - `acq_stats` (app_settings) : { "<src>|<campagne>": { client, pro, last } } ; jamais d'identité.
 *   - Seau PRIVÉ `marketing` : rushes envoyés depuis `/admin/marketing` (montage des vidéos UGC).
 */
import { STORAGE_BUCKETS, normaliserSource } from '@salondz/constants';
import type { FastifyBaseLogger } from 'fastify';
import { db } from './supabase';

type Stats = Record<string, { client: number; pro: number; last: string }>;
const KEY = 'acq_stats';

export async function readAcqStats(): Promise<Stats> {
  const r = await db.from('app_settings').select('value').eq('key', KEY).maybeSingle();
  if (r.error || !r.data?.value) return {};
  try {
    return JSON.parse(String(r.data.value)) as Stats;
  } catch {
    return {};
  }
}

/** +1 inscription pour cette provenance. Jamais bloquant pour l'inscription. */
export async function recordSignupSource(log: FastifyBaseLogger, role: 'client' | 'pro', acq: { src: string; c?: string } | undefined): Promise<void> {
  try {
    const src = normaliserSource(acq?.src);
    if (!src) return;
    const c = (acq?.c ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
    const k = `${src}|${c}`;
    const stats = await readAcqStats();
    const cur = stats[k] ?? { client: 0, pro: 0, last: '' };
    cur[role] += 1;
    cur.last = new Date().toISOString();
    stats[k] = cur;
    await db.from('app_settings').upsert({ key: KEY, value: JSON.stringify(stats), updated_at: cur.last }, { onConflict: 'key' });
  } catch (err) {
    log.warn({ err }, 'provenance d’inscription non comptée');
  }
}

/** Le seau privé des vidéos, créé à la première utilisation. */
async function seau(): Promise<void> {
  const g = await db.storage.getBucket(STORAGE_BUCKETS.marketing);
  if (g.data) return;
  const c = await db.storage.createBucket(STORAGE_BUCKETS.marketing, { public: false, fileSizeLimit: '50MB', allowedMimeTypes: ['video/*', 'image/*', 'audio/*'] });
  if (c.error && !/exists/i.test(c.error.message)) throw c.error;
}

export async function listRushes() {
  await seau();
  const r = await db.storage.from(STORAGE_BUCKETS.marketing).list('rushes', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
  if (r.error) throw r.error;
  return (r.data ?? [])
    .filter((f) => f.name && !f.name.startsWith('.'))
    .map((f) => ({ name: f.name, size: Number((f.metadata as { size?: number } | null)?.size ?? 0), createdAt: f.created_at ?? null }));
}

export async function rushUploadUrl(nom: string) {
  await seau();
  const propre = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
  const path = `rushes/${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${propre}`;
  const r = await db.storage.from(STORAGE_BUCKETS.marketing).createSignedUploadUrl(path);
  if (r.error) throw r.error;
  return { path, token: r.data.token };
}

export async function rushReadUrl(name: string) {
  const r = await db.storage.from(STORAGE_BUCKETS.marketing).createSignedUrl(`rushes/${name}`, 3600);
  if (r.error) throw r.error;
  return { url: r.data.signedUrl };
}
