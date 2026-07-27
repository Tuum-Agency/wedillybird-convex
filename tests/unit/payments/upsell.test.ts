import { afterEach, describe, expect, it } from 'vitest';
import {
  classifyPostEventUpsellSession,
  type PostEventUpsellWebhookEvent,
} from '@/lib/payments/drivers/stripe';
import { getUpsellPrice, priceIdForPostEventUpsell, POST_EVENT_UPSELL } from '@/lib/payments/plans';

type SessionLike = Parameters<typeof classifyPostEventUpsellSession>[0];

function session(over: Partial<SessionLike> = {}): SessionLike {
  return {
    id: 'cs_test_123',
    metadata: { kind: 'post-event-upsell', eventId: 'ev_1', requesterId: 'usr_1' },
    currency: 'eur',
    amount_total: 2900,
    ...over,
  } as SessionLike;
}

describe('classifyPostEventUpsellSession', () => {
  it('classe une session payée d_upsell HD', () => {
    const r = classifyPostEventUpsellSession(session(), 'checkout.session.completed');
    expect(r).toEqual<PostEventUpsellWebhookEvent>({
      kind: 'post-event-upsell',
      eventId: 'ev_1',
      requesterId: 'usr_1',
      stripeSessionId: 'cs_test_123',
      amountMinor: 2900,
      currency: 'EUR',
    });
  });

  it('ignore un autre type d_event', () => {
    expect(classifyPostEventUpsellSession(session(), 'checkout.session.expired')).toBeNull();
  });

  it('ignore un autre kind (payg, budget…)', () => {
    expect(
      classifyPostEventUpsellSession(
        session({ metadata: { kind: 'payg', organizationId: 'org', requesterId: 'u' } }),
        'checkout.session.completed',
      ),
    ).toBeNull();
  });

  it('refuse une session sans eventId / requesterId', () => {
    expect(
      classifyPostEventUpsellSession(
        session({ metadata: { kind: 'post-event-upsell', eventId: 'ev_1' } }),
        'checkout.session.completed',
      ),
    ).toBeNull();
  });

  it('refuse une devise inconnue', () => {
    expect(
      classifyPostEventUpsellSession(session({ currency: 'gbp' }), 'checkout.session.completed'),
    ).toBeNull();
  });

  it('applique l_override XOF (stocké en centimes)', () => {
    const r = classifyPostEventUpsellSession(
      session({ currency: 'xof', amount_total: 19000 }),
      'checkout.session.completed',
    );
    // XOF zéro-décimale chez Stripe → on remet en centimes internes (×100).
    expect(r?.amountMinor).toBe(1_900_000);
    expect(r?.currency).toBe('XOF');
  });
});

describe('tarif upsell HD', () => {
  it('vaut 29 € canoniques en EUR', () => {
    expect(POST_EVENT_UPSELL.eurMinor).toBe(2900);
    expect(getUpsellPrice('EUR')).toBe(2900);
  });

  it('dérive un montant > 0 dans les autres devises Stripe', () => {
    expect(getUpsellPrice('USD')).toBeGreaterThan(0);
    expect(getUpsellPrice('MAD')).toBeGreaterThan(0);
  });
});

describe('priceIdForPostEventUpsell', () => {
  const KEYS = [
    'STRIPE_PRICE_POST_EVENT_UPSELL',
    'STRIPE_PRICE_POST_EVENT_UPSELL_EUR',
    'STRIPE_PRICE_POST_EVENT_UPSELL_USD',
    'STRIPE_PRICE_POST_EVENT_UPSELL_MAD',
  ];
  afterEach(() => {
    for (const k of KEYS) delete process.env[k];
  });

  it('préfère la clé par devise', () => {
    process.env.STRIPE_PRICE_POST_EVENT_UPSELL_USD = 'price_usd';
    expect(priceIdForPostEventUpsell('USD')).toBe('price_usd');
  });

  it('retombe sur l_alias EUR sans suffixe', () => {
    process.env.STRIPE_PRICE_POST_EVENT_UPSELL = 'price_eur_legacy';
    expect(priceIdForPostEventUpsell('EUR')).toBe('price_eur_legacy');
  });

  it('renvoie undefined pour XOF / TND (pas de processeur)', () => {
    expect(priceIdForPostEventUpsell('XOF')).toBeUndefined();
    expect(priceIdForPostEventUpsell('TND')).toBeUndefined();
  });
});
