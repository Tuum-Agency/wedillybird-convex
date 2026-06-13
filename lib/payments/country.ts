import type { Currency } from './plans';

export type ProviderName = 'stripe' | 'mock';

const STRIPE_COUNTRIES = new Set([
  'FR',
  'BE',
  'CH',
  'LU',
  'MC',
  'IT',
  'ES',
  'PT',
  'DE',
  'NL',
  'IE',
  'AT',
  'GB',
  'CA',
  'US',
]);

// Pays facturés en USD par défaut (region "americas"). Doit rester en sync
// avec `AMERICAS_COUNTRIES` dans `region.ts` — les deux Sets décrivent la
// même région marché.
const USD_COUNTRIES = new Set(['US', 'CA']);

export interface PaymentRouting {
  provider: ProviderName;
  currency: Currency;
}

export function routePayment(
  countryCode: string | undefined,
  preferred?: { provider?: ProviderName; currency?: Currency },
): PaymentRouting {
  if (process.env.PAYMENTS_DRIVER === 'mock') {
    return {
      provider: 'mock',
      currency: preferred?.currency ?? 'EUR',
    };
  }

  if (preferred?.provider && preferred?.currency) {
    return { provider: preferred.provider, currency: preferred.currency };
  }

  const code = (countryCode ?? '').toUpperCase();
  if (STRIPE_COUNTRIES.has(code)) {
    const defaultCurrency: Currency = USD_COUNTRIES.has(code) ? 'USD' : 'EUR';
    return { provider: 'stripe', currency: preferred?.currency ?? defaultCurrency };
  }
  return { provider: 'stripe', currency: preferred?.currency ?? 'EUR' };
}

export function detectCountryFromHeaders(headers: Headers): string | undefined {
  return headers.get('x-vercel-ip-country') ?? headers.get('cf-ipcountry') ?? undefined;
}
