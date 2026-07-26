// @vitest-environment node
import { describe, it, expect, vi, beforeAll } from 'vitest';

// `lib/auth/session.ts` importe `server-only` (qui throw hors RSC) et
// `next/headers`. On les neutralise pour tester la logique pure d'encodage /
// décodage (HMAC + expiration serveur), sans dépendre du runtime Next.
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

beforeAll(() => {
  process.env.SESSION_SECRET = 'test-secret-session-key-at-least-32-chars';
});

describe('decodeSession — expiration & intégrité côté serveur', () => {
  it('accepte un token fraîchement émis', async () => {
    const { encodeSession, decodeSession } = await import('@/lib/auth/session');
    const token = await encodeSession({
      userId: 'usr_1',
      phone: '+33600000000',
      issuedAt: Date.now(),
    });
    const decoded = await decodeSession(token);
    expect(decoded?.userId).toBe('usr_1');
  });

  it('rejette un token dont issuedAt dépasse la fenêtre de 30 jours', async () => {
    const { encodeSession, decodeSession } = await import('@/lib/auth/session');
    const token = await encodeSession({
      userId: 'usr_1',
      issuedAt: Date.now() - THIRTY_DAYS_MS - 60_000,
    });
    expect(await decodeSession(token)).toBeNull();
  });

  it('rejette un token sans issuedAt valide', async () => {
    const { encodeSession, decodeSession } = await import('@/lib/auth/session');
    // @ts-expect-error — on force un payload sans issuedAt (token legacy/forgé)
    const token = await encodeSession({ userId: 'usr_1' });
    expect(await decodeSession(token)).toBeNull();
  });

  it('rejette un token à signature altérée (tamper)', async () => {
    const { encodeSession, decodeSession } = await import('@/lib/auth/session');
    const token = await encodeSession({ userId: 'usr_1', issuedAt: Date.now() });
    const tampered = token.endsWith('A') ? `${token.slice(0, -1)}B` : `${token.slice(0, -1)}A`;
    expect(await decodeSession(tampered)).toBeNull();
  });
});
