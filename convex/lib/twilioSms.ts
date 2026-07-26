/**
 * Wrapper unifié autour de l'API Twilio Messages
 * (`POST /2010-04-01/Accounts/{AccountSid}/Messages.json`).
 *
 * Miroir intentionnel de `whatsappCloud.ts` : même contrat de retour discriminé
 * `{ ok, mock?, messageId?, error?, httpStatus? }`, même mode mock (forcé par
 * `E2E_MODE === '1'` ou par l'absence de credentials), pour que les call-sites
 * puissent router WhatsApp / SMS de façon homogène sans dupliquer la mécanique
 * transport + mock + parsing d'erreur.
 *
 * Envoi via **Messaging Service** (`TWILIO_MESSAGING_SERVICE_SID`) si défini —
 * Twilio sélectionne alors le bon sender du pool selon le pays du destinataire.
 * Sinon, fallback sur un numéro fixe (`TWILIO_FROM_NUMBER`).
 *
 * ⚠️ Volontairement minimal : pas de retry, pas de queue, pas de validation de
 * signature (le webhook entrant STOP la gère séparément). Aligné sur le style
 * du wrapper WhatsApp.
 */

export interface TwilioSmsSendInput {
  /** Destinataire en E.164 (avec ou sans le `+` en tête). */
  to: string;
  /** Corps texte du SMS. Garder en GSM-7 (<=160 chars) pour 1 seul segment. */
  body: string;
  /**
   * URL `StatusCallback` Twilio. Quand fournie, Twilio POST le statut de
   * livraison réel (delivered/undelivered/failed) à cette URL. C'est ce qui
   * transforme « accepté en file » (HTTP 200) en livraison observée (F4).
   */
  statusCallback?: string;
}

export interface TwilioSmsEnv {
  accountSid: string;
  authToken: string;
  /** Messaging Service SID (préféré, pool de senders par pays). */
  messagingServiceSid?: string;
  /** Numéro émetteur E.164 (fallback si pas de Messaging Service). */
  fromNumber?: string;
}

export interface TwilioSmsSendResult {
  ok: boolean;
  /** SID Twilio du message (présent quand `ok: true` et pas mock). */
  messageId?: string;
  /** Mode mock activé via `E2E_MODE=1` ou credentials absents. */
  mock?: boolean;
  /** Message d'erreur lisible (présent quand `ok: false`). */
  error?: string;
  /** Code HTTP si l'erreur vient du transport. */
  httpStatus?: number;
}

/**
 * Indique si Twilio est configuré côté env Convex : il faut le couple
 * `accountSid` + `authToken` ET au moins un sender (Messaging Service OU numéro).
 */
export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER),
  );
}

/**
 * Indique si on doit forcer le mode mock (E2E ou credentials absents).
 */
export function shouldUseTwilioMock(): boolean {
  if (process.env.E2E_MODE === '1') return true;
  return !isTwilioConfigured();
}

/**
 * Construit l'URL de l'API Messages à partir du `accountSid`.
 */
export function buildTwilioMessagesUrl(accountSid: string): string {
  return `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
}

/**
 * Envoie un SMS via Twilio. Retourne un `{ ok, ... }` discriminé — l'appelant
 * choisit ce qu'il fait des erreurs (throw métier, fallback email, etc.).
 *
 * Mode mock : si `process.env.E2E_MODE === '1'`, loggue et retourne
 * `{ ok: true, mock: true, messageId: 'mock-sms-...' }`, sans appel HTTP réel.
 * Le check E2E est volontairement placé AVANT la vérification des credentials
 * (cf. sécurité F-04 sur WhatsApp) : hors E2E et sans creds, on retourne
 * `{ ok: false, error: 'TWILIO_NOT_CONFIGURED' }` — jamais de mock silencieux.
 */
export async function sendTwilioSms(
  input: TwilioSmsSendInput,
  env?: Partial<TwilioSmsEnv>,
): Promise<TwilioSmsSendResult> {
  const accountSid = env?.accountSid ?? process.env.TWILIO_ACCOUNT_SID;
  const authToken = env?.authToken ?? process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = env?.messagingServiceSid ?? process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = env?.fromNumber ?? process.env.TWILIO_FROM_NUMBER;

  if (process.env.E2E_MODE === '1') {
    const mockId = `mock-sms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.info(`[twilio:mock] SMS -> ${input.to} | id=${mockId}`);
    return { ok: true, mock: true, messageId: mockId };
  }

  if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) {
    return { ok: false, error: 'TWILIO_NOT_CONFIGURED' };
  }

  const params = new URLSearchParams();
  params.set('To', input.to.startsWith('+') ? input.to : `+${input.to}`);
  params.set('Body', input.body);
  // Messaging Service prioritaire (sélection de sender par pays). À défaut,
  // numéro fixe.
  if (messagingServiceSid) {
    params.set('MessagingServiceSid', messagingServiceSid);
  } else if (fromNumber) {
    params.set('From', fromNumber);
  }
  // Statut de livraison réel poussé par Twilio à cette URL (webhook StatusCallback).
  if (input.statusCallback) {
    params.set('StatusCallback', input.statusCallback);
  }

  // Auth HTTP Basic `AccountSid:AuthToken`. `btoa` est dispo dans le runtime
  // Convex (V8 isolate) ET dans Node — pas de `Buffer` (absent du isolate).
  const authHeader = `Basic ${btoa(`${accountSid}:${authToken}`)}`;

  let res: Response;
  try {
    res = await fetch(buildTwilioMessagesUrl(accountSid), {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    return { ok: false, error: `network: ${message}` };
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      message?: string;
      code?: number;
    };
    const reason = data.message ?? `HTTP ${res.status}`;
    return { ok: false, error: reason, httpStatus: res.status };
  }

  const data = (await res.json().catch(() => ({}))) as { sid?: string };
  return { ok: true, mock: false, messageId: data.sid };
}
