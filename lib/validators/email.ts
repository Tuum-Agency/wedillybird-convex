/**
 * Email validation centralisé.
 *
 * Avant ce module, le regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` était dupliqué
 * dans `convex/auth.ts`, `convex/users.ts`, `lib/validators/auth.ts`,
 * `lib/validators/guests.ts`, `components/onboarding/onboarding-wizard.tsx`,
 * etc. On le centralise ici avec un schema `zod` réutilisable.
 *
 * Côté Convex (`convex/lib/email.ts`), un miroir minimal — `tsconfig` root
 * exclut `convex/`, donc on duplique le strict minimum (un commentaire est
 * posé pour rappeler de garder en sync).
 */

import { z } from 'zod';

/**
 * Regex email volontairement permissive (pas de RFC 5321 strict). Le
 * mismatch sur edge-cases compatibles RFC ≠ ce qui est acceptable côté
 * MTA est négligeable face au coût d'une validation trop stricte qui
 * rejetterait des emails légitimes (apostrophes, plus-addressing, IDN).
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Vérifie si une chaîne ressemble à un email valide. Pas de normalisation
 * (`.trim()`, `.toLowerCase()`) — c'est à l'appelant de le faire si besoin.
 */
export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

/**
 * Schema zod prêt à l'emploi : trim → lowercase → validation regex.
 * Idéal pour les body schemas d'API routes et formulaires.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isValidEmail, { message: 'Validation.emailInvalid' });

/**
 * Les messages Zod ci-dessus sont des **codes i18n**. À traduire côté client
 * via `useTranslations()`.
 */

/**
 * Schema optionnel + transform vers `undefined` quand vide. Utile pour les
 * champs email de formulaires guests où l'email est optionnel.
 */
export const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .refine((v) => v === undefined || v === '' || isValidEmail(v), 'Validation.emailInvalid')
  .transform((v) => (v && v.length > 0 ? v : undefined));
