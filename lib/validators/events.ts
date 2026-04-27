import { z } from 'zod';

const HEX_COLOR = /^#([0-9a-fA-F]{3}){1,2}$/;
const MIN_FUTURE_BUFFER_MS = 60 * 60 * 1000;

export const partnerNameSchema = z
  .string()
  .trim()
  .min(1, 'Prénom requis')
  .max(60, 'Prénom trop long');

export const eventTitleSchema = z
  .string()
  .trim()
  .min(2, 'Titre trop court')
  .max(120, 'Titre trop long');

export const eventDateSchema = z
  .string()
  .trim()
  .min(1, 'Date requise')
  .refine((val) => !Number.isNaN(Date.parse(val)), 'Date invalide')
  .transform((val) => new Date(val).getTime())
  .refine((ts) => ts > Date.now() + MIN_FUTURE_BUFFER_MS, 'La date doit être dans le futur');

export const timezoneSchema = z
  .string()
  .trim()
  .min(1, 'Fuseau horaire requis')
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat('fr', { timeZone: tz }).format(Date.now());
      return true;
    } catch {
      return false;
    }
  }, 'Fuseau horaire invalide');

export const venueSchema = z
  .object({
    name: z.string().trim().min(2, 'Nom du lieu requis').max(120, 'Nom trop long'),
    address: z.string().trim().min(3, 'Adresse requise').max(240, 'Adresse trop longue'),
  })
  .optional();

export const themeSchema = z
  .object({
    primaryColor: z.string().regex(HEX_COLOR, 'Couleur invalide'),
    accentColor: z.string().regex(HEX_COLOR, 'Couleur invalide'),
    fontFamily: z.string().trim().min(1, 'Police requise').max(80, 'Police trop longue'),
  })
  .optional();

export const planTierSchema = z.enum(['essential', 'premium']);

export const createEventSchema = z.object({
  title: eventTitleSchema,
  partnerA: partnerNameSchema,
  partnerB: partnerNameSchema,
  eventDate: eventDateSchema,
  timezone: timezoneSchema,
  venueName: z.string().trim().max(120).optional(),
  venueAddress: z.string().trim().max(240).optional(),
  themePrimary: z.string().regex(HEX_COLOR, 'Couleur invalide').optional(),
  themeAccent: z.string().regex(HEX_COLOR, 'Couleur invalide').optional(),
  themeFont: z.string().trim().max(80).optional(),
  pendingPlanTier: planTierSchema.optional(),
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
  themePrimary: z.string().regex(HEX_COLOR, 'Couleur invalide').optional(),
  themeAccent: z.string().regex(HEX_COLOR, 'Couleur invalide').optional(),
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
  };
}
