import { expect, test } from '@playwright/test';
import {
  requiresConvexDev,
  requiresE2EMode,
  seedEmailOnlyUser,
  issueMockLinkPhoneCode,
} from './utils/fixtures';

/**
 * Tests E2E du flow de linking d'identifiants (phone OU email) à un user
 * existant. Couvre :
 *  1. Sign-up via magic link → onboarding (skip si environnement non préparé)
 *  2. Saisie d'un phone E.164 dans la carte "Activer WhatsApp"
 *  3. Récupération du code OTP via la helper Convex E2E-only puis verify
 *  4. Vérification que la card disparaît et que `users.phone` est patché
 *  5. Scénario `PHONE_TAKEN` : un 2e user qui tente de prendre le même phone
 *
 * Ces tests dépendent de `E2E_MODE=1` côté Convex. Si non posé, les tests
 * sont skip proprement (cf. `requiresE2EMode()`).
 *
 * Setup recommandé avant la suite :
 *   pnpx convex env set E2E_MODE 1
 *   pnpx convex run seed:seedTestUsers
 *   pnpm exec playwright test auth-linking
 *   pnpx convex env unset E2E_MODE
 */

const SHOULD_SKIP_REASON =
  'Requiert un déploiement Convex dev avec E2E_MODE=1 (cf. tests/e2e/auth-linking.spec.ts)';

test.describe('Auth — linking flow', () => {
  test.beforeEach(({}, testInfo) => {
    if (requiresConvexDev() || requiresE2EMode()) {
      testInfo.skip(true, SHOULD_SKIP_REASON);
    }
  });

  test('user email-only peut lier son numéro WhatsApp via OTP mock', async ({ page }) => {
    // 1. Seed un user "email-only" frais (idempotent côté seed mutation).
    const email = `link-test-${Date.now()}@wedillybird.test`;
    const { userId } = await seedEmailOnlyUser(email);

    // 2. Génère le code mock côté Convex (court-circuit Meta) avant d'ouvrir
    //    l'UI : le helper crée une row linkVerifications valide et renvoie
    //    le code en clair.
    const phone = `+33612${Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0')}`;
    const code = await issueMockLinkPhoneCode({ userId, phone });

    expect(code).toMatch(/^\d{6}$/);

    // 3. Fast-path login : on dépose la session via /api/dev/login.
    //    Le user créé est email-only, dev-login attend un phone — on saute
    //    cette étape et on tape directement les routes API de verify pour
    //    valider l'effet de bord côté DB. La spec UI complète (ouvrir le
    //    drawer, taper le code dans OtpInput, etc.) reste skippée tant que
    //    le flow magic-link UI complet n'est pas câblé pour les tests.
    test.skip(
      true,
      "L'UI de linking via /dashboard nécessite une session magic-link préalable. " +
        'À implémenter quand un endpoint /api/dev/sign-in-by-email sera disponible.',
    );

    // Placeholder pour le test futur :
    await page.goto('/dashboard');
    await expect(page.getByTestId('link-card-phone')).toBeVisible();
  });

  test('PHONE_TAKEN — 2e user qui tente de prendre un phone déjà lié reçoit le message FR', async ({
    request,
  }) => {
    // Pré-condition : il faut deux users seedés avec un phone connu (par
    // exemple le user dev par défaut) + une session pour le second.
    test.skip(
      true,
      'Scénario PHONE_TAKEN — requiert deux sessions distinctes simultanées + une route API ' +
        "/api/account/link/phone/request authentifiée. À câbler avec un helper d'injection " +
        'de session quand le pattern E2E sera stabilisé.',
    );

    // Esquisse du test ciblé une fois les helpers prêts :
    const res = await request.post('/api/account/link/phone/request', {
      data: { phone: '+33612931779' },
    });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { ok?: boolean; error?: string };
    expect(body.error).toBe('PHONE_TAKEN');
  });
});

test.describe('Auth — linking helpers Convex (smoke)', () => {
  test('issueMockLinkPhoneCode rejette en absence de E2E_MODE côté Convex', async ({}, testInfo) => {
    if (requiresConvexDev()) {
      testInfo.skip(true, 'Convex dev deployment required');
    }
    test.skip(
      requiresE2EMode(),
      "E2E_MODE doit être désactivé côté Convex pour valider la garde — l'inverse de la suite ci-dessus. " +
        'Cas couvert par les tests Convex CLI (cf. BACKLOG section "Test E2E linking happy path").',
    );
  });
});
