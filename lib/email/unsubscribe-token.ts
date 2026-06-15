import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Jeton de désinscription signé (HMAC-SHA256) — évite qu'un tiers désinscrive
 * une adresse arbitraire en devinant l'URL. Le lien dans les emails est
 * `…/api/newsletter/unsubscribe?email=<e>&token=<signUnsubscribe(e)>`.
 *
 * Secret : `NEWSLETTER_UNSUBSCRIBE_SECRET`, fallback `SESSION_SECRET`. Utilisé
 * côté Convex (action d'envoi, `use node`) ET côté Next (route GET) — mêmes
 * algo/secret des deux côtés.
 */

function secret(): string {
  const s = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET ?? process.env.SESSION_SECRET;
  if (!s) throw new Error('UNSUBSCRIBE_SECRET_NOT_CONFIGURED');
  return s;
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export function signUnsubscribe(email: string): string {
  return createHmac('sha256', secret()).update(normalize(email)).digest('hex');
}

export function verifyUnsubscribe(email: string, token: string): boolean {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return false;
  const expected = signUnsubscribe(email);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(token, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
