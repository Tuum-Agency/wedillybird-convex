import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const submitRsvpActionMock = vi.fn();

vi.mock('@/app/[locale]/i/[token]/actions', () => ({
  submitRsvpAction: (token: string, formData: FormData) => submitRsvpActionMock(token, formData),
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, vars?: Record<string, unknown>) => {
    if (vars && typeof vars === 'object') {
      const parts = Object.entries(vars).map(([k, v]) => `${k}=${String(v)}`);
      return `${namespace ?? 'T'}.${key}(${parts.join(',')})`;
    }
    return `${namespace ?? 'T'}.${key}`;
  },
}));

import { RsvpForm } from '@/components/invitee/rsvp-form';

const TOKEN = 'QR123';

beforeEach(() => {
  submitRsvpActionMock.mockReset();
});

describe('RsvpForm', () => {
  it('renders three status options and disables attending extras until chosen', () => {
    render(<RsvpForm token={TOKEN} plusOnesAllowed={2} initial={{ rsvpStatus: 'pending' }} />);
    expect(screen.getByTestId('rsvp-option-attending')).toBeInTheDocument();
    expect(screen.getByTestId('rsvp-option-declined')).toBeInTheDocument();
    expect(screen.getByTestId('rsvp-option-maybe')).toBeInTheDocument();
    expect(screen.queryByTestId('plus-one-0')).not.toBeInTheDocument();
  });

  it('shows plus-ones inputs when attending is picked', async () => {
    const user = userEvent.setup();
    render(<RsvpForm token={TOKEN} plusOnesAllowed={2} initial={{ rsvpStatus: 'pending' }} />);

    await user.click(screen.getByTestId('rsvp-option-attending'));
    expect(screen.getByTestId('plus-one-0')).toBeInTheDocument();
    expect(screen.getByTestId('plus-one-1')).toBeInTheDocument();
  });

  it('submits attending with plus-ones and dietary to the action', async () => {
    submitRsvpActionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RsvpForm token={TOKEN} plusOnesAllowed={2} initial={{ rsvpStatus: 'pending' }} />);

    await user.click(screen.getByTestId('rsvp-option-attending'));
    await user.type(screen.getByTestId('plus-one-0'), 'Awa');
    await user.type(screen.getByLabelText('Invitation.dietaryLabel'), 'Végétarien');
    await user.click(screen.getByTestId('submit-rsvp'));

    await waitFor(() => expect(submitRsvpActionMock).toHaveBeenCalledTimes(1));
    const [token, formData] = submitRsvpActionMock.mock.calls[0]!;
    expect(token).toBe(TOKEN);
    expect(formData.get('rsvpStatus')).toBe('attending');
    expect(formData.getAll('plusOnesNames')).toEqual(['Awa']);
    expect(formData.get('dietaryRestrictions')).toBe('Végétarien');

    await waitFor(() => expect(screen.getByTestId('rsvp-success')).toBeInTheDocument());
  });

  it('submits declined without plus-ones', async () => {
    submitRsvpActionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RsvpForm token={TOKEN} plusOnesAllowed={2} initial={{ rsvpStatus: 'pending' }} />);

    await user.click(screen.getByTestId('rsvp-option-declined'));
    expect(screen.queryByTestId('plus-one-0')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('submit-rsvp'));

    await waitFor(() => {
      expect(submitRsvpActionMock).toHaveBeenCalledTimes(1);
    });
    const [, formData] = submitRsvpActionMock.mock.calls[0]!;
    expect(formData.get('rsvpStatus')).toBe('declined');
    expect(formData.getAll('plusOnesNames')).toEqual([]);
  });

  it('blocks submit when no status picked', async () => {
    const user = userEvent.setup();
    render(<RsvpForm token={TOKEN} plusOnesAllowed={0} initial={{ rsvpStatus: 'pending' }} />);

    await user.click(screen.getByTestId('submit-rsvp'));
    expect(submitRsvpActionMock).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/pickStatus/);
  });

  it('shows success state on prefilled response and allows changing the answer', async () => {
    render(<RsvpForm token={TOKEN} plusOnesAllowed={0} initial={{ rsvpStatus: 'attending' }} />);
    expect(screen.getByTestId('rsvp-success')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByTestId('rsvp-change'));
    expect(screen.getByTestId('rsvp-form')).toBeInTheDocument();
  });

  it('renders server error when action returns EVENT_CLOSED', async () => {
    submitRsvpActionMock.mockResolvedValue({ ok: false, error: 'EVENT_CLOSED' });
    const user = userEvent.setup();
    render(<RsvpForm token={TOKEN} plusOnesAllowed={0} initial={{ rsvpStatus: 'pending' }} />);

    await user.click(screen.getByTestId('rsvp-option-maybe'));
    await user.click(screen.getByTestId('submit-rsvp'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/eventClosed/);
  });
});
