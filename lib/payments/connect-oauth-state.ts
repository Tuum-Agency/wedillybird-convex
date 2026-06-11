/**
 * État OAuth signé (anti-CSRF) pour la connexion « Se connecter avec Stripe ».
 * Encodage `body.signature` (HMAC-SHA256, base64url) — même schéma que la
 * session (`lib/auth/session.ts`). Le `state` est opaque pour Stripe, qui nous
 * le renvoie tel quel au retour ; on vérifie alors la signature + la fraîcheur,
 * et on lie `orgId` pour empêcher tout détournement vers une autre agence.
 *
 * Fonctions pures (le secret et `now` sont passés en argument) → testables sans
 * dépendre de l'environnement.
 */

export interface ConnectOAuthState {
  /** Organisation qui initie la connexion. */
  orgId: string;
  /** Aléa anti-rejeu. */
  nonce: string;
  /** Émission (ms epoch). */
  ts: number;
}

/** Durée de validité d'un `state` (10 min : large pour le détour par Stripe). */
export const CONNECT_STATE_TTL_MS = 10 * 60 * 1000;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecodeToString(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = atob(padded);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

/** Signe un `state` OAuth. `secret` doit faire ≥ 32 caractères. */
export async function signConnectState(state: ConnectOAuthState, secret: string): Promise<string> {
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(state)));
  const sig = await hmac(body, secret);
  return `${body}.${sig}`;
}

/**
 * Vérifie un `state` OAuth : signature valide + non expiré (≤ `ttlMs`) + pas
 * émis dans le futur. Renvoie l'état décodé, ou `null` si invalide.
 */
export async function verifyConnectState(
  token: string,
  secret: string,
  now: number,
  ttlMs: number = CONNECT_STATE_TTL_MS,
): Promise<ConnectOAuthState | null> {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = await hmac(body, secret);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const parsed = JSON.parse(base64UrlDecodeToString(body)) as Partial<ConnectOAuthState>;
    if (
      typeof parsed.orgId !== 'string' ||
      typeof parsed.nonce !== 'string' ||
      typeof parsed.ts !== 'number'
    ) {
      return null;
    }
    if (parsed.ts > now + 60_000) return null; // émis « dans le futur » → suspect
    if (now - parsed.ts > ttlMs) return null; // expiré
    return { orgId: parsed.orgId, nonce: parsed.nonce, ts: parsed.ts };
  } catch {
    return null;
  }
}

/** Lit le secret de signature (réutilise `SESSION_SECRET`). Lève si absent/court. */
export function connectStateSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set and >= 32 chars');
  }
  return secret;
}
