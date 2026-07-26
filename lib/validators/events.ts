import { z } from 'zod';

const HEX_COLOR = /^#([0-9a-fA-F]{3}){1,2}$/;
const MIN_FUTURE_BUFFER_MS = 60 * 60 * 1000;

/**
 * Les messages Zod ci-dessous sont des **codes i18n** (cf. `messages/*.json`
 * namespace `Validation`). Le composant qui consomme les erreurs doit les
 * traduire — voir `lib/validators/translate-zod.ts`.
 */

export const partnerNameSchema = z
  .string()
  .trim()
  .min(1, 'Validation.firstNameRequired')
  .max(60, 'Validation.firstNameTooLong');

export const eventTitleSchema = z
  .string()
  .trim()
  .min(2, 'Validation.titleTooShort')
  .max(120, 'Validation.titleTooLong');

export const eventDateSchema = z
  .string()
  .trim()
  .min(1, 'Validation.dateRequired')
  .refine((val) => !Number.isNaN(Date.parse(val)), 'Validation.dateInvalid')
  .transform((val) => new Date(val).getTime())
  .refine((ts) => ts > Date.now() + MIN_FUTURE_BUFFER_MS, 'Validation.dateMustBeFuture');

export const timezoneSchema = z
  .string()
  .trim()
  .min(1, 'Validation.timezoneRequired')
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat('fr', { timeZone: tz }).format(Date.now());
      return true;
    } catch {
      return false;
    }
  }, 'Validation.timezoneInvalid');

export const venueSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Validation.venueNameRequired')
      .max(120, 'Validation.venueNameTooLong'),
    address: z
      .string()
      .trim()
      .min(3, 'Validation.venueAddressRequired')
      .max(240, 'Validation.venueAddressTooLong'),
  })
  .optional();

export const themeSchema = z
  .object({
    primaryColor: z.string().regex(HEX_COLOR, 'Validation.colorInvalid'),
    accentColor: z.string().regex(HEX_COLOR, 'Validation.colorInvalid'),
    fontFamily: z
      .string()
      .trim()
      .min(1, 'Validation.fontRequired')
      .max(80, 'Validation.fontTooLong'),
  })
  .optional();

export const planTierSchema = z.enum(['essential', 'premium']);

/**
 * État US (2 lettres) ou province canadienne (`CA-` + 2 lettres) — cf.
 * `lib/geo/regions.ts` / `convex/schema.ts:events.weddingState`. Optionnel :
 * seuls les mariages US/Canada le renseignent utilement, mais rien ne
 * l'impose côté validateur (la mutation d'opt-in reco-faciale est l'autorité
 * qui en a réellement besoin).
 */
export const weddingStateSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^([A-Z]{2}|CA-[A-Z]{2})$/, 'Validation.weddingStateInvalid')
  .optional();

export const createEventSchema = z.object({
  title: eventTitleSchema,
  partnerA: partnerNameSchema,
  partnerB: partnerNameSchema,
  eventDate: eventDateSchema,
  timezone: timezoneSchema,
  venueName: z.string().trim().max(120).optional(),
  venueAddress: z.string().trim().max(240).optional(),
  themePrimary: z.string().regex(HEX_COLOR, 'Validation.colorInvalid').optional(),
  themeAccent: z.string().regex(HEX_COLOR, 'Validation.colorInvalid').optional(),
  themeFont: z.string().trim().max(80).optional(),
  pendingPlanTier: planTierSchema.optional(),
  weddingState: weddingStateSchema,
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

/**
 * Édition partielle d'un événement existant. Tous les champs sont optionnels :
 * on n'envoie que ce qui change. `clearVenue=true` permet de retirer un lieu
 * sans en remettre un (cas où le couple n'a plus de lieu).
 */
export const updateEventSchema = z.object({
  title: eventTitleSchema.optional(),
  partnerA: partnerNameSchema.optional(),
  partnerB: partnerNameSchema.optional(),
  eventDate: eventDateSchema.optional(),
  timezone: timezoneSchema.optional(),
  venueName: z.string().trim().max(120).optional(),
  venueAddress: z.string().trim().max(240).optional(),
  clearVenue: z.boolean().optional(),
  themePrimary: z.string().regex(HEX_COLOR, 'Validation.colorInvalid').optional(),
  themeAccent: z.string().regex(HEX_COLOR, 'Validation.colorInvalid').optional(),
  themeFont: z.string().trim().max(80).optional(),
});

export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export interface NormalizedEventInput {
  title: string;
  partnerA: string;
  partnerB: string;
  eventDate: number;
  timezone: string;
  venue?: { name: string; address: string };
  theme?: { primaryColor: string; accentColor: string; fontFamily: string };
  pendingPlanTier?: 'essential' | 'premium';
  weddingState?: string;
}

export function normalizeCreateEvent(input: CreateEventInput): NormalizedEventInput {
  const venue =
    input.venueName && input.venueAddress
      ? { name: input.venueName, address: input.venueAddress }
      : undefined;
  const theme =
    input.themePrimary && input.themeAccent && input.themeFont
      ? {
          primaryColor: input.themePrimary,
          accentColor: input.themeAccent,
          fontFamily: input.themeFont,
        }
      : undefined;
  return {
    title: input.title,
    partnerA: input.partnerA,
    partnerB: input.partnerB,
    eventDate: input.eventDate,
    timezone: input.timezone,
    ...(venue ? { venue } : {}),
    ...(theme ? { theme } : {}),
    ...(input.pendingPlanTier ? { pendingPlanTier: input.pendingPlanTier } : {}),
    ...(input.weddingState ? { weddingState: input.weddingState } : {}),
  };
}
