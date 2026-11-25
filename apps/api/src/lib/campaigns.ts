/**
 * CAMPAGNES DE NOTIFICATIONS (25 nov. 2026, demande du propriétaire : « envoyer des notifications
 * manuellement ou automatiquement, à tout le monde ou à des publics filtrés, avec la redirection »).
 *
 * Une campagne = un texte (titre + message), une DESTINATION par public (où mène le toucher), un
 * PUBLIC décrit par des filtres, et un MOMENT : tout de suite, à une date, ou en RÉPÉTITION
 * (chaque jour / semaine / mois — c'est l'envoi « automatique »).
 *
 * L'envoi ne réinvente rien : une ligne dans `notifications` par personne, puis la chaîne
 * habituelle (`dispatchPendingPush`) — iPhone, Android, navigateur, séparation stricte des deux
 * applications (`appMatchesRole`), réservation anti-doublon, badge, nettoyage des jetons morts.
 * Le texte apparaît aussi dans la liste des notifications de l'application, même sans téléphone
 * inscrit : personne ne la rate, elle arrive seulement sans sonner.
 *
 * Sans migration : la liste vit dans `app_settings` (`push_campaigns`) ; une campagne RÉPÉTÉE
 * retient ses destinataires (`push_campaign_sent:<id>`) et ne touche jamais deux fois la même
 * personne — « inscrits depuis moins d'un jour » chaque matin devient un message de bienvenue.
 * Type de notification : `booking_completed` + `data.kind = 'campaign'` (même procédé que les
 * nouveautés, `lib/proNews.ts` ; l'énumération n'a pas de type dédié).
 *
 * Qui peut-on toucher ? Les COMPTES. Une application installée sans compte n'a pas d'identité côté
 * serveur (son jeton n'est rattaché à personne) : elle ne peut pas être visée.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import { db } from './supabase';
import { CLIENT_APP_ID, PRO_APP_ID, dispatchPendingPush } from './push';
import { readAllPlans } from './plans';
import { isWebPushToken } from './webpush';

export type CampaignRole = 'all' | 'client' | 'pro';
export type CampaignDevice = 'any' | 'app' | 'no_app' | 'push' | 'no_push';
export type CampaignPlan = 'any' | 'free' | 'paid' | 'pro' | 'salon';
export type CampaignMarket = 'any' | 'women' | 'men';
export type CampaignRepeat = 'none' | 'daily' | 'weekly' | 'monthly';

export interface CampaignAudience {
  role: CampaignRole;
  /** Application installée (jeton de l'application mobile), notifications actives (n'importe quel appareil)… */
  device: CampaignDevice;
  /** Professionnels seulement : offre du salon. */
  plan: CampaignPlan;
  /** Clientes / clients seulement : côté de la place de marché. */
  market: CampaignMarket;
  /** Inscrits depuis moins de N jours (null = tout le monde). */
  newSinceDays: number | null;
  /** Inscrits depuis PLUS de N jours (null = tout le monde). */
  olderThanDays: number | null;
}

export interface CampaignRun {
  at: string;
  /** Personnes visées par les filtres. */
  targeted: number;
  /** Notifications créées (les répétitions sautent ceux déjà touchés). */
  created: number;
}

export interface Campaign {
  id: string;
  title: string;
  body: string;
  /** Destination du toucher, côté clientes/clients (chemin de l'application, « /… »). */
  urlClient: string | null;
  /** Destination du toucher, côté professionnels (« /pro/… »). */
  urlPro: string | null;
  audience: CampaignAudience;
  /** `scheduled` = attend son moment ; `done` = envoyée (unique) ; `cancelled` = arrêtée. */
  status: 'scheduled' | 'sending' | 'done' | 'cancelled';
  repeat: CampaignRepeat;
  /** Prochain envoi (ISO) ; null une fois terminée. */
  nextAt: string | null;
  createdAt: string;
  createdBy: string;
  runs: CampaignRun[];
}

const KEY = 'push_campaigns';
const MAX = 200;
const sentKey = (id: string) => `push_campaign_sent:${id}`;

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const r = await db.from('app_settings').select('value').eq('key', key).maybeSingle();
  if (r.error || !r.data?.value) return fallback;
  try {
    return JSON.parse(r.data.value as string) as T;
  } catch {
    return fallback;
  }
}
async function writeSetting(key: string, value: unknown): Promise<void> {
  const r = await db.from('app_settings').upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (r.error) throw r.error;
}

export async function readCampaigns(): Promise<Campaign[]> {
  const v = await readSetting<Campaign[]>(KEY, []);
  return Array.isArray(v) ? v : [];
}
async function writeCampaigns(items: Campaign[]): Promise<void> {
  await writeSetting(KEY, items.slice(0, MAX));
}
async function updateCampaign(id: string, patch: (c: Campaign) => Campaign): Promise<Campaign | null> {
  const items = await readCampaigns();
  const i = items.findIndex((c) => c.id === id);
  if (i < 0) return null;
  items[i] = patch(items[i]!);
  await writeCampaigns(items);
  return items[i]!;
}

// ------------------------------------------------------------------ public

interface Person {
  id: string;
  role: 'client' | 'pro';
}

/** Les personnes que désignent les filtres. */
export async function resolveAudience(a: CampaignAudience): Promise<Person[]> {
  const people: { id: string; role: string; market: string | null; created_at: string }[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from('profiles').select('id, role, market, created_at').is('suspended_at', null).order('created_at').range(from, from + 999);
    if (a.role !== 'all') q = q.eq('role', a.role);
    const r = await q;
    if (r.error) throw r.error;
    people.push(...((r.data ?? []) as typeof people));
    if ((r.data ?? []).length < 1000) break;
  }
  const now = Date.now();
  let list = people.filter((p) => p.role === 'client' || p.role === 'pro');
  if (a.newSinceDays != null) list = list.filter((p) => now - Date.parse(p.created_at) <= a.newSinceDays! * 86_400_000);
  if (a.olderThanDays != null) list = list.filter((p) => now - Date.parse(p.created_at) >= a.olderThanDays! * 86_400_000);
  // Côté de la place de marché : un critère de CLIENT — un professionnel n'en a pas et reste dans la liste.
  if (a.market !== 'any') list = list.filter((p) => p.role === 'pro' || p.market === a.market);

  // Offre du salon : un critère de PROFESSIONNEL — les clients restent dans la liste.
  if (a.plan !== 'any') {
    const proIds = list.filter((p) => p.role === 'pro').map((p) => p.id);
    const salons = new Map<string, string>();
    for (let i = 0; i < proIds.length; i += 500) {
      const r = await db.from('salons').select('id, owner_id').in('owner_id', proIds.slice(i, i + 500));
      if (r.error) throw r.error;
      for (const s of r.data ?? []) if (!salons.has(s.owner_id as string)) salons.set(s.owner_id as string, s.id as string);
    }
    const plans = await readAllPlans();
    const planOf = (owner: string) => {
      const salon = salons.get(owner);
      return (salon && plans.get(salon)?.plan) || 'free';
    };
    list = list.filter((p) => {
      if (p.role !== 'pro') return true;
      const plan = planOf(p.id);
      if (a.plan === 'free') return plan === 'free';
      if (a.plan === 'paid') return plan !== 'free';
      return plan === a.plan;
    });
  }

  // Appareils : application mobile installée (de SON côté) ; notifications actives (tout appareil).
  if (a.device !== 'any') {
    const ids = list.map((p) => p.id);
    const app = new Set<string>();
    const any = new Set<string>();
    const roleOf = new Map(list.map((p) => [p.id, p.role] as const));
    for (let i = 0; i < ids.length; i += 500) {
      const r = await db.from('push_tokens').select('user_id, token, app_id').in('user_id', ids.slice(i, i + 500));
      if (r.error) throw r.error;
      for (const t of r.data ?? []) {
        const uid = t.user_id as string;
        const role = roleOf.get(uid);
        const appId = (t.app_id as string | null) ?? null;
        // Un jeton de l'AUTRE application ne compte pas : il ne recevra rien (séparation stricte).
        if (appId && appId !== (role === 'pro' ? PRO_APP_ID : CLIENT_APP_ID)) continue;
        any.add(uid);
        if (!isWebPushToken(t.token as string)) app.add(uid);
      }
    }
    list = list.filter((p) => {
      if (a.device === 'app') return app.has(p.id);
      if (a.device === 'no_app') return !app.has(p.id);
      if (a.device === 'push') return any.has(p.id);
      return !any.has(p.id);
    });
  }
  return list.map((p) => ({ id: p.id, role: p.role as 'client' | 'pro' }));
}

/** Combien de personnes, dont combien recevront sur un téléphone ou un navigateur. */
export async function previewAudience(a: CampaignAudience): Promise<{ total: number; clients: number; pros: number; reachable: number }> {
  const people = await resolveAudience(a);
  // Joignables sur un appareil = l'intersection du public avec « notifications actives ».
  let reachable = people.length;
  if (a.device === 'no_push') reachable = 0;
  else if (a.device !== 'push' && a.device !== 'app') {
    const avecAppareil = new Set((await resolveAudience({ ...a, device: 'push' })).map((p) => p.id));
    reachable = people.filter((p) => avecAppareil.has(p.id)).length;
  }
  return {
    total: people.length,
    clients: people.filter((p) => p.role === 'client').length,
    pros: people.filter((p) => p.role === 'pro').length,
    reachable,
  };
}

// ------------------------------------------------------------------ envoi

function nextOccurrence(from: string, repeat: CampaignRepeat): string | null {
  if (repeat === 'none') return null;
  const d = new Date(from);
  if (repeat === 'daily') d.setUTCDate(d.getUTCDate() + 1);
  else if (repeat === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  // Jamais dans le passé (serveur arrêté plusieurs jours) : la prochaine échéance à venir.
  while (d.getTime() <= Date.now()) {
    if (repeat === 'daily') d.setUTCDate(d.getUTCDate() + 1);
    else if (repeat === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
    else d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d.toISOString();
}

/** Crée les notifications d'une campagne et lance l'envoi poussé. Rend le compte rendu. */
async function deliver(log: FastifyBaseLogger, c: Campaign, only?: Person[]): Promise<CampaignRun> {
  const people = only ?? (await resolveAudience(c.audience));
  let targets = people;
  let dejaTouches: string[] = [];
  if (!only && c.repeat !== 'none') {
    dejaTouches = await readSetting<string[]>(sentKey(c.id), []);
    const vu = new Set(dejaTouches);
    targets = people.filter((p) => !vu.has(p.id));
  }
  const rows = targets.map((p) => ({
    user_id: p.id,
    type: 'booking_completed',
    title: c.title,
    body: c.body,
    data: {
      kind: 'campaign',
      campaignId: c.id,
      audience: p.role,
      ...((p.role === 'pro' ? c.urlPro : c.urlClient) ? { url: p.role === 'pro' ? c.urlPro : c.urlClient } : {}),
    },
    booking_id: null,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const ins = await db.from('notifications').insert(rows.slice(i, i + 500));
    if (ins.error) throw ins.error;
  }
  if (!only && c.repeat !== 'none' && targets.length) await writeSetting(sentKey(c.id), [...dejaTouches, ...targets.map((p) => p.id)]);
  // L'envoi poussé travaille par lots de 200 : on vide la file en arrière-plan.
  void (async () => {
    for (let k = 0; k < Math.ceil(rows.length / 200) + 2; k++) {
      const n = await dispatchPendingPush(log).catch((err) => {
        log.error({ err }, 'campagne : envoi poussé');
        return -1;
      });
      if (n <= 0 && k > Math.ceil(rows.length / 200)) break;
    }
  })();
  return { at: new Date().toISOString(), targeted: people.length, created: rows.length };
}

export async function createCampaign(
  log: FastifyBaseLogger,
  input: Omit<Campaign, 'id' | 'status' | 'nextAt' | 'createdAt' | 'runs'> & { sendAt: string | null },
): Promise<Campaign> {
  const now = new Date().toISOString();
  const immediate = !input.sendAt || input.sendAt <= now;
  const c: Campaign = {
    id: randomUUID(),
    title: input.title,
    body: input.body,
    urlClient: input.urlClient,
    urlPro: input.urlPro,
    audience: input.audience,
    repeat: input.repeat,
    status: 'scheduled',
    nextAt: immediate ? now : input.sendAt,
    createdAt: now,
    createdBy: input.createdBy,
    runs: [],
  };
  await writeCampaigns([c, ...(await readCampaigns())]);
  if (immediate) return (await runCampaign(log, c.id)) ?? c;
  return c;
}

/** Exécute une campagne maintenant, puis prépare sa prochaine échéance (ou la termine). */
export async function runCampaign(log: FastifyBaseLogger, id: string): Promise<Campaign | null> {
  const c = (await readCampaigns()).find((x) => x.id === id);
  if (!c || c.status === 'cancelled' || c.status === 'done') return c ?? null;
  await updateCampaign(id, (x) => ({ ...x, status: 'sending' }));
  try {
    const run = await deliver(log, c);
    return await updateCampaign(id, (x) => {
      const nextAt = nextOccurrence(x.nextAt ?? run.at, x.repeat);
      return { ...x, runs: [run, ...x.runs].slice(0, 30), status: nextAt ? 'scheduled' : 'done', nextAt };
    });
  } catch (err) {
    log.error({ err, id }, 'campagne : échec');
    await updateCampaign(id, (x) => ({ ...x, status: 'scheduled' }));
    throw err;
  }
}

export async function cancelCampaign(id: string): Promise<Campaign | null> {
  return updateCampaign(id, (x) => ({ ...x, status: 'cancelled', nextAt: null }));
}

/** Envoi d'ESSAI : à la seule personne qui le demande, dans son application. */
export async function testCampaign(
  log: FastifyBaseLogger,
  me: Person,
  input: Pick<Campaign, 'title' | 'body' | 'urlClient' | 'urlPro'>,
): Promise<CampaignRun> {
  const fake: Campaign = {
    ...input,
    id: `essai-${randomUUID()}`,
    audience: { role: 'all', device: 'any', plan: 'any', market: 'any', newSinceDays: null, olderThanDays: null },
    status: 'scheduled',
    repeat: 'none',
    nextAt: null,
    createdAt: new Date().toISOString(),
    createdBy: me.id,
    runs: [],
  };
  return deliver(log, fake, [me]);
}

/** Cron : les campagnes arrivées à échéance (programmées et répétitions). Rend le nombre exécuté. */
export async function runDueCampaigns(log: FastifyBaseLogger): Promise<number> {
  const now = new Date().toISOString();
  const due = (await readCampaigns()).filter((c) => c.status === 'scheduled' && c.nextAt && c.nextAt <= now);
  let n = 0;
  for (const c of due) {
    try {
      await runCampaign(log, c.id);
      n++;
    } catch {
      /* journalisé dans runCampaign ; la suivante passe quand même */
    }
  }
  return n;
}
