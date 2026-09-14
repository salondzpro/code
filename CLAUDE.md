# SalonDZ — notes pour Claude Code

Monorepo pnpm : `apps/api` (Fastify), `apps/web` (Vite/React), `apps/mobile` (Expo), `packages/*` (constants, types, validation, api-client), `supabase/migrations`.

## Commandes
- `pnpm install` · `pnpm typecheck` · `pnpm --filter @salondz/validation test` · `pnpm --filter @salondz/api test` (e2e réel contre Supabase, crée puis supprime des utilisateurs jetables)
- `pnpm --filter @salondz/web test:e2e` : parcours complet pro + client dans Chromium headless (playwright-core) ; exige `pnpm dev:api` (8090) + `pnpm dev:web` (9000) lancés, `PLAYWRIGHT_CHROME` si Chrome n'est pas installé. Captures dans `apps/web/test/shots/`.
- `pnpm test:e2e:mobile` : parcours client + pro sur l'app mobile rendue par Expo web (`apps/mobile/test/smoke.e2e.mjs`) ; exige `pnpm dev:api` et, depuis `apps/mobile`, `CI=1 EXPO_PUBLIC_API_URL=http://localhost:8090 npx expo start --web --port 8082`. Captures dans `apps/mobile/test/shots/`.
- `pnpm demo:seed` / `pnpm demo:cleanup` : deux salons de démonstration (Sarah Beauty Studio, Amine Barber) + une cliente avec rendez-vous, pour captures et tests manuels ; sessions dans `scripts/.demo.json` (gitignoré). Exige `pnpm dev:api`.
- `pnpm check:realtime` : rejoue contre la **prod** le scénario « le pro est sur son accueil, la cliente réserve » et dit si l'événement Realtime arrive sans actualiser (`scripts/check-realtime.mjs`, comptes de démonstration, rendez-vous de test annulé à la fin). À lancer après toute modification du temps réel ou de la publication Postgres.
- `pnpm check:contact` : ouvre les écrans clients en **prod** et vérifie qu'aucun numéro, appel ou WhatsApp du salon n'y apparaît (drapeau `SHOW_SALON_CONTACT_TO_CLIENTS`).
- `pnpm check:for-other` : réservation POUR QUELQU'UN D'AUTRE contre la **prod** — le rendez-vous atterrit sur le compte de la personne quand son numéro en a un, sinon sur son numéro seul ; qui a réservé est conservé ; celui qui a réservé le retrouve dans ses rendez-vous ; les règles restent celles de la personne concernée. Nettoyage par annulation DU SALON (une annulation cliente compterait dans l'anti-abus).
- `pnpm check:badge` : pastille rouge des demandes à confirmer sur l'onglet Réservations, contre la **prod** — apparition sans actualiser (temps réel), compte qui suit, baisse après confirmation, visible depuis les autres écrans pro. Coupe la confirmation automatique du salon de démo et **la remet dans tous les cas** (`finally`).
- `pnpm check:webpush` : chaîne complète des notifications navigateur en **prod**. Le dernier saut exige une fenêtre réelle : `CHECK_HEADLESS=0 pnpm check:webpush`. Sans affichage, Chrome fait juger son inscription FCM périmée (410) — ce n'est pas une régression.
- `pnpm db:migrate` (lit `DATABASE_URL` dans `.env`, suit `public.schema_migrations`). Les migrations déjà appliquées sont immuables : toute correction = nouveau fichier `000N_*.sql`.
- API locale : `pnpm dev:api` sur le port `PORT` du `.env` (8090 en local, 8080 sur Render) ; web toujours sur http://localhost:9000 (Vite `strictPort`).

## Règles métier non négociables
- Devise DA uniquement (`formatDA`), jamais d'euros. Fuseau `Africa/Algiers`. Semaine **dimanche → samedi** (`WEEK_STARTS_ON = 0`, `weekKeys()`), `day_of_week` 0 = dimanche.
- Anti-double réservation = contrainte d'exclusion GiST sur `bookings` + fonctions SQL `create_booking` / `reschedule_booking` / `get_available_slots`. Ne jamais réimplémenter la logique de créneaux côté API/front ; Realtime = affichage seulement.
- Règles du salon appliquées en SQL (`create_booking_multi`, `reschedule_booking` avec `p_enforce_rules`) : délai minimum, horizon, annulation/report jusqu'à `cancel_min_hours`, report client désactivable (`allow_client_reschedule`). Les fonctions d'écriture sont révoquées pour `anon`/`authenticated` (migration 0009) : seule l'API (clé secrète) les appelle.
- **Réservation POUR QUELQU'UN D'AUTRE** (`beneficiary` dans `createBookingSchema`) : le rendez-vous appartient à la PERSONNE CONCERNÉE, jamais à celle qui réserve. Son numéro l'identifie : s'il correspond à un compte, `client_id` est celui-là ; sinon `client_id` reste nul et le numéro seul l'identifie. Les règles se lisent donc sur elle, par compte ET par numéro (`clientFilter` / `clientStanding` dans `apps/api/src/lib/standing.ts`). `booked_by` / `booked_by_name` gardent qui a réservé : cette personne garde l'accès (voir, annuler, reporter) mais pas l'avis, qui reste à la personne concernée. Vérifié par `pnpm check:for-other`.
- Garde-fous API (`packages/constants/src/booking.ts`) : au plus `MAX_UPCOMING_BOOKINGS_PER_CLIENT` rendez-vous à venir par client, pas de doublon du même client sur un horaire qui chevauche (`ALREADY_BOOKED`), plafonds équipe/catalogue, blocage ≤ 1 an. Transitions pro : `confirmed` impossible après l'heure (`BOOKING_EXPIRED`), `no_show` impossible avant l'heure (`NOT_STARTED`). Le cron (`/internal/cron/tick`) expire les demandes `pending` passées (`cancelled_by = 'system'`).
- Téléphones normalisés E.164 `+213…` via `phoneDZ` ; snake_case en base, camelCase dans l'API (`camelize`). Un numéro vérifié par OTP (dans le jeton) n'est pas modifiable via `PATCH /me` ; le lien (`slug`) du salon est définitif.
- Textes UI en français ; prévoir l'arabe (RTL) plus tard via `packages/constants` (labels `*_AR`).

## Cache HTTP (API publique)
- Listes/salons : `public, max-age=60, stale-while-revalidate=600` (4G : réponses instantanées en revisite). Chrome ressert la copie périmée et ne revalide qu'en arrière-plan : pour une ressource qui doit refléter immédiatement une écriture (avis, disponibilités), utiliser `public, no-cache` (ETag → 304). Le propriétaire reçoit toujours `private, no-cache`.

## Sécurité
- `SUPABASE_SECRET_KEY` et `DATABASE_URL` : API/scripts seulement, jamais dans web/mobile ni dans git (`.env*` ignoré, `.env.example` sans secret).
- L'API contourne la RLS (clé secrète) : chaque route protégée passe par `requireAuth` / `requireProfile` / `requireSalon` et vérifie l'appartenance (`salon_id`, `client_id`).

## Comptes de démonstration (accès direct)
- Deux numéros ouvrent une vraie session sans SMS, avec le code fixe `1111` : client `0603044618`, pro `0603044619` (définis dans `packages/constants/src/phone.ts` : `TEST_ACCOUNTS`, `TEST_LOGIN_CODE`, `isTestPhone`).
- Front : sur ces numéros, `sendPhoneOtp` est un no-op, l'écran « canal » est sauté, l'écran code accepte 4 chiffres, `verifyPhoneOtp` appelle `POST /v1/auth/dev-login` puis `supabase.auth.setSession(...)`.
- API (`apps/api/src/routes/auth.ts`) : la clé secrète crée le compte au besoin (idempotent), complète le profil (téléphone E.164, nom, marché client) puis délivre une session via un lien magique à usage unique. Le code accepte `1111` ou toute suite de `1` (tolérance à la faute de frappe). **Désactiver en production réelle avec `TEST_LOGIN_ENABLED=0`.**
- Le compte pro de démonstration reçoit à la première connexion un salon publié prêt à l'emploi (« Salon Démo », unisexe, prestations + horaires 7j/7 ; `apps/api/src/lib/demo.ts`, idempotent) : le tableau de bord pro est directement peuplé et le client démo peut y réserver.

## Design
- Le design Claude Design (`Salon DZ Hi-Fi.dc.html`) fait foi pour web et mobile : couleurs, composants, mises en page, animations, illustrations. Pas de réinvention.
- Export local : `design/split.mjs` → `design/screens/<ID>.html` (+ PNG ignorés par git) et `design/index.md` (table des écrans AUTH / C-H / C-F / PRO-F). Jetons : `apps/web/src/styles/tokens.css` et `apps/mobile/src/theme/design.ts` (mêmes valeurs).
- Web : classes du design dans `apps/web/src/styles/index.css`, primitives dans `apps/web/src/components/ui.tsx`. Mobile : primitives natives équivalentes dans `apps/mobile/src/ui/` (`Text.tsx`, `index.tsx`, `Screen.tsx`, `TabBar.tsx`, `Pickers.tsx`), écrans Expo Router sous `apps/mobile/app/` (groupes `(auth)`, `(client)`, `(pro)`, `s/[slug]`).
- **Typographie MESURÉE sur la référence du marché (Planity, navigateur en conditions téléphone), qui l'emporte sur le fichier de design** : racine 14 px ; six tailles 12 / 14 / 16 / 20 / 24 / 32 ; poids ≤ 600 au-dessus de 20 px.
- **Arrondis : RÉDUITS, et c'est une consigne permanente (15 sept. 2026).** Cartes **8 px**, tout le petit mobilier (boutons, champs, créneaux, vignettes, pavés, cases) **6 px**, feuilles 12 px, segmenté intérieur et cases à cocher 4 px ; pilules, badges et cercles inchangés. Tout passe par les jetons (`--radius-*` web, `R` mobile), **jamais une valeur en dur** (`rounded-[0.xxxrem]`, `borderRadius: 12`) : écrire `rounded-[var(--radius-card)]` / `R.card`. Pour tout NOUVEAU composant, prendre l'arrondi le plus petit qui convient, jamais le plus grand ; ne jamais « rétablir » 12 / 16 / 20 px. C'est un outil de travail, pas un jouet.
- Un créneau horaire est un bouton de choix : rectangle arrondi (`--radius-slot`), jamais une pilule.
- **Espace pro web façon outil du métier (Planity Pro, 14 sept. 2026)** : en-tête fixe `ProHeader` (menu → tiroir `.drw` avec toute la gestion et la pastille des demandes, salon au centre, « + » nouveau rendez-vous) sur `ProLayout` ; agenda vue jour en COLONNES par membre (`.agcol` / `.agb` / `.agoff`, 72 px par heure, tap sur un vide = création à cette heure pour ce membre, en-tête des colonnes `sticky` HORS du carrousel) ; formulaire de rendez-vous en lignes qui s'ouvrent en feuille (client cherché dans la clientèle avant d'être saisi) ; fiches de rendez-vous (pro, fenêtre d'agenda, client, confirmation, récapitulatif) en `FactRow` (`components/BookingFacts.tsx`) : une ligne par fait, prix d'une prestation unique jamais répété. Le mobile (Expo) n'a PAS encore cette refonte.

## Mobile (Expo)
- Vérification visuelle sans appareil : `npx expo start --web --port 8082` depuis `apps/mobile` (react-native-web), captures 390×844 avec playwright-core. Ajouter `http://localhost:8082` à `CORS_ORIGINS` du `.env` de l'API.
- Le watcher Metro ne voit pas toujours les modifications sous Windows : après une série d'éditions, redémarrer `expo start` (`--clear`) plutôt que d'attendre la reconstruction.
- Routes : les groupes `(client)` et `(pro)` ne doivent pas exposer le même chemin (`/profil` client vs `/profil-pro` pro, `/rdv/[id]` client vs `/pro-rdv/[id]` pro). `resolveNext()` dans `src/lib/authFlow.ts` traduit les chemins web (`/pro`, `/`) en routes Expo.
- Texte nu interdit hors `<Text>` : toujours passer par `Tx` / `P` / `InfoBox` (un fragment mixte dans une `View` plante sur iOS/Android).
