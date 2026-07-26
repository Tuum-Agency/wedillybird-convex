/**
 * Webhook StatusCallback Twilio — statut de livraison réel des SMS.
 *
 * Twilio POST ici le cycle de vie de chaque message (`queued` → `sent` →
 * `delivered` / `undelivered` / `failed`). C'est ce qui transforme le « envoyé »
 * trompeur (HTTP 200 = accepté en file) en livraison OBSERVÉE — le correctif du
 * mode d'échec F4 du premortem (les carriers A2P US filtrent en silence).
 *
 * Double barrière, comme le webhook WhatsApp :
 *  1. Signature `X-Twilio-Signature` (HMAC-SHA1 base64 de URL + params triés,
 *     clé = `TWILIO_AUTH_TOKEN`) vérifiée à la frontière.
 *  2. `CONVEX_WEBHOOK_SECRET` passé à la mutation Convex gardée.
 *
 * On répond toujours 200 après vérif : sinon Twilio retente en boucle. La perte
 * d'un callback est rattrapée par le cron de secours (SID orphelins, T1-P1).
 *
 * Runtime nodejs requis : `crypto.createHmac` + ConvexHttpClient server-only.
 */

import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

export const runtime = 'nodejs';

/**
 * URL canonique du callback = celle posée comme `StatusCallback` à l'envoi
 * (cf. invitationActions.broadcast). Elle DOIT correspondre à l'octet près à ce
 * que Twilio a signé, donc on la dérive de la même source (`NEXT_PUBLIC_APP_URL`)
 * plutôt que de la reconstruire depuis la requête (proxies Vercel = URL altérée).
 */
const CALLBACK_URL = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://wedillybird.com'}/api/webhooks/twilio`;

function validateTwilioSignature(
  params: Record<string, string>,
  signature: string | null,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    // Dev sans creds Twilio : on accepte (mock-friendly). En prod, la variable
    // DOIT être posée, sinon on rejette tout pour éviter une faille muette.
    if (process.env.NODE_ENV === 'production') return false;
    return true;
  }
  if (!signature) return false;
  // Twilio : data = URL + concat(clé + valeur) pour chaque param, clés triées.
  const sortedKeys = Object.keys(params).sort();
  let data = CALLBACK_URL;
  for (const key of sortedKeys) data += key + params[key];
  const expected = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const form = new URLSearchParams(rawBody);
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = value;
  });

  if (!validateTwilioSignature(params, req.headers.get('x-twilio-signature'))) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  const twilioSid = params.MessageSid ?? params.SmsSid;
  const twilioStatus = params.MessageStatus ?? params.SmsStatus;
  if (!twilioSid || !twilioStatus) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }

  const webhookSecret = process.env.CONVEX_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'WEBHOOK_SECRET_NOT_CONFIGURED' }, { status: 500 });
  }

  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.smsApplyStatusWebhook, {
      webhookSecret,
      twilioSid,
      twilioStatus,
      errorCode: params.ErrorCode || undefined,
    });
  } catch (err) {
    // 200 quand même : sinon Twilio retente en boucle. Le cron de secours
    // rattrapera un SID resté sans statut terminal.
    console.error('[webhooks/twilio] mutation failed', err);
  }

  return NextResponse.json({ ok: true });
}
