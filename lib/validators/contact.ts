import { z } from 'zod';
import { emailSchema } from './auth';

/**
 * Validators formulaires publics (contact + newsletter).
 *
 * Honeypot : champ `website` censé rester vide. Les bots remplissent tous
 * les champs visibles ; on rejette silencieusement (response 200 ok:true)
 * pour éviter de leur signaler la détection.
 *
 * Caps strictes anti-abuse. Ces longueurs ont aussi un sens UX : un sujet
 * de 200 chars devient illisible, un message > 5000 chars c'est un blob.
 *
 * Les messages Zod sont des codes i18n (cf. `messages/*.json` namespace
 * `Validation`). Le composant qui affiche les erreurs doit les traduire.
 */

export const contactFormSchema = z.object({
  name: z.string().trim().min(2, 'Validation.nameTooShort').max(80, 'Validation.nameTooLong'),
  email: emailSchema,
  subject: z
    .string()
    .trim()
    .min(3, 'Validation.subjectTooShort')
    .max(140, 'Validation.subjectTooLong'),
  message: z
    .string()
    .trim()
    .min(20, 'Validation.messageTooShort')
    .max(5000, 'Validation.messageTooLong'),
  /** Honeypot — doit rester vide. Si rempli → bot. */
  website: z.string().optional().default(''),
});

export const newsletterSchema = z.object({
  email: emailSchema,
  /** Honeypot — doit rester vide. */
  website: z.string().optional().default(''),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;
export type NewsletterInput = z.infer<typeof newsletterSchema>;

/** Détecte si le champ honeypot est rempli (= bot probable). */
export function isHoneypotTriggered(input: { website?: string }): boolean {
  return !!input.website && input.website.trim().length > 0;
}
