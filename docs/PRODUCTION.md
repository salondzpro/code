# Salon DZ — plan de mise en production

Version du 16 septembre 2026. Synthèse de quatre audits (sécurité API et base, règles de gestion, application web, DevOps) et des corrections livrées le jour même. Ce document est la liste de contrôle jusqu'à l'ouverture au public ; il se met à jour à chaque lot.

## 1. Corrigé le 16 septembre (en production)

Sécurité :
- Jeton du cron interne : la production tournait avec le jeton par défaut `dev-cron-token-change-me`. Remplacé par 40 caractères aléatoires (Render, `app_settings.cron_token`, `.env`) ; le cron appelle désormais `https://api.salondz.com`.
- Comptes de démonstration désactivés par défaut dans le code (`TEST_LOGIN_ENABLED=1` explicite), code fixe strict.
- Liens des e-mails : `API_PUBLIC_URL` obligatoire en production, plus jamais construits depuis l'en-tête `Host` (vol de jeton par lien forgé).
- Limitation de débit : un seul mandataire de confiance (fini le contournement par `X-Forwarded-For`), compteur par compte quand il est connu, limite par adresse e-mail + IP sur les envois (6 / 10 min).
- Énumération de comptes : lien de connexion, renvoi de confirmation et réinitialisation répondent 204 même pour une adresse inconnue.
- Recherche de compte par e-mail indexée (fonction SQL réservée à la clé secrète) : plus de plafond silencieux à 1 000 comptes.
- Journaux : autorisation masquée, URL sans chaîne de requête (jetons, numéros), adresse e-mail réduite au domaine.
- Réservation pour quelqu'un d'autre : le nom du titulaire d'un numéro n'est plus révélé ; au plus 5 réservations pour autrui par compte et par jour.
- Téléphone du salon retiré des réponses « mes rendez-vous » côté client ; URL d'images limitées à notre stockage.
- Nom du salon échappé dans les bulles de la carte (XSS stocké).
- Site : `Cache-Control: no-cache` sur l'index, `X-Frame-Options: DENY`, `Permissions-Policy`.
- Délais d'attente sur Supabase (10 s), arrêt propre borné à 10 s, en-têtes CSP `default-src 'none'` sur l'API.

Règles de gestion :
- Jour de repos d'un membre respecté (un membre avec horaires personnalisés n'est réservable que sur ses lignes).
- Un rendez-vous déplacé redevient à rappeler.
- « Client absent » possible jusqu'à 7 jours après la clôture automatique.
- Situation d'un client lue par compte ET par numéro (écran et API cohérents).
- Index manquants ajoutés (téléphone client, réservé par, prestation, avis, téléphone de profil) ; format E.164 imposé aux nouveaux numéros.
- Purge quotidienne des résidus techniques du cron.

Conformité :
- Pages `/cgu`, `/confidentialite`, `/mentions-legales`, `/aide` (textes de départ, loi 18-07), liées depuis le pied de page, les réglages client et le compte pro.
- `GET /v1/me/export` (toutes les données en JSON) et `DELETE /v1/me` (effacement, rendez-vous passés anonymisés) ; boutons dans Réglages.
- `robots.txt` (espaces privés exclus).

Exploitation :
- Variables complètes dans `render.yaml` (`API_PUBLIC_URL`, `WEB_URL`, Resend, VAPID, `VITE_VAPID_PUBLIC_KEY`, `VITE_SENTRY_DSN`) ; `render-web.mjs` fusionne les variables au lieu de les écraser ; `.env.example` complété.
- Session expirée : déconnexion propre et retour à la connexion ; agenda et clientèle affichent une erreur réseau au lieu d'une liste vide.

## 2. Décisions à prendre par le propriétaire

| # | Décision | Recommandation |
|---|---|---|
| 1 | Comptes de démonstration en production (`TEST_LOGIN_ENABLED=1` dans `render.yaml`) | Les couper le jour J (`0`) et dépublier « Salon Démo ». Garder un couple de comptes de test privés sur un projet Supabase de préproduction pour les scripts `check:*`. |
| 2 | Sauvegardes | Passer Supabase en Pro (25 $/mois) avant le premier vrai salon : sauvegardes quotidiennes 7 jours. Sans cela, une erreur = perte totale. |
| 3 | Mobile au lancement | Non. Le mobile Expo a encore l'ancienne connexion par téléphone et aucune refonte pro. Lancer en web seul, aligner le mobile ensuite. |
| 4 | Textes légaux | Faire relire CGU, confidentialité et mentions légales par un conseil ; compléter dénomination, RC, NIF dans `/mentions-legales`. |
| 5 | Rappels hors application | Aujourd'hui : notification in-app et push seulement. Choisir un canal de secours (SMS via un opérateur algérien, ou WhatsApp Business) : c'est le premier levier contre les absences. |
| 6 | Cartes et géocodage | OpenStreetMap et Photon publics ne sont pas prévus pour un usage commercial soutenu. Prévoir MapTiler ou Stadia (25–50 $/mois) avant la montée en charge. |

## 3. Reste à faire avant l'ouverture (par ordre)

### Bloquant
1. Sauvegardes (décision 2) puis un exercice de restauration chronométré sur un projet jetable.
2. Comptes de démonstration (décision 1).
3. Textes légaux validés (décision 4).
4. Vérification du numéro de téléphone : non modifiable dès le premier rendez-vous (fait le 17 sept., `PHONE_LOCKED`) ; la vérification par code (SMS ou WhatsApp) attend le canal de la décision 5.
5. Sentry (API + web) et sonde de disponibilité 5 min sur `/health` et `salondz.com`, alertes vers le propriétaire.
6. Déploiement par la CI : job `deploy` écrit (17 sept.), actif dès que le secret GitHub `RENDER_API_KEY` est posé (propriétaire) ; ordre « migration d'abord, API ensuite » dans la section Procédures.

### Important (première quinzaine)
7. ~~Lecture directe avec la clé publique~~ : fait le 16 sept. (migration 0039, privilèges de colonnes sur `salons`, `staff`, `reviews`).
8. Schémas de réponse zod sur les routes publiques (aucune colonne nouvelle ne part par défaut).
9. Réglage « Rappels » lu par le cron (fait le 16 sept.) ; reste « Confirmations » et « Nouveautés » (l'expiration des demandes à 24 h et la relance du pro sont livrées le 16 sept., ainsi que la liste d'attente « créneau libéré »).
10. Fiche client sur identifiant stable (fusion compte + numéro), blocage d'un client de passage.
11. ~~Congés : rendez-vous touchés listés et annulés sur confirmation~~ (fait le 17 sept.) ; reste le cas des horaires modifiés.
12. ~~Découpage du bundle, police auto-hébergée, manifeste PWA~~ (faits le 16 sept. : 40 pages en chargement paresseux, dictionnaires à la demande, Inter en woff2 local, manifeste avec icônes SVG) ; reste les icônes PNG maskable ; les balises Open Graph sont servies via `/share/s/:slug` de l'API (fait le 17 sept.).
13. ~~Réglage des notifications navigateur côté pro~~ : fait le 16 sept. (Compte pro → « Notifications sur cet appareil », abonnement rafraîchi à l'entrée).
14. Projet Supabase de préproduction pour la CI e2e et les scripts `check:*` (aujourd'hui ils écrivent en production).
15. Chiffre d'affaires : distinguer prévisionnel (confirmé) et réalisé (terminé).

### Souhaitable
16. Multi-prestations à la saisie pro, jours fériés, horaires de nuit, grille alignée sur l'horloge, export CSV.
17. Accessibilité : cibles 44 px et contraste des textes discrets faits le 17 sept. ; restent feuilles avec rôle dialogue et Échap, RTL en propriétés logiques.
18. Vignettes d'images (transformations Supabase, plan Pro). `sitemap.xml` servi par l'API (fait le 17 sept.).
19. Modération des avis, réponse du professionnel, rôle administrateur.

## 4. Calendrier

| Quand | Quoi | Qui |
|---|---|---|
| J-7 | Supabase Pro + restauration testée · Sentry + sonde uptime · textes légaux relus · déploiement par CI · points 7–8 | Propriétaire + dev |
| J-1 | `pnpm db:status` = 0 migration en attente · variables Render vérifiées (API et site) · `select * from app_settings` et `cron.job` · parcours complet sur vrai téléphone en 4G (inscription, confirmation e-mail, réservation, notification) · DMARC en `p=quarantine` · gel du code | Dev + propriétaire |
| Jour J | Sauvegarde manuelle · migrations · déploiement API puis site · `TEST_LOGIN_ENABLED=0` · tick cron manuel et lecture du JSON · un vrai compte client et un vrai compte pro · surveillance 4 h | Dev |
| J+7 | Relecture des journaux (5xx, 429, `EMAIL_*`) · consommation Resend · taille base et stockage · exercice de restauration réel · points 9–15 | Dev |
| J+30 | Bilan absences et annulations · décision canal SMS/WhatsApp · plan mobile | Propriétaire |

## 5. Procédures

Déployer : `git push` → migration `node --env-file=.env scripts/db-migrate.mjs` (toujours rétro-compatible) → API via l'API Render (`POST /services/srv-dag7cr740ujc738dm7r0/deploys`) → site `node --env-file=.env scripts/render-web.mjs --deploy` → vérifier `https://api.salondz.com/health` et une route profonde du site.

Cron muet : `select * from public.app_settings;` (api_url = `https://api.salondz.com`, cron_token = `INTERNAL_CRON_TOKEN` de Render), `select * from cron.job;`, `select * from net._http_response order by created desc limit 10;`. Tick manuel : `curl -X POST -H "Authorization: Bearer $INTERNAL_CRON_TOKEN" https://api.salondz.com/internal/cron/tick`.

Quota Resend dépassé : les inscriptions répondent `EMAIL_QUOTA` (429). Passer au plan payant ; en attendant, connexion par mot de passe pour les comptes existants.

Rotation du jeton cron : générer 32+ caractères, `PUT /services/{api}/env-vars/INTERNAL_CRON_TOKEN` sur Render, `update app_settings set value=… where key='cron_token'`, vérifier un tick.

## 6. Coûts

| Étape | Mensuel | Détail |
|---|---|---|
| Lancement (web seul) | ≈ 26–28 $ | Supabase Pro 25 $, domaine ≈ 2 $, Render/Resend/Sentry/uptime gratuits |
| 1 000 salons | ≈ 170–220 $ | Render Standard 25 $, Supabase 25–60 $, Resend Pro 20 $, Sentry 26 $, cartes 25–50 $, géocodage 20–50 $, EAS 19 $, Apple 8 $ |

Soit environ 0,20 $ par salon et par mois : l'infrastructure n'est pas le sujet économique ; les postes qui montent sont les photos (stockage) et les cartes.
