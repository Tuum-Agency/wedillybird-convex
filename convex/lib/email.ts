/**
 * Mirror minimal de `lib/validators/email.ts` côté Convex.
 *
 * Le `tsconfig` root exclut `convex/`, donc on ne peut pas importer
 * `lib/validators/email.ts` directement depuis ici. Le regex et le helper
 * sont dupliqués strictement.
 *
 * keep in sync with lib/validators/email.ts
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
