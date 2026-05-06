import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['fr', 'en', 'es', 'it', 'pt', 'de', 'ar'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
  // Pas de redirection forcée en fonction de Accept-Language. À la place, une
  // bannière soft (`<LocaleSuggestionBanner />` dans `app/[locale]/layout.tsx`)
  // suggère la langue préférée sans casser les liens partagés.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

export const RTL_LOCALES = ['ar'] as const satisfies ReadonlyArray<Locale>;

export function isRtlLocale(locale: Locale): boolean {
  return (RTL_LOCALES as ReadonlyArray<string>).includes(locale);
}

export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  de: 'Deutsch',
  ar: 'العربية',
};
