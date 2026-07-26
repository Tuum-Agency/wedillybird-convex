import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { EVENTS } from '@/lib/analytics/events';

/**
 * T2-3 : le filet best-effort de la success-page (`reconciliationFailed`)
 * était catché et affiché à l'utilisateur, mais jamais remonté ops — silence
 * relevé au premortem. On vérifie ici que l'échec émet
 * `payment_reconciliation_failed` (distinctId = userId session), qu'un
 * succès n'émet RIEN, et que le rendu utilisateur existant (le `role="alert"`)
 * reste inchangé.
 */

const getSessionMock = vi.fn();
const queryMock = vi.fn();
const mutationMock = vi.fn();
const retrieveSessionStatusMock = vi.fn();
const captureServerMock = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  getSession: () => getSessionMock(),
}));

vi.mock('@/lib/auth/convex-server', () => ({
  getConvexServerClient: () => ({ query: queryMock, mutation: mutationMock }),
  convexApi: {
    getEventById: 'events:getById',
    currentUser: 'auth:currentUser',
    markPaymentSucceeded: 'payments:markSucceeded',
  },
}));

vi.mock('@/lib/payments', () => ({
  getPaymentDriver: () => ({ retrieveSessionStatus: retrieveSessionStatusMock }),
}));

// PAS d'`importOriginal()` : `posthog-server.ts` importe `server-only`, dont
// la résolution échoue sous jsdom. `EVENTS` vient du module pur. La page est
// importée STATIQUEMENT plus bas (comme `billing-page.test.tsx`) : sa
// résolution (Phase 1 ESM) précède l'exécution du corps de CE fichier
// (Phase 2), donc `captureServerMock` — un `const` local — serait encore en
// TDZ si on le référençait en valeur directe ici. On le referme dans une
// closure (comme les autres mocks ci-dessus) pour ne le lire qu'à l'appel.
vi.mock('@/lib/analytics/posthog-server', () => ({
  captureServer: (...args: Parameters<typeof captureServerMock>) => captureServerMock(...args),
  EVENTS,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  setRequestLocale: () => {},
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND_CALLED');
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  redirect: () => {
    throw new Error('REDIRECT_CALLED');
  },
}));

vi.mock('@/components/app/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

import UpgradeSuccessPage from '@/app/[locale]/(app)/events/[eventId]/upgrade/success/page';

afterEach(() => {
  getSessionMock.mockReset();
  queryMock.mockReset();
  mutationMock.mockReset();
  retrieveSessionStatusMock.mockReset();
  captureServerMock.mockReset();
  vi.unstubAllEnvs();
  delete process.env.CONVEX_WEBHOOK_SECRET;
});

const baseSession = { userId: 'usr_1', issuedAt: 0 };

function mockConvexQueries(event: { _id: string; planTier?: string }) {
  queryMock.mockImplementation((ref: string) => {
    if (ref === 'events:getById') return Promise.resolve(event);
    if (ref === 'auth:currentUser') return Promise.resolve({ fullName: 'Awa Diop' });
    return Promise.resolve(null);
  });
}

describe('UpgradeSuccessPage — alerte réconciliation (T2-3)', () => {
  it('émet payment_reconciliation_failed (distinctId = userId session) quand le filet best-effort échoue', async () => {
    getSessionMock.mockResolvedValue(baseSession);
    mockConvexQueries({ _id: 'ev_1', planTier: undefined });
    retrieveSessionStatusMock.mockRejectedValue(new Error('STRIPE_UNAVAILABLE'));

    const ui = await UpgradeSuccessPage({
      params: Promise.resolve({ locale: 'fr', eventId: 'ev_1' }),
      searchParams: Promise.resolve({ session_id: 'sess_1', provider: 'stripe' }),
    });
    render(ui);

    expect(captureServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: 'usr_1',
        event: 'payment_reconciliation_failed',
        properties: expect.objectContaining({
          event_id: 'ev_1',
          provider: 'stripe',
          session_id: 'sess_1',
          message: 'STRIPE_UNAVAILABLE',
        }),
      }),
    );
    // Rendu utilisateur inchangé : l'alerte reste affichée.
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // La vérification Stripe a échoué avant tout marquage — aucune mutation forgée.
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it('AUCUNE alerte quand la réconciliation réussit (chemin heureux inchangé)', async () => {
    getSessionMock.mockResolvedValue(baseSession);
    mockConvexQueries({ _id: 'ev_1', planTier: 'essential' });
    retrieveSessionStatusMock.mockResolvedValue({
      paid: true,
      providerSessionId: 'sess_1',
      providerEventId: 'sess_1',
      amountMinor: 2900,
      currency: 'EUR',
    });
    mutationMock.mockResolvedValue({ ok: true, alreadyApplied: false });
    vi.stubEnv('CONVEX_WEBHOOK_SECRET', 'secret');

    const ui = await UpgradeSuccessPage({
      params: Promise.resolve({ locale: 'fr', eventId: 'ev_1' }),
      searchParams: Promise.resolve({ session_id: 'sess_1', provider: 'stripe' }),
    });
    render(ui);

    expect(captureServerMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it("sans session_id (pas de retour Stripe), n'appelle ni Stripe ni l'alerte", async () => {
    getSessionMock.mockResolvedValue(baseSession);
    mockConvexQueries({ _id: 'ev_1', planTier: 'essential' });

    const ui = await UpgradeSuccessPage({
      params: Promise.resolve({ locale: 'fr', eventId: 'ev_1' }),
      searchParams: Promise.resolve({}),
    });
    render(ui);

    expect(retrieveSessionStatusMock).not.toHaveBeenCalled();
    expect(captureServerMock).not.toHaveBeenCalled();
  });
});
