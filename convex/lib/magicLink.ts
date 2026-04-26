/**
 * Magic Link helpers — pattern miroir de otp.ts mais pour des tokens longs
 * cryptographiquement sécurisés (32 bytes random, hex 64 chars). Hash SHA-256
 * avec l'email en salt pour empêcher le stockage du token clair en DB.
 *
 * Expiration courte (15 min) : un magic link n'a pas vocation à traîner.
 * Rate limit : 3 emails par heure par adresse pour limiter l'abuse.
 */

export function generateMagicToken(): string {
  // 32 bytes = 256 bits d'entropie. Suffisant pour résister à du brute-force
  // même si un attaquant connaît l'email cible.
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  let hex = '';
  for (const b of buffer) hex += b.toString(16).padStart(2, '0');
  return hex;
}

export async function hashMagicToken(token: string, email: string): Promise<string> {
  const material = `${email.toLowerCase()}:${token}`;
  const data = new TextEncoder().encode(material);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(digest);
}

export async function verifyMagicTokenHash(
  token: string,
  email: string,
  expected: string,
): Promise<boolean> {
  const actual = await hashMagicToken(token, email);
  return timingSafeEqual(actual, expected);
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export const MAGIC_LINK_EXPIRY_MS = 15 * 60 * 1000;
export const MAX_MAGIC_LINKS_PER_HOUR = 3;
export const MAGIC_LINK_RATE_WINDOW_MS = 60 * 60 * 1000;
