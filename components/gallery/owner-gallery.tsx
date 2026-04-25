'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhotoUploader } from './photo-uploader';
import {
  createOwnerUploadUrlAction,
  confirmOwnerUploadAction,
  moderatePhotoAction,
  removePhotoAction,
} from '@/app/[locale]/(app)/events/[eventId]/gallery/actions';

type Status = 'pending' | 'approved' | 'rejected';

export interface OwnerPhotoItem {
  _id: string;
  url: string | null;
  status: Status;
  uploaderName?: string;
  uploadedByGuestToken?: boolean;
  width?: number;
  height?: number;
  sizeBytes: number;
  contentType: string;
  createdAt: number;
}

interface Props {
  eventId: string;
  initialPhotos: OwnerPhotoItem[];
}

const FILTERS = ['all', 'pending', 'approved', 'rejected'] as const;

export function OwnerGallery({ eventId, initialPhotos }: Props) {
  const t = useTranslations('Gallery');
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (filter === 'all') return initialPhotos;
    return initialPhotos.filter((p) => p.status === filter);
  }, [filter, initialPhotos]);

  const counts = useMemo(
    () => ({
      all: initialPhotos.length,
      pending: initialPhotos.filter((p) => p.status === 'pending').length,
      approved: initialPhotos.filter((p) => p.status === 'approved').length,
      rejected: initialPhotos.filter((p) => p.status === 'rejected').length,
    }),
    [initialPhotos],
  );

  function runDecision(photoId: string, decision: 'approved' | 'rejected') {
    startTransition(async () => {
      const result = await moderatePhotoAction(eventId, photoId, decision);
      if (result.ok) router.refresh();
    });
  }

  function runRemove(photoId: string) {
    startTransition(async () => {
      const result = await removePhotoAction(eventId, photoId);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`focus-ring rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-white'
                  : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)]'
              }`}
              data-testid={`filter-${f}`}
            >
              {t(`filters.${f}`)} · {counts[f]}
            </button>
          ))}
        </div>
        <PhotoUploader
          mode="owner"
          eventId={eventId}
          getUploadUrl={createOwnerUploadUrlAction}
          confirm={confirmOwnerUploadAction}
          onUploaded={() => router.refresh()}
        />
      </div>

      {filtered.length === 0 ? (
        <p
          className="rounded-xl border border-dashed border-[color:var(--color-border)] p-10 text-center text-sm text-[color:var(--color-muted)]"
          data-testid="gallery-empty"
        >
          {t('empty')}
        </p>
      ) : (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
          data-testid="photo-grid"
        >
          {filtered.map((p) => (
            <li
              key={p._id}
              className="flex flex-col gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2"
              data-testid="photo-card"
              data-status={p.status}
            >
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- Convex storage URLs are external; next/image requires remotePatterns config
                <img
                  src={p.url}
                  alt={p.uploaderName ?? ''}
                  loading="lazy"
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ) : (
                <div className="aspect-square w-full rounded-lg bg-[color:var(--color-ivory-100)]" />
              )}
              <div className="flex items-center justify-between gap-2 text-xs">
                <Badge variant={statusVariant(p.status)}>{t(`status.${p.status}`)}</Badge>
                {p.uploaderName ? (
                  <span className="truncate text-[color:var(--color-muted)]">{p.uploaderName}</span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1">
                {p.status !== 'approved' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => runDecision(p._id, 'approved')}
                    disabled={pending}
                    data-testid="approve"
                  >
                    {t('approve')}
                  </Button>
                ) : null}
                {p.status !== 'rejected' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => runDecision(p._id, 'rejected')}
                    disabled={pending}
                    data-testid="reject"
                  >
                    {t('reject')}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => runRemove(p._id)}
                  disabled={pending}
                  data-testid="remove"
                >
                  {t('remove')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function statusVariant(status: Status): 'accent' | 'primary' | 'destructive' {
  if (status === 'approved') return 'accent';
  if (status === 'pending') return 'primary';
  return 'destructive';
}
