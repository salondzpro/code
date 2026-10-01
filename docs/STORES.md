# Salon DZ — publication sur Google Play et l'App Store

Textes et réponses à copier dans les consoles. Écrit le 21 septembre 2026 ; à tenir à jour avec l'application.

- Identifiant de l'application : **`dz.salondz.app`** (Android `package` et iOS `bundleIdentifier`). Définitif dès le premier envoi.
- Éditeur : le compte développeur du propriétaire. Contact public : `support@salondz.com`. Site : `https://salondz.com`.
- URL de confidentialité : `https://salondz.com/confidentialite` · Aide : `https://salondz.com/aide` · CGU : `https://salondz.com/cgu`.
- Images de marque : `node scripts/make-app-icons.mjs --store <dossier>` (icône 512 et image de présentation 1024×500).

## 1. Fiche (français)

| | Play Store | App Store |
|---|---|---|
| Nom (30 max) | `Salon DZ` | `Salon DZ` (sinon `Salon DZ – Réservation`) |
| Sous-titre (30 max) | — | `Coiffeur, barbier, institut` |
| Description courte (80 max) | `Réservez coiffeur, barbier ou institut en Algérie, sans appeler.` | — |
| Texte promotionnel (170 max) | — | `Trouvez un salon près de vous, réservez en quelques secondes et recevez vos rappels par notification. Pour les professionnels : agenda, demandes et rappels en direct.` |
| Mots-clés (100 max) | — | `coiffeur,barbier,salon,beauté,rendez-vous,réservation,ongles,cils,institut,Algérie,agenda,Alger` |
| Catégorie | Beauté | Style de vie |
| Langue | Français | Français |

### Description longue (identique sur les deux)

```
Salon DZ, c'est la réservation de salon en Algérie : simple, et sans avoir à appeler.

POUR LES CLIENTS
• Trouvez barbiers, coiffeurs, instituts, ongles, cils et soins près de chez vous, avec les disponibilités en temps réel
• Réservez en quelques secondes, en dinars algériens
• Recevez la confirmation du salon et vos rappels (la veille et 2 h avant) directement par notification
• Reportez ou annulez en un geste, et retrouvez tous vos rendez-vous au même endroit
• Réservez aussi pour un proche
• Laissez un avis après votre rendez-vous

POUR LES PROFESSIONNELS
• Votre agenda, votre équipe et vos prestations dans votre poche
• Recevez chaque nouvelle demande en direct, confirmez ou refusez d'un geste
• Un rappel une heure avant chaque rendez-vous : plus besoin de vous envoyer un message pour ne pas oublier
• Votre page en ligne, votre lien et votre QR code à partager avec vos clients
• Fiche client, historique et chiffre d'affaires

Les confirmations, les demandes et les rappels passent par les notifications de l'application : fini les messages à recopier.
```

## 1 bis. Salon DZ Pro — seconde fiche Google Play (1er oct. 2026)

L'application professionnelle est une application **à part** sur Play : identifiant **`pro.salondz.app`**, sa propre fiche, ses propres visuels, sa propre file de versions (`version-pro.properties`). Elle ne contient **que** l'espace professionnel — les routes clientes ne sont pas livrées dans le bundle (`VITE_APP_FLAVOR=pro`).

| | Valeur |
|---|---|
| Nom (30 max) | `Salon DZ Pro` |
| Description courte (80 max) | `L’agenda de votre salon : réservations, clientèle et chiffre d’affaires.` |
| Catégorie | Entreprise |
| Public cible | 18 ans et plus |
| Accès à l'application | restreint — compte **professionnel** (`relecteur-pro@salondz.com`, mot de passe dans `secrets/store-review.txt`) |

```
Salon DZ Pro, c'est votre salon dans votre poche. Réservé aux professionnels de la beauté en Algérie : barbiers, coiffeurs, coiffeuses, ongleries, instituts, cils et soins.

VOTRE JOURNÉE, D'UN COUP D'ŒIL
• Les rendez-vous du jour, les demandes à confirmer et le prochain client dès l'ouverture
• Agenda en colonnes, une par personne de l'équipe : un appui sur un creux crée le rendez-vous
• Fermetures, congés et pauses, sans qu'un client puisse réserver dessus

LES DEMANDES, EN DIRECT
• Chaque nouvelle demande arrive en notification, à l'instant où elle est faite
• Confirmez, reportez ou refusez d'un geste — ou laissez la confirmation automatique
• Un rappel une heure avant chaque rendez-vous

VOS CLIENTS RÉSERVENT SANS VOUS APPELER
• Votre page, votre lien et votre QR code à mettre sur Instagram, WhatsApp, Snapchat ou en vitrine
• Vos prestations, vos durées, vos prix en dinars, vos photos de réalisations
• Vos avis, auxquels vous pouvez répondre publiquement

VOTRE CLIENTÈLE ET VOS CHIFFRES
• Une fiche par client : historique, notes, numéro
• Chiffre d'affaires du jour, de la semaine et du mois, encaissé et prévisionnel
• Export de votre clientèle et de vos chiffres

Gratuit, en français, en arabe et en anglais. Vos clients réservent depuis l'application Salon DZ ou depuis votre lien.
```

**Visuels** : `node scripts/make-play-pro-assets.mjs` (ou `--format tablette-10` pour n'en refaire qu'un) → `apps/web/android/store/pro/`.

| Emplacement de la fiche | Dossier | Taille | Rendu capturé |
|---|---|---|---|
| Téléphone | `telephone/` | 1080×1920 | 360×640 points × 3 — barre d'onglets flottante |
| Tablette 7 pouces | `tablette-7/` | 1920×1200 | 960×600 points × 2 — encore sous 1 024, donc barre d'onglets |
| Tablette 10 pouces | `tablette-10/` | 2560×1600 | 1280×800 points × 2 — **rail permanent** |
| Image de présentation | racine | 1024×500 | imposé par Google |
| Icône | `store/icone-play-store-512-pro.png` | 512×512 | `make-capacitor-icons.mjs --pro` |

**Ne pas réutiliser les visuels iPhone** : ils font 1290×2796, soit un rapport de 2,167, et Google refuse au-delà de 2:1. **Ne pas non plus agrandir les visuels téléphone** : à partir de 1 024 px l'espace professionnel échange sa barre d'onglets contre un rail permanent, et c'est précisément cette adaptation que l'emplacement tablette sert à montrer. La densité fait la taille, jamais la largeur de fenêtre : poser 2 560 px de large donnerait une mise en page de très grand écran.

Cinquième volet différent selon le format : **Lien et QR code** sur téléphone, **Catalogue** sur tablette — l'écran du lien est une colonne de lecture sans rail, qui sur 2 560 px n'est qu'un QR code au milieu d'une grande surface grise.

**Sécurité des données** : la même déclaration qu'en § 2, moins la position (l'espace professionnel ne géolocalise pas) et moins les avis (le professionnel y répond, il n'en dépose pas).

**Reste à faire** : `apps/web/public/.well-known/assetlinks.json` ne déclare que `dz.salondz.app`. L'empreinte de signature de `pro.salondz.app` n'est connue qu'après le premier envoi sur Play (clé de Google) — ajouter une seconde entrée alors, sinon les liens `salondz.com` n'ouvriront pas l'application professionnelle.

## 2. Google Play — questionnaires

**Contenu de l'application**
- *Accès à l'application* : **restreint** (compte requis). Identifiants de test : `secrets/store-review.txt` (cliente `relecteur-client@salondz.com`, professionnel `relecteur-pro@salondz.com`), créés le 21 sept. par `scripts/store-review.mjs`.
- *Annonces* : **non**.
- *Public cible* : **18 ans et plus** (évite les exigences « Familles »).
- *Classification (IARC)* : catégorie « Utilitaire / autre ». Violence, sexualité, langage, drogues, jeux d'argent : **non**. Contenu généré par les utilisateurs : **oui** (avis sur les salons). Partage de position avec d'autres utilisateurs : **non**. Achats numériques : **non**. Résultat attendu : tous publics.
- *Application d'actualités, gouvernementale, santé, finance* : **non**.

**Sécurité des données**

| Donnée | Collectée | Partagée | Pourquoi | Facultative |
|---|---|---|---|---|
| Nom | oui | oui — le salon réservé | Fonctionnement, gestion du compte | non |
| Adresse e-mail | oui | non | Gestion du compte, connexion | non |
| Numéro de téléphone | oui | oui — le salon réservé | Fonctionnement (le salon appelle en cas de retard) | non |
| Position approximative et précise | oui | non | Fonctionnement (salons autour de soi) | **oui** |
| Photos (logo, réalisations, avatar) | oui | non | Fonctionnement (page publique du salon) | oui |
| Avis et notes | oui | oui — public | Fonctionnement | oui |
| Identifiants de l'appareil (jeton de notification) | oui | non | Fonctionnement (notifications) | oui |

- Données **chiffrées en transit** : oui (HTTPS partout).
- **Suppression** : oui. Depuis l'application (clients : Réglages → « Supprimer mon compte » ; professionnels : Compte → « Supprimer mon compte et mon salon », **dans le build v4 et suivants, pas dans le v3**) et sur demande à `support@salondz.com`. URL de suppression à déclarer : `https://salondz.com/supprimer` (page dédiée, détaille ce qui est supprimé et ce qui est conservé).
- Aucune donnée vendue. Aucun pistage publicitaire.

## 3. App Store — questionnaires

**Confidentialité de l'app (étiquettes)** : mêmes données que ci-dessus. Toutes « liées à l'identité de l'utilisateur », **aucune utilisée pour le pistage**. Position : « utilisée pour le fonctionnement de l'app », facultative.

**Classification par âge** : contenu généré par les utilisateurs = **oui** (avis) ; tout le reste = **non**. Résultat attendu : 4+.

**Notes pour la revue** : identifiants de `secrets/store-review.txt` (e-mail + mot de passe ; les deux comptes sont déjà confirmés, aucun e-mail à ouvrir). Préciser que la position n'est utilisée qu'app ouverte, et que les notifications servent aux rappels de rendez-vous.

**Coordonnées de revue** : nom, téléphone et e-mail du propriétaire (Apple exige un numéro).

## 3 bis. App Store Connect par l'API (29 sept. 2026)

L'application « Salon DZ » existe dans App Store Connect : id **`6817317513`**, bundle `dz.salondz.app`, SKU `salondz`, langue principale `fr-FR`, version `1.0`.

Trois scripts remplissent la fiche sans passer par l'interface web (clé ASC de `secrets/`, client dans `scripts/asc-lib.mjs`) :

| Script | Ce qu'il fait |
|---|---|
| `node scripts/asc-fiche.mjs` | sous-titre, confidentialité, catégories, description, mots-clés, liens, copyright, classification par âge, notes de revue, tarif gratuit, disponibilité (175 pays). Idempotent. `--telephone "+213 …"` pose le numéro de revue, `--lire` n'écrit rien. |
| `node scripts/make-store-panels.mjs` | les six visuels de présentation 1290×2796 (panorama continu, `apps/web/ios/store/presentation-6-7/`) |
| `node scripts/asc-captures.mjs` | les envoie sur la fiche (série `APP_IPHONE_67`), en quatre temps comme l'exige Apple ; `--lire` montre l'état |
| `node scripts/asc-builds.mjs` | les builds reçus par Apple et leur état de traitement |
| `node scripts/asc-signature.mjs` | capacités de l'App ID et profils : dit si la signature passera |
| `node scripts/asc-soumettre.mjs` | rattache le dernier build traité à la version et l'envoie EN REVUE ; `--verifier` ne fait que dire ce qui manque |
| `node --env-file=.env scripts/check-review-accounts.mjs` | les deux comptes que le relecteur va utiliser s'ouvrent-ils vraiment, et leur profil est-il complet |
| `node --env-file=.env scripts/check-apns.mjs` | la clé APNs est-elle acceptée par Apple (sans appareil) |

**Lancer une compilation iOS** : `git tag ios-N && git push origin ios-N`. Le déclenchement se fait sur l'étiquette et non sur chaque poussée — une machine macOS se paie à la minute. L'intégration Codemagic doit s'appeler **`salondz_asc`**.

**Diagnostiquer un refus de mise en revue** : Apple répond « cette ressource ne peut pas être relue, voyez les erreurs associées » — un message qui ne dit rien. Les VRAIES raisons sont dans `meta.associatedErrors` de la réponse ; `asc-soumettre.mjs` les déplie désormais systématiquement. **C'est ce qui a permis de trouver le vrai blocage** après l'avoir attribué à tort aux étiquettes de confidentialité.

**Ce que l'API ne peut PAS faire, et qui reste à la main** :
- **la déclaration « dispositif médical réglementé »** (`CANNOT_SUBMIT_MISSING_REGULATED_MEDICAL_DEVICE_APP_DECLARATION`). Ajoutée par Apple au questionnaire de classification par âge, elle n'est exposée NULLE PART dans l'API — vérifié : ni attribut de `appInfos`, de `appStoreVersions` ou de `ageRatingDeclarations`, ni chemin dédié. À répondre dans App Store Connect → **Informations sur l'app** → **Classification par âge** → **Modifier** → « Votre app est-elle un dispositif médical réglementé ? » → **Non** ;
- **créer la fiche** (fait par le propriétaire le 29 sept.) ;
- **les étiquettes de confidentialité** (« App Privacy ») : Apple a retiré `appDataUsages` de l'API — les six chemins répondent 404, vérifié. Le contenu à cocher est au § 3 ci-dessus ;
- **le numéro de téléphone de revue** : Apple l'exige et il n'est écrit nulle part dans le dépôt.

**iPhone seulement** (`TARGETED_DEVICE_FAMILY = "1"`) : le site a bien une mise en page tablette, mais l'application n'a jamais été essayée sur iPad, et déclarer l'iPad obligerait à fournir une série de captures 13". À rouvrir après la 1.0, en connaissance de cause.

## 4. Risques connus avant une revue

1. ~~Marketplace vide~~ — **traité le 21 sept.** : « Salon Démonstration » (Alger Centre, publié, réservation confirmée d'office, 6 prestations, 2 membres, photos) et deux comptes de revue, par `node --env-file=.env scripts/store-review.mjs`. Aucun avis fabriqué. Le salon est clairement présenté comme une démonstration ; à retirer (`--remove`) quand de vrais salons existent, ou à laisser : décision du propriétaire.
2. ~~Suppression du compte d'un professionnel~~ — **traité le 21 sept.** : « Supprimer mon compte et mon salon » (web et mobile), `DELETE /v1/me` avec `{ withSalon: true }`. Les rendez-vous à venir sont annulés et leurs clients prévenus ; l'historique des rendez-vous passés disparaît aussi chez les clients (l'écran le dit). Ce contrôle a révélé que l'effacement de compte — client compris — n'avait **jamais abouti** (colonne `favorites.client_id` inexistante) : corrigé, vérifié par `pnpm check:pro-deletion`.
3. ~~Signalement d'un avis~~ — **traité le 21 sept.** : « Signaler » sous chaque avis (web : page salon, tous les avis, avis du professionnel ; application : liste des avis), un motif parmi quatre ; file `/admin/signalements` (masquer avec motif, ou sans suite) ; migration 0047 ; vérifié par `pnpm check:review-report`. Contact publié : `support@salondz.com`. **Dans le build v5 et suivants** de l'application.
4. ~~**Captures d'écran** à prendre depuis un vrai téléphone~~ — **caduc depuis la bascule Capacitor (24 sept.)** : l'application EST le site embarqué, donc un rendu du site à la taille d'un iPhone est l'application au pixel près. `node scripts/make-ios-screenshots.mjs` ouvre la production en 430×932 à densité 3 (= 1290×2796), se connecte aux comptes de démonstration et prend six écrans ; il injecte les marges de sécurité de l'iPhone (59 pt en haut, 34 pt en bas) dans les mêmes variables CSS que le natif, sinon la mise en page serait celle d'un navigateur de bureau. Il ÉCHOUE bruyamment si la connexion ne prend pas — sans ce garde-fou, les six captures seraient six fois l'écran de connexion.
5. **Application non essayée sur appareil** avant le premier envoi : le test interne (Play) et TestFlight (Apple) servent à ça, pas la production.
6. **iOS** — aucun build jamais fait ; bloqué en attente de la clé App Store Connect, de la clé APNs et du Team ID.
