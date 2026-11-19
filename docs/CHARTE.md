# Charte graphique et Design System — Salon DZ (référence UNIQUE)

> **19 nov. 2026 — charte alignée sur Planity (demande du propriétaire).** Les valeurs ci-dessous de couleur, police et arrondi sont remplacées par : Inter ; encre `#202020` ; gris `#4e5860` ; fond `#f7f7f7` ; filets `#eef0f2` ; contours de champ `#c7cfd7` ; ombre de carte `0 4px 8px -2px rgb(26 27 31 / .08)` ; arrondis 8 px partout, créneaux 4 px, fenêtres 16 px ; violet `#625df5` pour les numéros d'étape et les liens d'action seulement. Source : `tokens.css` et `styles/planity.css` (composants `pl-*`).

> **RÈGLE ABSOLUE (15 nov. 2026, demande du propriétaire)** : l'espace Professionnels EN PRODUCTION
> (thème « minimal éditorial » validé le 11 nov. 2026) est la source de vérité graphique. UNE charte,
> UN Design System, pour TOUT le produit : espace pro, espace clientes, portails d'accès, fenêtres,
> visuels générés (stories, vidéo). Aucune nouvelle identité visuelle sans demande explicite du
> propriétaire ; aucune ancienne identité ne doit revenir.
>
> - Valeurs : `apps/web/src/styles/tokens.css` (jetons) — la SEULE source des couleurs, polices,
>   arrondis et ombres.
> - Composants : `apps/web/src/components/ui.tsx` (primitives) et `index.css` (classes).
> - Mesures de référence : audit de la production du 15 nov. 2026
>   (`node_modules/.shots/charte-audit.mjs` → `charte/audit.txt` et captures, hors git).

But : qu'un professionnel algérien, souvent seul dans son salon, comprenne un écran **d'un coup
d'œil, entre deux clientes**, et ne réapprenne jamais un geste.

---

## 1. Principes

1. **L'essentiel du moment d'abord, le reste sur demande** (replié : « Plus d'informations », « Voir tout »).
2. **Zéro doublon** : une information, une action, une destination, un seul endroit.
3. **Une icône parle avant le mot** : chaque bouton a l'icône de son action (§ 8).
4. **Texte minimal (règle du 15 nov. 2026)** : pas de sous-titre ni de phrase d'explication ; un texte n'apparaît que s'il est indispensable (erreur, état vide, conséquence d'une action irréversible, valeur d'un réglage). Aucun réglage inutile : une valeur par défaut adaptée au marché algérien plutôt qu'une question.
5. **Pouce d'abord** : actions en bas, cibles ≥ 44 px, ronds d'action de 56 px.
6. **Aplats seulement** : ni dégradé décoratif, ni halo coloré, ni reflet, ni ombre teintée.

## 2. Couleurs (jetons de `tokens.css`)

| Rôle | Jeton | Valeur |
|---|---|---|
| Encre (texte, bouton principal, sélection, onglet actif) | `--color-text` / `--color-ink` | `#111111` |
| Gris texte (sous-titres, libellés, étiquettes) | `--color-muted` / `--color-subtle` | `#6e6e76` |
| Désactivé | `--color-disabled` | `#c7c7cc` |
| Fond de page | `--color-bg` | `#f7f7f9` |
| Surface (cartes, listes, fenêtres, champs) | `--color-surface` | `#ffffff` |
| Fond doux (icône dans un rond, champ non modifiable) | `--color-fill` | `#f1f1f3` |
| Gris plein (bouton secondaire, segmenté) | `--color-fill-strong` | `#ebebee` |
| Bordure | `--color-line` | `#ececef` |
| Contour de champ, rond blanc, lignes des heures | `--color-line-strong` | `#e2e2e6` |
| Séparateur de liste | `--color-line-soft` | `#f1f1f3` |

**Aucun accent de marque.** Les anciens jetons `--color-accent*` / `--color-primary` existent encore
pour les classes en place mais valent l'encre et les gris. La couleur ne sert qu'à DIRE quelque chose
(couleurs système d'iOS) :

| Sens | Plein | Fond pâle / texte | Exemples |
|---|---|---|---|
| Oui / fait / en cours | `#34c759` | `#e3f7e8` / `#1d8a3c` | Accepter, Valider, Terminé, en cours |
| Non / danger | `#ff3b30` | `#ffe7e5` / `#c81e14` | Refuser, Absent, Retard, ligne de l'heure |
| À valider | `#ff9500` | `#fff1dc` / `#a35f00` | demande en attente, reçu à vérifier |
| Confirmé | `#007aff` | `#e5f1ff` | rendez-vous confirmé |
| Passé / terminé | `#aeaeb2` | `#f1f1f3` | rendez-vous passé |

Couleurs de statut d'un rendez-vous : `lib/statusColors.ts` (`STATUT_COULEUR`, `statutCle`) — la même
partout (jour, semaine, mois, Demandes). **Jamais de couleur par catégorie de prestation ni par membre.**
**Exception voulue** : cercle de rayon et position sur les cartes clientes = bleu Apple `#007aff`, trait plein 2,5 px, fond bleuté 14 % (`lib/mapColors.ts`, demande du propriétaire, 15 nov. 2026). **Exception voulue** : « Le plus tôt » (réserver au plus vite, `.bw-fast`) = orange iOS `--color-fast` `#ff9500` + éclair plein (demande du propriétaire, 15 nov. 2026). Marques tierces : logos et couleurs OFFICIELS (§ 9). Espace clientes : seul le rose `--color-women`
(`#f06a9b`) marque l'espace féminin.

## 3. Typographie

- **Une seule police : Plus Jakarta Sans** (`--font-sans` = `--font-display`), graisses **400 / 500 / 600**
  seulement. L'arabe retombe sur la police système. Inter ne reste qu'en secours.
- Chiffres (heures, prix, numéros) : `dir="ltr"`, `tabular-nums` / `mono` quand ils s'alignent.
- **Toute taille en px s'écrit `calc(Npx * var(--fz, 1))`** : l'espace pro grossit tout de +5 %
  (`html.espace-pro { --fz: 1.05 }`, racine `calc(14px * var(--fz, 1))`).
- **Échelle de l'espace pro** (tailles mesurées sur mew3id, taille seulement — dernier bloc d'`index.css`) :

| Niveau | Taille | Graisse | Classes |
|---|---|---|---|
| Titre de page (barre du retour) | 24 | 600 | `.h1`, `.tb-t` |
| « Bonjour … » de l'accueil | 22 | 600 | `.h12-hi` |
| Titre de section / de fenêtre | 20 | 600 | `.h2`, `.h12-h`, `.h12-sc h2` |
| Nom (cliente, prestation, demande) | 17 | 600 | `.cl-nom`, `.sv-nom`, `.rp-n`, `.ag9-st` |
| Ligne de réglage, fait d'une fiche | 16 | 500 | `.lst-t > span`, `.ag-fait b` |
| Sous-titre de page, bouton | 15 | 400 / 600 | `.pgh-s`, `.btn`, `.h11-b` |
| Texte secondaire | 14 | 400 | `.t3`, `.lst-t small`, `.cl-sub`, `.sv-sub`, `.rp-s` |
| Étiquette de section, puce, onglet, petit bouton | 13 | 600 | `.h3`, `.seg > button`, `.rp-tabs button`, `.btn.sm` |
| Barre du bas | 12 | 500 / 600 | `.nvl` |
| Grand chiffre | 40 | 600 | `.h12-kp b` |
| Date de l'agenda | 16 | 600 | `.ag9-t` |

- Titre de page TOUJOURS dans la barre du retour (`TopBar title`), jamais un `<h1>` dessous.

## 4. Formes, ombres, espacements

| Élément | Arrondi | Ombre |
|---|---|---|
| Carte, liste (`.crd`, `.lst`, `.h12-card`) | 22 px (`--radius-card`) | `--shadow-card` : `0 10px 28px -16px rgb(0 0 0 / .16)`, sans contour |
| Tuile, petite carte | 14 px (`--radius-card-sm`) | idem ou filet `#ececef` |
| Bouton rectangulaire, champ | 14 px (`--radius-btn`, `--radius-input`) | aucune |
| Créneau horaire | 12 px (`--radius-slot`) — jamais une pilule | aucune |
| Pastille, badge, rond, petit bouton | pilule (`--radius-pill`) | aucune |
| Fenêtre du bas | 28 px en haut (`--radius-sheet`) | `--shadow-sheet` |
| Menu déroulant | 16 px | `--shadow-menu` |

- Ombres **neutres** (noir transparent), jamais teintées.
- Gouttière de page 1 rem (≈ 14,7 px), espacement vertical entre blocs 14–16 px, dans une carte 12 px.
- Une carte tient par son ombre, pas par un contour.

## 5. Boutons (`Button` / `LinkButton` de `ui.tsx` — jamais `<button className="btn">` à la main)

| Niveau | Classe | Rendu |
|---|---|---|
| Principal | `.btn` | encre plein `#111`, texte blanc, 52 px de haut (56 en barre basse), coins 14 px, 15 px 600 |
| Secondaire | `.btn.g` | gris plein `#ebebee`, texte encre, sans contour |
| Troisième | `.btn.o` | blanc cerclé d'encre |
| Lien | `<Link>` souligné | « Voir tout », « Modifier » — pas de pilule |
| Danger | `.btn.d` | rouge pâle `#ffe7e5`, texte `#c81e14` — réservé à l'irréversible |
| Petit | `.btn.sm` | 44 px, pilule, 13 px |
| Rond d'action | `ActionRond` (`.ag-acts`) | 56 px, plein de la couleur de sens, icône blanche, mot dessous |
| Bouton rond d'en-tête | `.hdr-b`, retour | 46 px, blanc, filet `#ececef` |

États : `:hover` opacité .92 · `:active` opacité .85 et `scale(.97)` pour les ronds et tuiles ·
désactivé = fond `#f1f1f3`, texte gris, pas d'ombre · chargement = `Button loading` (roue dans le
bouton, libellé gardé) · focus clavier = anneau encre 2 px.

## 6. Formulaires, listes, menus

- **Champ** (`.inp`, `Input`, `Field`, `.tmb`, `.fld`, indicatif) : fond BLANC `#ffffff` + contour 1,5 px
  `#e2e2e6` (`--color-line-strong`) — 17 nov. 2026, le gris se confondait avec le fond des pages ;
  coins 14 px, ≈ 50 px de haut, texte 16 px (anti-zoom iOS), focus = contour encre, erreur = contour
  `#ff3b30` + message rouge sous le champ. Champ NON modifiable = gris `#f1f1f3` sans contour.
  Étiquette au-dessus, 13 px 600.
- **Liste** (`.lst` + `SettingRow`, `.li`) : carte blanche, lignes séparées par `#f1f1f3`, icône dans
  un rond gris `#f1f1f3`, titre 16 px, sous-titre 14 px gris, chevron gris au bout.
- **Sélecteur** (`Segmented`, `.seg`) = **onglets soulignés**, partout (18 nov. 2026, demande du propriétaire) : texte gris 15 px 500, choisi en encre 600 souligné de 2 px, filet `#ececef` dessous — l'apparence exacte d'« Aujourd'hui / Demain » (Rappels). Plus de pastille grise ni de bouton noir.
- **Onglets** (`.rp-tabs`) : texte souligné d'encre sous l'onglet actif, compteur gris.
- **Pastilles** (`.pill`) : choisie = trait encre, non choisie = trait `#ececef`.
- **Menu déroulant** (ex. filtre par membre, `StaffFilter`) : bouton pilule blanc cerclé `#e2e2e6`,
  liste blanche coins 16 px, `--shadow-menu`, coche encre sur le choix, Échap / toucher dehors ferme.
- **Tableau** (administration) : lignes `.li`, en-têtes 13 px 600 gris, chiffres alignés à droite.

## 7. Badges, états, notifications, fenêtres

- **Badge d'état** : TOUJOURS en couleur de sens (fond pâle + point + texte de la couleur), jamais
  une pastille noir et blanc. 22 px, pilule, 12–13 px 600.
- **Pastille non lue** : rond rouge `#ff3b30`, chiffre blanc.
- **Message flottant** (`toast`) : blanc, `--shadow-toast`, icône de sens.
- **Fenêtre du bas** (`BottomSheet` + `Dim`, `modal`) : coins 28 px, au moins la moitié de l'écran sur
  téléphone, actions en bas, poignée grise ; fenêtre centrée à partir de 768 px.
- **Une fenêtre = une décision** : deux lignes d'en-tête, contacts en icônes, une rangée de ronds,
  le rare derrière « ⋯ ».
- États de page : `PageLoading` (squelettes `.skx-*`, rien avant 150 ms), `ErrorState` (plein écran),
  `ErrorMessage` (bandeau), `EmptyState` (icône dans un disque gris, titre, une phrase, une action).

## 8. Icônes

- **Une action = une icône, la même partout** : vocabulaire `lib/actionIcons.ts` (`ICONE.*`).
- lucide-react, trait 2 ; icône manquante = dessinée (24 × 24, trait 1,6, bouts ronds) dans
  `lib/customIcons.ts`. Flèches et chevrons se retournent en arabe.

## 9. Marques — logos et couleurs officiels

WhatsApp `#25D366` (`WhatsAppLogo` / `WhatsAppGlyph`, jamais une bulle générique), Instagram,
Snapchat `#FFFC00`, Facebook `#1877F2`, TikTok, messageries (Gmail, Outlook, Yahoo, Mail) :
`components/BrandIcons.tsx`, tracés `packages/constants/src/brandLogos.ts`. Joindre un client = les
trois ronds `ClientContact` (WhatsApp, SMS, appel).

## 10. Navigation

- Téléphone : barre du bas blanche translucide floutée (`.nvb`, 66 px, filet `#ececef`), actif en
  encre, rond Agenda encre au centre. Pas d'en-tête ni de tiroir côté pro et clientes.
- Ordinateur (≥ 1 024 px) : rail permanent à gauche, mêmes entrées.
- Barre d'état de l'application : fondu noir flouté, icônes système blanches.

## 11. Agenda

Couleur = statut (§ 2) : bloc teinté 16 %, HEURE écrite dans la couleur. Lignes des heures en trait
plein `#e2e2e6`, demi-heures en pointillés, heure 12 px grise. Jour choisi = numéro dans un cercle
encre. Un point par rendez-vous (quatre au plus). Filtre par membre = liste déroulante « Toute
l'équipe » par défaut ; le nom en tête de chaque colonne.

## 12. Clavier, langue, chargement

- Rien de ce qu'on utilise ne finit sous le clavier (règle complète dans CLAUDE.md). Aucun focus automatique.
- Langue : toujours `LangSwitch` (drapeau + nom). Arabe : utilitaires logiques (`ms-`, `ps-`, `start-`).
- Chargement : squelettes, jamais l'écran de marque en cours de route.

## 13. Responsive

Mêmes écrans, mêmes couleurs, mêmes composants sur téléphone, tablette et ordinateur ; seule la
répartition change, à partir de 768 px (fenêtres centrées) et 1 024 px (rail, colonnes). Vérifier à
390, 820 et 1 280 px avant de livrer ; aucun débordement horizontal.

## 14. Anciennes identités — SUPPRIMÉES, ne jamais les réintroduire

| Ancienne identité | Remplacée par |
|---|---|
| Violet `#6c5ce7`, « SalonDZ × mew3id » (1er nov.) | encre `#111` |
| Encre bleu nuit `#1e1b30`, gris violacés `#636174`, `#e6e5ee`, `#f4f4f9`, `#ececf4` | `#111`, `#6e6e76`, `#ececef`, `#f1f1f3`, `#ebebee` |
| Ombres teintées `rgb(30 27 48)` / `rgb(108 92 231)` | ombres neutres |
| Police Outfit, Instrument Serif (« Bonjour » italique) | Plus Jakarta Sans |
| Couleurs par catégorie de prestation (`--color-cat-*`, `TONE`, `toneVar`) | couleurs de statut |
| Bouton secondaire blanc à contour violet | gris plein `#ebebee` |
| Rose framboise, grenat, zellige, bleu Apple `#007AFF` comme marque, « Horizon », « Créneau » | — |
| Modèle de story « Violet » | modèle « Encre » |

Exceptions voulues (pas des identités concurrentes) : étiquettes IMPRIMÉES (`lib/labels.ts`, modèles
« Vitrine » choisis par le pro) et icône de l'application, qui restent des objets imprimés / natifs.

## 15. Avant de livrer un écran — liste de contrôle

- [ ] Uniquement des jetons de `tokens.css` et des primitives de `ui.tsx` ; aucune valeur au jugé.
- [ ] Ce qu'il faut savoir *maintenant* est en haut ; le rare est replié ; rien n'apparaît deux fois.
- [ ] Chaque bouton a l'icône du vocabulaire ; chaque marque son logo officiel.
- [ ] Encre / blanc / gris + couleurs de sens uniquement ; aucune ancienne identité (§ 14).
- [ ] Tailles de l'échelle (§ 3), en `calc(Npx * var(--fz, 1))` si en px.
- [ ] Testé à 390, 820 et 1 280 px, clavier ouvert, en arabe ; comparé à l'espace pro en production.
- [ ] Textes passés par `t()` et traduits (ar, en).
