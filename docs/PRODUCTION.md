# Salon DZ — plan de mise en production (résumé du 29 oct. 2026)

**Pas encore ouvert au public** : les données sont des données de test. Ce document est la liste de contrôle jusqu'à l'ouverture.

## 1. En place
- **Sécurité** : jetons et limites de débit durcis, clé publique révoquée sur les fonctions sensibles (0052), schémas de réponse sur les routes publiques, journaux sans données personnelles.
- **Produit** : réservation multi-prestations, validation manuelle et liste d'attente, rappels 1 h / 30 min, avis + réponses + signalements, fiche client unique, administration (voir, suspendre, piloter un pro), étiquettes QR imprimables, trois langues, affichage ordinateur.
- **Conformité** : CGU, confidentialité, mentions légales (Algérie), export et suppression du compte.
- **Mobile** : le site est l'application. Android client charge salondz.com en direct ; iPhone et applications Pro se **mettent à jour seules** à chaque déploiement du site (paquets `/ota/`).

## 2. Publication des applications (automatique)
- **iPhone** : chaque compilation Codemagic est soumise à Apple et mise en vente **dès l'approbation** (24–48 h), sans TestFlight.
- **Android** : publication directe sur la piste production de Google Play **dès que la clé Google Play est dans Codemagic** (ci-dessous).
- Un changement d'écran ou de texte n'a besoin d'aucun store ; seul un changement natif (permission, icône, greffon) exige une nouvelle version.

### Clé Google Play à poser (propriétaire)
1. Fichier JSON du compte de service : dans `secrets/` sur le PC (`{"type": "service_account", …}`). À défaut : Google Cloud → IAM → Comptes de service → créer → Clés → JSON ; puis Play Console → Utilisateurs et autorisations → inviter l'e-mail du compte, droit de publier.
2. Codemagic → Salon DZ → Environment variables : nom `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS`, groupe `google_play`, valeur = tout le contenu du JSON, **Secure** coché.
3. Ne jamais coller ce contenu ailleurs (discussion, dépôt) : il donne le droit de publier.
4. Google peut exiger un test fermé (12 testeurs, 14 jours) avant d'ouvrir la production à un nouveau compte.

## 3. Décisions et actions du propriétaire
| # | Sujet | À faire |
|---|---|---|
| 1 | App Store | Compléter la fiche de **Salon DZ Pro** (textes, captures, confidentialité) sinon Apple refuse. |
| 2 | Codemagic | Relier le dépôt GitHub (Webhooks) pour lancer les compilations sans intervention. |
| 3 | Sauvegardes | Supabase Pro reporté : `pnpm db:backup` avant chaque migration et chaque semaine. |
| 4 | Textes légaux | Identité de l'éditeur (`EDITOR`), formalités ANPDP, relecture par un conseil. |
| 5 | Rappels hors app | Choisir un canal SMS / WhatsApp (premier levier contre les absences). |
| 6 | Cartes | OpenStreetMap + Photon pour l'instant ; MapTiler/Stadia avant la montée en charge. |
| 7 | Sécurité | Changer `PLAN_ACCESS_CODE` (encore `123`) sur Render ; poser `ANTHROPIC_API_KEY` pour la synthèse des avis. |

## 4. Reste avant l'ouverture
- Sentry + sonde de disponibilité (5 min) sur `/health` et `salondz.com`.
- Projet Supabase de préproduction pour les tests (ils écrivent aujourd'hui en production).
- Parcours complet sur vrai téléphone en 4G ; DMARC en `p=quarantine`.

## 5. Procédures
- **Déployer** : `git push` → migration (`scripts/db-migrate.mjs`) → API et site via l'API Render → `pnpm check:coque`.
- **Cron muet** : lire `app_settings` et `cron.job`, tick manuel `POST /internal/cron/tick`.

## 6. Coûts
Lancement ≈ 26–28 $/mois (Supabase Pro + domaine) ; 1 000 salons ≈ 170–220 $/mois, soit ≈ 0,20 $ par salon.
