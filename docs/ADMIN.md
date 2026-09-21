# Salon DZ — espace d'administration de la place de marché

Analyse et conception, 20 septembre 2026. Les décisions attendues du propriétaire sont en
section 9 ; l'état de la livraison est en section 11.

**Les lots 1 et 2 sont livrés.** Lot 1 le 20 septembre 2026 (migration `0044`, garde
`requireAdmin`, routes `/v1/admin/*`, écrans sous `/admin`, journal). Lot 2 le 21 septembre 2026
(migration `0045`) : geler ou masquer un salon, suspendre un client, masquer un avis, annuler au
nom de la plateforme, et piloter l'espace d'un professionnel. Détail en sections 11 et 12.

---

## 1. Ce qui existe aujourd'hui

Trois constats commandent toute la conception.

**Il n'y a aucun administrateur.** Le type `public.user_role` vaut `client` ou `pro`, point. Aucune
route, aucun écran, aucun compte ne permet d'agir sur la place de marché. Pour dépublier un salon
abusif aujourd'hui, il faut ouvrir la base de données à la main.

**L'API travaille déjà avec la clé secrète et contourne la RLS.** Les 39 règles RLS protègent les
accès directs à la base ; c'est le code de l'API qui autorise, par trois gardes successives :
`requireAuth` (une session), `requireProfile` (un profil chargé), `requireSalon` (le salon dont on
est propriétaire). **Un quatrième garde `requireAdmin` s'insère exactement dans ce schéma** : pas
de refonte de la RLS, pas de nouveau modèle d'accès. C'est la bonne nouvelle de cette analyse.

**Rien n'est prévu pour la modération.** Il manque, au niveau des données :

| Manque | Conséquence aujourd'hui |
|---|---|
| Suspension d'un salon par la plateforme | `is_published` appartient au professionnel : il le remet à `true` |
| Suspension d'un client par la plateforme | `blocked_clients` est propre à UN salon, pas à la place de marché |
| Masquage d'un avis | Un avis injurieux reste en ligne |
| Signalement par un utilisateur | Aucun canal : tout arrive par e-mail, sans suivi |
| Journal des actions d'administration | Aucune trace de qui a fait quoi |

Ce qui existe et servira : `app_settings` (clé/valeur), les agrégats de note, les fonctions SQL de
la clientèle, le cron, la limitation de débit, et le motif de la page `/moi` (page protégée par un
code, hors indexation).

---

## 2. Ce qu'un opérateur de place de marché fait vraiment

Le back-office n'est pas « toutes les tables avec des boutons ». C'est l'outil de quelqu'un qui,
dans la journée, fait ceci — dans cet ordre de fréquence :

1. **Répondre à un professionnel qui appelle** : « mon salon n'apparaît pas », « je n'ai pas reçu
   la demande », « un client me met un avis mensonger ». Il faut retrouver le salon en trois
   secondes et VOIR ce que le pro voit.
2. **Traiter un signalement** : avis injurieux, salon qui ne répond jamais, photo inappropriée.
3. **Surveiller la place de marché** : combien de salons publiés, combien de réservations hier,
   quel taux d'annulation, quel taux d'absence — et ce qui se dégrade.
4. **Agir quand il le faut** : suspendre un salon, suspendre un client, masquer un avis.
5. **Tenir le contenu** : catégories, quartiers, prestations types.
6. **Vérifier que la machine tourne** : le cron a-t-il tiqué, les e-mails partent-ils, les
   notifications arrivent-elles.

Tout le reste est du confort. La conception suit cet ordre.

---

## 3. Périmètre, écran par écran

### 3.1 Tableau de bord

La page d'entrée répond à « est-ce que tout va bien ? » sans faire défiler.

- **Aujourd'hui** : réservations, annulations, absences, nouveaux salons, nouveaux comptes.
- **Tendance 30 jours** : réservations par jour, courbe simple, comparaison au mois précédent.
- **Ce qui attend** : signalements non traités, salons en attente de première publication, avis
  masqués à revoir.
- **Santé technique** : dernier tic du cron, e-mails envoyés / en échec sur 24 h, taux d'erreur de
  l'API. Une ligne verte ou rouge, pas un graphique.

### 3.2 Professionnels

La liste : recherche par nom, lien, ville, téléphone, e-mail du propriétaire. Filtres : publié /
non publié / suspendu, wilaya, marché, avec ou sans rendez-vous ce mois.

La fiche d'un salon rassemble ce que l'opérateur demande au téléphone :

- identité (nom, lien, adresse, coordonnées, marché, catégories) ;
- le propriétaire (nom, e-mail, téléphone, date d'inscription) ;
- l'activité (rendez-vous 30 jours, chiffre d'affaires, taux d'annulation, taux d'absence) ;
- le catalogue, l'équipe, les horaires — **en lecture** ;
- les avis, dont ceux masqués ;
- le journal des actions d'administration sur ce salon.

Actions : **suspendre** (avec motif obligatoire), **réactiver**, **forcer la dépublication**,
**voir la page publique**, **voir comme le pro** (section 5).

> Ce qu'un administrateur ne doit PAS pouvoir faire : modifier le catalogue, les prix ou les
> horaires d'un salon. Ce sont les données du professionnel ; les toucher, c'est prendre la
> responsabilité de son agenda. En cas d'erreur, on l'appelle.

### 3.3 Clients

Liste avec recherche par nom, téléphone, e-mail. Fiche : identité, rendez-vous (à venir, passés,
annulés), avis donnés, salons qui l'ont bloqué, situation anti-abus (annulations et absences
récentes, suspension en cours).

Actions : **suspendre la réservation en ligne** sur toute la place de marché (motif obligatoire),
**lever une suspension**, **exporter ses données** (loi 18-07), **supprimer le compte** (même
anonymisation que `DELETE /v1/me`, avec confirmation forte).

### 3.4 Rendez-vous

Recherche globale par salon, client, téléphone, date, statut. Sert presque uniquement au litige :
« le client dit qu'il a annulé, le salon dit que non ». La fiche montre l'historique complet du
rendez-vous : création, confirmation, report, annulation, par qui, à quelle heure.

Une seule action : **annuler au nom de la plateforme**, avec motif, les deux parties prévenues.

### 3.5 Avis et signalements

File d'attente des signalements, plus récents d'abord : qui signale, quoi, pourquoi. Sur un avis :
le lire en contexte (le rendez-vous, le salon, le client), **masquer** avec motif, **rétablir**.

Un avis masqué disparaît de la page publique et du calcul de la note, mais **n'est jamais
supprimé** : on doit pouvoir expliquer une décision six mois plus tard.

### 3.6 Contenu de la place de marché

Catégories (libellés FR/AR, icône, marché, ordre), prestations types proposées à l'inscription,
quartiers. Aujourd'hui tout cela vit dans le code ou dans des migrations : le passer en base
permet de corriger un libellé sans déployer.

### 3.7 Réglages de la plateforme

`app_settings` avec une vraie interface : URL de l'API pour le cron, jeton, drapeaux de
fonctionnalité (`SHOW_SALON_CONTACT_TO_CLIENTS` par exemple), message d'annonce affiché en haut de
l'application. Les valeurs sensibles (jetons) se remplacent, ne se lisent pas.

### 3.8 Journal

Toute écriture faite depuis l'espace d'administration : qui, quand, quoi, sur qui, avec quel motif,
depuis quelle adresse. Filtrable, exportable. **Ce n'est pas une option** (section 5).

---

## 4. Modèle de rôle

Trois possibilités.

| | Comment | Pour | Contre |
|---|---|---|---|
| **A** | Ajouter `admin` à l'énumération `user_role` | Une ligne de migration | Un administrateur devient un type d'utilisateur de la place de marché ; les gardes existants (`RequireClient`, `RequirePro`) doivent tous le prévoir ; pas de niveaux |
| **B** | Table `platform_admins` séparée | Un administrateur reste un client ou un pro normal ; niveaux possibles ; on ajoute et on retire un accès sans toucher au compte | Une table de plus |
| **C** | Projet d'authentification séparé | Isolation maximale | Deux systèmes de comptes à tenir, pour une équipe de une à trois personnes |

**Recommandation : B**, avec deux niveaux :

- **`support`** — voit tout, agit sur ce qui se répare (masquer un avis, lever une suspension,
  traiter un signalement). Ne supprime pas de compte, ne touche pas aux réglages.
- **`owner`** — tout, dont la suppression de compte, les réglages de la plateforme et la gestion
  des administrateurs eux-mêmes.

La distinction n'est pas de la bureaucratie : le jour où quelqu'un aide au support, il ne doit pas
pouvoir effacer un salon par erreur.

---

## 5. Sécurité — les points non négociables

**Le journal d'abord.** Un opérateur agit sur les données d'autrui : ses clients, leurs clients,
leurs rendez-vous. Chaque écriture est tracée avec l'état avant et après. C'est ce qui permet de
répondre à « pourquoi mon salon a-t-il été suspendu ? » et c'est aussi ce que demande l'esprit de
la loi 18-07 sur la traçabilité des traitements.

**Un motif obligatoire** sur toute action qui prive quelqu'un de quelque chose : suspension,
masquage, suppression. Le motif est affiché à la personne concernée quand cela la regarde.

**« Voir comme le pro » en LECTURE SEULE.** Le besoin est réel — comprendre ce que le
professionnel a sous les yeux. Une vraie prise de session (agir à sa place) est un pouvoir
disproportionné et intraçable du côté du pro. On propose donc une vue en lecture, bandeau visible,
tracée au journal ; jamais d'écriture en son nom.

**Un garde serveur, pas un écran caché.** Les routes `/v1/admin/*` refusent tout ce qui ne vient
pas d'un administrateur, indépendamment de l'interface. Une adresse devinée ne donne rien.

**Deuxième facteur.** Recommandé sur les comptes `owner` — Supabase le propose. À décider (§ 9).

**Limitation de débit séparée** et journalisation des accès refusés : une tentative répétée sur
`/v1/admin/*` doit se voir.

---

## 6. Données à ajouter

Esquisse de migration, à affiner à l'écriture :

```
platform_admins   user_id · level (support|owner) · created_at · created_by · disabled_at
admin_audit       id · admin_id · action · target_type · target_id · before · after
                  · reason · ip · created_at
reports           id · reporter_id · target_type (review|salon|booking) · target_id
                  · reason · message · status (open|handled|rejected)
                  · handled_by · handled_at · created_at

salons     + suspended_at · suspended_reason
profiles   + suspended_at · suspended_reason
reviews    + hidden_at · hidden_reason · hidden_by
```

Aucune suppression, aucun renommage : tout est additif et rétro-compatible, conformément à la
règle du projet sur les migrations.

---

## 7. Ce que cela change ailleurs

Une suspension n'a de valeur que si tout le reste la respecte. À traiter dans le même lot :

- `search_salons_v2` et la page publique **excluent** un salon suspendu ;
- `create_booking_multi` **refuse** un client suspendu, avec un code d'erreur clair ;
- les avis masqués sortent de la liste publique **et** du calcul de `rating_avg` / `rating_count` ;
- le professionnel **voit** qu'il est suspendu et pourquoi, dès son accueil : une suspension muette
  produit un appel furieux ;
- les schémas de réponse des routes publiques (point 8 du plan de production) doivent recevoir les
  nouvelles colonnes **uniquement** si elles sont publiques — `suspended_reason` ne l'est pas.

---

## 8. Où vit l'espace d'administration

Deux options.

**Dans l'application web, sous `/admin`** — les composants, les jetons, l'authentification et les
traductions sont déjà là ; l'écriture est rapide. L'application charge déjà ses 40 écrans à la
demande : le code de l'administration formerait un morceau séparé, jamais téléchargé par un
visiteur, comme le moteur de démonstration. Le garde serveur reste la vraie barrière.

**Une application séparée (`apps/admin`)** — isolation totale, mais un déploiement, un domaine, une
chaîne de construction et une authentification de plus, pour trois personnes.

**Recommandation : `/admin` dans l'application web**, chargé à la demande, derrière le garde
serveur. On pourra toujours l'extraire plus tard : la frontière est l'API, pas l'interface.

---

## 9. Décisions attendues du propriétaire

| # | Question | Recommandation |
|---|---|---|
| 1 | Modèle de rôle : A, B ou C ? | **B** — table `platform_admins`, deux niveaux |
| 2 | Espace dans l'application web ou application séparée ? | **Dans l'application**, sous `/admin` |
| 3 | « Voir comme le pro » : lecture seule, ou prise de session complète ? | **Lecture seule** |
| 4 | Un administrateur peut-il modifier le catalogue d'un salon ? | **Non** — on appelle le pro |
| 5 | Deuxième facteur obligatoire sur les comptes `owner` ? | **Oui**, dès qu'il y a plus d'un administrateur |
| 6 | Qui est administrateur au départ ? | Le propriétaire seul, en `owner` |
| 7 | Les signalements par les utilisateurs : dans ce lot ou plus tard ? | **Dans le lot 2** : sans canal, tout arrive par e-mail et rien n'est suivi |

---

## 10. Lots de livraison

**Lot 1 — voir (le back-office en lecture).** Table `platform_admins`, garde `requireAdmin`,
journal, tableau de bord, liste et fiche des professionnels, liste et fiche des clients, recherche
de rendez-vous. Aucune action destructive. C'est déjà 80 % de la valeur au quotidien : retrouver
un salon et comprendre ce qu'il voit.

**Lot 2 — agir.** Suspension d'un salon et d'un client (avec motif et effets partout), masquage
d'un avis, signalements et leur file d'attente, annulation au nom de la plateforme.

**Lot 3 — tenir.** Réglages de la plateforme, contenu (catégories, quartiers), « voir comme le
pro », export du journal, second facteur.

Le lot 1 est utile seul et sans risque : il ne modifie rien. C'est par lui qu'il faut commencer.

---

## 11. Lot 1 — ce qui est livré (20 septembre 2026)

**Données** — `supabase/migrations/0044_platform_admin.sql` : type `admin_level`
(`support` | `owner`), table `platform_admins` (`user_id`, `level`, `created_at`, `created_by`,
`disabled_at`), table `admin_audit`, et quatre fonctions de lecture (`admin_overview`,
`admin_salons_page`, `admin_profiles_page`, `admin_bookings_page`). Les deux tables ont la RLS
activée **sans aucune politique**, et tous les droits sont révoqués pour `anon` et
`authenticated` : personne n'y accède depuis un navigateur, seule l'API (clé secrète) les lit.

**Garde** — `requireAdmin` dans `apps/api/src/plugins/auth.ts`, quatrième maillon après
`requireAuth` → `requireProfile`. Un accès retiré (`disabled_at`) vaut refus. Tout refus part dans
les journaux (compte, adresse IP, route) : une tentative répétée se voit. `requireOwner` ajoute le
niveau `owner`, en attente du lot 2.

**API** — `apps/api/src/routes/admin.ts`, montée sur `/v1/admin`, limitée à 120 requêtes par
minute et par compte, `Cache-Control: private, no-store` sur toutes les réponses : `/me`,
`/overview`, `/salons`, `/salons/:id`, `/profiles`, `/profiles/:id`, `/bookings`, `/audit`. La
consultation d'une fiche **nominative** (un salon, un compte) écrit dans `admin_audit` ; une liste
ou un compteur, non — un journal qui enregistre tout ne se lit plus.

**Écrans** — `apps/web/src/pages/admin/`, sous `/admin`, chargés à la demande (morceaux séparés,
jamais téléchargés par une cliente) : vue d'ensemble, professionnels (liste + fiche), comptes
(liste + fiche), rendez-vous, journal. Aucun lien n'y mène depuis l'application : l'adresse se
tape, et le garde serveur est la seule barrière qui compte. Un visiteur non connecté est envoyé
sur l'écran de connexion, qui le ramène ensuite ici ; un visiteur connecté mais qui n'est PAS
administrateur est renvoyé à l'accueil sans un mot — c'est ce cas-là qui compte, inutile
d'apprendre à un client curieux qu'une porte existe.

**Adresse du portail** — `admin.salondz.com` ouvre directement le tableau de bord : c'est la même
application, et `main.tsx` réécrit simplement la racine en `/admin` avant le démarrage du routeur.
`salondz.com/admin` reste valable. Le sous-domaine demande soit un moyen de paiement sur Render
(le plan gratuit s'arrête à deux domaines personnalisés par compte, déjà pris par `salondz.com`,
`www` et `api`), soit une redirection de sous-domaine chez IONOS vers `https://salondz.com/admin`
— cette seconde voie ne coûte rien et ne touche pas à l'hébergement.

**Donner et retirer un accès** — `node --env-file=.env scripts/admin.mjs list | grant <e-mail>
[support|owner] | revoke <e-mail>`. `revoke` pose `disabled_at` et ne supprime jamais la ligne :
le journal doit rester lisible après coup.

**Vérifié par** — le test e2e 37 de l'API, « administration : la porte est fermée, et l'ouverture
laisse une trace » : anonyme, client et pro reçoivent 401/403 ; une fois l'accès donné, la vue
d'ensemble rend ses quatre blocs et la fiche d'un salon rend la vue du propriétaire avec son
adresse e-mail ; la consultation laisse une ligne dans `admin_audit` ; l'accès retiré redonne 403.

---

## 12. Lot 2 — ce qui est livré (21 septembre 2026)

Le propriétaire a tranché autrement que les recommandations des décisions 3 et 4 : un
administrateur peut faire **tout** ce que fait un professionnel, et gérer les clients de bout en
bout. La contrepartie est tenue : **tout est tracé, tout porte un motif, et la personne concernée
voit ce motif.**

**Suspendre un salon, à deux degrés** (migration `0045`) — `frozen` gèle les réservations en
laissant la page en ligne ; `hidden` retire le salon de la place de marché. `is_published` n'est
jamais touché : c'est l'intention du professionnel, et la plateforme n'a pas à la réécrire. La
colonne calculée `is_visible` croise les deux, et c'est elle qu'interrogent les trois fonctions de
recherche publique — un levier oublié quelque part se verrait tout de suite.

**Suspendre un client** — `profiles.suspended_at` : plus de réservation en ligne, sur toute la
place de marché. Ce n'est pas `blocked_clients`, qui est propre à un salon ; et un client reçu en
personne au comptoir reste l'affaire du salon.

**Masquer un avis** — il quitte la page publique et le calcul de la note, sans être supprimé : une
décision doit pouvoir s'expliquer six mois plus tard.

**Une suspension arrête ce qui ENTRE, jamais ce qui est déjà pris.** Créer et reporter sont
refusés (`SALON_SUSPENDED`, `CLIENT_SUSPENDED`) ; confirmer, terminer et annuler un rendez-vous
existant restent possibles. Sans cela, on laisserait des clients devant une porte close sans que
personne puisse les prévenir.

**Annuler au nom de la plateforme** — `cancelled_by = 'platform'`, une nouvelle valeur : ni le
client ni le salon n'en porte la responsabilité, et le créneau repart en liste d'attente.

**Agir en tant que professionnel** — le bouton « Ouvrir son espace », dans la liste comme sur la
fiche, délivre un **jeton de contrôle** : signé, valable deux heures, lié à l'administrateur ET au
salon. Envoyé dans `X-Admin-Control`, il fait porter toutes les routes `/v1/pro/*` sur ce salon :
l'administrateur voit et fait ce que le professionnel voit et fait, depuis la même application.
Le pro appelle, il ne trouve pas comment fermer une journée : on le fait avec lui au lieu de lui
dicter des clics.

Le jeton est étroit parce que le pouvoir est total. Il est *personnel* (un autre compte, même
administrateur, ne s'en sert pas), *daté* (l'espace se referme tout seul, on n'oublie pas une porte
ouverte), et revérifié à chaque requête contre `platform_admins` : retirer l'accès d'un
administrateur coupe ses jetons en cours, sans rien à révoquer. L'entrée et la sortie sont au
journal, chaque écriture faite ainsi aussi (`acted_as_salon`), et un bandeau noir permanent rappelle
chez qui l'on travaille et jusqu'à quelle heure. Dans cet espace, l'accueil et la page Compte
parlent du professionnel, pas de l'administrateur ; son identité se corrige depuis l'administration
(avec motif), jamais depuis l'espace pro.

**Le motif, partout** — huit caractères minimum, refusé par le serveur en deçà. Il est affiché à
la personne concernée : le professionnel suspendu lit pourquoi dans son espace, le client aussi.
Une plateforme qui coupe sans rien dire n'est pas un partenaire.

**Ce qui reste** — les signalements par les utilisateurs (décision 7 : ils devaient venir avec ce
lot, ils demandent un écran côté client et une file d'attente côté administration), puis le lot 3
(réglages de la plateforme, contenu, export du journal, second facteur).

---

*Ce document vit dans le dépôt et se met à jour à chaque lot.*
