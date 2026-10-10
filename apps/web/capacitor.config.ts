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

/**
 * VARIANTE PROFESSIONNELLE (`SALONDZ_APP_FLAVOR=pro`) : une seconde application, publiée à part
 * sous `pro.salondz.app`, qui ne contient QUE l'espace professionnel. Le bundle web est lui aussi
 * construit en variante pro (`VITE_APP_FLAVOR=pro`) : les écrans clients n'y sont pas livrés.
 */
const pro = process.env.SALONDZ_APP_FLAVOR === 'pro';

const config: CapacitorConfig = {
  appId: pro ? 'pro.salondz.app' : 'dz.salondz.app',
  appName: pro ? 'Salon DZ Pro' : 'Salon DZ',
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
     * EN CAS D'ÉCHEC DE CHARGEMENT, on affiche `hors-ligne.html` et non `index.html`. Renvoyer vers
     * l'index embarqué démarrait une SECONDE copie de l'application depuis une autre origine que
     * celle qu'elle attend — sans session ni réglages, et parfois sans rien afficher : c'est le
     * candidat le plus sérieux à l'écran blanc constaté le 25 septembre 2026. Une page de secours
     * qui ne dépend de rien dit ce qui se passe au lieu de le laisser deviner.
     */
    ...(process.env.SALONDZ_APP_MODE === 'remote' ? { url: 'https://salondz.com', errorPath: 'hors-ligne.html' } : {}),
  },
  plugins: {
    /**
     * iPhone, application AU PREMIER PLAN : sans ces options, iOS n'affiche RIEN quand une
     * notification arrive pendant que l'application est ouverte — le professionnel sur son agenda
     * n'apprend la nouvelle demande que par le rafraîchissement temps réel, sans son ni bandeau.
     * (Sur Android, le greffon ne montre pas de notification système au premier plan : c'est le
     * bandeau de `components/PushToast.tsx` qui prend le relais, sur les deux systèmes.)
     */
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
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
