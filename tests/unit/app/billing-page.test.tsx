import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const getSessionMock = vi.fn();
const queryMock = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- mock signature must accept arg
const redirectMock = vi.fn((_target: unknown) => {
  throw new Error('REDIRECT_THROWN');
});

vi.mock('@/lib/auth/session', () => ({
  getSession: () => getSessionMock(),
}));

vi.mock('@/lib/auth/convex-server', () => ({
  getConvexServerClient: () => ({ query: queryMock }),
  convexApi: {
    myOrganization: 'organizations:myOrganization',
    currentUser: 'auth:currentUser',
    getPaygCreditsByOrganization: 'paygPurchases:getCreditsByOrganization',
    listPaygPurchasesByOrganization: 'paygPurchases:listByOrganization',
  },
}));

vi.mock('next/navigation', () => ({
  redirect: (target: unknown) => redirectMock(target),
}));

vi.mock('@/components/pro/pro-shell', () => ({
  ProShell: ({ children }: React.PropsWithChildren) => (
    <div data-testid="pro-shell">{children}</div>
  ),
  ProNav: () => <nav data-testid="pro-nav" />,
}));

// L'import des server actions de la page n'est utilisé qu'en `<form action={…}>`,
// jamais appelé pendant le rendu — on retourne des stubs pour éviter qu'un
// effet secondaire (ex: `getStripeDriver()`) explose.
vi.mock('@/app/[locale]/(app)/pro/billing/actions', () => ({
  subscribeAction: async () => undefined,
  openBillingPortalAction: async () => undefined,
  payAsYouGoAction: async () => undefined,
}));

import ProBillingPage from '@/app/[locale]/(app)/pro/billing/page';

const baseOrg = {
  _id: 'org_1',
  name: 'Studio Lumière',
  slug: 'studio-lumiere',
  logoUrl: null,
  myRole: 'owner' as const,
};

const baseSession = { userId: 'usr_owner', issuedAt: 0 };

beforeEach(() => {
  getSessionMock.mockReset();
  queryMock.mockReset();
  redirectMock.mockClear();
});

const searchParams = () => Promise.resolve({});

describe('ProBillingPage — PAYG history', () => {
  it('shows the empty state when no PAYG purchases exist', async () => {
    getSessionMock.mockResolvedValue(baseSession);
    queryMock.mockImplementation((ref: string) => {
      if (ref === 'organizations:myOrganization') return Promise.resolve(baseOrg);
      if (ref === 'auth:currentUser') return Promise.resolve({ fullName: 'Awa Diop' });
      if (ref === 'paygPurchases:getCreditsByOrganization') return Promise.resolve({ credits: 0 });
      if (ref === 'paygPurchases:listByOrganization') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const ui = await ProBillingPage({ searchParams: searchParams() });
    render(ui);

    expect(screen.getByTestId('payg-history')).toBeInTheDocument();
    expect(screen.getByTestId('payg-history-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('payg-history-table')).not.toBeInTheDocument();
  });

  it('renders one row per PAYG purchase with formatted amount, currency and truncated session id', async () => {
    getSessionMock.mockResolvedValue(baseSession);
    queryMock.mockImplementation((ref: string) => {
      if (ref === 'organizations:myOrganization') return Promise.resolve(baseOrg);
      if (ref === 'auth:currentUser') return Promise.resolve({ fullName: 'Awa Diop' });
      if (ref === 'paygPurchases:getCreditsByOrganization') return Promise.resolve({ credits: 2 });
      if (ref === 'paygPurchases:listByOrganization') {
        return Promise.resolve([
          {
            _id: 'payg_1',
            amountMinor: 6900,
            currency: 'EUR',
            stripeSessionId: 'cs_test_a1b2c3d4e5f6g7h8i9j0',
            createdAt: new Date('2026-04-15T12:00:00Z').getTime(),
          },
          {
            _id: 'payg_2',
            amountMinor: 6900,
            currency: 'EUR',
            stripeSessionId: 'cs_test_short',
            createdAt: new Date('2026-04-01T10:00:00Z').getTime(),
          },
        ]);
      }
      return Promise.resolve(null);
    });

    const ui = await ProBillingPage({ searchParams: searchParams() });
    render(ui);

    const rows = screen.getAllByTestId('payg-history-row');
    expect(rows).toHaveLength(2);

    // Le montant est formaté en FR avec devise EUR.
    expect(screen.getAllByText(/69,00\s?€/).length).toBeGreaterThan(0);
    // L'ID transaction longue est tronqué + le tooltip (title) garde la valeur full.
    const longId = screen.getByTitle('cs_test_a1b2c3d4e5f6g7h8i9j0');
    expect(longId.textContent).toContain('…');
    // L'ID court (≤ 18 chars) reste intact.
    expect(screen.getByTitle('cs_test_short').textContent).toBe('cs_test_short');
  });
});
