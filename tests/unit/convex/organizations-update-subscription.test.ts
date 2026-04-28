import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Fix sécurité F-01 (audit avril 2026) — la mutation `updateSubscription`
 * doit être `internalMutation` (donc inaccessible aux clients) et le seul
 * point d'entrée public côté webhook doit valider un secret partagé.
 *
 * Avant le fix, `updateSubscription` était une mutation publique sans
 * aucun check : tout user authentifié pouvait s'upgrader Agency `active` 10
 * ans gratuitement (IDOR, CVSS 8.8).
 */
describe('convex/organizations.ts — updateSubscription (F-01)', () => {
  const orgSrc = readFileSync(
    resolve(__dirname, '..', '..', '..', 'convex', 'organizations.ts'),
    'utf-8',
  );

  it('`updateSubscription` est exporté en `internalMutation`', () => {
    expect(orgSrc).toMatch(/export const updateSubscription\s*=\s*internalMutation\(/);
  });

  it("`updateSubscription` n'est PAS exporté en mutation publique (régression guard)", () => {
    expect(orgSrc).not.toMatch(/export const updateSubscription\s*=\s*mutation\(/);
  });

  it('`updateSubscriptionFromWebhook` est exposé comme bridge public', () => {
    expect(orgSrc).toMatch(/export const updateSubscriptionFromWebhook\s*=\s*mutation\(/);
  });

  it('le bridge webhook valide un secret partagé `CONVEX_WEBHOOK_SECRET`', () => {
    expect(orgSrc).toMatch(/process\.env\.CONVEX_WEBHOOK_SECRET/);
    expect(orgSrc).toMatch(/INVALID_WEBHOOK_SECRET/);
  });

  it("le bridge throw `WEBHOOK_SECRET_NOT_CONFIGURED` quand l'env n'est pas posée", () => {
    expect(orgSrc).toMatch(/WEBHOOK_SECRET_NOT_CONFIGURED/);
  });

  it('le bridge accepte un argument `webhookSecret: v.string()`', () => {
    expect(orgSrc).toMatch(/webhookSecret:\s*v\.string\(\)/);
  });
});

describe('app/api/webhooks/[provider]/route.ts — webhook utilise le bridge (F-01)', () => {
  const webhookSrc = readFileSync(
    resolve(__dirname, '..', '..', '..', 'app', 'api', 'webhooks', '[provider]', 'route.ts'),
    'utf-8',
  );

  it("appelle `updateOrgSubscriptionFromWebhook` (et non l'ancienne version)", () => {
    expect(webhookSrc).toMatch(/updateOrgSubscriptionFromWebhook/);
    // Régression : on ne doit plus voir l'appel à l'ancienne référence sans
    // le suffix "FromWebhook".
    expect(webhookSrc).not.toMatch(/updateOrgSubscription\b(?!FromWebhook)/);
  });

  it('lit `CONVEX_WEBHOOK_SECRET` et passe le secret à la mutation', () => {
    expect(webhookSrc).toMatch(/process\.env\.CONVEX_WEBHOOK_SECRET/);
    expect(webhookSrc).toMatch(/webhookSecret/);
  });

  it("rejette quand le secret n'est pas configuré (pas de fallback silencieux)", () => {
    expect(webhookSrc).toMatch(/WEBHOOK_SECRET_NOT_CONFIGURED/);
  });
});
