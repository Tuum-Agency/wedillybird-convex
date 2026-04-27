import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const fetchMock = vi.fn();
const assignMock = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) => {
    if (vars) {
      const parts = Object.entries(vars).map(([k, v]) => `${k}=${String(v)}`);
      return `${key}(${parts.join(',')})`;
    }
    return key;
  },
}));

import { UpgradeCard } from '@/components/payments/upgrade-card';

beforeEach(() => {
  fetchMock.mockReset();
  assignMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign: assignMock, href: 'http://test/', origin: 'http://test' },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UpgradeCard', () => {
  it('shows essential + premium when current tier is free', () => {
    render(<UpgradeCard eventId="evt_1" currentTier={undefined} currency="EUR" />);
    expect(screen.getByTestId('upgrade-plan-essential')).toBeInTheDocument();
    expect(screen.getByTestId('upgrade-plan-premium')).toBeInTheDocument();
  });

  it('shows only premium upgrade when current tier is essential', () => {
    render(<UpgradeCard eventId="evt_1" currentTier="essential" currency="EUR" />);
    expect(screen.queryByTestId('upgrade-plan-essential')).not.toBeInTheDocument();
    expect(screen.getByTestId('upgrade-plan-premium')).toBeInTheDocument();
  });

  it('shows premium-already message when current tier is premium', () => {
    render(<UpgradeCard eventId="evt_1" currentTier="premium" currency="EUR" />);
    expect(screen.queryByTestId('upgrade-card')).not.toBeInTheDocument();
    expect(screen.getByText(/alreadyPremium/)).toBeInTheDocument();
  });

  it('POSTs to /api/checkout and redirects on success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ redirectUrl: '/api/checkout/mock?x=1' }),
    });
    const user = userEvent.setup();

    render(<UpgradeCard eventId="evt_1" currentTier={undefined} currency="EUR" />);
    await user.click(screen.getByTestId('upgrade-cta-essential'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/checkout', expect.any(Object)),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body).toEqual({ eventId: 'evt_1', plan: 'essential', currency: 'EUR' });

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('/api/checkout/mock?x=1'));
  });

  it('renders an error when /api/checkout responds non-ok', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'FORBIDDEN' }),
    });
    const user = userEvent.setup();

    render(<UpgradeCard eventId="evt_1" currentTier={undefined} currency="EUR" />);
    await user.click(screen.getByTestId('upgrade-cta-premium'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/forbidden/);
    expect(assignMock).not.toHaveBeenCalled();
  });
});
