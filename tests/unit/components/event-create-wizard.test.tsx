import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createEventActionMock = vi.fn();

vi.mock('@/app/[locale]/(app)/events/actions', () => ({
  createEventAction: (formData: FormData) => createEventActionMock(formData),
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => `${namespace ?? 'T'}.${key}`,
}));

import { EventCreateWizard } from '@/components/events/event-create-wizard';

beforeEach(() => {
  createEventActionMock.mockReset();
});

function futureLocalDatetime(offsetMs: number): string {
  const d = new Date(Date.now() + offsetMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

describe('EventCreateWizard', () => {
  it('starts on step 1 (couple info)', () => {
    render(<EventCreateWizard />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('stepCouple');
  });

  it('disables Next until title and partners are filled', async () => {
    const user = userEvent.setup();
    render(<EventCreateWizard />);
    const next = screen.getByRole('button', { name: 'EventCreate.next' });
    expect(next).toBeDisabled();

    await user.type(screen.getByLabelText('EventCreate.titleLabel'), 'Mariage F & A');
    await user.type(screen.getByLabelText('EventCreate.partnerALabel'), 'Fatou');
    await user.type(screen.getByLabelText('EventCreate.partnerBLabel'), 'Amadou');
    expect(next).toBeEnabled();
  });

  it('advances through 4 steps and submits with a FormData payload', async () => {
    createEventActionMock.mockResolvedValue({ ok: true, slug: 'fatou-amadou' });
    const user = userEvent.setup();
    render(<EventCreateWizard />);

    await user.type(screen.getByLabelText('EventCreate.titleLabel'), 'Mariage F & A');
    await user.type(screen.getByLabelText('EventCreate.partnerALabel'), 'Fatou');
    await user.type(screen.getByLabelText('EventCreate.partnerBLabel'), 'Amadou');
    await user.click(screen.getByRole('button', { name: 'EventCreate.next' }));

    const dateInput = screen.getByLabelText('EventCreate.dateLabel') as HTMLInputElement;
    const future = futureLocalDatetime(3 * 24 * 60 * 60 * 1000);
    fireEvent.change(dateInput, { target: { value: future } });
    await user.click(screen.getByRole('button', { name: 'EventCreate.next' }));

    await user.click(screen.getByRole('button', { name: 'EventCreate.next' }));

    await user.click(screen.getByRole('button', { name: 'EventCreate.submit' }));

    expect(createEventActionMock).toHaveBeenCalledTimes(1);
    const fd = createEventActionMock.mock.calls[0]![0] as FormData;
    expect(fd.get('title')).toBe('Mariage F & A');
    expect(fd.get('partnerA')).toBe('Fatou');
    expect(fd.get('partnerB')).toBe('Amadou');
    expect(fd.get('timezone')).toBeTruthy();
    expect(fd.get('eventDate')).toBeTruthy();
  });

  it('surfaces server-side field errors and jumps back to step 1', async () => {
    createEventActionMock.mockResolvedValue({
      ok: false,
      error: 'INVALID_INPUT',
      fieldErrors: { title: ['Titre trop court'] },
    });
    const user = userEvent.setup();
    render(<EventCreateWizard />);

    await user.type(screen.getByLabelText('EventCreate.titleLabel'), 'Mariage F & A');
    await user.type(screen.getByLabelText('EventCreate.partnerALabel'), 'Fatou');
    await user.type(screen.getByLabelText('EventCreate.partnerBLabel'), 'Amadou');
    await user.click(screen.getByRole('button', { name: 'EventCreate.next' }));

    const dateInput = screen.getByLabelText('EventCreate.dateLabel') as HTMLInputElement;
    const future = futureLocalDatetime(3 * 24 * 60 * 60 * 1000);
    fireEvent.change(dateInput, { target: { value: future } });
    await user.click(screen.getByRole('button', { name: 'EventCreate.next' }));
    await user.click(screen.getByRole('button', { name: 'EventCreate.next' }));

    await user.click(screen.getByRole('button', { name: 'EventCreate.submit' }));

    // Should show field error text and rewind to step 1 (couple header visible)
    expect(await screen.findByText('Titre trop court')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('stepCouple');
  });
});
