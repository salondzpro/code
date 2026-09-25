/**
 * Comptes de DÉMONSTRATION (accès direct, sans mot de passe) : deux professionnels et deux clients.
 * Ils servent à montrer Salon DZ aux futurs professionnels : chaque compte est un monde cohérent
 * (salon publié, catalogue complet, photos, historique de rendez-vous) construit par l'API à la
 * première connexion (`apps/api/src/lib/demo.ts`, idempotent). L'accès se fait en tapant l'adresse
 * à la place de l'e-mail sur l'écran Connexion, ou par les boutons « Démonstration » de cet écran.
 * Désactivable côté API avec `TEST_LOGIN_ENABLED=0`.
 */
export type DemoAccountKey = 'hommes' | 'femmes' | 'clienthomme' | 'clientfemme';

export interface DemoAccount {
  key: DemoAccountKey;
  email: string;
  role: 'client' | 'pro';
  fullName: string;
  /** Numéro fictif (E.164), jamais attribué à un vrai abonné : préfixe 0550 10 00 xx. */
  phone: string;
  gender: 'male' | 'female';
  market: 'men' | 'women' | null;
  /** Libellé lisible, utilisé dans les scripts et les journaux. */
  label: string;
  hint: string;
  /** Ce compte ouvre une session de démonstration. Les autres ne font que peupler le monde. */
  login: boolean;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { key: 'hommes', email: 'pro-homme@salondz.com', role: 'pro', fullName: 'Karim Bouzid', phone: '+213550100001', gender: 'male', market: null, label: 'Professionnel · Hommes', hint: 'Barbier, 13 prestations', login: true },
  { key: 'femmes', email: 'pro-femme@salondz.com', role: 'pro', fullName: 'Yasmine Haddad', phone: '+213550100002', gender: 'female', market: null, label: 'Professionnel · Femmes', hint: 'Cheveux, ongles, cils, soins', login: true },
  { key: 'clienthomme', email: 'client@salondz.com', role: 'client', fullName: 'Yacine Benali', phone: '+213550100003', gender: 'male', market: 'men', label: 'Client', hint: 'Rendez-vous, historique, avis', login: true },
  // Cliente du salon femmes : elle PEUPLE le monde de démonstration (historique, avis du salon de
  // Yasmine) mais ne sert pas à se connecter — trois accès suffisent, un par rôle à montrer.
  { key: 'clientfemme', email: 'clientfemme@salondz.internal', role: 'client', fullName: 'Amel Kaci', phone: '+213550100004', gender: 'female', market: 'women', label: 'Cliente · Femme', hint: 'Rendez-vous, historique, avis', login: false },
];

/**
 * Anciens numéros de démonstration (application mobile, scripts `check:*`) : ils ouvrent désormais
 * les nouveaux comptes, avec le code fixe `DEMO_LOGIN_CODE`.
 */
export const DEMO_PHONE_ALIASES: Record<string, DemoAccountKey> = {
  '+213603044618': 'clienthomme',
  '+213603044619': 'hommes',
};
export const DEMO_LOGIN_CODE = '1111';

const byKey = (key: DemoAccountKey) => DEMO_ACCOUNTS.find((a) => a.key === key)!;

/** Le compte de démonstration désigné par une adresse e-mail (insensible à la casse) ou un ancien numéro E.164. */
export function demoAccountFor(identifier: string | null | undefined): DemoAccount | null {
  if (!identifier) return null;
  const v = identifier.trim().toLowerCase();
  const byEmail = DEMO_ACCOUNTS.find((a) => a.login && a.email === v);
  if (byEmail) return byEmail;
  const alias = DEMO_PHONE_ALIASES[identifier.trim()];
  return alias ? byKey(alias) : null;
}

/**
 * La démonstration ne s'affiche plus nulle part : elle s'ouvre en se connectant normalement, avec
 * l'adresse ET le mot de passe qui lui est identique. Un visiteur n'a donc aucun moyen de tomber
 * dessus, et une démonstration se montre en tapant une seule chose.
 */
export function demoAccountForCredentials(identifier: string | null | undefined, password: string | null | undefined): DemoAccount | null {
  const account = demoAccountFor(identifier);
  if (!account) return null;
  return password?.trim().toLowerCase() === account.email ? account : null;
}

export const isDemoEmail = (email: string | null | undefined) => !!demoAccountFor(email);

/** Catalogue des salons de démonstration : une prestation = un visuel (`key`) dans le stockage (`demo/<key>.webp`). */
export interface DemoService {
  key: string;
  name: string;
  minutes: number;
  priceDa: number;
  categoryId: string;
  description?: string;
}

/** Salon de Karim (hommes) : durées et prix du marché algérien. */
export const DEMO_SERVICES_MEN: readonly DemoService[] = [
  { key: 'h-coupe-barbe', name: 'Coupe + barbe', minutes: 25, priceDa: 800, categoryId: 'coiffure', description: 'Coupe aux ciseaux ou tondeuse, dégradé au choix, barbe taillée et contours au rasoir.' },
  { key: 'h-coupe', name: 'Coupe seule', minutes: 15, priceDa: 500, categoryId: 'coiffure' },
  { key: 'h-coupe-mariage', name: 'Coupe mariage', minutes: 45, priceDa: 2500, categoryId: 'coiffure', description: 'Coupe soignée, barbe, soin du visage et coiffage pour le grand jour.' },
  { key: 'h-nettoyage-peau', name: 'Nettoyage de peau', minutes: 30, priceDa: 1500, categoryId: 'soins-peau', description: 'Vapeur, extraction des points noirs, masque apaisant.' },
  { key: 'h-lissage-keratine', name: 'Lissage kératine', minutes: 90, priceDa: 6000, categoryId: 'lissage', description: 'Lissage durable 3 à 4 mois, cheveux disciplinés et brillants.' },
  { key: 'h-lissage-proteine', name: 'Lissage protéine', minutes: 90, priceDa: 5000, categoryId: 'lissage' },
  { key: 'h-defrisage', name: 'Défrisage', minutes: 60, priceDa: 3000, categoryId: 'lissage' },
  { key: 'h-coupe-barbe-brushing', name: 'Coupe + barbe + brushing', minutes: 35, priceDa: 1200, categoryId: 'coiffure' },
  { key: 'h-brushing', name: 'Brushing', minutes: 15, priceDa: 400, categoryId: 'coiffure' },
  { key: 'h-barbe', name: 'Barbe', minutes: 10, priceDa: 300, categoryId: 'barbe', description: 'Taille, contours et serviette chaude.' },
  { key: 'h-tracage', name: 'Traçage', minutes: 10, priceDa: 200, categoryId: 'barbe', description: 'Contours nets à la tondeuse de finition.' },
  { key: 'h-coupe-barbe-shampoing', name: 'Coupe + barbe + shampoing', minutes: 30, priceDa: 1000, categoryId: 'coiffure' },
  { key: 'h-coupe-lissage', name: 'Coupe + lissage', minutes: 60, priceDa: 4000, categoryId: 'lissage' },
];

/** Salon de Yasmine (femmes) : cheveux, onglerie, cils et sourcils, soins de peau. */
export const DEMO_SERVICES_WOMEN: readonly DemoService[] = [
  { key: 'f-coupe', name: 'Coupe femme', minutes: 30, priceDa: 1200, categoryId: 'coiffure-lissage' },
  { key: 'f-brushing', name: 'Brushing', minutes: 30, priceDa: 800, categoryId: 'coiffure-lissage' },
  { key: 'f-coloration', name: 'Coloration', minutes: 60, priceDa: 3500, categoryId: 'coiffure-lissage', description: 'Coloration complète, produits sans ammoniaque.' },
  { key: 'f-balayage', name: 'Balayage', minutes: 120, priceDa: 7000, categoryId: 'coiffure-lissage' },
  { key: 'f-lissage-bresilien', name: 'Lissage brésilien', minutes: 120, priceDa: 8000, categoryId: 'coiffure-lissage', description: 'Lissage à la kératine, tenue 3 à 5 mois.' },
  { key: 'f-soin-proteine', name: 'Soin protéine', minutes: 45, priceDa: 2500, categoryId: 'coiffure-lissage' },
  { key: 'f-chignon-mariee', name: 'Chignon mariée', minutes: 90, priceDa: 6000, categoryId: 'coiffure-lissage', description: 'Essai inclus, tenue toute la soirée.' },
  { key: 'f-tresses', name: 'Tresses', minutes: 90, priceDa: 3000, categoryId: 'coiffure-lissage' },
  { key: 'f-manucure', name: 'Manucure classique', minutes: 30, priceDa: 800, categoryId: 'ongles' },
  { key: 'f-pose-gel', name: 'Pose gel', minutes: 60, priceDa: 2500, categoryId: 'ongles', description: 'Gel sans HEMA, tenue 3 à 4 semaines.' },
  { key: 'f-semi-permanent', name: 'Vernis semi-permanent', minutes: 40, priceDa: 1500, categoryId: 'ongles' },
  { key: 'f-nail-art', name: 'Nail art', minutes: 30, priceDa: 1000, categoryId: 'ongles' },
  { key: 'f-pedicure', name: 'Pédicure', minutes: 45, priceDa: 1500, categoryId: 'ongles' },
  { key: 'f-extension-cils', name: 'Extension de cils', minutes: 90, priceDa: 4500, categoryId: 'cils', description: 'Cil à cil ou volume russe, effet naturel ou intense.' },
  { key: 'f-rehaussement-cils', name: 'Rehaussement de cils', minutes: 45, priceDa: 2500, categoryId: 'cils' },
  { key: 'f-teinture-cils', name: 'Teinture cils et sourcils', minutes: 30, priceDa: 1200, categoryId: 'cils' },
  { key: 'f-sourcils', name: 'Restructuration des sourcils', minutes: 20, priceDa: 600, categoryId: 'sourcils' },
  { key: 'f-sourcils-fil', name: 'Épilation des sourcils au fil', minutes: 15, priceDa: 400, categoryId: 'sourcils' },
  { key: 'f-nettoyage-peau', name: 'Nettoyage de peau', minutes: 45, priceDa: 2000, categoryId: 'soins', description: 'Démaquillage, gommage, vapeur, extraction et masque.' },
  { key: 'f-soin-hydratant', name: 'Soin hydratant', minutes: 30, priceDa: 1800, categoryId: 'soins' },
  { key: 'f-epilation-visage', name: 'Épilation du visage', minutes: 15, priceDa: 500, categoryId: 'soins' },
];

/** Visuels des salons et des profils (mêmes fichiers `demo/<key>.webp`). */
export const DEMO_VISUAL_KEYS = {
  coverMen: 'cover-hommes',
  logoMen: 'logo-hommes',
  coverWomen: 'cover-femmes',
  logoWomen: 'logo-femmes',
  avatarHommes: 'avatar-hommes',
  avatarFemmes: 'avatar-femmes',
  avatarClientHomme: 'avatar-clienthomme',
  avatarClientFemme: 'avatar-clientfemme',
  staffMen2: 'avatar-sofiane',
  staffWomen2: 'avatar-lina',
} as const;
