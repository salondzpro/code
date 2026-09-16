import { z } from 'zod';
import {
  CATEGORY_IDS,
  DZ_PHONE_REGEX,
  MAX_SERVICE_DURATION_MINUTES,
  normalizeDZPhone,
  SLOT_INTERVALS,
} from '@salondz/constants';

export const uuid = z.string().uuid();
export const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : YYYY-MM-DD');
export const timeHM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format attendu : HH:mm');
export const isoDateTime = z.string().datetime({ offset: true });
export const dayOfWeek = z.number().int().min(0).max(6);
export const wilayaCode = z.number().int().min(1).max(58);
export const categoryId = z.enum(CATEGORY_IDS);
export const priceDa = z.number().int().min(0).max(1_000_000);
export const durationMinutes = z.number().int().min(5).max(MAX_SERVICE_DURATION_MINUTES);
export const slotInterval = z
  .number()
  .int()
  .refine((v) => (SLOT_INTERVALS as readonly number[]).includes(v), {
    message: `Intervalle autorisé : ${SLOT_INTERVALS.join(', ')} min`,
  });

/** Téléphone algérien (espaces/points tolérés), normalisé en E.164. */
export const phoneDZ = z
  .string()
  .trim()
  .max(24)
  .transform((v, ctx) => {
    const normalized = normalizeDZPhone(v);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Numéro algérien invalide (ex : 05 51 23 45 67)' });
      return z.NEVER;
    }
    return normalized;
  });

/** Regex brute (pour les inputs HTML `pattern`). */
export const DZ_PHONE_PATTERN = DZ_PHONE_REGEX;

export const shortText = (max = 120) => z.string().trim().min(1).max(max);
export const longText = (max = 2000) => z.string().trim().max(max);
export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide')
  .min(3)
  .max(60);
/**
 * URL d'image acceptée en base : uniquement notre stockage Supabase (objets publics) — plus les photos
 * Unsplash des salons de démonstration. Jamais un domaine arbitraire (contenu modifiable après coup,
 * traçage des visiteurs), jamais `javascript:` / `data:`.
 */
export const httpUrl = z
  .string()
  .url()
  .max(500)
  .refine(
    (u) => /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//.test(u) || /^https:\/\/images\.unsplash\.com\//.test(u),
    { message: "URL d'image non autorisée : utilisez une photo envoyée depuis l'application." },
  );
