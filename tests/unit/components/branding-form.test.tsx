import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const updateBrandingMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('@/app/[locale]/(app)/pro/actions', () => ({
  updateOrgBrandingAction: (formData: FormData) => updateBrandingMock(formData),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `Branding.${key}`,
}));

import { BrandingForm } from '@/components/pro/branding-form';

beforeEach(() => {
  updateBrandingMock.mockReset();
  refreshMock.mockReset();
  // jsdom-friendly stubs for Object URL APIs that are used by the live preview.
  if (typeof URL.createObjectURL !== 'function') {
    URL.createObjectURL = vi.fn(() => 'blob:preview-1');
    URL.revokeObjectURL = vi.fn();
  } else {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview-1');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  }
});

function renderForm(props?: Partial<React.ComponentProps<typeof BrandingForm>>) {
  return render(
    <BrandingForm
      initialLogoUrl={null}
      initialPrimaryColor="#2c1a11"
      initialAccentColor="#c8a165"
      {...props}
    />,
  );
}

describe('BrandingForm', () => {
  it('renders preview placeholder when no initial logo and no pending file', () => {
    renderForm();
    const preview = screen.getByTestId('branding-logo-preview');
    expect(preview).toBeInTheDocument();
    // No <img> rendered — placeholder text only.
    expect(preview.querySelector('img')).toBeNull();
  });

  it('shows live preview after picking a file', async () => {
    const user = userEvent.setup();
    renderForm();
    const input = screen.getByTestId('branding-logo-input') as HTMLInputElement;
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    await user.upload(input, file);

    await waitFor(() => {
      const img = screen
        .getByTestId('branding-logo-preview')
        .querySelector('img') as HTMLImageElement | null;
      expect(img).not.toBeNull();
      expect(img!.src).toContain('blob:preview-1');
    });
  });

  it('blocks submit when hex value is invalid', async () => {
    const user = userEvent.setup();
    renderForm();

    const hexInput = screen.getByTestId('branding-primary-hex') as HTMLInputElement;
    await user.clear(hexInput);
    await user.type(hexInput, 'not-a-hex');

    await user.click(screen.getByTestId('branding-submit'));

    expect(updateBrandingMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('branding-error')).toHaveTextContent('Branding.errors.invalid_color');
  });

  it('submits the form, calls the action and refreshes router on success', async () => {
    updateBrandingMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByTestId('branding-submit'));

    await waitFor(() => expect(updateBrandingMock).toHaveBeenCalledTimes(1));
    const firstCall = updateBrandingMock.mock.calls[0]!;
    const formData = firstCall[0] as FormData;
    expect(formData.get('primaryColor')).toBe('#2c1a11');
    expect(formData.get('accentColor')).toBe('#c8a165');

    await waitFor(() =>
      expect(screen.getByTestId('branding-success')).toHaveTextContent('Branding.saveSuccess'),
    );
    expect(refreshMock).toHaveBeenCalled();
  });

  it('surfaces the error key when the action fails', async () => {
    updateBrandingMock.mockResolvedValue({ ok: false, error: 'INVALID_LOGO_SIZE' });
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByTestId('branding-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('branding-error')).toHaveTextContent(
        'Branding.errors.invalid_logo_size',
      ),
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('toggles the remove flag and hides the preview when removing logo', async () => {
    const user = userEvent.setup();
    renderForm({ initialLogoUrl: 'https://cdn/logo.png' });

    expect(screen.getByTestId('branding-logo-preview').querySelector('img')).not.toBeNull();

    await user.click(screen.getByTestId('branding-remove-logo'));

    expect(screen.getByTestId('branding-logo-preview').querySelector('img')).toBeNull();

    updateBrandingMock.mockResolvedValue({ ok: true });
    await user.click(screen.getByTestId('branding-submit'));

    await waitFor(() => expect(updateBrandingMock).toHaveBeenCalledTimes(1));
    const removeCall = updateBrandingMock.mock.calls[0]!;
    const formData = removeCall[0] as FormData;
    expect(formData.get('removeLogo')).toBe('true');
  });
});
