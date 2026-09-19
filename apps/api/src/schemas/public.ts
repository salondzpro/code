/**
 * Schémas de RÉPONSE des routes publiques (point 8 du plan de mise en production).
 *
 * Rôle : décider quelles CLÉS sortent de l'API, pas juger ce que contient la base. Fastify sérialise
 * chaque réponse à travers ces schémas et zod retire toute clé absente d'ici. Une colonne ajoutée
 * demain à `salons`, à `services`, au retour d'une fonction SQL ou à un `select *` ne part donc plus
 * toute seule vers l'extérieur : il faut l'ajouter ici, c'est-à-dire le décider.
 *
 * Conséquence sur l'écriture des schémas : les valeurs restent volontairement peu contraintes (pas de
 * format de date, pas de liste fermée). Une valeur inattendue en base doit s'afficher, jamais
 * transformer une page publique en erreur 500 ; le contrôle des valeurs se fait à l'écriture
 * (`@salondz/validation`) et par les contraintes SQL, là où l'erreur sert à quelque chose.
 *
 * Garde-fou : chaque schéma est comparé à la compilation au type correspondant de `@salondz/types`
 * (`PublicSchemasMatchTypes`, en bas). Un champ ajouté au type sans être ajouté ici fait échouer le
 * typecheck au lieu de disparaître en silence de la réponse.
 */
import { z } from 'zod';
import type { DayOfWeek, GenderTarget } from '@salondz/constants';
import type {
  AvailabilityResponse,
  Category,
  CityCount,
  OpeningHour,
  SalonPhoto,
  SalonPublic,
  SalonSummary,
  SearchSuggestions,
  Service,
  ServicePhoto,
} from '@salondz/types';

/**
 * Nombre tolérant : PostgREST renvoie les `bigint` et certains `numeric` sous forme de chaîne selon la
 * fonction SQL. On convertit plutôt que de refuser (`.nullable()` court-circuite avant la conversion,
 * donc un `null` reste `null` et ne devient pas 0).
 */
const num = () => z.coerce.number();

/**
 * Chaîne d'une énumération : le TYPE vient de `@salondz/types`, la VALEUR n'est jamais rejetée.
 * Ajouter une valeur à une énumération SQL ne doit pas casser la marketplace.
 */
const enumStr = <T extends string>() => z.string().transform((v) => v as T);
const enumNum = <T extends number>() => num().transform((v) => v as T);

// ---------- Briques ----------

const servicePhoto = z.object({
  id: z.string(),
  url: z.string(),
  sortOrder: num(),
});

const service = z.object({
  id: z.string(),
  salonId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  durationMinutes: num(),
  priceDa: num(),
  categoryId: z.string().nullable(),
  groupName: z.string().nullable(),
  isActive: z.boolean(),
  sortOrder: num(),
  photos: z.array(servicePhoto).optional(),
});

const salonPhoto = z.object({
  id: z.string(),
  salonId: z.string(),
  url: z.string(),
  sortOrder: num(),
  kind: enumStr<'cover' | 'work'>(),
});

const openingHour = z.object({
  id: z.string(),
  salonId: z.string(),
  dayOfWeek: enumNum<DayOfWeek>(),
  opensAt: z.string(),
  closesAt: z.string(),
  isClosed: z.boolean(),
});

/** Membre visible du public : ni téléphone, ni compte rattaché, ni affectations de prestations. */
const staffPublic = z.object({
  id: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});

/** Colonnes du salon publiables. `ownerId` (compte auth du propriétaire) n'y est volontairement pas. */
const salonBase = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  phone: z.string().nullable(),
  wilayaCode: num(),
  city: z.string(),
  address: z.string().nullable(),
  lat: num().nullable(),
  lng: num().nullable(),
  coverUrl: z.string().nullable(),
  logoUrl: z.string().nullable(),
  zone: z.string().nullable(),
  genderTarget: enumStr<GenderTarget>(),
  isPublished: z.boolean(),
  slotIntervalMinutes: num(),
  bookingLeadTimeMinutes: num(),
  bookingHorizonDays: num(),
  autoConfirm: z.boolean(),
  cancelMinHours: num(),
  bufferMinutes: num(),
  homeService: z.boolean(),
  allowClientReschedule: z.boolean(),
  depositRequired: z.boolean(),
  ratingAvg: num(),
  ratingCount: num(),
  categoryIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ---------- Réponses ----------

/** `GET /v1/categories` */
export const categoriesResponse = z.array(
  z.object({
    id: z.string(),
    labelFr: z.string(),
    labelAr: z.string(),
    icon: z.string(),
    sortOrder: num(),
    market: enumStr<'men' | 'women'>().nullable(),
  }),
);

/** `GET /v1/wilayas` (liste figée du code, aucun contenu de base). */
export const wilayasResponse = z.array(
  z.object({ code: num(), name: z.string(), nameAr: z.string() }),
);

/** `GET /v1/salons/cities` */
const cityCount = z.object({
  city: z.string(),
  parentCity: z.string().nullable(),
  wilayaCode: num(),
  salonCount: num(),
  distanceKm: num().nullable(),
});
export const citiesResponse = z.object({ items: z.array(cityCount) });

/** `GET /v1/salons/suggest` */
export const suggestResponse = z.object({
  salons: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      city: z.string(),
      zone: z.string().nullable(),
      wilayaCode: num(),
      logoUrl: z.string().nullable(),
      coverUrl: z.string().nullable(),
      ratingAvg: num(),
      ratingCount: num(),
      categoryId: z.string().nullable(),
    }),
  ),
  services: z.array(
    z.object({ name: z.string(), salonCount: num(), minPriceDa: num().nullable() }),
  ),
  places: z.array(
    z.object({
      city: z.string(),
      parentCity: z.string().nullable(),
      wilayaCode: num(),
      salonCount: num(),
    }),
  ),
});

/** `GET /v1/salons` — carte de la marketplace : volontairement plus pauvre que la fiche complète. */
const salonSummary = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  city: z.string(),
  wilayaCode: num(),
  coverUrl: z.string().nullable(),
  genderTarget: enumStr<GenderTarget>(),
  ratingAvg: num(),
  ratingCount: num(),
  categoryIds: z.array(z.string()),
  minPriceDa: num().nullable(),
  distanceKm: num().nullable().optional(),
  zone: z.string().nullable(),
  logoUrl: z.string().nullable(),
  topServices: z.array(z.object({ name: z.string(), priceDa: num() })),
  nextSlots: z.array(z.string()),
  photoUrls: z.array(z.string()),
  nextAvailable: z
    .object({
      date: z.string(),
      slots: z.array(z.string()),
      morning: z.array(z.string()).optional(),
      afternoon: z.array(z.string()).optional(),
    })
    .nullable(),
  isOpenNow: z.boolean(),
  lat: num().nullable().optional(),
  lng: num().nullable().optional(),
});
export const searchSalonsResponse = z.object({
  items: z.array(salonSummary),
  total: num(),
  nextCursor: z.string().nullable(),
});

/** `GET /v1/salons/:slug` */
export const salonPublicResponse = salonBase.extend({
  photos: z.array(salonPhoto),
  works: z.array(salonPhoto),
  services: z.array(service),
  staff: z.array(staffPublic),
  openingHours: z.array(openingHour),
});

/** `GET /v1/salons/:id/availability` */
export const availabilityResponse = z.object({
  salonId: z.string(),
  serviceId: z.string(),
  serviceIds: z.array(z.string()),
  date: z.string(),
  slotIntervalMinutes: num(),
  durationMinutes: num(),
  slots: z.array(z.object({ startsAt: z.string(), staffIds: z.array(z.string()) })),
  nextAvailable: z.object({ date: z.string(), slots: z.array(z.string()) }).nullable(),
});

/** `GET /v1/salons/:id/reviews` — le nom de l'auteur est déjà réduit à « Prénom I. » par la route. */
export const reviewsResponse = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      rating: num(),
      comment: z.string().nullable(),
      createdAt: z.string(),
      authorName: z.string(),
      reply: z.string().nullable(),
      repliedAt: z.string().nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

// ---------- Garde-fou de compilation ----------

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

/**
 * Si l'un de ces éléments passe à `false`, un type de `@salondz/types` et son schéma de réponse ont
 * divergé : le champ manquant serait retiré de la réponse sans que rien ne le signale. Le numéro de
 * l'élément en erreur indique lequel, dans l'ordre ci-dessous.
 */
export type PublicSchemasMatchTypes = [
  Assert<Exact<z.infer<typeof categoriesResponse>[number], Category>>,
  Assert<Exact<z.infer<typeof cityCount>, CityCount>>,
  Assert<Exact<z.infer<typeof suggestResponse>, SearchSuggestions>>,
  Assert<Exact<z.infer<typeof salonSummary>, SalonSummary>>,
  Assert<Exact<z.infer<typeof salonPublicResponse>, SalonPublic>>,
  Assert<Exact<z.infer<typeof availabilityResponse>, AvailabilityResponse>>,
  Assert<Exact<z.infer<typeof service>, Service>>,
  Assert<Exact<z.infer<typeof servicePhoto>, ServicePhoto>>,
  Assert<Exact<z.infer<typeof salonPhoto>, SalonPhoto>>,
  Assert<Exact<z.infer<typeof openingHour>, OpeningHour>>,
];
