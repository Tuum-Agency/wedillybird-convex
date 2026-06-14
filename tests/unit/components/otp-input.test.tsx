import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import frMessages from '@/messages/fr.json';
import { OtpInput } from '@/components/auth/otp-input';

// `OtpInput` consomme `useTranslations('Auth')` ; on l'enveloppe du vrai provider
// chargé avec `messages/fr.json` pour fournir le contexte next-intl aux tests.
function renderOtp(props: ComponentProps<typeof OtpInput> = {}) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      <OtpInput {...props} />
    </NextIntlClientProvider>,
  );
}

function getCells() {
  return screen.getAllByRole('textbox') as HTMLInputElement[];
}

describe('OtpInput', () => {
  it('renders N cells (default 6)', () => {
    renderOtp();
    expect(getCells()).toHaveLength(6);
  });

  it('supports a custom length', () => {
    renderOtp({ length: 4 });
    expect(getCells()).toHaveLength(4);
  });

  it('focuses the first cell when autoFocus', () => {
    renderOtp();
    expect(getCells()[0]).toHaveFocus();
  });

  it('auto-advances focus after typing a digit', async () => {
    const user = userEvent.setup();
    renderOtp();
    const cells = getCells();
    await user.type(cells[0]!, '1');
    expect(cells[1]!).toHaveFocus();
  });

  it('goes back on backspace when empty', async () => {
    const user = userEvent.setup();
    renderOtp();
    const cells = getCells();
    await user.type(cells[0]!, '1');
    expect(cells[1]!).toHaveFocus();
    await user.keyboard('{Backspace}');
    expect(cells[0]!).toHaveFocus();
    expect(cells[0]!.value).toBe('');
  });

  it('supports arrow navigation', async () => {
    const user = userEvent.setup();
    renderOtp();
    const cells = getCells();
    cells[0]!.focus();
    await user.keyboard('{ArrowRight}');
    expect(cells[1]!).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(cells[0]!).toHaveFocus();
  });

  it('strips non-digits from typed input', async () => {
    const user = userEvent.setup();
    renderOtp();
    const cells = getCells();
    await user.type(cells[0]!, 'a');
    expect(cells[0]!.value).toBe('');
  });

  it('fills multiple cells on paste', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    renderOtp({ onComplete });
    const cells = getCells();
    cells[0]!.focus();
    await user.paste('123456');
    const values = getCells().map((c) => c.value);
    expect(values).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('exposes a hidden input with the aggregated value', async () => {
    const user = userEvent.setup();
    renderOtp({ name: 'code' });
    const cells = getCells();
    cells[0]!.focus();
    await user.paste('987654');
    const hidden = document.querySelector('input[name="code"][type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toBe('987654');
  });

  it('marks cells invalid and shows the error message', () => {
    renderOtp({ error: 'Code invalide' });
    for (const cell of getCells()) {
      expect(cell).toHaveAttribute('aria-invalid', 'true');
    }
    expect(screen.getByText('Code invalide')).toBeInTheDocument();
  });
});
