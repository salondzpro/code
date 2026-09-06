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
- Règles du salon appliquées en SQL (`create_booking_multi`, `reschedule_booking` avec `p_enforce_rules`) : délai minimum, horizon, annulation/report jusqu'à `cancel_min_hours`, report client désactivable (`allow_client_reschedule`). Les fonctions d'écriture sont révoquées pour `anon`/`authenticated` (migration 0009) : seule l'API (clé secrète) les appelle.
- Garde-fous API (`packages/constants/src/booking.ts`) : au plus `MAX_UPCOMING_BOOKINGS_PER_CLIENT` rendez-vous à venir par client, pas de doublon du même client sur un horaire qui chevauche (`ALREADY_BOOKED`), plafonds équipe/catalogue, blocage ≤ 1 an. Transitions pro : `confirmed` impossible après l'heure (`BOOKING_EXPIRED`), `no_show` impossible avant l'heure (`NOT_STARTED`). Le cron (`/internal/cron/tick`) expire les demandes `pending` passées (`cancelled_by = 'system'`).
- Téléphones normalisés E.164 `+213…` via `phoneDZ` ; snake_case en base, camelCase dans l'API (`camelize`). Un numéro vérifié par OTP (dans le jeton) n'est pas modifiable via `PATCH /me` ; le lien (`slug`) du salon est définitif.
- Textes UI en français ; prévoir l'arabe (RTL) plus tard via `packages/constants` (labels `*_AR`).

## Cache HTTP (API publique)
- Listes/salons : `public, max-age=60, stale-while-revalidate=600` (4G : réponses instantanées en revisite). Chrome ressert la copie périmée et ne revalide qu'en arrière-plan : pour une ressource qui doit refléter immédiatement une écriture (avis, disponibilités), utiliser `public, no-cache` (ETag → 304). Le propriétaire reçoit toujours `private, no-cache`.

## Sécurité
- `SUPABASE_SECRET_KEY` et `DATABASE_URL` : API/scripts seulement, jamais dans web/mobile ni dans git (`.env*` ignoré, `.env.example` sans secret).
- L'API contourne la RLS (clé secrète) : chaque route protégée passe par `requireAuth` / `requireProfile` / `requireSalon` et vérifie l'appartenance (`salon_id`, `client_id`).

## Design
- Le design Claude Design (`App Beaute Hi-Fi.dc.html`) fait foi pour web et mobile : couleurs, composants, mises en page, animations, illustrations. Pas de réinvention.
- Export local : `design/split.mjs` → `design/screens/<ID>.html` (+ PNG ignorés par git) et `design/index.md` (table des écrans AUTH / C-H / C-F / PRO-F). Jetons : `apps/web/src/styles/tokens.css` et `apps/mobile/src/theme/design.ts` (mêmes valeurs).
- Web : classes du design dans `apps/web/src/styles/index.css`, primitives dans `apps/web/src/components/ui.tsx`. Mobile : primitives natives équivalentes dans `apps/mobile/src/ui/` (`Text.tsx`, `index.tsx`, `Screen.tsx`, `TabBar.tsx`, `Pickers.tsx`), écrans Expo Router sous `apps/mobile/app/` (groupes `(auth)`, `(client)`, `(pro)`, `s/[slug]`).

## Mobile (Expo)
- Vérification visuelle sans appareil : `npx expo start --web --port 8082` depuis `apps/mobile` (react-native-web), captures 390×844 avec playwright-core. Ajouter `http://localhost:8082` à `CORS_ORIGINS` du `.env` de l'API.
- Le watcher Metro ne voit pas toujours les modifications sous Windows : après une série d'éditions, redémarrer `expo start` (`--clear`) plutôt que d'attendre la reconstruction.
- Routes : les groupes `(client)` et `(pro)` ne doivent pas exposer le même chemin (`/profil` client vs `/profil-pro` pro, `/rdv/[id]` client vs `/pro-rdv/[id]` pro). `resolveNext()` dans `src/lib/authFlow.ts` traduit les chemins web (`/pro`, `/`) en routes Expo.
- Texte nu interdit hors `<Text>` : toujours passer par `Tx` / `P` / `InfoBox` (un fragment mixte dans une `View` plante sur iOS/Android).
