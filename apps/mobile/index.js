/**
 * Point d'entrée LOCAL, exigé par le monorepo pnpm : `expo-router/entry` est hissé à la racine du dépôt,
 * hors de `apps/mobile`, et le groupeur le résolvait alors depuis la mauvaise racine (« Unable to resolve
 * module ./../../node_modules/expo-router/entry.js »). Un fichier à l'intérieur de l'app est résoluble
 * quelle que soit la racine retenue.
 */
import 'expo-router/entry';
