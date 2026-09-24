/**
 * Application mobile Salon DZ : le SITE embarqué dans une coque native (Capacitor), et non une seconde
 * base de code. Tout ce qui est publié sur salondz.com se retrouve donc dans l'application, y compris
 * l'espace pro et les trois langues, que l'ancienne application Expo n'avait pas.
 *
 * Les fichiers sont EMBARQUÉS (webDir), pas chargés depuis le réseau : l'application s'ouvre hors ligne,
 * démarre vite, et Apple refuse les coques qui ne font qu'afficher un site distant.
 *
 * `androidScheme: 'https'` donne l'origine `https://localhost` : indispensable pour que le stockage local,
 * les cookies et Supabase se comportent comme sur le site. Cette origine doit figurer dans `CORS_ORIGINS`
 * de l'API.
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dz.salondz.app',
  appName: 'Salon DZ',
  webDir: 'dist',
  android: {
    // Origine `https://localhost` (et non `http://`) : sans cela, Chrome traite l'app comme non sécurisée
    // et refuse notamment la géolocalisation et le stockage persistant.
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
    /**
     * MODE EN LIGNE (`SALONDZ_APP_MODE=remote`, utilisé par `scripts/build-android.mjs`).
     *
     * L'application charge le site publié au lieu de sa copie embarquée. Deux conséquences voulues :
     * un déploiement sur salondz.com met à jour l'application de TOUT LE MONDE immédiatement, sans
     * repasser par le Play Store ; et l'application vit sur la même origine que le site, donc la
     * connexion, la session et les appels à l'API s'y comportent exactement pareil.
     *
     * En contrepartie, l'application a besoin du réseau pour démarrer. C'est acceptable ici :
     * réserver, consulter un agenda ou recevoir une demande exigent de toute façon le réseau.
     *
     * Les fichiers embarqués restent dans l'application et servent de secours au chargement.
     */
    ...(process.env.SALONDZ_APP_MODE === 'remote' ? { url: 'https://salondz.com', errorPath: 'index.html' } : {}),
  },
  plugins: {
    SplashScreen: {
      // L'écran natif reste affiché jusqu'à ce que l'application prenne le relais, sur le MÊME fond
      // d'encre que l'animation d'ouverture : aucun éclair blanc entre les deux.
      launchAutoHide: false,
      backgroundColor: '#111214',
      androidSplashResourceName: 'splash',
      splashFullScreen: false,
      splashImmersive: false,
    },
  },
};

export default config;
