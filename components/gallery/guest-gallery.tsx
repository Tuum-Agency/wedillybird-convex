'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoUploader } from './photo-uploader';
import { FaceSearchModal } from './face-search-modal';
import {
  createGuestUploadUrlAction,
  confirmGuestUploadAction,
  faceSearchGuestAction,
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

/** Fenêtre de polling après upload pour qu'un invité voie sa photo apparaître
 * dès la fin de la modération Rekognition (en moyenne 2-5s, jusqu'à 30s en
 * pire cas). Au-delà, on stoppe pour éviter un poll permanent inutile sur la
 * page galerie publique. */
const RECENT_UPLOAD_WINDOW_MS = 30 * 1000;
const POLL_INTERVAL_MS = 5 * 1000;

export function GuestGallery({ token, inviteeName, initialPhotos }: Props) {
  const t = useTranslations('Gallery');
  const router = useRouter();
  const [faceSearchOpen, setFaceSearchOpen] = useState(false);
  const [faceMatchedIds, setFaceMatchedIds] = useState<string[] | null>(null);
  // Timestamp du dernier upload guest. Quand non-null, on poll toutes les 5s
  // jusqu'à expiration de la fenêtre de modération. La query côté Convex ne
  // retourne que les photos `approved`, donc le polling fait apparaître la
  // photo du guest dès que Rekognition a validé.
  const [lastUploadAt, setLastUploadAt] = useState<number | null>(null);

  useEffect(() => {
    if (lastUploadAt === null) return;
    const elapsed = Date.now() - lastUploadAt;
    if (elapsed >= RECENT_UPLOAD_WINDOW_MS) {
      setLastUploadAt(null);
      return;
    }
    const interval = window.setInterval(() => {
      router.refresh();
      // Stoppe le polling quand la fenêtre est écoulée — sans attendre le
      // prochain tick — pour éviter un refresh inutile en bord de fenêtre.
      if (Date.now() - lastUploadAt >= RECENT_UPLOAD_WINDOW_MS) {
        setLastUploadAt(null);
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [lastUploadAt, router]);

  const filtered = useMemo(() => {
    if (faceMatchedIds === null) return initialPhotos;
    const set = new Set(faceMatchedIds);
    return initialPhotos.filter((p) => set.has(p._id));
  }, [initialPhotos, faceMatchedIds]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[color:var(--color-muted)]">{t('guestIntro')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => setFaceSearchOpen(true)}
            data-testid="face-search-trigger"
          >
            <ScanFace className="h-4 w-4" aria-hidden strokeWidth={1.75} />
            {t('faceSearch.triggerGuest')}
          </Button>
          {faceMatchedIds !== null ? (
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setFaceMatchedIds(null)}
              data-testid="face-search-clear"
            >
              {t('faceSearch.showAll')}
            </Button>
          ) : null}
          <PhotoUploader
            mode="guest"
            token={token}
            uploaderName={inviteeName}
            getUploadUrl={createGuestUploadUrlAction}
            confirm={confirmGuestUploadAction}
            onUploaded={() => {
              router.refresh();
              setLastUploadAt(Date.now());
            }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p
          className="rounded-xl border border-dashed border-[color:var(--color-border)] p-10 text-center text-sm text-[color:var(--color-muted)]"
          data-testid="gallery-empty"
        >
          {t('emptyGuest')}
        </p>
      ) : (
        <ul
          className="gap-3 [column-fill:_balance] columns-2 sm:columns-3 md:columns-4"
          data-testid="photo-grid"
        >
          {filtered.map((p) => (
            <li
              key={p._id}
              className="mb-3 flex break-inside-avoid flex-col overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
              data-testid="photo-card"
            >
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- Convex storage URLs are external; next/image requires remotePatterns config
                <img
                  src={p.url}
                  alt={p.uploaderName ?? ''}
                  loading="lazy"
                  width={p.width}
                  height={p.height}
                  className="h-auto w-full"
                />
              ) : (
                <div
                  className="w-full bg-[color:var(--color-ivory-100)]"
                  style={{ aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : '1 / 1' }}
                />
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

      <FaceSearchModal
        open={faceSearchOpen}
        onClose={() => setFaceSearchOpen(false)}
        onResult={(ids) => setFaceMatchedIds(ids)}
        search={(dataUrl) => faceSearchGuestAction(token, dataUrl)}
      />
    </div>
  );
}
