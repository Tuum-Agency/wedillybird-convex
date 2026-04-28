import { expect, test } from '@playwright/test';
import { requiresConvexDev } from './utils/fixtures';

/**
 * E2E pour `GET /api/payments/[paymentId]/invoice.pdf`.
 *
 * Le test 401 (sans session) ne nécessite ni Convex dev ni paiement seedé —
 * c'est un guard pur côté `lib/auth/session`.
 *
 * Le test 200 (avec session valide + paiement succeeded) nécessite :
 *  - Convex dev déployé,
 *  - une variable `E2E_INVOICE_PAYMENT_ID` qui pointe sur un payment seedé
 *    `succeeded` appartenant au user dev `+33612931779`.
 * Sans ces conditions, le test est skippé (couvert par
 * `tests/unit/app/invoice-pdf-route.test.tsx` qui mocke Convex).
 */
test.describe('Invoice PDF — auth gate', () => {
  test('renvoie 401 sans session', async ({ request }) => {
    const response = await request.get('/api/payments/pay_anything/invoice.pdf');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('UNAUTHORIZED');
  });
});

test.describe('Invoice PDF — happy path (avec session + payment seedé)', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');
  test.skip(
    !process.env.E2E_INVOICE_PAYMENT_ID,
    'E2E_INVOICE_PAYMENT_ID required (paiement succeeded seedé pour le user dev)',
  );

  test('renvoie 200 application/pdf attachment pour le buyer', async ({ page, request }) => {
    // skip: requires running dev server with seeded payment
    await page.goto('/dev-login');
    await page
      .locator('form', { has: page.locator('input[value="+33612931779"]') })
      .getByRole('button', { name: /se connecter/i })
      .click();
    await page.waitForURL((url) => /\/dashboard/.test(url.pathname));

    const paymentId = process.env.E2E_INVOICE_PAYMENT_ID!;
    const response = await request.get(`/api/payments/${paymentId}/invoice.pdf`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/pdf');
    expect(response.headers()['content-disposition']).toContain('attachment');
    expect(response.headers()['content-disposition']).toMatch(/facture-wedillybird-/);

    // Magic bytes "%PDF" → 0x25 0x50 0x44 0x46
    const buffer = await response.body();
    expect(buffer[0]).toBe(0x25);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x44);
    expect(buffer[3]).toBe(0x46);
  });
});
