import { z } from 'zod';
import { isValidE164, normalizePhoneE164 } from '@/lib/phone';

export const phoneSchema = z
  .string()
  .trim()
  .min(8, 'Numéro trop court')
  .transform((val) => normalizePhoneE164(val))
  .refine((val): val is string => val !== null && isValidE164(val), {
    message: 'Numéro de téléphone invalide',
  });

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Le code doit contenir 6 chiffres');

export const requestOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
});

export const onboardingSchema = z.object({
  fullName: z.string().trim().min(2, 'Nom trop court').max(80, 'Nom trop long'),
  role: z.enum(['couple', 'pro']),
  email: z
    .string()
    .trim()
    .email('Email invalide')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
