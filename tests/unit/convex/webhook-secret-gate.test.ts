import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertWebhookSecret } from '../../../convex/lib/webhookSecret';
import { markSucceeded, markFailed } from '../../../convex/payments';
import { markPurchase } from '../../../convex/paygPurchases';
import { applyWebhookStatusUpdate } from '../../../convex/whatsappTemplates';

/**
 * Tests comportementaux de la garde `CONVEX_WEBHOOK_SECRET` (fix anti-forge
 * F-01 résiduel, audit archi 2026-07-19). On invoque directement le `_handler`
 * des mutations de bridge webhook — comme les autres tests d'intégration Convex
 * du repo — pour VÉRIFIER que la garde s'exécute (pas juste qu'une chaîne est
 * présente dans le source). Un ctx vide suffit pour les cas de rejet : si la
 * garde n'était pas prioritaire, on planterait sur `ctx.db` au lieu de throw
 * le bon code.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = { _handler: (ctx: any, args: any) => Promise<unknown> };
const asFn = (m: unknown) => m as unknown as AnyFn;

const SECRET = 'test-webhook-secret-value';

describe('assertWebhookSecret — garde partagée', () => {
  afterEach(() => {
    delete process.env.CONVEX_WEBHOOK_SECRET;
  });

  it('throw WEBHOOK_SECRET_NOT_CONFIGURED si l’env Convex est absente', () => {
    delete process.env.CONVEX_WEBHOOK_SECRET;
    expect(() => assertWebhookSecret('anything')).toThrow('WEBHOOK_SECRET_NOT_CONFIGURED');
  });

  it('throw INVALID_WEBHOOK_SECRET si le secret ne correspond pas', () => {
    process.env.CONVEX_WEBHOOK_SECRET = SECRET;
    expect(() => assertWebhookSecret('wrong')).toThrow('INVALID_WEBHOOK_SECRET');
  });

  it('ne throw pas quand le secret correspond', () => {
    process.env.CONVEX_WEBHOOK_SECRET = SECRET;
    expect(() => assertWebhookSecret(SECRET)).not.toThrow();
  });
});

describe('Mutations bridge webhook — rejet d’un appel direct sans secret valide', () => {
  beforeEach(() => {
    process.env.CONVEX_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.CONVEX_WEBHOOK_SECRET;
  });

  it('markSucceeded rejette un mauvais secret AVANT tout accès DB', async () => {
    await expect(
      asFn(markSucceeded)._handler(
        {},
        {
          webhookSecret: 'wrong',
          provider: 'stripe',
          providerSessionId: 's',
          providerEventId: 'e',
        },
      ),
    ).rejects.toThrow('INVALID_WEBHOOK_SECRET');
  });

  it('markFailed rejette un mauvais secret', async () => {
    await expect(
      asFn(markFailed)._handler(
        {},
        {
          webhookSecret: 'wrong',
          provider: 'stripe',
          providerSessionId: 's',
          providerEventId: 'e',
          status: 'failed',
        },
      ),
    ).rejects.toThrow('INVALID_WEBHOOK_SECRET');
  });

  it('paygPurchases.markPurchase rejette un mauvais secret (pas de crédit forgé)', async () => {
    await expect(
      asFn(markPurchase)._handler(
        {},
        {
          webhookSecret: 'wrong',
          organizationId: 'org_1',
          requesterId: 'usr_1',
          stripeSessionId: 'sess_x',
          amountMinor: 7900,
          currency: 'EUR',
        },
      ),
    ).rejects.toThrow('INVALID_WEBHOOK_SECRET');
  });

  it('whatsappTemplates.applyWebhookStatusUpdate rejette un mauvais secret', async () => {
    await expect(
      asFn(applyWebhookStatusUpdate)._handler(
        {},
        { webhookSecret: 'wrong', metaTemplateId: 'm', status: 'approved' },
      ),
    ).rejects.toThrow('INVALID_WEBHOOK_SECRET');
  });

  it('markSucceeded rejette aussi quand l’env secret n’est pas configurée', async () => {
    delete process.env.CONVEX_WEBHOOK_SECRET;
    await expect(
      asFn(markSucceeded)._handler(
        {},
        { webhookSecret: SECRET, provider: 'stripe', providerSessionId: 's', providerEventId: 'e' },
      ),
    ).rejects.toThrow('WEBHOOK_SECRET_NOT_CONFIGURED');
  });
});

describe('paygPurchases.markPurchase — happy path avec le bon secret', () => {
  beforeEach(() => {
    process.env.CONVEX_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.CONVEX_WEBHOOK_SECRET;
  });

  it('crédite l’organisation (+1) et insère la ligne une fois le secret validé', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let patched: any = null;
    const ctx = {
      db: {
        query: () => ({ withIndex: () => ({ first: async () => null }) }),
        // 1er get = l'org (crédits actuels = 2) ; 2e get = owner sans email (skip notif).
        get: async (id: string) =>
          id === 'org_1'
            ? { _id: 'org_1', paygCredits: 2, ownerId: 'usr_owner', name: 'Org Test' }
            : { _id: id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        insert: async (_table: string, row: any) => {
          inserted.push(row);
          return 'payg_1';
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        patch: async (_id: string, p: any) => {
          patched = p;
        },
      },
    };

    const res = await asFn(markPurchase)._handler(ctx, {
      webhookSecret: SECRET,
      organizationId: 'org_1',
      requesterId: 'usr_1',
      stripeSessionId: 'sess_new',
      amountMinor: 7900,
      currency: 'EUR',
    });

    expect(res).toMatchObject({ ok: true });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ organizationId: 'org_1', stripeSessionId: 'sess_new' });
    expect(patched.paygCredits).toBe(3); // 2 existants + 1
  });
});
