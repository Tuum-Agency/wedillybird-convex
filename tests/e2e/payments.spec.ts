import { expect, test } from '@playwright/test';

test.describe('Payments — unauthenticated', () => {
  test('POST /api/checkout requires session', async ({ request }) => {
    const response = await request.post('/api/checkout', {
      data: { eventId: 'evt_anything', plan: 'essential' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(401);
  });

  test('upgrade success page redirects to sign-in', async ({ page }) => {
    await page.goto('/events/evt_anything/upgrade/success');
    await page.waitForURL((url) => url.pathname.endsWith('/sign-in'));
  });

  test('webhook with bad signature is rejected', async ({ request }) => {
    const response = await request.post('/api/webhooks/mock', {
      data: { providerSessionId: 'x', providerEventId: 'y', status: 'succeeded' },
      headers: { 'Content-Type': 'application/json', 'x-signature': 'wrong' },
    });
    expect(response.status()).toBe(400);
  });

  test('webhook for unknown provider returns 404', async ({ request }) => {
    const response = await request.post('/api/webhooks/unknown', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(404);
  });

  test('Stripe webhook rejects request without stripe-signature', async ({ request }) => {
    const response = await request.post('/api/webhooks/stripe', {
      data: { id: 'evt_x' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('INVALID_SIGNATURE');
  });
});
