/** Exécuté par EAS après l'installation (`eas-build-post-install`) : un build sans ces variables plante au démarrage. */
const REQUIRED = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_API_URL'];
const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Build refusé : variables manquantes (${missing.join(', ')}). Les poser avec « eas env:create » ou dans eas.json.`);
  process.exit(1);
}
console.log('Variables publiques Expo présentes :', REQUIRED.join(', '));
