import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const getSessionMock = vi.fn();
const queryMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error('NOT_FOUND_THROWN');
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- mock signature must accept arg
const redirectMock = vi.fn((_target: unknown) => {
  throw new Error('REDIRECT_THROWN');
});
const setRequestLocaleMock = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  getSession: () => getSessionMock(),
}));

vi.mock('@/lib/auth/convex-server', () => ({
  // Jeton de session vérifié par Convex (remplace les anciens requesterId).
  sessionTokenArg: async () => 'test-session-token',
  optionalSessionTokenArg: async () => 'test-session-token',
  getConvexServerClient: () => ({ query: queryMock }),
  convexApi: {
    getEventById: 'events:getById',
    listPaymentsByEvent: 'payments:listByEvent',
    currentUser: 'auth:currentUser',
  },
}));

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  redirect: (target: unknown) => redirectMock(target),
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale: (loc: string) => setRequestLocaleMock(loc),
  getTranslations: async (namespace: string) => (key: string, vars?: Record<string, unknown>) => {
    if (vars && Object.keys(vars).length > 0) {
      return `${namespace}.${key}:${JSON.stringify(vars)}`;
    }
    return `${namespace}.${key}`;
  },
}));

vi.mock('@/components/app/app-shell', () => ({
  AppShell: ({ children }: React.PropsWithChildren) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

import EventInvoicePage from '@/app/[locale]/(app)/events/[eventId]/invoice/page';

beforeEach(() => {
  getSessionMock.mockReset();
  queryMock.mockReset();
  notFoundMock.mockClear();
  redirectMock.mockClear();
  setRequestLocaleMock.mockClear();
});

const params = (eventId = 'evt_1') => Promise.resolve({ locale: 'fr', eventId });

const baseEvent = {
  _id: 'evt_1',
  ownerId: 'usr_owner',
  coupleNames: { partnerA: 'Fatou', partnerB: 'Amadou' },
};

describe('EventInvoicePage', () => {
  it('redirects when no session', async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(EventInvoicePage({ params: params() })).rejects.toThrow('REDIRECT_THROWN');
    expect(redirectMock).toHaveBeenCalledWith({ href: '/sign-in', locale: 'fr' });
  });

  it('shows the empty state when no succeeded payments exist', async () => {
    getSessionMock.mockResolvedValue({ userId: 'usr_owner', issuedAt: 0 });
    queryMock.mockImplementation((ref: string) => {
      if (ref === 'events:getById') return Promise.resolve(baseEvent);
      if (ref === 'payments:listByEvent') return Promise.resolve([]);
      if (ref === 'auth:currentUser') return Promise.resolve({ fullName: 'Fatou Diop' });
      return Promise.resolve(null);
    });

    const ui = await EventInvoicePage({ params: params() });
    render(ui);

    expect(screen.getByTestId('invoice-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('invoice-list')).not.toBeInTheDocument();
  });

  it('renders one row per succeeded payment with a download link to the PDF', async () => {
    getSessionMock.mockResolvedValue({ userId: 'usr_owner', issuedAt: 0 });
    queryMock.mockImplementation((ref: string) => {
      if (ref === 'events:getById') return Promise.resolve(baseEvent);
      if (ref === 'payments:listByEvent') {
        return Promise.resolve([
          {
            _id: 'pay_1',
            plan: 'essential',
            currency: 'EUR',
            amountMinor: 1900,
            provider: 'stripe',
            status: 'succeeded',
            createdAt: new Date('2026-04-01T10:00:00Z').getTime(),
          },
          {
            _id: 'pay_2',
            plan: 'premium',
            currency: 'EUR',
            amountMinor: 4900,
            provider: 'stripe',
            status: 'succeeded',
            createdAt: new Date('2026-04-15T12:00:00Z').getTime(),
          },
          // Cancelled / pending payments must be filtered out.
          {
            _id: 'pay_pending',
            plan: 'essential',
            currency: 'EUR',
            amountMinor: 1900,
            provider: 'stripe',
            status: 'pending',
            createdAt: Date.now(),
          },
        ]);
      }
      if (ref === 'auth:currentUser') return Promise.resolve({ fullName: 'Fatou Diop' });
      return Promise.resolve(null);
    });

    const ui = await EventInvoicePage({ params: params() });
    render(ui);

    const rows = screen.getAllByTestId('invoice-row');
    expect(rows).toHaveLength(2);

    // Each row exposes a download link pointing at the PDF route.
    const firstRow = rows[0]!;
    const secondRow = rows[1]!;
    const link1 = within(firstRow).getByTestId('invoice-download') as HTMLAnchorElement;
    expect(link1).toHaveAttribute('href', '/api/payments/pay_1/invoice.pdf');
    expect(link1).toHaveAttribute('download');

    const link2 = within(secondRow).getByTestId('invoice-download') as HTMLAnchorElement;
    expect(link2).toHaveAttribute('href', '/api/payments/pay_2/invoice.pdf');
  });

  it('calls notFound() when the event is missing', async () => {
    getSessionMock.mockResolvedValue({ userId: 'usr_owner', issuedAt: 0 });
    queryMock.mockImplementation((ref: string) => {
      if (ref === 'events:getById') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    await expect(EventInvoicePage({ params: params() })).rejects.toThrow('NOT_FOUND_THROWN');
    expect(notFoundMock).toHaveBeenCalled();
  });
});
