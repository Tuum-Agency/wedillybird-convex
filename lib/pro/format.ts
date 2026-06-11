/**
 * Formatage FR partagé par les modules du back-office agence.
 */

const EUR = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const EUR_CENTS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/** Centimes d'euro → « 18 000 € » (ou avec décimales si non rond). */
export function formatEurMinor(minor: number | null | undefined): string {
  if (minor == null) return '—';
  const eur = minor / 100;
  return Number.isInteger(eur) ? EUR.format(eur) : EUR_CENTS.format(eur);
}

/** Euros (number) → centimes entiers. */
export function eurToMinor(eur: number): number {
  return Math.round(eur * 100);
}

/** Parse une saisie d'euros libre (« 18 000 », « 1 250,50 ») → centimes, ou null. */
export function parseEurToMinor(input: string | null | undefined): number | null {
  if (!input) return null;
  const cleaned = input.replace(/\s/g, '').replace(/€/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/**
 * Lecture d'horloge isolée hors du rendu des composants (respecte la règle de
 * pureté React ; ces lectures sont ponctuelles, par requête côté serveur ou par
 * rendu côté client).
 */
export function nowMs(): number {
  return Date.now();
}

/** Timestamp ms → « 12 sept. 2026 » (UTC pour éviter les décalages SSR). */
export function formatDateFr(ms: number | null | undefined): string {
  if (ms == null) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(ms));
}
