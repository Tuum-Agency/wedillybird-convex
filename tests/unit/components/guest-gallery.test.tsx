import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/app/[locale]/i/[token]/gallery/actions', () => ({
  createGuestUploadUrlAction: vi.fn(),
  confirmGuestUploadAction: vi.fn(),
  faceSearchGuestAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { GuestGallery, type GuestPhotoItem } from '@/components/gallery/guest-gallery';

beforeEach(() => {
  vi.clearAllMocks();
});

function makePhoto(overrides: Partial<GuestPhotoItem> = {}): GuestPhotoItem {
  return {
    _id: 'photo_a',
    url: 'https://media.example/a.jpg',
    createdAt: 1,
    ...overrides,
  };
}

describe('GuestGallery — pending badge', () => {
  it('affiche le badge "Vérification en cours" sur les photos pending de l\'invité', () => {
    render(
      <GuestGallery
        token="tok_123"
        inviteeName="Camille"
        initialPhotos={[makePhoto({ status: 'pending' })]}
      />,
    );

    const badge = screen.getByTestId('guest-photo-pending');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('status.pending');
  });

  it("n'affiche pas le badge sur les photos approved", () => {
    render(
      <GuestGallery
        token="tok_123"
        inviteeName="Camille"
        initialPhotos={[makePhoto({ status: 'approved' })]}
      />,
    );

    expect(screen.queryByTestId('guest-photo-pending')).toBeNull();
  });

  it("n'affiche pas le badge quand le status est absent (fallback ancien format)", () => {
    render(<GuestGallery token="tok_123" inviteeName="Camille" initialPhotos={[makePhoto()]} />);

    expect(screen.queryByTestId('guest-photo-pending')).toBeNull();
  });
});

describe('GuestGallery — reco-faciale opt-in (Lane T3, F7)', () => {
  it('masque le bouton "Find my photos" par défaut (faceSearchEnabled non fourni)', () => {
    render(<GuestGallery token="tok_123" inviteeName="Camille" initialPhotos={[]} />);
    expect(screen.queryByTestId('face-search-trigger')).toBeNull();
  });

  it('masque le bouton quand faceSearchEnabled=false', () => {
    render(
      <GuestGallery
        token="tok_123"
        inviteeName="Camille"
        initialPhotos={[]}
        faceSearchEnabled={false}
      />,
    );
    expect(screen.queryByTestId('face-search-trigger')).toBeNull();
  });

  it('affiche le bouton quand faceSearchEnabled=true', () => {
    render(
      <GuestGallery token="tok_123" inviteeName="Camille" initialPhotos={[]} faceSearchEnabled />,
    );
    expect(screen.getByTestId('face-search-trigger')).toBeInTheDocument();
  });
});
