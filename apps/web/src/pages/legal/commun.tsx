/** Données communes des pages légales, dans toutes les langues (identité de l'éditeur, contacts). */
export const UPDATED = '14 novembre 2026';
export const UPDATED_AR = '14 نوفمبر 2026';
export const UPDATED_EN = '14 November 2026';
export const SUPPORT = 'support@salondz.com';
export const CONTACT = 'contact@salondz.com';
export const PRO_MAIL = 'pro@salondz.com';

/**
 * Identité de l'éditeur (14 nov. 2026) : la même que pour Coligo (`coligo.app`, `lib/config/legal.ts`) —
 * le même exploitant, en auto-entrepreneur. Un auto-entrepreneur est inscrit au Registre national de
 * l'auto-entrepreneur, pas au registre du commerce : pas de numéro RC ni de NIF distinct à afficher.
 */
export const EDITOR = {
  name: 'Salon DZ',
  owner: 'GACI Noufel',
  legal: 'GACI Noufel, auto-entrepreneur (loi n° 22-23 du 18 décembre 2022 portant statut de l’auto-entrepreneur)',
  legalAr: 'GACI Noufel، مقاول ذاتي (القانون رقم 22-23 المؤرخ في 18 ديسمبر 2022 المتضمن القانون الأساسي للمقاول الذاتي)',
  legalEn: 'GACI Noufel, self-employed entrepreneur (Law No. 22-23 of 18 December 2022 on the status of the self-employed entrepreneur)',
  registrationLabel: 'Registre national de l’auto-entrepreneur',
  registrationNumber: '10981022005702687',
  address: 'Akbou, Béjaïa 06001, Algérie',
  addressAr: 'أقبو، بجاية 06001، الجزائر',
  addressEn: 'Akbou, Béjaïa 06001, Algeria',
};

export const Mailto = ({ to }: { to: string }) => (
  <a href={`mailto:${to}`} dir="ltr">
    {to}
  </a>
);
