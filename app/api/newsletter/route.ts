import { NextResponse } from 'next/server';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { sendEmail } from '@/lib/email';
import { renderNewsletterSignup } from '@/lib/email/templates';
import { isHoneypotTriggered, newsletterSchema } from '@/lib/validators/contact';

/**
 * POST /api/newsletter — inscription newsletter (footer landing).
 *
 * Store-first : on persiste l'abonné dans Convex `newsletterSubscribers`
 * (idempotent : déjà inscrit → no-op), PUIS on envoie une notif admin via
 * SES en best-effort. Si SES échoue, on garde quand même l'abonné — le
 * stockage Convex est la source de vérité pour les futures campagnes
 * (Brevo/Mailchimp viendront se brancher plus tard sur listActive).
 *
 * Supporte FormData (form HTML classique sans JS) ET JSON (fetch).
 */

const CONTACT_INBOX = process.env.CONTACT_INBOX_EMAIL ?? 'hello@wedillybird.com';

async function readPayload(request: Request): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return (await request.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  try {
    const form = await request.formData();
    return Object.fromEntries(form.entries()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function clientIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim();
  return request.headers.get('x-real-ip') ?? undefined;
}

export async function POST(request: Request) {
  const payload = await readPayload(request);
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  const parsed = newsletterSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'INVALID_INPUT',
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  if (isHoneypotTriggered(parsed.data)) {
    return NextResponse.json({ ok: true });
  }

  const ip = clientIp(request);
  const source =
    typeof payload.source === 'string' && payload.source.length > 0
      ? payload.source.slice(0, 60)
      : 'footer';

  // 1. Store-first : persist le subscriber dans Convex (idempotent).
  let subscribeResult: { alreadyActive: boolean; reactivated: boolean };
  try {
    const convex = getConvexServerClient();
    subscribeResult = await convex.mutation(convexApi.newsletterSubscribe, {
      email: parsed.data.email,
      source,
      ipAddress: ip,
    });
  } catch (err) {
    console.error('[newsletter] convex subscribe failed', err);
    return NextResponse.json({ ok: false, error: 'STORE_FAILED' }, { status: 502 });
  }

  // 2. Si déjà inscrit et actif, on n'envoie pas une 2e notif admin.
  if (subscribeResult.alreadyActive) {
    return NextResponse.json({ ok: true, alreadyActive: true });
  }

  // 3. Notif admin SES en best-effort. Si échec, on log mais on retourne
  //    ok — le subscriber est dans Convex, c'est ça qui compte.
  const rendered = renderNewsletterSignup({
    email: parsed.data.email,
    requestIp: ip,
    source,
  });

  const sendResult = await sendEmail({
    to: CONTACT_INBOX,
    rendered,
  });

  if (!sendResult.ok) {
    console.error('[newsletter] sendEmail failed (subscriber stored)', {
      error: sendResult.error,
    });
  }

  return NextResponse.json({
    ok: true,
    reactivated: subscribeResult.reactivated,
    notificationSent: sendResult.ok,
  });
}
