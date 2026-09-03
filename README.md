# SalonDZ

Réservation en ligne et agenda pour salons de coiffure, barbers et instituts en Algérie.
Deux espaces : **professionnels** (salon, services, équipe, agenda temps réel) et **clients** (recherche, page salon, prise de RDV, historique).

- Devise : Dinar algérien (DA) uniquement · Fuseau : Africa/Algiers · Semaine : **dimanche → samedi**
- Pensé pour la 4G moyenne : pages publiques en une requête, cache HTTP + ETag, images compressées côté client.

## Structure du monorepo (pnpm + Turborepo)

```
apps/
  api/      Fastify 5 + TypeScript + Zod  → Fly.io      (port 8080)
  web/      React 19 + Vite 7 + TypeScript → Cloudflare Pages
  mobile/   React Native + Expo SDK 54 + Expo Router → EAS (iOS + Android)
packages/
  constants/   wilayas, catégories, DA, dates (dimanche), téléphone DZ
  types/       entités + DTO partagés
  validation/  schémas Zod partagés front ↔ back
  api-client/  client HTTP typé + hooks TanStack Query (web + mobile)
supabase/
  migrations/  schéma Postgres, RLS, fonctions atomiques, cron
scripts/
  db-migrate.mjs  applique les migrations (table public.schema_migrations)
```

## Démarrage

Prérequis : Node ≥ 20.19, pnpm 10 (`corepack enable`).

```bash
pnpm install
cp .env.example .env        # puis renseigner les clés Supabase
pnpm db:migrate             # applique supabase/migrations/*.sql
pnpm dev:api                # http://localhost:8080/health
pnpm dev:web                # http://localhost:5173
pnpm dev:mobile             # Expo (scanner le QR avec Expo Go / dev build)
```

Tests :

```bash
pnpm --filter @salondz/validation test    # unitaires (Zod)
pnpm --filter @salondz/api test           # e2e contre Supabase (crée/supprime des utilisateurs jetables)
pnpm typecheck
```

## Variables d'environnement

Voir `.env.example`. Résumé :

| Variable | Où | Rôle |
| --- | --- | --- |
| `SUPABASE_URL` | api | URL du projet |
| `SUPABASE_PUBLISHABLE_KEY` | api, web (`VITE_`), mobile (`EXPO_PUBLIC_`) | clé publique |
| `SUPABASE_SECRET_KEY` | api uniquement | contourne la RLS, jamais côté front |
| `SUPABASE_JWT_SECRET` | api | secours HS256 (les tokens sont ES256 via JWKS) |
| `DATABASE_URL` | scripts | migrations (mot de passe URL-encodé) |
| `INTERNAL_CRON_TOKEN` | api + `app_settings.cron_token` | protège `/internal/cron/tick` |
| `CORS_ORIGINS` | api | origines web autorisées (CSV) |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` / `EXPO_PUBLIC_SENTRY_DSN` | tous | monitoring (free tier) |

## Modèle de données (Supabase / Postgres)

`profiles` (1:1 auth.users, rôle client/pro) · `salons` (slug, wilaya, ville, publication, cadence des créneaux, délai/horizon de réservation) · `salon_categories` · `salon_photos` · `services` (durée, prix DA) · `staff` (membres, un créé automatiquement) · `opening_hours` (0 = dimanche) · `staff_hours` (facultatif, intersecté avec le salon) · `time_blocks` (congés/pauses) · `bookings` (snapshots service/prix, statut, source) · `reviews` · `favorites` · `push_tokens` · `notifications`.

### Réservation atomique

- Contrainte d'exclusion GiST sur `bookings (staff_id, tstzrange(starts_at, ends_at))` pour les statuts `pending`/`confirmed` : **la base refuse physiquement deux réservations qui se chevauchent**, quelle que soit la concurrence.
- `create_booking(...)` (security definer) valide salon publié, service actif, délai minimum, horizon, appartenance du créneau à `get_available_slots(...)`, puis insère ; si "n'importe quel membre" est demandé, elle essaie chaque membre disponible et rattrape `exclusion_violation`.
- `get_available_slots(salon, service, date, staff?)` est **l'unique source de vérité** des créneaux (horaires salon ∩ horaires membre − réservations − blocages).
- Supabase Realtime (`bookings`, `notifications`) sert uniquement à rafraîchir l'affichage.

### RLS

Activée partout. Lecture publique des salons publiés (et de leurs services/équipe/horaires) ; écriture réservée au propriétaire (`is_salon_owner`). Les réservations ne s'insèrent que via les fonctions (`book_slot` pour un client authentifié, `create_booking` réservée au service). L'API utilise la clé secrète et applique elle-même les contrôles d'accès dans ses preHandlers.

## API (Fastify) — préfixe `/v1`

Public : `GET /categories`, `GET /wilayas`, `GET /salons?q&wilaya&city&category&gender&lat&lng`, `GET /salons/:slug`, `GET /salons/:id/availability?serviceId&date&staffId`, `GET /salons/:id/reviews`.
Compte : `GET|PATCH /me`, `POST /me/role`, `POST|DELETE /me/push-tokens`, `GET /me/notifications`, `POST /me/notifications/read`, `GET|PUT|DELETE /me/favorites`.
Client : `POST /bookings`, `GET /me/bookings?scope=upcoming|past`, `GET /bookings/:id`, `POST /bookings/:id/cancel|reschedule|review`.
Pro : `GET|POST|PATCH /pro/salon`, `PUT /pro/salon/photos|hours`, `GET /pro/stats`, `POST|PATCH|DELETE /pro/services`, `PUT /pro/services/reorder`, `POST|PATCH|DELETE /pro/staff`, `GET|PUT /pro/staff/:id/hours`, `GET|POST|DELETE /pro/blocks`, `GET /pro/bookings?from&to&status&staffId`, `GET /pro/bookings/pending`, `POST /pro/bookings` (client de passage), `POST /pro/bookings/:id/status|cancel|reschedule`.
Interne : `POST /internal/cron/tick` (Bearer `INTERNAL_CRON_TOKEN`) — rappels J-1, clôture auto, envoi des push.

Erreurs : `{ "error": { "code", "message", "details?" } }` avec codes métier stables (`SLOT_TAKEN`, `OUTSIDE_OPENING_HOURS`, `TOO_SOON`, `TOO_FAR`, `CANNOT_PUBLISH`, `CANCEL_TOO_LATE`, …).

Auth : JWT Supabase vérifié localement (JWKS ES256, secours HS256). OTP par **email** (l'OTP SMS est désactivé sur le projet : à activer plus tard avec un fournisseur SMS).

## Déploiement (plans gratuits)

- **Supabase** : migrations via `pnpm db:migrate`. Après déploiement de l'API, renseigner `app_settings` (`api_url`, `cron_token`) pour activer le cron (`0003_cron_tick.sql`).
- **API → Fly.io** : `fly launch --no-deploy --copy-config --config apps/api/fly.toml` puis `fly secrets set ...` puis `fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile .` (depuis la racine). Machine `shared-cpu-1x` 256 Mo, auto-stop/auto-start. Workflow GitHub `deploy-api.yml` (secret `FLY_API_TOKEN`).
- **Web → Cloudflare Pages** : build command `pnpm --filter @salondz/web build`, output `apps/web/dist`, variables `VITE_*`. `_redirects` gère le SPA.
- **Mobile → EAS** : `eas build --profile preview --platform android` (APK interne) ; push via Expo Push (gratuit).
- **Sentry** : renseigner les DSN.

## Conventions

- Semaine dimanche-samedi partout (`WEEK_STARTS_ON = 0`, `weekKeys()`), heures locales `Africa/Algiers`, prix entiers en DA (`formatDA`).
- Téléphones normalisés en E.164 (`+213…`) via `phoneDZ`.
- snake_case en base, camelCase dans l'API/front (`camelize`).
- Toute nouvelle règle métier de réservation vit dans SQL (`get_available_slots` / `create_booking`), jamais dupliquée côté front.
