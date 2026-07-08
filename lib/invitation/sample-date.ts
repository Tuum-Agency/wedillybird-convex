/**
 * Date de mariage d'ÉCHANTILLON pour les démos de la landing (cinématique du
 * chapitre 04 + bento des univers). Fixe (pas de `Date.now()` → aucun mismatch
 * d'hydratation) et dans le futur proche pour que le compte à rebours reste
 * positif. Formatée PAR PAYS via `Intl.DateTimeFormat(locale)` — « 12 septembre
 * 2026 » en France, « September 12, 2026 » aux États-Unis — exactement comme la
 * vraie page d'invitation (`app/[locale]/i/[token]/page.tsx`).
 */
export const SAMPLE_EVENT_DATE_ISO = '2026-09-12T15:00:00Z';

const SAMPLE_EVENT_DATE = new Date(SAMPLE_EVENT_DATE_ISO);

/** Format compact localisé (jour mois année, capitales) de la date démo. */
export function formatSampleDate(locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(SAMPLE_EVENT_DATE)
    .toUpperCase();
}
