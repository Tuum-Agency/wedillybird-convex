import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { createZipStream, safeZipEntryName, type ZipStreamEntry } from '@/lib/photos/zip-stream';
import { canDownloadGalleryZip } from '@/lib/gallery/zip-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vercel Fluid Compute caps Next 16 routes at 300 s by default. We accept
// that limit for galleries up to ~1 000 photos; larger archives will need
// to be moved to a Lambda/Step Function (see BACKLOG.md).
export const maxDuration = 300;

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

interface ApprovedPhoto {
  _id: string;
  url: string | null;
  uploaderName?: string;
  contentType: string;
  createdAt: number;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ eventId: string; locale: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { eventId } = await ctx.params;
  const convex = getConvexServerClient();

  let event;
  try {
    event = await convex.query(convexApi.getEventById, {
      eventId,
      requesterId: session.userId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    if (message.includes('EVENT_NOT_FOUND')) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: 'UNKNOWN' }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  // Gate par formule : le téléchargement ZIP de la galerie est une feature
  // Premium (cf. PREMIUM_EXTRA_FEATURES dans lib/payments/plans.ts), aussi
  // débloquée par l'upsell HD post-event (+29 €) pour un Essentiel. Sans ce
  // check, l'archive serait accessible via l'URL directe alors que l'UI la
  // réserve à ces formules. Cohérent avec `eventHasFeature` côté Convex.
  if (!canDownloadGalleryZip(event)) {
    return NextResponse.json({ error: 'FEATURE_NOT_IN_PLAN' }, { status: 403 });
  }

  let photos: ApprovedPhoto[];
  try {
    const all = await convex.query(convexApi.listPhotosForOwner, {
      eventId,
      requesterId: session.userId,
      status: 'approved',
    });
    photos = all.flatMap((p) => {
      if (!p.url) return [];
      return [
        {
          _id: p._id,
          url: p.url,
          uploaderName: p.uploaderName,
          contentType: p.contentType,
          createdAt: p.createdAt,
        },
      ];
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    return NextResponse.json({ error: 'UNKNOWN' }, { status: 500 });
  }

  if (photos.length === 0) {
    return NextResponse.json({ error: 'NO_APPROVED_PHOTOS' }, { status: 404 });
  }

  const zipName = `${event.slug || 'galerie'}-photos.zip`;
  const stream = createZipStream(toZipEntries(photos));

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
      'Cache-Control': 'no-store',
    },
  });
}

async function* toZipEntries(photos: ApprovedPhoto[]): AsyncIterable<ZipStreamEntry> {
  // Build a stable, collision-free filename for each photo. Sorted by
  // createdAt ascending so the archive lists oldest first (chronological).
  const sorted = [...photos].sort((a, b) => a.createdAt - b.createdAt);
  const used = new Set<string>();

  for (const [index, photo] of sorted.entries()) {
    const ext = EXT_BY_CONTENT_TYPE[photo.contentType] ?? 'jpg';
    const prefix = String(index + 1).padStart(4, '0');
    const author = photo.uploaderName
      ? `_${safeZipEntryName(photo.uploaderName, 'invite').slice(0, 40)}`
      : '';
    let name = `${prefix}${author}.${ext}`;
    let suffix = 1;
    while (used.has(name)) {
      name = `${prefix}${author}_${suffix}.${ext}`;
      suffix += 1;
    }
    used.add(name);

    const response = await fetch(photo.url!, {
      // CloudFront — public read; the URLs were resolved server-side from
      // the photo doc by Convex. No auth header needed.
      cache: 'no-store',
    });
    if (!response.ok || !response.body) {
      // Skip unreachable objects rather than aborting the whole archive.
      continue;
    }

    yield { name, body: response.body };
  }
}
