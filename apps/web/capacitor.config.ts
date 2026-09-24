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
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#FFFFFF',
    },
  },
};

export default config;
