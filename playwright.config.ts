import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // CI : 1 seul worker. À 2 workers, chromium + webkit tournaient en parallèle
  // sur le même runner (+ un seul serveur Next), et la contention faisait échouer
  // les tests sensibles au timing sur webkit-Linux (scroll-spy `aria-current`,
  // focus après collage OTP) même après retries. Sérialiser supprime la
  // contention au prix d'un job plus lent — fiabilité > vitesse pour ce gate.
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: isCI ? 'pnpm start' : 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://invalid.convex.test',
      SESSION_SECRET:
        process.env.SESSION_SECRET ?? 'test-session-secret-at-least-32-chars-long-xxxxx',
      WHATSAPP_MOCK: '1',
      // Force le driver mock côté Next.js. Pour les actions Convex (qui
      // tournent dans le cloud Convex), il faut aussi poser cette env var
      // côté deployment dev avant de lancer les tests :
      //   pnpx convex env set E2E_MODE 1
      // Cf. tests/e2e/auth-linking.spec.ts pour le pattern de teardown.
      E2E_MODE: '1',
      EMAIL_DRIVER: 'mock',
    },
  },
});
