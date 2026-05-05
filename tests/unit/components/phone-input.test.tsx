import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (key: string) => key,
}));

import { PhoneInput } from '@/components/auth/phone-input';

describe('PhoneInput', () => {
  it('shows default +33 country label', () => {
    render(<PhoneInput />);
    expect(screen.getByText('+33')).toBeInTheDocument();
  });

  it('accepts a custom default country', () => {
    render(<PhoneInput defaultCountry="SN" />);
    expect(screen.getByText('+221')).toBeInTheDocument();
  });

  it('renders input with tel semantics', () => {
    render(<PhoneInput />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.type).toBe('tel');
    expect(input.getAttribute('inputmode')).toBe('tel');
    expect(input.autocomplete).toBe('tel-national');
  });

  it('allows typing and reflects value', async () => {
    const user = userEvent.setup();
    render(<PhoneInput />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, '612345678');
    expect(input.value).toBe('612345678');
  });

  it('combines country code with local number in hidden input', async () => {
    const user = userEvent.setup();
    const { container } = render(<PhoneInput name="phone" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, '612345678');
    const hidden = container.querySelector(
      'input[type="hidden"][name="phone"]',
    ) as HTMLInputElement;
    expect(hidden.value).toBe('+33612345678');
  });

  it('strips leading zero from local number', async () => {
    const user = userEvent.setup();
    const { container } = render(<PhoneInput name="phone" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, '0612345678');
    const hidden = container.querySelector(
      'input[type="hidden"][name="phone"]',
    ) as HTMLInputElement;
    expect(hidden.value).toBe('+33612345678');
  });

  it('updates hidden phone when country changes', async () => {
    const user = userEvent.setup();
    const { container } = render(<PhoneInput name="phone" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, '612345678');
    const select = screen.getByLabelText('countryCodeLabel') as HTMLSelectElement;
    await user.selectOptions(select, 'SN');
    const hidden = container.querySelector(
      'input[type="hidden"][name="phone"]',
    ) as HTMLInputElement;
    expect(hidden.value).toBe('+221612345678');
  });

  it('displays an error message with aria-invalid', () => {
    render(<PhoneInput error="Invalide" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Invalide')).toBeInTheDocument();
  });
});
