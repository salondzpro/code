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

## 2. Google Play — questionnaires

**Contenu de l'application**
- *Accès à l'application* : **restreint** (compte requis). Il faut fournir un identifiant de test aux relecteurs → dépend du salon de démonstration et des comptes « relecteur » (**en attente**).
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
- **Suppression** : oui. Depuis l'application (Réglages → « Supprimer mon compte », clients) et sur demande à `support@salondz.com`. URL de suppression à déclarer : `https://salondz.com/confidentialite` (à remplacer par une page dédiée).
- Aucune donnée vendue. Aucun pistage publicitaire.

## 3. App Store — questionnaires

**Confidentialité de l'app (étiquettes)** : mêmes données que ci-dessus. Toutes « liées à l'identité de l'utilisateur », **aucune utilisée pour le pistage**. Position : « utilisée pour le fonctionnement de l'app », facultative.

**Classification par âge** : contenu généré par les utilisateurs = **oui** (avis) ; tout le reste = **non**. Résultat attendu : 4+.

**Notes pour la revue** : compte de test (e-mail + mot de passe) à fournir — **en attente** (comptes « relecteur »). Préciser que la position n'est utilisée qu'app ouverte, et que les notifications servent aux rappels de rendez-vous.

**Coordonnées de revue** : nom, téléphone et e-mail du propriétaire (Apple exige un numéro).

## 4. Risques connus avant une revue

1. **Marketplace vide** — aucun salon publié depuis le nettoyage du 21 sept. Les relecteurs verraient une application sans contenu. → salon de démonstration (**décision en attente**).
2. **Suppression du compte d'un professionnel** — impossible dans l'application tant qu'il porte un salon (`HAS_SALON`). Apple (5.1.1(v)) et Google l'exigent. → **décision en attente**.
3. **Signalement d'un avis** — les avis sont du contenu généré par les utilisateurs ; Apple (1.2) attend un moyen de les signaler et de bloquer un abus, avec un contact publié. L'administration sait masquer un avis, mais un utilisateur ne peut pas encore en signaler un. → à faire (« signalements », lot 2 de `docs/ADMIN.md`).
4. **Captures d'écran** — Play : 2 à 8 captures de téléphone ; App Store : au moins une série 6,7" (1290×2796) ou 6,9" (1320×2868). À prendre depuis l'application installée.
5. **Application non essayée sur appareil** avant le premier envoi : le test interne (Play) et TestFlight (Apple) servent à ça, pas la production.
