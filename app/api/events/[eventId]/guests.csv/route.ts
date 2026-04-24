import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

const CSV_HEADERS = [
  'fullName',
  'phone',
  'email',
  'category',
  'plusOnesAllowed',
  'rsvpStatus',
  'qrCodeToken',
  'notes',
];

function escapeField(value: string | number | undefined): string {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ eventId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { eventId } = await ctx.params;
  const convex = getConvexServerClient();

  try {
    const guests = await convex.query(convexApi.listGuestsByEvent, {
      eventId,
      requesterId: session.userId,
    });

    const lines: string[] = [CSV_HEADERS.join(',')];
    for (const g of guests) {
      lines.push(
        [
          escapeField(g.fullName),
          escapeField(g.phone),
          escapeField(g.email),
          escapeField(g.category),
          escapeField(g.plusOnesAllowed),
          escapeField(g.rsvpStatus),
          escapeField(g.qrCodeToken),
          escapeField(g.notes),
        ].join(','),
      );
    }

    const csv = lines.join('\n') + '\n';
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="guests-${eventId}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    if (message === 'EVENT_NOT_FOUND') {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: 'UNKNOWN' }, { status: 500 });
  }
}
