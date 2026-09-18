# Salon DZ — plan de mise en production

Version du 16 septembre 2026, mise à jour le 18 septembre (dernier lot : identité du client chez un salon). **Le service n'est pas encore ouvert au public** (décision du propriétaire, 18 sept.) : les données actuelles sont des données de test et peuvent être modifiées librement. Synthèse de quatre audits (sécurité API et base, règles de gestion, application web, DevOps) et des corrections livrées le jour même. Ce document est la liste de contrôle jusqu'à l'ouverture au public ; il se met à jour à chaque lot.

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

Lot du 17 septembre (commits 23aa8d2 et 9a4d1a5) :
- Numéro de téléphone verrouillé dès le premier rendez-vous (`PHONE_LOCKED`, support pour le changer) ; `sitemap.xml` servi par l'API et réécrit par le site ; job `deploy` dans la CI (attend le secret GitHub `RENDER_API_KEY`) ; erreurs API traduites dans les trois langues ; page 404 hors indexation ; cibles tactiles 38/44 px et contraste 4,5:1 ; routes `/compte/*` en double supprimées ; interrupteurs protégés contre le double appui ; langue enregistrée avant le rechargement.
- Tests API : 31/31 contre Supabase ; le rôle des comptes de démonstration est réaffirmé par `dev-login`.

Lot du 18 septembre :
- **Démonstration 100 % navigateur** : plus aucun compte ni donnée de démonstration côté serveur (`TEST_LOGIN_ENABLED=0`), chaque appareil a la sienne, moteur chargé à la demande (entrée du site allégée de 60 ko).
- **Schémas de réponse zod sur les routes publiques** (point 8) : une colonne ajoutée à une table ne peut plus partir toute seule vers l'extérieur.
- **Identité d'un client chez un salon** (point 10, migration 0042) : une seule fiche par personne, et un blocage possible sur un client de passage.
- **Tablette, ordinateur et grand écran** : le site s'adapte enfin aux écrans larges — l'espace pro passe de la barre d'onglets à un rail permanent à gauche au-delà de 1 024 px, les listes de cartes se rangent en colonnes, l'agenda prend la largeur de ses colonnes et les feuilles deviennent des fenêtres centrées. **Le rendu téléphone est inchangé**, et une sonde le vérifie à chaque modification.
- **Textes légaux adaptés à l'Algérie**, sauvegardes `pg_dump` gratuites, plan de production en ligne sur `salondz.com/moi`.

## 2. Décisions à prendre par le propriétaire

| # | Décision | Recommandation |
|---|---|---|
| 1 | Comptes de démonstration | ~~Décision prise le 18 sept.~~ : la démonstration est 100 % navigateur (`apps/web/src/demo/`), sans compte ni donnée côté serveur ; `TEST_LOGIN_ENABLED=0` en production, anciens comptes de test supprimés. Rien à couper le jour J. Garder un couple de comptes de test privés sur un projet Supabase de préproduction pour les scripts `check:*`. **À supprimer dès maintenant** : le salon « Alcatra » (`slug` `alcatra`, créé le 16 sept. par le compte client démo pendant les captures de l'inscription pro ; 0 rendez-vous) — `delete from public.salons where slug = 'alcatra';`. Depuis le 17 sept., `dev-login` réaffirme le rôle des comptes démo à chaque connexion. |
| 2 | Sauvegardes | **Décision du 18 sept. : Supabase Pro reporté** (25 $/mois, pas maintenant). En attendant : `pnpm db:backup` (pg_dump gratuit, fichier dans `backups/`, hors git) à lancer avant chaque migration et au moins une fois par semaine dès qu'un vrai salon existe ; restauration : `pg_restore -d <url cible> --clean --if-exists <fichier>`. À reconsidérer avant l'ouverture au public. |
| 3 | Mobile au lancement | Non. Le mobile Expo a encore l'ancienne connexion par téléphone et aucune refonte pro. Lancer en web seul, aligner le mobile ensuite. |
| 4 | Textes légaux | Réécrits le 18 sept. pour l'Algérie (lois 18-07, 18-05, 09-03, 04-02, ordonnance 03-05 ; prestataires décrits par catégorie, rien de technique). Reste au propriétaire : compléter dénomination, forme juridique, RC, NIF et adresse dans `apps/web/src/pages/Legal.tsx` (`EDITOR`) ; accomplir les formalités ANPDP (déclaration du traitement et autorisation de transfert hors Algérie, art. 44 de la loi 18-07, les serveurs étant dans l'UE) ; relecture par un conseil recommandée. |
| 5 | Rappels hors application | Décision du 18 sept. : rappels par notification (application mobile si installée, sinon navigateur), la veille et 2 h avant. Aujourd'hui : notification in-app et push seulement. Choisir un canal de secours (SMS via un opérateur algérien, ou WhatsApp Business) : c'est le premier levier contre les absences. |
| 6 | Cartes et géocodage | **Décision du 18 sept. : on garde OpenStreetMap + Photon pour l'instant.** Ils ne sont pas prévus pour un usage commercial soutenu : Prévoir MapTiler ou Stadia (25–50 $/mois) avant la montée en charge. |

## 3. Reste à faire avant l'ouverture (par ordre)

### Bloquant
1. ~~Sauvegardes (décision 2)~~ reportées (18 sept.) ; en attendant `pnpm db:backup` avant chaque migration et chaque semaine.
2. Comptes de démonstration (décision 1).
3. Textes légaux : réécrits pour l'Algérie (18 sept.) ; reste l'identité de l'éditeur, les formalités ANPDP et une relecture (décision 4).
4. Vérification du numéro de téléphone : non modifiable dès le premier rendez-vous (fait le 17 sept., `PHONE_LOCKED`) ; la vérification par code (SMS ou WhatsApp) attend le canal de la décision 5.
5. Sentry (API + web) et sonde de disponibilité 5 min sur `/health` et `salondz.com`, alertes vers le propriétaire.
6. Déploiement par la CI : job `deploy` écrit (17 sept.), actif dès que le secret GitHub `RENDER_API_KEY` est posé (propriétaire) ; ordre « migration d'abord, API ensuite » dans la section Procédures.

### Important (première quinzaine)
7. ~~Lecture directe avec la clé publique~~ : fait le 16 sept. (migration 0039, privilèges de colonnes sur `salons`, `staff`, `reviews`).
8. ~~Schémas de réponse zod sur les routes publiques~~ (fait le 18 sept.) : `apps/api/src/schemas/public.ts`, branché sur les huit routes publiques. Ce qui n'est pas listé dans le schéma ne sort pas — une colonne ajoutée demain à une table ou au retour d'une fonction SQL ne part plus par défaut. Les schémas filtrent les clés sans juger les valeurs (une valeur inattendue s'affiche, elle ne fait pas tomber la page en 500) ; l'accord entre schémas et types est vérifié à la compilation, la liste des clés servies par deux tests (32/32). `GET /v1/categories` lit désormais ses colonnes nommées au lieu de `select *`.
9. Réglage « Rappels » lu par le cron (fait le 16 sept.) ; « Confirmations » porté par le profil et respecté à l'envoi des push (17 sept., migration 0040) ; « Nouveautés » retiré, aucune fonctionnalité derrière (l'expiration des demandes à 24 h et la relance du pro sont livrées le 16 sept., ainsi que la liste d'attente « créneau libéré »).
10. ~~Fiche client sur identifiant stable (fusion compte + numéro), blocage d'un client de passage~~ (fait le 18 sept., migration 0042). L'identité d'un client chez un salon est désormais son NUMÉRO (celui du compte quand il y en a un, donc toujours à jour), puis le compte, puis le nom : une personne reçue d'abord de passage puis revenue avec un compte ne fait plus deux fiches, deux historiques, deux totaux dépensés et deux blocs de notes. Le blocage suit la même identité et devient possible sur un client de passage sans compte ni numéro — c'est alors un repère dans la clientèle, puisqu'il n'a rien à empêcher en ligne ; l'écran l'explique. Les notes déjà enregistrées sont rattachées par la migration. Deux tests e2e (34/34) et une sonde de la démonstration navigateur.
11. ~~Congés : rendez-vous touchés listés et annulés sur confirmation~~ (fait le 17 sept.) ; horaires modifiés (salon ou membre) : les rendez-vous laissés hors plage sont listés et conservés, feuille « Voir l'agenda » (17 sept.).
12. ~~Découpage du bundle (entrée à 495 ko / 153 ko compressés le 18 sept., moteur de démonstration exclu), police auto-hébergée, manifeste PWA~~ (faits le 16 sept. : 40 pages en chargement paresseux, dictionnaires à la demande, Inter en woff2 local, manifeste avec icônes SVG) ; icônes PNG 192/512 + apple-touch-icon (17 sept.) ; les balises Open Graph sont servies via `/share/s/:slug` de l'API (fait le 17 sept.).
13. ~~Réglage des notifications navigateur côté pro~~ : fait le 16 sept. (Compte pro → « Notifications sur cet appareil », abonnement rafraîchi à l'entrée).
14. Projet Supabase de préproduction pour la CI e2e et les scripts `check:*` (aujourd'hui ils écrivent en production).
15. ~~Chiffre d'affaires : distinguer prévisionnel (confirmé) et réalisé (terminé)~~ (libellés explicites le 17 sept. ; le cron termine les rendez-vous passés, donc « Encaissé » = réalisé).

### Souhaitable
16. Multi-prestations à la saisie pro, jours fériés, horaires de nuit, grille alignée sur l'horloge, export CSV.
17. Accessibilité : cibles 44 px et contraste des textes discrets faits le 17 sept. ; Échap ferme toute feuille modale (`Dim`, 17 sept.) ; RTL en propriétés logiques (codemod du 17 sept. : `ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/`text-start`, 147 remplacements ; prix, durées et adresses en `dir="ltr"`/`auto`).
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
