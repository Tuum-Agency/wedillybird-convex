import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/app/[locale]/(app)/events/[eventId]/gallery/actions', () => ({
  createOwnerUploadUrlAction: vi.fn(),
  confirmOwnerUploadAction: vi.fn(),
  moderatePhotoAction: vi.fn(),
  removePhotoAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'fr',
}));

import { OwnerGallery, type OwnerPhotoItem } from '@/components/gallery/owner-gallery';

beforeEach(() => {
  vi.clearAllMocks();
});

function makePhoto(overrides: Partial<OwnerPhotoItem> = {}): OwnerPhotoItem {
  return {
    _id: 'photo_a',
    url: 'https://media.example/a.jpg',
    status: 'approved',
    contentType: 'image/jpeg',
    sizeBytes: 1234,
    createdAt: 1,
    ...overrides,
  };
}

describe('OwnerGallery — download all', () => {
  it('renders the disabled placeholder when there are no approved photos', () => {
    render(<OwnerGallery eventId="evt_1" initialPhotos={[]} />);

    const disabled = screen.getByTestId('download-all-disabled');
    expect(disabled).toBeInTheDocument();
    expect(disabled).toHaveAttribute('aria-disabled', 'true');
    expect(disabled).toHaveAttribute('title', 'downloadEmpty');
    expect(screen.queryByTestId('download-all')).toBeNull();
  });

  it('renders an enabled link to the ZIP route when at least one photo is approved', () => {
    render(<OwnerGallery eventId="evt_42" initialPhotos={[makePhoto()]} />);

    const link = screen.getByTestId('download-all');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/fr/events/evt_42/gallery/download-zip');
    expect(link).toHaveAttribute('download');
    expect(screen.queryByTestId('download-all-disabled')).toBeNull();
  });

  it('keeps the placeholder when every photo is pending or rejected', () => {
    render(
      <OwnerGallery
        eventId="evt_2"
        initialPhotos={[
          makePhoto({ _id: 'a', status: 'pending' }),
          makePhoto({ _id: 'b', status: 'rejected' }),
        ]}
      />,
    );

    expect(screen.getByTestId('download-all-disabled')).toBeInTheDocument();
    expect(screen.queryByTestId('download-all')).toBeNull();
  });

  it('renders a per-photo download link pointing at the proxy route', () => {
    render(<OwnerGallery eventId="evt_3" initialPhotos={[makePhoto({ _id: 'photo_z' })]} />);

    const links = screen.getAllByTestId('download-one');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      'href',
      '/fr/events/evt_3/gallery/photos/photo_z/download',
    );
    expect(links[0]).toHaveAttribute('download');
  });
});
