/**
 * Conversion snake_case (Postgres) → camelCase (API/front), récursive.
 * Les clés de `data` (jsonb libre) ne sont pas converties.
 */
const KEEP_AS_IS = new Set(['data']);

function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function camelize<T = unknown>(input: unknown): T {
  if (Array.isArray(input)) return input.map((v) => camelize(v)) as T;
  if (input && typeof input === 'object' && !(input instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[toCamel(k)] = KEEP_AS_IS.has(k) ? v : camelize(v);
    }
    return out as T;
  }
  return input as T;
}

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** camelCase → snake_case (1 niveau : payloads d'écriture). Ignore les `undefined`. */
export function snakeize(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    out[toSnake(k)] = v;
  }
  return out;
}

/** "HH:mm:ss" (time Postgres) → "HH:mm". */
export function hm(time: string): string {
  return time.slice(0, 5);
}
