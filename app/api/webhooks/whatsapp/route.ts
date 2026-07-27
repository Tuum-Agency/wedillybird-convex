/**
 * Webhook Meta WhatsApp Business — events `message_template_status_update`.
 *
 * GET : hub challenge à la souscription.
 *   Meta envoie ?hub.mode=subscribe&hub.verify_token=X&hub.challenge=Y
 *   On compare verify_token à `WHATSAPP_WEBHOOK_VERIFY_TOKEN` env var.
 *   Si match : on renvoie le challenge en text/plain. Sinon 403.
 *
 * POST : event payload signé par Meta.
 *   Header `x-hub-signature-256: sha256=<hex>` = HMAC-SHA256 du body brut
 *   avec `WHATSAPP_APP_SECRET` comme clé. On vérifie avant de parser.
 *   On walke `entry[].changes[]` à la recherche de
 *   `field === "message_template_status_update"`. Pour chaque, on appelle
 *   la mutation Convex `applyWhatsappTemplateWebhook` (idempotente) puis
 *   on déclenche `dispatchTemplateNotifications` (best-effort).
 *
 * Meta retry plusieurs fois en cas de 4xx/5xx, donc l'endpoint répond 200
 * dès que le payload est bien signé, même si certains templates n'existent
 * pas en base (cas où le webhook arrive avant que le DB soit synchro).
 *
 * Runtime nodejs requis : crypto.createHmac + ConvexHttpClient via
 * lib/auth/convex-server.ts (server-only).
 */

import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

export const runtime = 'nodejs';

interface WhatsappTemplateStatusValue {
  message_template_id?: number | string;
  message_template_name?: string;
  message_template_language?: string;
  event?: string;
  reason?: string;
}

interface WhatsappWebhookChange {
  field: string;
  value: WhatsappTemplateStatusValue | Record<string, unknown>;
}

interface WhatsappWebhookEntry {
  id?: string;
  time?: number;
  changes?: WhatsappWebhookChange[];
}

interface WhatsappWebhookPayload {
  object?: string;
  entry?: WhatsappWebhookEntry[];
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    // En dev on accepte tout (mock-friendly). En prod, la variable DOIT
    // être set sinon on rejette tout pour éviter une faille muette.
    if (process.env.NODE_ENV === 'production') return false;
    return true;
  }
  if (!signatureHeader) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  // Comparaison constant-time pour éviter le timing attack.
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'WEBHOOK_NOT_CONFIGURED' }, { status: 503 });
  }
  if (mode !== 'subscribe' || token !== expected || !challenge) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  return new Response(challenge, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  let payload: WhatsappWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WhatsappWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const convex = getConvexServerClient();
  // Secret partagé Vercel ⇄ Convex : empêche un appel direct de marquer un
  // template `approved`/`disabled` sans passer par ce webhook Meta signé.
  const webhookSecret = process.env.CONVEX_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'WEBHOOK_SECRET_NOT_CONFIGURED' }, { status: 500 });
  }
  let processed = 0;
  let touched = 0;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'message_template_status_update') continue;
      const value = change.value as WhatsappTemplateStatusValue;
      const metaTemplateId =
        value.message_template_id !== undefined ? String(value.message_template_id) : undefined;
      const metaName = value.message_template_name;
      const metaEvent = value.event ?? value['event' as keyof typeof value];
      const reason = value.reason;
      if (!metaTemplateId && !metaName) continue;
      if (!metaEvent || typeof metaEvent !== 'string') continue;

      try {
        const result = await convex.mutation(convexApi.applyWhatsappTemplateWebhook, {
          webhookSecret,
          metaTemplateId: metaTemplateId ?? '',
          metaName,
          status: metaEvent,
          reason: typeof reason === 'string' ? reason : undefined,
        });
        if (result.ok) touched += 1;
      } catch (err) {
        console.error('[webhooks/whatsapp] mutation failed', err);
      }
      processed += 1;
    }
  }

  // Best-effort dispatch des notifs en attente (idempotent côté Convex).
  if (touched > 0) {
    try {
      await convex.action(convexApi.dispatchTemplateNotifications, {});
    } catch (err) {
      console.error('[webhooks/whatsapp] dispatch failed', err);
    }
  }

  return NextResponse.json({ ok: true, processed, touched });
}
