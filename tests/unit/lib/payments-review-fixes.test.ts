import { describe, expect, it, beforeAll } from 'vitest';
import Stripe from 'stripe';
import {
  verifyAndParseSubscriptionWebhook,
  parsePaymentLinkWebhook,
  mapConnectedPayment,
} from '../../../lib/payments/drivers/stripe';

/**
 * Régression des correctifs de l'audit paiements (avant ouverture aux agences) :
 *  - vérif webhook **double-secret** : un event Connect (compte connecté) signé avec
 *    le secret Connect ne doit PLUS faire jeter la vérif abonnement (sinon 400 avant
 *    d'atteindre le parseur de liens → réconciliation cassée en prod) ;
 *  - le parseur **lie l'event au compte connecté** (`stripeAccountId = event.account`)
 *    pour bloquer tout marquage inter-tenant ;
 *  - `mapConnectedPayment` étiquette un remboursement **partiel** comme remboursé.
 */
const PLATFORM = 'whsec_platform_test_secret';
const CONNECT = 'whsec_connect_test_secret';

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_no_network';
  process.env.STRIPE_WEBHOOK_SECRET = PLATFORM;
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = CONNECT;
});

function sign(eventObj: unknown, secret: string) {
  const stripe = new Stripe('sk_test_dummy_no_network');
  const payload = JSON.stringify(eventObj);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return { payload, header };
}

// Event Connect — `checkout.session.expired` pour éviter tout appel réseau (le succès
// récupère le reçu). Le statut devient 'failed' mais `stripeAccountId` est bien posé.
const connectLinkEvent = (account: string) => ({
  id: 'evt_test_1',
  account,
  type: 'checkout.session.expired',
  data: {
    object: { id: 'cs_test_1', metadata: { kind: 'payment_link', paymentLinkId: 'pl_abc' } },
  },
});

describe('webhook BYOP — vérif double-secret (régression du bug d’ordre critique)', () => {
  it('event signé avec le secret CONNECT → la vérif abonnement renvoie null (ne jette plus)', async () => {
    const { payload, header } = sign(connectLinkEvent('acct_X'), CONNECT);
    await expect(verifyAndParseSubscriptionWebhook(payload, header)).resolves.toBeNull();
  });

  it('parsePaymentLinkWebhook lie l’event au compte connecté (stripeAccountId = event.account)', async () => {
    const { payload, header } = sign(connectLinkEvent('acct_AGENCY'), CONNECT);
    const res = await parsePaymentLinkWebhook(payload, header);
    expect(res?.paymentLinkId).toBe('pl_abc');
    expect(res?.stripeAccountId).toBe('acct_AGENCY');
  });

  it('signature ne matchant aucun secret → INVALID_SIGNATURE', async () => {
    const { payload, header } = sign(connectLinkEvent('acct_X'), 'whsec_unknown');
    await expect(parsePaymentLinkWebhook(payload, header)).rejects.toThrow('INVALID_SIGNATURE');
  });
});

describe('mapConnectedPayment — remboursement partiel étiqueté « remboursé »', () => {
  const charge = (o: Partial<Stripe.Charge>) => o as Stripe.Charge;
  it('remboursement total → refunded true', () => {
    expect(
      mapConnectedPayment(charge({ id: 'ch', amount: 1000, status: 'succeeded', refunded: true })),
    ).toMatchObject({ refunded: true });
  });
  it('remboursement PARTIEL (refunded=false, amount_refunded>0) → refunded true', () => {
    expect(
      mapConnectedPayment(
        charge({
          id: 'ch',
          amount: 1000,
          status: 'succeeded',
          refunded: false,
          amount_refunded: 300,
        }),
      ).refunded,
    ).toBe(true);
  });
  it('aucun remboursement → refunded false', () => {
    expect(
      mapConnectedPayment(
        charge({
          id: 'ch',
          amount: 1000,
          status: 'succeeded',
          refunded: false,
          amount_refunded: 0,
        }),
      ).refunded,
    ).toBe(false);
  });
});
