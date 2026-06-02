import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  chromium,
} = require('/Users/rrr/conductor/workspaces/wedillybird-convex/nicosia/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', '.context/attachments/launch-captures');
mkdirSync(outDir, { recursive: true });

const BASE = 'http://localhost:3001';
const TOKEN = '0d548d2d246c4c2aa126';

const shots = [
  { name: '01-invitation-desktop', url: `${BASE}/en/i/${TOKEN}`, vp: { width: 1280, height: 800 } },
  {
    name: '02-invitation-iphone',
    url: `${BASE}/en/i/${TOKEN}`,
    vp: { width: 390, height: 844 },
    mobile: true,
  },
  {
    name: '03-gallery-iphone',
    url: `${BASE}/en/i/${TOKEN}/gallery`,
    vp: { width: 390, height: 844 },
    mobile: true,
  },
  {
    name: '04-invitation-iphone-fr',
    url: `${BASE}/fr/i/${TOKEN}`,
    vp: { width: 390, height: 844 },
    mobile: true,
  },
];

const browser = await chromium.launch({ headless: true });
for (const s of shots) {
  const ctx = await browser.newContext({
    viewport: s.vp,
    deviceScaleFactor: 2,
    isMobile: !!s.mobile,
    userAgent: s.mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
      : undefined,
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('wedillybird-cookie-consent', 'declined');
    } catch {}
  });
  const page = await ctx.newPage();
  console.log(`→ ${s.url}`);
  const resp = await page.goto(s.url, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => {
    console.error(`✗ navigation failed for ${s.name}: ${e.message}`);
    return null;
  });
  if (resp) console.log(`  status=${resp.status()}`);
  await page.waitForTimeout(5500);
  const out = resolve(outDir, `${s.name}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log(`✓ ${out}`);
  await ctx.close();
}
await browser.close();
