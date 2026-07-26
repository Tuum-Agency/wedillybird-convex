// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

// `lib/auth/csrf.ts` importe `server-only` (throw hors RSC) — on le neutralise.
vi.mock('server-only', () => ({}));

import { assertSameOrigin } from '@/lib/auth/csrf';

// La spec Fetch interdit de fixer l'en-tête `host` sur une Request ; on simule
// donc l'hôte servi via `x-forwarded-host` (exactement ce que pose Vercel).
function req(origin: string | null, forwardedHost: string): Request {
  const headers: Record<string, string> = { 'x-forwarded-host': forwardedHost };
  if (origin !== null) headers.origin = origin;
  return new Request('https://wedillybird.com/api/checkout', { method: 'POST', headers });
}

describe('assertSameOrigin — défense CSRF des routes API', () => {
  it('autorise une requête same-origin (Origin == hôte servi)', () => {
    expect(assertSameOrigin(req('https://wedillybird.com', 'wedillybird.com'))).toBeNull();
  });

  it('autorise un sous-domaine tenant qui poste vers son propre hôte', () => {
    expect(
      assertSameOrigin(req('https://acme.wedillybird.com', 'acme.wedillybird.com')),
    ).toBeNull();
  });

  it('tolère une requête sans en-tête Origin (client non navigateur)', () => {
    expect(assertSameOrigin(req(null, 'wedillybird.com'))).toBeNull();
  });

  it('refuse une origine cross-site (403)', () => {
    const res = assertSameOrigin(req('https://evil.example', 'wedillybird.com'));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  it('refuse un Origin d’un autre tenant/domaine ressemblant', () => {
    const res = assertSameOrigin(req('https://wedillybird.com.evil.com', 'wedillybird.com'));
    expect(res?.status).toBe(403);
  });

  it('refuse un Origin malformé', () => {
    const res = assertSameOrigin(req('not-a-valid-url', 'wedillybird.com'));
    expect(res?.status).toBe(403);
  });
});
