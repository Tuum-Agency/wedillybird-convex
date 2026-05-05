import { z } from 'zod';
import { optionalEmailSchema } from '@/lib/validators/email';

const E164 = /^\+[1-9]\d{6,14}$/;

/**
 * Les messages Zod ci-dessous sont des **codes i18n** (cf. `messages/*.json`
 * namespace `Validation`). Le composant qui consomme les erreurs doit les
 * traduire via `translateZodMessage` — voir `lib/validators/translate-zod.ts`.
 */

export const guestFullNameSchema = z
  .string()
  .trim()
  .min(1, 'Validation.guestNameRequired')
  .max(120, 'Validation.guestNameTooLong');

export const guestPhoneSchema = z
  .string()
  .trim()
  .optional()
  .refine((v) => v === undefined || v === '' || E164.test(v), 'Validation.phoneE164Invalid')
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const guestEmailSchema = optionalEmailSchema;

export const guestCategorySchema = z
  .string()
  .trim()
  .max(60, 'Validation.categoryTooLong')
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const guestNotesSchema = z
  .string()
  .trim()
  .max(500, 'Validation.notesTooLong')
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const plusOnesSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? Number.parseInt(v, 10) : v))
  .refine((n) => Number.isInteger(n) && n >= 0 && n <= 10, 'Validation.plusOnesRange');

export const addGuestSchema = z.object({
  fullName: guestFullNameSchema,
  phone: guestPhoneSchema,
  email: guestEmailSchema,
  category: guestCategorySchema,
  plusOnesAllowed: plusOnesSchema,
  notes: guestNotesSchema,
});

export const updateGuestSchema = z.object({
  fullName: guestFullNameSchema.optional(),
  phone: guestPhoneSchema,
  email: guestEmailSchema,
  category: guestCategorySchema,
  plusOnesAllowed: plusOnesSchema.optional(),
  notes: guestNotesSchema,
});

export type AddGuestInput = z.infer<typeof addGuestSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
