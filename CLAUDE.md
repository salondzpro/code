# SalonDZ — notes pour Claude Code

Monorepo pnpm : `apps/api` (Fastify), `apps/web` (Vite/React), `apps/mobile` (Expo), `packages/*` (constants, types, validation, api-client), `supabase/migrations`.

## Commandes
- `pnpm install` · `pnpm typecheck` · `pnpm --filter @salondz/validation test` · `pnpm --filter @salondz/api test` (e2e réel contre Supabase, crée puis supprime des utilisateurs jetables)
- `pnpm --filter @salondz/web test:e2e` : parcours complet pro + client dans Chromium headless (playwright-core) ; exige `pnpm dev:api` + `pnpm dev:web` lancés, `PLAYWRIGHT_CHROME` si Chrome n'est pas installé. Captures dans `apps/web/test/shots/`.
- `pnpm db:migrate` (lit `DATABASE_URL` dans `.env`, suit `public.schema_migrations`). Les migrations déjà appliquées sont immuables : toute correction = nouveau fichier `000N_*.sql`.
- API locale : `pnpm dev:api` sur le port `PORT` du `.env` (8787 en local, 8080 sur Fly).

## Règles métier non négociables
- Devise DA uniquement (`formatDA`), jamais d'euros. Fuseau `Africa/Algiers`. Semaine **dimanche → samedi** (`WEEK_STARTS_ON = 0`, `weekKeys()`), `day_of_week` 0 = dimanche.
- Anti-double réservation = contrainte d'exclusion GiST sur `bookings` + fonctions SQL `create_booking` / `reschedule_booking` / `get_available_slots`. Ne jamais réimplémenter la logique de créneaux côté API/front ; Realtime = affichage seulement.
- Téléphones normalisés E.164 `+213…` via `phoneDZ` ; snake_case en base, camelCase dans l'API (`camelize`).
- Textes UI en français ; prévoir l'arabe (RTL) plus tard via `packages/constants` (labels `*_AR`).

## Cache HTTP (API publique)
- Listes/salons : `public, max-age=60, stale-while-revalidate=600` (4G : réponses instantanées en revisite). Chrome ressert la copie périmée et ne revalide qu'en arrière-plan : pour une ressource qui doit refléter immédiatement une écriture de l'utilisateur (avis), utiliser `public, no-cache` (ETag → 304). Le propriétaire reçoit toujours `private, no-cache`.

## Sécurité
- `SUPABASE_SECRET_KEY` et `DATABASE_URL` : API/scripts seulement, jamais dans web/mobile ni dans git (`.env*` ignoré, `.env.example` sans secret).
- L'API contourne la RLS (clé secrète) : chaque route protégée passe par `requireAuth` / `requireProfile` / `requireSalon` et vérifie l'appartenance (`salon_id`, `client_id`).

## Design
- Le design Claude Design (`App Beaute Hi-Fi.dc.html`) fait foi pour web et mobile : couleurs, composants, mises en page, animations, illustrations. Pas de réinvention.
