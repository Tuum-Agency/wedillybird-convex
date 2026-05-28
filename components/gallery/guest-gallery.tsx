'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ScanFace } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  /**
   * Variantes WebP (thumb/medium/large) pour servir des images légères côté
   * mobile invité. Fallback sur `url` si absentes.
   */
  variants?: { thumb?: string; medium?: string; large?: string };
  /**
   * `pending` n'apparaît que pour les photos uploadées par CET invité — la
   * query Convex filtre `uploadedByGuestToken === token` côté serveur pour
   * que les autres invités ne voient que les `approved`. Absent → ancien
   * format de réponse (avant déploiement Convex), on suppose `approved`.
   */
  status?: 'pending' | 'approved' | 'rejected';
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
    const remaining = RECENT_UPLOAD_WINDOW_MS - (Date.now() - lastUploadAt);
    if (remaining <= 0) {
      // Reset asynchrone via timer 0 pour ne pas appeler setState dans le
      // body de l'effect (cascading renders).
      const t = window.setTimeout(() => setLastUploadAt(null), 0);
      return () => window.clearTimeout(t);
    }
    const interval = window.setInterval(() => {
      router.refresh();
    }, POLL_INTERVAL_MS);
    const expiry = window.setTimeout(() => setLastUploadAt(null), remaining);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(expiry);
    };
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
          className="columns-2 gap-3 [column-fill:_balance] sm:columns-3 md:columns-4"
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
                  src={p.variants?.thumb ?? p.url}
                  alt={p.uploaderName ?? ''}
                  loading="lazy"
                  width={p.width}
                  height={p.height}
                  className="h-auto w-full"
                />
              ) : (
                <div
                  className="w-full bg-[color:var(--color-ivory-100)]"
                  style={{
                    aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : '1 / 1',
                  }}
                />
              )}
              <div className="flex items-center justify-between gap-2 px-2 pb-2">
                {p.uploaderName ? (
                  <span className="truncate text-xs text-[color:var(--color-muted)]">
                    {p.uploaderName}
                  </span>
                ) : (
                  <span />
                )}
                {p.status === 'pending' ? (
                  <Badge variant="primary" data-testid="guest-photo-pending">
                    {t('status.pending')}
                  </Badge>
                ) : null}
              </div>
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
