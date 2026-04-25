'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PhotoUploader } from './photo-uploader';
import {
  createGuestUploadUrlAction,
  confirmGuestUploadAction,
} from '@/app/[locale]/i/[token]/gallery/actions';

export interface GuestPhotoItem {
  _id: string;
  url: string | null;
  uploaderName?: string;
  width?: number;
  height?: number;
  createdAt: number;
}

interface Props {
  token: string;
  inviteeName: string;
  initialPhotos: GuestPhotoItem[];
}

export function GuestGallery({ token, inviteeName, initialPhotos }: Props) {
  const t = useTranslations('Gallery');
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[color:var(--color-muted)]">{t('guestIntro')}</p>
        <PhotoUploader
          mode="guest"
          token={token}
          uploaderName={inviteeName}
          getUploadUrl={createGuestUploadUrlAction}
          confirm={confirmGuestUploadAction}
          onUploaded={() => router.refresh()}
        />
      </div>

      {initialPhotos.length === 0 ? (
        <p
          className="rounded-xl border border-dashed border-[color:var(--color-border)] p-10 text-center text-sm text-[color:var(--color-muted)]"
          data-testid="gallery-empty"
        >
          {t('emptyGuest')}
        </p>
      ) : (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
          data-testid="photo-grid"
        >
          {initialPhotos.map((p) => (
            <li
              key={p._id}
              className="flex flex-col gap-2 overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
              data-testid="photo-card"
            >
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- Convex storage URLs are external; next/image requires remotePatterns config
                <img
                  src={p.url}
                  alt={p.uploaderName ?? ''}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="aspect-square w-full bg-[color:var(--color-ivory-100)]" />
              )}
              {p.uploaderName ? (
                <p className="truncate px-2 pb-2 text-xs text-[color:var(--color-muted)]">
                  {p.uploaderName}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
