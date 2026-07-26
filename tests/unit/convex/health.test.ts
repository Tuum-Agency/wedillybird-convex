/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, afterEach } from 'vitest';
import { verifyWebhookSecret } from '../../../convex/health';

/**
 * Health-check secret+URL indépendant du money-path (T2-1). `verifyWebhookSecret`
 * est une QUERY (jamais une mutation, aucun effet de bord) : on vérifie ici les
 * 3 issues possibles du round-trip de secret — même approche comportementale
 * que les autres tests de bridge webhook du repo (invocation directe du
 * `_handler` avec un ctx minimal).
 */

type AnyFn = { _handler: (ctx: any, args: any) => Promise<unknown> };
const asFn = (m: unknown) => m as unknown as AnyFn;

const SECRET = 'test-webhook-secret-value';

describe('health.verifyWebhookSecret', () => {
  afterEach(() => {
    delete process.env.CONVEX_WEBHOOK_SECRET;
  });

  it('retourne { ok: false, reason: NOT_CONFIGURED } si CONVEX_WEBHOOK_SECRET est absente côté Convex', async () => {
    delete process.env.CONVEX_WEBHOOK_SECRET;
    const res = await asFn(verifyWebhookSecret)._handler({}, { secret: SECRET });
    expect(res).toEqual({ ok: false, reason: 'NOT_CONFIGURED' });
  });

  it('retourne { ok: false, reason: MISMATCH } si le secret ne correspond pas — sans throw (query lisible par un check externe)', async () => {
    process.env.CONVEX_WEBHOOK_SECRET = SECRET;
    const res = await asFn(verifyWebhookSecret)._handler({}, { secret: 'wrong' });
    expect(res).toEqual({ ok: false, reason: 'MISMATCH' });
  });

  it('retourne { ok: true } quand le secret fait un aller-retour réussi', async () => {
    process.env.CONVEX_WEBHOOK_SECRET = SECRET;
    const res = await asFn(verifyWebhookSecret)._handler({}, { secret: SECRET });
    expect(res).toEqual({ ok: true });
  });

  it("ne touche jamais ctx.db — c'est une query pure sans lecture ni écriture", async () => {
    process.env.CONVEX_WEBHOOK_SECRET = SECRET;
    // ctx vide sans `db` du tout : si le handler tentait le moindre accès DB,
    // ce test planterait sur `Cannot read properties of undefined`.
    const res = await asFn(verifyWebhookSecret)._handler(undefined, { secret: SECRET });
    expect(res).toEqual({ ok: true });
  });
});
