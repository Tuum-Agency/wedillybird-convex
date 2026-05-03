'use client';

import { Badge } from '@/components/ui/badge';
import { useServerAction } from '@/components/admin/use-admin-action';
import { adminModeratePhotoAction } from '@/app/[locale]/(app)/admin/actions';

type Photo = {
  _id: string;
  eventId: string;
  s3Key?: string;
  status: string;
  sizeBytes: number;
  contentType: string;
  uploaderName?: string;
  variants?: { thumb?: string; medium?: string; large?: string };
  createdAt: number;
};

type Template = {
  _id: string;
  eventId: string;
  name: string;
  bodyText: string;
  ctaLabel: string;
  status: string;
  rejectionReason?: string;
  submittedAt?: number;
  reviewedAt?: number;
  createdAt: number;
};

const TEMPLATE_STATUS_VARIANT: Record<string, 'neutral' | 'success' | 'warning' | 'destructive'> = {
  draft: 'neutral',
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
  paused: 'warning',
  disabled: 'destructive',
};

export function AdminModerationPanel({
  photos,
  templates,
}: {
  photos: Photo[];
  templates: Template[];
}) {
  return (
    <div className="flex flex-col gap-8">
      {/* Photos section */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg italic">Photos en attente ({photos.length})</h2>
        {photos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[color:var(--color-border)] px-6 py-10 text-center text-sm text-[color:var(--color-muted-foreground)]">
            Aucune photo en attente de modération
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((p) => (
              <PhotoCard key={p._id} photo={p} />
            ))}
          </div>
        )}
      </section>

      {/* Templates section */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg italic">Templates WhatsApp ({templates.length})</h2>
        <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
                <Th>Nom</Th>
                <Th>Corps</Th>
                <Th>CTA</Th>
                <Th>Statut</Th>
                <Th>Soumis le</Th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr
                  key={t._id}
                  className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-elevated)]/50"
                >
                  <td className="px-4 py-3 font-mono text-xs font-medium">{t.name}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-[color:var(--color-muted-foreground)]">
                    {t.bodyText}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
                    {t.ctaLabel}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={TEMPLATE_STATUS_VARIANT[t.status] ?? 'neutral'}>
                      {t.status}
                    </Badge>
                    {t.rejectionReason ? (
                      <p className="mt-1 text-xs text-red-400">{t.rejectionReason}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
                    {t.submittedAt
                      ? new Intl.DateTimeFormat('fr', { dateStyle: 'medium' }).format(
                          new Date(t.submittedAt),
                        )
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PhotoCard({ photo }: { photo: Photo }) {
  const { execute: moderate, loading } = useServerAction(adminModeratePhotoAction);

  const thumbUrl = photo.variants?.thumb ?? photo.variants?.medium;
  const sizeKb = Math.round(photo.sizeBytes / 1024);

  return (
    <div className="flex flex-col gap-3 overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      {thumbUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={thumbUrl}
          alt="Photo en attente"
          className="h-40 w-full rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg bg-[color:var(--color-surface-elevated)] text-xs text-[color:var(--color-muted-foreground)]">
          Pas d&apos;aperçu
        </div>
      )}
      <div className="flex flex-col gap-1 text-xs text-[color:var(--color-muted-foreground)]">
        <p>
          {photo.uploaderName ?? 'Anonyme'} · {sizeKb} Ko
        </p>
        <p>{photo.contentType}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => moderate(photo._id, 'approved')}
          disabled={loading}
          className="flex-1 rounded-lg bg-[color:var(--color-sage-100)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-sage-700)] transition-colors hover:bg-[color:var(--color-sage-100)]/80 disabled:opacity-50"
        >
          Approuver
        </button>
        <button
          onClick={() => moderate(photo._id, 'rejected')}
          disabled={loading}
          className="flex-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 transition-colors hover:bg-red-100/80 disabled:opacity-50"
        >
          Rejeter
        </button>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-muted-foreground)] uppercase">
      {children}
    </th>
  );
}
