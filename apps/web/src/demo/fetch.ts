/**
 * `fetch` de démonstration : intercepte les appels de l'API client (`/v1/...`) et les sert depuis le
 * monde en mémoire. Même contrat qu'un serveur (JSON, codes, `{ error: { code, message } }`), avec une
 * courte latence pour que les états de chargement de l'interface restent visibles.
 */
import { HttpError, dispatch, getWorld, type Ctx } from './handlers';
import { currentDemo, DEMO_USER_IDS } from './session';

const LATENCY_MS = 80;

export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
  const method = (init?.method ?? 'GET').toUpperCase();
  const path = url.pathname.replace(/^.*\/v1(?=\/)/, '');
  let body: Record<string, unknown> = {};
  if (init?.body) {
    try {
      body = JSON.parse(String(init.body)) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }
  await new Promise((r) => setTimeout(r, LATENCY_MS));
  const w = getWorld();
  const acct = currentDemo();
  const ctx: Ctx = { w, user: acct ? (w.profiles[DEMO_USER_IDS[acct.key]] ?? null) : null, method, path, query: url.searchParams, body, now: Date.now() };
  try {
    const r = dispatch(ctx);
    if (r.status === 204) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(r.body ?? null), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    if (err instanceof HttpError)
      return new Response(JSON.stringify({ error: { code: err.code, message: err.message, details: err.details } }), { status: err.status, headers: { 'Content-Type': 'application/json' } });
    console.error('[démo]', method, path, err);
    return new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Erreur de la démonstration.' } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

/** Fait avancer le monde (nouveautés, rappels, clôtures) ; `true` si quelque chose a changé. */
export { advance as demoAdvance, getWorld as demoWorld } from './world';
