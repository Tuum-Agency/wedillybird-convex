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

const URL = 'https://wedillybird.com/en/i/0552d96900374105acbb';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
console.log(`→ ${URL}`);
const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
console.log(`status=${resp.status()}`);
await page.waitForTimeout(5500);
const out = resolve(outDir, 'PROD-invitation-iphone.png');
await page.screenshot({ path: out, fullPage: false });
console.log(`✓ ${out}`);
await ctx.close();
await browser.close();
