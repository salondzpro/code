/**
 * Qui est le visiteur, derrière les mandataires ?
 *
 * Entre lui et nous il y a DEUX intermédiaires en production : le réseau de diffusion qui reçoit la
 * connexion (adresses publiques, liste ci-dessous) puis le répartiteur interne de l'hébergeur
 * (adresses privées 10.x). `X-Forwarded-For` se lit donc de la DROITE vers la GAUCHE, en sautant
 * tout ce qui est de confiance : on s'arrête à la première adresse qui ne l'est pas, et c'est le
 * visiteur. Une entrée forgée par le client reste à gauche de la vraie — on ne l'atteint jamais.
 *
 * Compter les sauts à la main ne tient pas : la première version en comptait un seul et rendait
 * l'adresse interne de l'hébergeur (mesuré en production le 20 septembre 2026), ce qui faisait
 * retomber la limitation de débit par adresse sur une poignée d'adresses partagées par tout le
 * monde, et faisait enregistrer 10.x dans le journal d'administration.
 *
 * Si le réseau de diffusion publie un jour de nouvelles plages, le pire qui arrive est de retenir
 * son adresse à lui plutôt que celle du visiteur — jamais une adresse choisie par le client. Cela
 * se voit dans le journal (`admin_audit.ip`) et se corrige en actualisant cette liste, publiée sur
 * https://www.cloudflare.com/ips-v4 et https://www.cloudflare.com/ips-v6.
 */

/** Plages du réseau de diffusion devant l'hébergeur (relevé du 20 septembre 2026). */
const EDGE = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

/**
 * Mandataires de confiance : la boucle locale (développement), les adresses de lien local, toutes
 * les adresses privées (le réseau interne de l'hébergeur), et le réseau de diffusion.
 */
export const TRUSTED_PROXIES = ['loopback', 'linklocal', 'uniquelocal', ...EDGE];
