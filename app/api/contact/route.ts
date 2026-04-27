import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { renderContactMessage } from '@/lib/email/templates';
import { contactFormSchema, isHoneypotTriggered } from '@/lib/validators/contact';

/**
 * POST /api/contact — formulaire de contact public.
 *
 * Forwarde le message à hello@wedillybird.com (override possible via
 * CONTACT_INBOX_EMAIL env var). Reply-To = email du contacter pour
 * pouvoir répondre directement depuis l'inbox.
 *
 * Anti-abuse :
 * - Honeypot `website` : si rempli → 200 ok:true silencieux, pas d'envoi
 * - Validation Zod stricte (caps de longueur)
 * - Pas de leak d'erreur SES vers le client
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
  // Fallback FormData (form HTML classique sans JS)
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

  const parsed = contactFormSchema.safeParse(payload);
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

  // Honeypot → on retourne ok pour ne pas signaler la détection au bot.
  if (isHoneypotTriggered(parsed.data)) {
    return NextResponse.json({ ok: true });
  }

  const ip = clientIp(request);
  const rendered = renderContactMessage({
    fromName: parsed.data.name,
    fromEmail: parsed.data.email,
    subject: parsed.data.subject,
    message: parsed.data.message,
    requestIp: ip,
  });

  const result = await sendEmail({
    to: CONTACT_INBOX,
    rendered,
    replyTo: parsed.data.email,
  });

  if (!result.ok) {
    console.error('[contact] sendEmail failed', { error: result.error });
    return NextResponse.json({ ok: false, error: 'SEND_FAILED' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, messageId: result.messageId });
}
