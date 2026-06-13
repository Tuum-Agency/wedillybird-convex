import type { ProviderName } from './country';
import type { PaymentDriver } from './provider';
import { mockDriver } from './drivers/mock';
import { stripeDriver } from './drivers/stripe';

export function getPaymentDriver(name: ProviderName): PaymentDriver {
  if (process.env.PAYMENTS_DRIVER === 'mock') return mockDriver;
  if (name === 'mock') return mockDriver;
  if (name === 'stripe') return stripeDriver;
  return mockDriver;
}
