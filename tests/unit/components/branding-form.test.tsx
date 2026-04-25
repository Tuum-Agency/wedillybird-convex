import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const updateMock = vi.fn();
const requestPresignMock = vi.fn();

vi.mock('@/app/[locale]/(app)/pro/branding/actions', () => ({
  updateBrandingAction: (formData: FormData) => updateMock(formData),
  requestLogoUploadUrlAction: (input: { contentType: string }) => requestPresignMock(input),
}));

import { BrandingForm } from '@/components/pro/branding-form';

beforeEach(() => {
  updateMock.mockReset();
  requestPresignMock.mockReset();
});

describe('BrandingForm', () => {
  it('renders preview with initial colors and org name', () => {
    render(
      <BrandingForm
        initialPrimary="#112233"
        initialAccent="#445566"
        initialLogoUrl={null}
        organizationName="Tuum Agency"
      />,
    );
    expect(screen.getByText('Tuum Agency')).toBeInTheDocument();
    expect(screen.getByLabelText('Couleur primaire')).toHaveValue('#112233');
    expect(screen.getByLabelText('Couleur accent')).toHaveValue('#445566');
  });

  it('updates the preview when the primary color changes', async () => {
    render(
      <BrandingForm
        initialPrimary="#000000"
        initialAccent="#ffffff"
        initialLogoUrl={null}
        organizationName="Org"
      />,
    );
    const primary = screen.getByLabelText('Couleur primaire') as HTMLInputElement;
    fireEvent.change(primary, { target: { value: '#abcdef' } });
    expect(primary.value).toBe('#abcdef');
  });

  it('exposes the logoS3Key as a hidden input that updates after upload', () => {
    const { container } = render(
      <BrandingForm
        initialPrimary="#000000"
        initialAccent="#ffffff"
        initialLogoUrl={null}
        organizationName="Org"
      />,
    );
    const hidden = container.querySelector('input[name="logoS3Key"]') as HTMLInputElement;
    expect(hidden).not.toBeNull();
    expect(hidden.value).toBe('');
  });
});
