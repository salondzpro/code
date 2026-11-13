# Charte graphique — Espace professionnel Salon DZ

> Référence unique du thème pro « minimal éditorial » (validé par le propriétaire le 11 nov. 2026,
> complété le 13 nov.). **À relire avant toute nouvelle page, fenêtre ou bouton de l'espace pro.**
> Ce qui est écrit ici l'emporte sur l'habitude. Le côté client garde son propre style.
>
> But : qu'un professionnel algérien, souvent seul dans son salon, comprenne un écran **d'un coup
> d'œil, entre deux clientes**, et ne reapprenne jamais un geste.

---

## 1. Principes

1. **L'essentiel du moment d'abord, le reste sur demande.** Un écran montre ce qu'il faut savoir
   *maintenant* (qui, quand, quoi faire). Le détail rare (coordonnées complètes, compteurs, blocage,
   historique entier) est replié : « Plus d'informations », « Voir tout ». *Exemples : fiche client,
   page du rendez-vous.*
2. **Zéro doublon.** Une information, une action, une destination : un seul endroit. Pas de bouton
   « Retour à l'agenda » quand la flèche retour existe ; pas l'heure deux fois ; pas la durée deux fois.
3. **Une icône parle avant le mot.** Chaque bouton a son icône (§ 5) ; les marques connues gardent
   leur logo et leur couleur (§ 4).
4. **Peu de texte.** Une phrase sous un titre, jamais un paragraphe. Pas de phrase qui explique ce
   que l'écran fait de lui-même (« Nous vérifions si… » : retiré).
5. **Pouce d'abord.** Actions en bas, cibles ≥ 44 px, ronds d'action de 56 px.

## 2. Couleurs

| Rôle | Valeur | Usage |
|---|---|---|
| Encre | `#111111` | texte, bouton principal, sélection, onglet actif |
| Gris texte | `#6e6e76` | sous-titres, libellés secondaires |
| Fond de page | `#f7f7f9` | toutes les pages pro |
| Surface | `#ffffff` | cartes, fenêtres, champs |
| Gris clair | `#ebebee` / `#f1f1f3` | bouton secondaire, fond d'icône |
| Filet | `#e2e2e6` / `#e4e4e8` | contour des champs et des ronds blancs |

**Aucun accent de marque** (le violet est abandonné). La couleur ne sert qu'à DIRE quelque chose :

| Sens | Couleur (système iOS) | Exemples |
|---|---|---|
| Oui / fait / en cours | vert `#34c759` | Accepter, Terminé, « en cours » dans l'agenda |
| Non / danger | rouge `#ff3b30` | Refuser, Absent, Retard, ligne de l'heure |
| À valider | orange `#ff9500` | demande en attente (agenda) |
| Confirmé | bleu `#007aff` | rendez-vous confirmé (agenda) |
| Passé / terminé | gris `#aeaeb2` | rendez-vous passé |

Agenda : fond teinté de la couleur du statut (16 %), heure écrite dans cette couleur, sans liseré.
**Jamais de couleur par membre de l'équipe** (refusé le 11 nov.) : le nom en tête de colonne suffit.

Frise des jours : **un point par rendez-vous** (quatre au plus) dans la couleur de son statut, point
rouge cerclé = nouveauté non vue. **Jour choisi = numéro dans un cercle bleu iOS **, nom du
jour en bleu (jamais un pavé noir) ; aujourd'hui non choisi s'écrit en bleu.

## 3. Typographie, formes, ombres

- **Plus Jakarta Sans**, graisses **400 / 500 / 600 seulement**. Grand titre 28 px 600, interlettrage
  serré (-0,03 em). Titre de page dans la barre du retour (`TopBar title`), jamais un `<h1>` dessous.
- Heures, prix, numéros : `dir="ltr"`, chiffres `mono` quand ils s'alignent.
- Cartes : blanches, **sans contour**, coins 16 px, ombre légère `0 10px 28px -16px rgb(0 0 0 / .16)`.
- Fenêtres du bas : coins 28 px ; **sur téléphone, au moins la moitié de l'écran**, actions en bas.
- **Aplats seulement** : ni dégradé décoratif, ni halo coloré, ni reflet. Seule exception voulue :
  le fond animé de l'écran d'ouverture (photo floutée + halos encre/blanc/gris).

## 4. Couleurs et logos des marques — toujours les officiels

Un logo connu se comprend sans lire. On n'en dessine **jamais** une imitation générique.

| Marque | Couleur | Composant |
|---|---|---|
| WhatsApp | `#25D366` | `WhatsAppLogo` (couleur) / `WhatsAppGlyph` (sur fond coloré) — **jamais** `MessageCircle` |
| Instagram | dégradé officiel | `InstagramLogo` / `InstagramGlyph` |
| Snapchat | `#FFFC00` | `SnapchatLogo` / `SnapchatGhost` |
| Facebook | `#1877F2` | `FacebookLogo` |
| TikTok | officiel | `TikTokLogo` |
| Gmail, Outlook, Yahoo Mail, Mail | officiels | `MailLogo` (`components/ProAuthKit.tsx`) |

Composants : `components/BrandIcons.tsx` ; tracés et couleurs : `packages/constants/src/brandLogos.ts`.
Une marque manquante s'y ajoute (tracé officiel, couleur officielle).
SMS et appel n'ont pas de marque : icône `Send` + mot « SMS », icône `Phone`.

**Joindre un client = les trois ronds `ClientContact`** (WhatsApp, SMS, appel), partout : fenêtre de
l'agenda, page du rendez-vous, carte du prochain rendez-vous. Pas de gros boutons « Appeler / WhatsApp ».

## 5. Icônes

- **Une action = une icône, la même partout**, prise dans `apps/web/src/lib/actionIcons.ts`
  (`ICONE.reporter`, `ICONE.annulerRdv`…). `<Button icon={ICONE.x}>`, `<LinkButton icon={…}>`.
- Être précis : « Annuler » un rendez-vous (calendrier barré) ≠ « Annuler » une fenêtre (croix).
- Aucune icône lucide ne dit exactement l'action ? On la **dessine** (24 × 24, trait 1,6, bouts
  ronds) et on l'ajoute au vocabulaire.
- Flèches et chevrons se retournent en arabe (automatique avec `icon=`).

## 6. Boutons

| Niveau | Style |
|---|---|
| Principal | noir plein, pilule (56 px en bas d'écran) |
| Secondaire | gris clair `#ebebee`, texte encre |
| Troisième | cerclé de noir |
| Lien | texte souligné (« Voir tout », « Modifier ») — pas de pilule |
| Danger | rouge, réservé à l'irréversible (supprimer, bloquer) |

**Ronds d'action** (`components/ActionRond.tsx`, grille `.ag-acts`) pour décider d'un rendez-vous :
vert plein = oui (Accepter, Terminé), rouge plein = non (Refuser, Absent, Retard), blanc cerclé =
le reste (Reporter, Annuler, Confier, Fiche), le mot dessous. Les mêmes que les Demandes.

## 7. Clavier, langue, chargement

- **Clavier** : rien de ce qu'on utilise ne finit dessous ; fenêtres du bas en haut de la zone
  visible (règle complète dans CLAUDE.md, « RÈGLE CLAVIER »). Aucun focus automatique.
- **Langue** : toujours `LangSwitch` (drapeau + nom, liste déroulante). Jamais de pastilles d'abréviations.
- **Chargement** : barre et squelette, jamais l'écran de marque en cours de route.

## 8. Erreurs déjà commises — à ne plus refaire

| Erreur | Règle |
|---|---|
| Bulle grise à la place du logo WhatsApp | Logo officiel vert (§ 4) |
| Boutons sans icône | Icône du vocabulaire sur chaque bouton (§ 5) |
| Icône écrasée à 0 px dans une rangée étroite | `.btn-i { flex: none }` ; ronds d'action au-dessus de 3 boutons |
| Fenêtre collée au clavier, champ caché par la barre iOS | Fenêtre en haut de la zone visible (§ 7) |
| Tout afficher d'un coup (fiche client) | L'essentiel du moment, le reste replié (§ 1) |
| « Retour à l'agenda » sous la flèche retour | Zéro doublon (§ 1) |
| Heure ou durée répétées | Une seule fois (§ 1) |
| Couleur par membre dans l'agenda | Couleur = statut seulement (§ 2) |
| Pastilles FR / AR / EN | `LangSwitch` (§ 7) |
| Pavé noir sur le jour choisi | Cercle bleu iOS sur le numéro (§ 2) |
| Points gris sans sens sous les jours | Un point par rendez-vous, couleur du statut (§ 2) |
| Violet, dégradés, halos colorés | Monochrome + couleurs de sens (§ 2, § 3) |

## 9. Avant de livrer un écran pro — liste de contrôle

- [ ] Ce qu'il faut savoir *maintenant* est en haut ; le rare est replié.
- [ ] Rien n'apparaît deux fois.
- [ ] Chaque bouton a l'icône du vocabulaire ; chaque marque son logo officiel.
- [ ] Couleurs : encre/blanc/gris + couleurs de sens uniquement.
- [ ] Testé à 390 px de large, clavier ouvert (`node_modules/.shots/clavier.mjs`), en arabe.
- [ ] Textes passés par `t()` et traduits (ar, en).
