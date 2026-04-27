import type { ProviderName } from './country';
import type { PaymentDriver } from './provider';
import { mockDriver } from './drivers/mock';
import { stripeDriver } from './drivers/stripe';
// CinetPay driver désactivé tant que les credentials prod ne sont pas dispo.
// Décommenter l'import et la branche `name === 'cinetpay'` quand prêt à activer.
// import { cinetpayDriver } from './drivers/cinetpay';

export function getPaymentDriver(name: ProviderName): PaymentDriver {
  if (process.env.PAYMENTS_DRIVER === 'mock') return mockDriver;
  if (name === 'mock') return mockDriver;
  if (name === 'stripe') return stripeDriver;
  // if (name === 'cinetpay') return cinetpayDriver;
  return mockDriver;
}
