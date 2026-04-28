import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateQrToken } from '../../../convex/lib/qrToken';

/**
 * Fix sécurité F-02 (audit avril 2026) — `generateQrToken` doit utiliser
 * `crypto.getRandomValues` (CSPRNG) plutôt que `Math.random` (PRNG
 * déterministe et devinable). Ces tests vérifient :
 *   1. que `crypto.getRandomValues` est appelé (mocké et compté)
 *   2. que `Math.random` n'est PAS appelé (régression guard)
 *   3. que le format de sortie reste correct (longueur 12, alphabet 32)
 */

describe('generateQrToken — fix sécurité F-02', () => {
  let originalCrypto: Crypto;
  let originalMathRandom: typeof Math.random;

  beforeEach(() => {
    originalCrypto = globalThis.crypto;
    originalMathRandom = Math.random;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      configurable: true,
    });
    Math.random = originalMathRandom;
  });

  it('appelle crypto.getRandomValues exactement une fois par invocation', () => {
    const spy = vi.fn((arr: Uint8Array) => {
      // Remplit avec des valeurs déterministes pour rendre le test reproductible.
      for (let i = 0; i < arr.length; i++) arr[i] = i;
      return arr;
    });
    Object.defineProperty(globalThis, 'crypto', {
      value: { ...originalCrypto, getRandomValues: spy },
      configurable: true,
    });

    generateQrToken();
    expect(spy).toHaveBeenCalledTimes(1);
    // Premier argument doit être un Uint8Array de 12 bytes (TOKEN_LENGTH).
    const buffer = spy.mock.calls[0]?.[0];
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect((buffer as Uint8Array).length).toBe(12);
  });

  it("n'appelle JAMAIS Math.random (régression guard)", () => {
    const mathRandomSpy = vi.fn(() => 0.5);
    Math.random = mathRandomSpy;

    generateQrToken();
    expect(mathRandomSpy).not.toHaveBeenCalled();
  });

  it("retourne un token de 12 caractères dans l'alphabet attendu (sans I/O/0/1)", () => {
    const token = generateQrToken();
    expect(token).toHaveLength(12);
    expect(token).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/);
  });

  it('génère des tokens distincts entre invocations (entropie réelle)', () => {
    // Pas de mock — on utilise le vrai crypto.getRandomValues.
    const tokens = new Set<string>();
    for (let i = 0; i < 50; i++) tokens.add(generateQrToken());
    // Avec 32^12 ≈ 1.15e18 combinaisons, 50 tirages doivent être uniques.
    expect(tokens.size).toBe(50);
  });
});
