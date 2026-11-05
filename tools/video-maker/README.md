# Fabrique de vidéos Salon DZ

Outil séparé de l'application : il filme le vrai parcours de réservation sur le site publié, puis monte une vidéo avec les clics et la voix off.

```
cd tools/video-maker
npm install --no-package-lock
node make.mjs --profil hommes --voix windows
```

| Option | Valeurs | Défaut |
|---|---|---|
| `--profil` | `hommes`, `femmes` | `hommes` |
| `--voix` | `elevenlabs`, `windows`, `none` | `none` |
| `--site` | adresse du site à filmer | `https://salondz.com` |
| `--sortie` | fichier produit | `out/salondz-<salon>.mp4` |

## Pourquoi il suit l'interface tout seul

- Les écrans ne sont pas redessinés : ce sont ceux du site, filmés au moment où l'outil tourne.
- Les boutons sont trouvés par leur rôle et leur texte (`scenario.mjs`), et la main va là où ils sont vraiment.
- Les couleurs viennent de `apps/web/src/styles/tokens.css`.
- Les temps morts du filmage sont coupés au montage : la voix et les gestes gardent leur vitesse.
- Si un bouton change de nom ou disparaît, l'outil s'arrête, dit lequel et laisse une capture dans `out/arret.png`. Il ne sort jamais une vidéo fausse.

## Ce qu'il ne fait pas encore

- **Salons réels** : le parcours se joue dans la démonstration du navigateur, pour ne créer aucune réservation. Seuls les deux salons de démonstration sont pris en charge.
- **Production automatique** : rien ne relance l'outil après un changement de prix ou d'interface, et la vidéo n'est pas encore reliée à « Ma vidéo » dans l'application.
- **Voix humaine** : `elevenlabs` exige `ELEVENLABS_API_KEY` et `ELEVENLABS_VOICE_ID` dans l'environnement, et n'a pas été essayé sans compte. `windows` est robotique : elle sert à caler les temps, pas à publier.

Le profil Instagram du début est une maquette : c'est le seul écran qui n'est pas Salon DZ. Le nom et le numéro saisis sont des exemples.

L'outil n'est pas dans l'espace de travail pnpm : il a ses propres dépendances et ne touche pas à `apps/web/package.json`, dont la modification sur `main` part en boutique.
