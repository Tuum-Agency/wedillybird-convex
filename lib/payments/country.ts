import type { Currency } from './plans';

export type ProviderName = 'stripe' | 'cinetpay' | 'mock';

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

const CINETPAY_BY_CURRENCY: Record<string, Currency> = {
  SN: 'XOF',
  CI: 'XOF',
  ML: 'XOF',
  BF: 'XOF',
  TG: 'XOF',
  BJ: 'XOF',
  GW: 'XOF',
  NE: 'XOF',
  CM: 'XOF',
  GA: 'XOF',
  CG: 'XOF',
  TD: 'XOF',
  CF: 'XOF',
  GQ: 'XOF',
  MA: 'MAD',
  TN: 'TND',
};

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
    return { provider: 'stripe', currency: preferred?.currency ?? 'EUR' };
  }
  if (code in CINETPAY_BY_CURRENCY) {
    return {
      provider: 'cinetpay',
      currency: preferred?.currency ?? CINETPAY_BY_CURRENCY[code]!,
    };
  }
  return { provider: 'stripe', currency: preferred?.currency ?? 'EUR' };
}

export function detectCountryFromHeaders(headers: Headers): string | undefined {
  return headers.get('x-vercel-ip-country') ?? headers.get('cf-ipcountry') ?? undefined;
}
