# App Beaute Hi-Fi.dc.html

## f1 — COMPTE ET SESSION — 16 écrans

Compte obligatoire avant toute réservation. Code WhatsApp une seule fois — à l’inscription ou à la première connexion — puis session ouverte sans limite, sur l’application comme sur le web. Les échecs courants (numéro invalide, code incorrect, code expiré, réseau) sont dans le flux ; les cas rares (blocage, WhatsApp injoignable, déconnexion volontaire) sont regroupés en partie 05. Une session ne se ferme jamais d’elle-même — ni délai, ni expiration : seule une déconnexion explicite la termine, côté client comme côté professionnel.

- **AUTH 01** Splash · logo Salon DZ → `screens/AUTH-01.html` / `screens/AUTH-01.png`
- **AUTH 02** Introduction → `screens/AUTH-02.html` / `screens/AUTH-02.png`
- **AUTH 03** Choix du compte → `screens/AUTH-03.html` / `screens/AUTH-03.png`
- **AUTH 04** Numéro de téléphone → `screens/AUTH-04.html` / `screens/AUTH-04.png`
- **AUTH 05** Numéro invalide → `screens/AUTH-05.html` / `screens/AUTH-05.png`
- **AUTH 06** Canal de vérification → `screens/AUTH-06.html` / `screens/AUTH-06.png`
- **AUTH 07** Envoi du code → `screens/AUTH-07.html` / `screens/AUTH-07.png`
- **AUTH 08** Code reçu sur WhatsApp → `screens/AUTH-08.html` / `screens/AUTH-08.png`
- **AUTH 09** Code incorrect → `screens/AUTH-09.html` / `screens/AUTH-09.png`
- **AUTH 10** Code expiré · renvoyer → `screens/AUTH-10.html` / `screens/AUTH-10.png`
- **AUTH 11** Erreur réseau → `screens/AUTH-11.html` / `screens/AUTH-11.png`
- **AUTH 12** Vérification réussie → `screens/AUTH-12.html` / `screens/AUTH-12.png`
- **AUTH 13** Profil client de base → `screens/AUTH-13.html` / `screens/AUTH-13.png`
- **AUTH 14** Retour dans l'app · session conservée → `screens/AUTH-14.html` / `screens/AUTH-14.png`
- **AUTH 15** Choix du marché · Pour Hommes ou Pour Femmes → `screens/AUTH-15.html` / `screens/AUTH-15.png`
- **AUTH 16** Bascule vers l’espace professionnel → `screens/AUTH-16.html` / `screens/AUTH-16.png`

## f2 — CLIENT · POUR HOMMES — 9 écrans

« Pour Hommes » ouvre directement la marketplace correspondante : pas de page de catégories intermédiaire, les catégories sont des filtres. Catalogue strictement séparé de celui des femmes ; les étapes communes renvoient vers 02B.

- **C-H 01** Marketplace · Pour Hommes → `screens/C-H-01.html` / `screens/C-H-01.png`
- **C-H 02** Localisation et rayon → `screens/C-H-02.html` / `screens/C-H-02.png`
- **C-H 03** Position non reconnue · réglages → `screens/C-H-03.html` / `screens/C-H-03.png`
- **C-H 04** Résultats sur la carte → `screens/C-H-04.html` / `screens/C-H-04.png`
- **C-H 05** Trier les résultats → `screens/C-H-05.html` / `screens/C-H-05.png`
- **C-H 06** Filtre Coiffure · Pour Hommes → `screens/C-H-06.html` / `screens/C-H-06.png`
- **C-H 07** Recherche · contexte Pour Hommes conservé → `screens/C-H-07.html` / `screens/C-H-07.png`
- **C-H 08** Aucun résultat → `screens/C-H-08.html` / `screens/C-H-08.png`
- (renvoi) C-H 09Page du barbierCouverture, note, prestations, réalisations et disponibilités — même structure que C-F 04 « Page du salon », avec le contenu Pour Hommes : voir PRO-H 05 (Amine Barber).
- **C-H 10** Prestations cumulées · Pour Hommes → `screens/C-H-10.html` / `screens/C-H-10.png`
- (renvoi) C-H 11Date, coordonnées, récapitulatif, confirmationÉcrans identiques au parcours femme — C-F 09 à C-F 13, avec le barbier et les prestations Pour Hommes en tête.
- (renvoi) C-H 12Suivi des rendez-vousMes rendez-vous, détail, report, annulation, historique, avis et favoris — C-F 14 à C-F 21.

## f3 — CLIENT · POUR FEMMES — 22 écrans

Parcours complet : découverte, localisation et carte, page du salon, réalisations, prestations, créneaux, coordonnées, récapitulatif, confirmation, puis suivi — report, annulation, historique, note et favoris.

- **C-F 01** Marketplace · Pour Femmes → `screens/C-F-01.html` / `screens/C-F-01.png`
- **C-F 02** Filtre Ongles · Pour Femmes → `screens/C-F-02.html` / `screens/C-F-02.png`
- (renvoi) C-F 03Localisation, carte, tri et rechercheSélecteur de quartier et rayon, vue carte, tri et recherche — écrans C-H 02 à C-H 08, contexte Pour Femmes.
- **C-F 04** Page du salon → `screens/C-F-04.html` / `screens/C-F-04.png`
- **C-F 05** Réalisations du salon → `screens/C-F-05.html` / `screens/C-F-05.png`
- **C-F 06** Prestations illustrées → `screens/C-F-06.html` / `screens/C-F-06.png`
- **C-F 07** Détail de la prestation → `screens/C-F-07.html` / `screens/C-F-07.png`
- **C-F 08** Prestations cumulées · Pour Femmes → `screens/C-F-08.html` / `screens/C-F-08.png`
- **C-F 09** Date et créneaux disponibles → `screens/C-F-09.html` / `screens/C-F-09.png`
- **C-F 10** Coordonnées de la cliente → `screens/C-F-10.html` / `screens/C-F-10.png`
- **C-F 11** Récapitulatif et validation → `screens/C-F-11.html` / `screens/C-F-11.png`
- **C-F 12** Réservation confirmée → `screens/C-F-12.html` / `screens/C-F-12.png`
- **C-F 13** Ajouter au calendrier → `screens/C-F-13.html` / `screens/C-F-13.png`
- **C-F 14** Mes rendez-vous · à venir → `screens/C-F-14.html` / `screens/C-F-14.png`
- **C-F 15** Détail du rendez-vous → `screens/C-F-15.html` / `screens/C-F-15.png`
- **C-F 16** Reporter le rendez-vous → `screens/C-F-16.html` / `screens/C-F-16.png`
- **C-F 17** Annuler le rendez-vous → `screens/C-F-17.html` / `screens/C-F-17.png`
- **C-F 18** Annulation confirmée → `screens/C-F-18.html` / `screens/C-F-18.png`
- **C-F 19** Rendez-vous passés → `screens/C-F-19.html` / `screens/C-F-19.png`
- **C-F 20** Noter la prestation → `screens/C-F-20.html` / `screens/C-F-20.png`
- **C-F 21** Salons favoris → `screens/C-F-21.html` / `screens/C-F-21.png`
- **C-F 22** Profil client → `screens/C-F-22.html` / `screens/C-F-22.png`
- **C-F 23** Réglages client → `screens/C-F-23.html` / `screens/C-F-23.png`

## f4 — PROFESSIONNEL · POUR HOMMES — 2 écrans

Même onboarding que 03B avec le catalogue Pour Hommes (coiffure, lissage, coloration & mèches, soins & nettoyage de la peau, tresses / braids) et sa page publique. Les étapes identiques renvoient vers 03B.

- (renvoi) PRO-H 01Bienvenue professionnelÉcran d’accueil de l’espace pro, commun aux deux marchés — écran PRO-F 01.
- (renvoi) PRO-H 02Création de compte WhatsAppNuméro +213, canal WhatsApp et code de vérification — écrans DÉBUT 03 à DÉBUT 12.
- (renvoi) PRO-H 03Choix du marché serviMême écran que PRO-F 03 : le professionnel choisit Pour Hommes, ce qui restreint tout son catalogue.
- **PRO-H 04** Catalogue Pour Hommes · sélection → `screens/PRO-H-04.html` / `screens/PRO-H-04.png`
- **PRO-H 05** Aperçu page publique · Pour Hommes → `screens/PRO-H-05.html` / `screens/PRO-H-05.png`
- (renvoi) PRO-H 06Établissement, photos, adresseNom et lien, logo et couverture, adresse et zone — écrans PRO-F 04 à PRO-F 06.
- (renvoi) PRO-H 07Prix, durées, photos et réalisationsCréation des prestations et du portfolio — écrans PRO-F 08 à PRO-F 10.
- (renvoi) PRO-H 08Horaires, disponibilités et règlesHoraires, créneaux, battement et règles de réservation — écrans PRO-F 11 à PRO-F 13.
- (renvoi) PRO-H 09Publication, lien et partagePublication, lien unique, partage WhatsApp / réseaux / QR — écrans PRO-F 16 à PRO-F 21.
- (renvoi) PRO-H 10Agenda, rendez-vous et chiffre d’affairesAccueil, CA jour/semaine/mois, agenda, création manuelle, clients, catalogue, avis, réglages — écrans PRO-F 22 à PRO-F 47.

## f5 — PROFESSIONNELLE · POUR FEMMES — 46 écrans

Ouverture du salon de bout en bout : identité, catalogue, prestations et photos, horaires, disponibilités et règles, publication et partage du lien. Puis exploitation quotidienne : chiffre d’affaires jour / semaine / mois, agenda jour / semaine / mois, création manuelle de rendez-vous, cycle de vie complet du rendez-vous, clients, catalogue, réalisations, avis et réglages.

- **PRO-F 01** Bienvenue professionnel → `screens/PRO-F-01.html` / `screens/PRO-F-01.png`
- (renvoi) PRO-F 02Création de compte WhatsAppNuméro +213, canal WhatsApp et code de vérification — écrans DÉBUT 03 à DÉBUT 12.
- **PRO-F 03** Choix du marché servi → `screens/PRO-F-03.html` / `screens/PRO-F-03.png`
- **PRO-F 04** Nom et lien de réservation → `screens/PRO-F-04.html` / `screens/PRO-F-04.png`
- **PRO-F 05** Logo et photo de couverture → `screens/PRO-F-05.html` / `screens/PRO-F-05.png`
- **PRO-F 06** Adresse et zone d'activité → `screens/PRO-F-06.html` / `screens/PRO-F-06.png`
- **PRO-F 07** Catalogue Pour Femmes · sélection → `screens/PRO-F-07.html` / `screens/PRO-F-07.png`
- **PRO-F 08** Créer une prestation · prix et durée → `screens/PRO-F-08.html` / `screens/PRO-F-08.png`
- **PRO-F 09** Photos de la prestation → `screens/PRO-F-09.html` / `screens/PRO-F-09.png`
- **PRO-F 10** Premières réalisations → `screens/PRO-F-10.html` / `screens/PRO-F-10.png`
- **PRO-F 11** Horaires d'ouverture → `screens/PRO-F-11.html` / `screens/PRO-F-11.png`
- **PRO-F 12** Créneaux et disponibilités → `screens/PRO-F-12.html` / `screens/PRO-F-12.png`
- **PRO-F 13** Règles de réservation → `screens/PRO-F-13.html` / `screens/PRO-F-13.png`
- **PRO-F 14** Fermetures et exceptions → `screens/PRO-F-14.html` / `screens/PRO-F-14.png`
- **PRO-F 15** Aperçu page publique · Pour Femmes → `screens/PRO-F-15.html` / `screens/PRO-F-15.png`
- **PRO-F 16** Publier la page → `screens/PRO-F-16.html` / `screens/PRO-F-16.png`
- **PRO-F 17** Lien de réservation généré → `screens/PRO-F-17.html` / `screens/PRO-F-17.png`
- **PRO-F 18** Partager votre page → `screens/PRO-F-18.html` / `screens/PRO-F-18.png`
- **PRO-F 19** Partage WhatsApp → `screens/PRO-F-19.html` / `screens/PRO-F-19.png`
- **PRO-F 20** Partage réseaux sociaux → `screens/PRO-F-20.html` / `screens/PRO-F-20.png`
- **PRO-F 21** QR code en vitrine → `screens/PRO-F-21.html` / `screens/PRO-F-21.png`
- **PRO-F 22** Accueil professionnel → `screens/PRO-F-22.html` / `screens/PRO-F-22.png`
- **PRO-F 23** Chiffre d'affaires · jour, semaine, mois → `screens/PRO-F-23.html` / `screens/PRO-F-23.png`
- **PRO-F 24** Agenda · vue jour → `screens/PRO-F-24.html` / `screens/PRO-F-24.png`
- **PRO-F 25** Agenda · vue semaine → `screens/PRO-F-25.html` / `screens/PRO-F-25.png`
- **PRO-F 26** Agenda · vue mois → `screens/PRO-F-26.html` / `screens/PRO-F-26.png`
