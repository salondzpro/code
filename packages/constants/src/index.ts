export * from './wilayas';
export * from './geocode';
export * from './hours';
export * from './services';
export * from './categories';
export * from './money';
export * from './dates';
export * from './lateness';
export * from './booking';
export * from './phone';
export * from './brandLogos';

export const APP_NAME = 'SalonDZ';
export const DEFAULT_LOCALE = 'fr' as const;
export const SUPPORTED_LOCALES = ['fr', 'ar'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Limites images (4G moyenne → on compresse côté client avant upload). */
export const IMAGE_MAX_DIMENSION = 1600;
export const IMAGE_MAX_BYTES = 600 * 1024;
export const SALON_MAX_PHOTOS = 8;
/** Réalisations (photos du travail réel), section séparée des couvertures et des prestations. */
export const SALON_MAX_WORKS = 40;

/** Buckets Supabase Storage. */
export const STORAGE_BUCKETS = { salons: 'salons', avatars: 'avatars' } as const;
