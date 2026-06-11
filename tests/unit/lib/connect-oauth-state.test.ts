import { describe, expect, it } from 'vitest';
import {
  signConnectState,
  verifyConnectState,
  CONNECT_STATE_TTL_MS,
} from '../../../lib/payments/connect-oauth-state';

/**
 * État OAuth signé (anti-CSRF) de la connexion « Se connecter avec Stripe ».
 * On vérifie : round-trip, détection de falsification (signature et corps),
 * mauvais secret, expiration et émission dans le futur.
 */
const SECRET = 'x'.repeat(40);
const NOW = 1_750_000_000_000;

describe('connect OAuth state', () => {
  it('round-trip : signe puis vérifie', async () => {
    const token = await signConnectState({ orgId: 'org_1', nonce: 'n1', ts: NOW }, SECRET);
    expect(await verifyConnectState(token, SECRET, NOW + 1000)).toEqual({
      orgId: 'org_1',
      nonce: 'n1',
      ts: NOW,
    });
  });

  it('signature falsifiée → null', async () => {
    const token = await signConnectState({ orgId: 'org_1', nonce: 'n1', ts: NOW }, SECRET);
    const [body] = token.split('.');
    expect(await verifyConnectState(`${body}.AAAA`, SECRET, NOW)).toBeNull();
  });

  it('mauvais secret → null', async () => {
    const token = await signConnectState({ orgId: 'org_1', nonce: 'n1', ts: NOW }, SECRET);
    expect(await verifyConnectState(token, 'y'.repeat(40), NOW)).toBeNull();
  });

  it('corps modifié (autre orgId) mais ancienne signature → null', async () => {
    const token = await signConnectState({ orgId: 'org_1', nonce: 'n1', ts: NOW }, SECRET);
    const forgedBody = Buffer.from(
      JSON.stringify({ orgId: 'org_evil', nonce: 'n1', ts: NOW }),
    ).toString('base64url');
    expect(
      await verifyConnectState(`${forgedBody}.${token.split('.')[1]}`, SECRET, NOW),
    ).toBeNull();
  });

  it('expiré (> TTL) → null', async () => {
    const token = await signConnectState({ orgId: 'org_1', nonce: 'n1', ts: NOW }, SECRET);
    expect(await verifyConnectState(token, SECRET, NOW + CONNECT_STATE_TTL_MS + 1)).toBeNull();
  });

  it('émis dans le futur → null', async () => {
    const token = await signConnectState(
      { orgId: 'org_1', nonce: 'n1', ts: NOW + 5 * 60_000 },
      SECRET,
    );
    expect(await verifyConnectState(token, SECRET, NOW)).toBeNull();
  });

  it('format invalide → null', async () => {
    expect(await verifyConnectState('garbage', SECRET, NOW)).toBeNull();
    expect(await verifyConnectState('', SECRET, NOW)).toBeNull();
  });
});
