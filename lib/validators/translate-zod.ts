/**
 * Helper pour traduire les codes Zod (préfixés `Validation.`) en messages
 * lisibles. Les schemas exposent des codes au lieu de chaînes en français
 * pour rester multilingues (cf. `messages/*.json` namespace `Validation`).
 *
 * Côté composant React :
 *   const t = useTranslations();
 *   <span>{translateZodMessage(error, t)}</span>
 */

type TranslateFn = (key: string) => string;

const ZOD_PREFIX = 'Validation.';

export function translateZodMessage(message: string | undefined | null, t: TranslateFn): string {
  if (!message) return '';
  if (message.startsWith(ZOD_PREFIX)) {
    try {
      return t(message);
    } catch {
      return message;
    }
  }
  return message;
}

export function translateFieldErrors<T extends Record<string, string[] | string | undefined>>(
  fieldErrors: T | undefined,
  t: TranslateFn,
): Record<keyof T, string | undefined> {
  const out = {} as Record<keyof T, string | undefined>;
  if (!fieldErrors) return out;
  for (const k of Object.keys(fieldErrors) as Array<keyof T>) {
    const v = fieldErrors[k];
    const raw: string | undefined = Array.isArray(v) ? v[0] : v;
    out[k] = raw ? translateZodMessage(raw, t) : undefined;
  }
  return out;
}
