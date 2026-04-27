import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { renderNewsletterSignup } from '@/lib/email/templates';
import { isHoneypotTriggered, newsletterSchema } from '@/lib/validators/contact';

/**
 * POST /api/newsletter — inscription newsletter (footer landing).
 *
 * MVP : forwarde la demande à hello@wedillybird.com. Quand on aura un
 * service newsletter (Brevo, Mailchimp), on remplacera par un appel API
 * direct ici.
 *
 * Supporte FormData (form HTML classique du footer) ET JSON (fetch).
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

  const rendered = renderNewsletterSignup({
    email: parsed.data.email,
    requestIp: ip,
    source,
  });

  const result = await sendEmail({
    to: CONTACT_INBOX,
    rendered,
  });

  if (!result.ok) {
    console.error('[newsletter] sendEmail failed', { error: result.error });
    return NextResponse.json({ ok: false, error: 'SEND_FAILED' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, messageId: result.messageId });
}
