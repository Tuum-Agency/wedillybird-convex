/**
 * Helpers de mapping de locale → tags étendus (BCP-47 / OG / etc.).
 * Module pur sans dépendance JSON — importable depuis Convex mutations
 * (V8 isolate) en plus des actions Node et du code Next.js.
 */
import { routing, type Locale } from '../../i18n/routing';

export function resolveLocale(input: string | undefined | null): Locale {
  if (!input) return routing.defaultLocale;
  const normalized = input.toLowerCase().split(/[-_]/)[0] ?? '';
  if ((routing.locales as readonly string[]).includes(normalized)) {
    return normalized as Locale;
  }
  return routing.defaultLocale;
}

const REGION_MAP: Record<Locale, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-PT',
  de: 'de-DE',
  ar: 'ar',
};

const OG_MAP: Record<Locale, string> = {
  fr: 'fr_FR',
  en: 'en_US',
  es: 'es_ES',
  it: 'it_IT',
  pt: 'pt_PT',
  de: 'de_DE',
  ar: 'ar_AR',
};

export function toIntlTag(locale: Locale | string | undefined | null): string {
  return REGION_MAP[resolveLocale(locale)];
}

export function toOgLocale(locale: Locale | string | undefined | null): string {
  return OG_MAP[resolveLocale(locale)];
}
