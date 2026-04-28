// Alphabet 32 caractères sans ambiguïtés visuelles (pas de I/O/0/1).
// 256 % 32 === 0 → distribution parfaitement uniforme avec un octet par
// symbole, aucun biais modulo.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TOKEN_LENGTH = 12;

/**
 * Génère un token QR cryptographiquement sûr (utilisé pour identifier un
 * invité au check-in). `crypto.getRandomValues` est disponible dans le
 * runtime Convex (V8 isolates) et offre une entropie non prédictible —
 * contrairement à `Math.random()` dont l'état interne reste devinable et
 * permettrait à un attaquant de forger les tokens d'autres invités.
 */
export function generateQrToken(): string {
  const buffer = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(buffer);
  let out = '';
  for (const b of buffer) out += ALPHABET[b % ALPHABET.length];
  return out;
}
