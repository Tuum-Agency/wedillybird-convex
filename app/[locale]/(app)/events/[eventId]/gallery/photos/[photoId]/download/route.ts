import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ eventId: string; photoId: string; locale: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { eventId, photoId } = await ctx.params;
  const convex = getConvexServerClient();

  // listPhotosForOwner already gates on ownership — we lookup the matching
  // photo there rather than adding a dedicated `getById` query.
  let photo: {
    _id: string;
    url: string | null;
    contentType: string;
    uploaderName?: string;
  } | null = null;
  try {
    const all = await convex.query(convexApi.listPhotosForOwner, {
      eventId,
      requesterId: session.userId,
    });
    photo = all.find((p) => p._id === photoId) ?? null;
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

  if (!photo || !photo.url) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const upstream = await fetch(photo.url, { cache: 'no-store' });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'UPSTREAM_UNAVAILABLE' }, { status: 502 });
  }

  const ext = EXT_BY_CONTENT_TYPE[photo.contentType] ?? 'jpg';
  const filename = `wedillybird-${photoId}.${ext}`;

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': photo.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
