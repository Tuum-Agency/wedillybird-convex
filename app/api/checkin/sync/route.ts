import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  eventId: z.string().min(1),
  checkIns: z
    .array(
      z.object({
        qrCodeToken: z.string().min(1),
        scannedAt: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1)
    .max(200),
});

export interface CheckInSyncResponse {
  ok: string[];
  failed: Array<{ token: string; error: string }>;
}

export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const convex = getConvexServerClient();
  const ok: string[] = [];
  const failed: CheckInSyncResponse['failed'] = [];

  for (const entry of parsed.checkIns) {
    try {
      // checkInByToken is idempotent: if checkedInAt is already set, it returns
      // alreadyCheckedIn=true with the existing timestamp and no DB write.
      await convex.mutation(convexApi.checkInByToken, {
        token: entry.qrCodeToken,
        eventId: parsed.eventId,
        requesterId: session.userId,
      });
      ok.push(entry.qrCodeToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNKNOWN';
      // FORBIDDEN means the requester doesn't own the event — abort the whole batch
      // so the client doesn't keep retrying with bad creds.
      if (message === 'FORBIDDEN') {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
      }
      failed.push({ token: entry.qrCodeToken, error: message });
    }
  }

  return NextResponse.json({ ok, failed } satisfies CheckInSyncResponse);
}
