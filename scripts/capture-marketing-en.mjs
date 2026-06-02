import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  chromium,
} = require('/Users/rrr/conductor/workspaces/wedillybird-convex/nicosia/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', '.context/attachments/marketing-en');
mkdirSync(outDir, { recursive: true });

const BASE = process.env.CAPTURE_BASE_URL ?? 'http://localhost:3001';
const TOKEN = process.env.CAPTURE_GUEST_TOKEN ?? '0d548d2d246c4c2aa126';

const MOBILE_VP = { width: 390, height: 844 };
const DESKTOP_VP = { width: 1440, height: 900 };
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

const shots = [
  // ─── Landing page (main hero + sections) ─────────────────────────────────
  { name: '01-landing-hero-mobile', url: `${BASE}/en`, vp: MOBILE_VP, mobile: true, scrollY: 0 },
  {
    name: '02-landing-features-mobile',
    url: `${BASE}/en`,
    vp: MOBILE_VP,
    mobile: true,
    scrollY: 900,
  },
  {
    name: '03-landing-pricing-mobile',
    url: `${BASE}/en`,
    vp: MOBILE_VP,
    mobile: true,
    scrollY: 1800,
  },
  { name: '04-landing-hero-desktop', url: `${BASE}/en`, vp: DESKTOP_VP, scrollY: 0 },

  // ─── Invitation (the wow page) ───────────────────────────────────────────
  {
    name: '05-invitation-mobile',
    url: `${BASE}/en/i/${TOKEN}`,
    vp: MOBILE_VP,
    mobile: true,
    scrollY: 0,
    waitExtra: 5500,
  },
  {
    name: '06-invitation-countdown-mobile',
    url: `${BASE}/en/i/${TOKEN}`,
    vp: MOBILE_VP,
    mobile: true,
    scrollY: 700,
    waitExtra: 5500,
  },
  {
    name: '07-invitation-rsvp-mobile',
    url: `${BASE}/en/i/${TOKEN}`,
    vp: MOBILE_VP,
    mobile: true,
    scrollY: 1600,
    waitExtra: 5500,
  },
  {
    name: '08-invitation-desktop',
    url: `${BASE}/en/i/${TOKEN}`,
    vp: DESKTOP_VP,
    scrollY: 0,
    waitExtra: 5500,
  },

  // ─── Guest gallery (face search + grid) ──────────────────────────────────
  {
    name: '09-gallery-mobile',
    url: `${BASE}/en/i/${TOKEN}/gallery`,
    vp: MOBILE_VP,
    mobile: true,
    scrollY: 0,
    waitExtra: 3000,
  },
  {
    name: '10-gallery-grid-mobile',
    url: `${BASE}/en/i/${TOKEN}/gallery`,
    vp: MOBILE_VP,
    mobile: true,
    scrollY: 500,
    waitExtra: 3000,
  },

  // ─── Pro pricing ─────────────────────────────────────────────────────────
  {
    name: '11-pricing-pro-mobile',
    url: `${BASE}/en/forfaits-pros`,
    vp: MOBILE_VP,
    mobile: true,
    scrollY: 0,
  },
  {
    name: '12-pricing-pro-tiers-mobile',
    url: `${BASE}/en/forfaits-pros`,
    vp: MOBILE_VP,
    mobile: true,
    scrollY: 600,
  },
  { name: '13-pricing-pro-desktop', url: `${BASE}/en/forfaits-pros`, vp: DESKTOP_VP, scrollY: 0 },

  // ─── Templates gallery ───────────────────────────────────────────────────
  {
    name: '14-templates-mobile',
    url: `${BASE}/en/templates`,
    vp: MOBILE_VP,
    mobile: true,
    scrollY: 0,
  },
  { name: '15-templates-desktop', url: `${BASE}/en/templates`, vp: DESKTOP_VP, scrollY: 0 },

  // ─── FAQ ─────────────────────────────────────────────────────────────────
  { name: '16-faq-mobile', url: `${BASE}/en/faq`, vp: MOBILE_VP, mobile: true, scrollY: 0 },

  // ─── Guide (how it works) ────────────────────────────────────────────────
  { name: '17-guide-mobile', url: `${BASE}/en/guide`, vp: MOBILE_VP, mobile: true, scrollY: 0 },
];

const browser = await chromium.launch({ headless: true });
for (const s of shots) {
  const ctx = await browser.newContext({
    viewport: s.vp,
    deviceScaleFactor: 3,
    isMobile: !!s.mobile,
    userAgent: s.mobile ? MOBILE_UA : undefined,
    locale: 'en-US',
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('wedillybird-cookie-consent', 'declined');
      localStorage.setItem('wedillybird-locale-suggestion-dismissed', '1');
    } catch {}
  });
  const page = await ctx.newPage();
  console.log(`→ ${s.url} (${s.vp.width}×${s.vp.height}${s.mobile ? ' mobile' : ''})`);
  const resp = await page.goto(s.url, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => {
    console.error(`✗ navigation failed for ${s.name}: ${e.message}`);
    return null;
  });
  if (resp) console.log(`  status=${resp.status()}`);
  if (s.scrollY) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), s.scrollY);
  }
  await page.waitForTimeout(s.waitExtra ?? 1500);
  const out = resolve(outDir, `${s.name}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log(`✓ ${out}`);
  await ctx.close();
}
await browser.close();
