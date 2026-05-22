import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('/Users/rrr/conductor/workspaces/wedillybird-convex/nicosia/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp');
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, '.context/attachments/social-avatars');
mkdirSync(outDir, { recursive: true });

const rawSvg = readFileSync(resolve(root, 'public/wedillybird-mark.svg'), 'utf-8');

const SIZE = 1080;
const MARGIN_RATIO = 0.18;
const innerSize = Math.round(SIZE * (1 - MARGIN_RATIO * 2));
const markOffset = Math.round((SIZE - innerSize) / 2);

const variants = [
  { name: 'terracotta', bg: '#C2613E', mark: '#FFF5EB' },
  { name: 'ivory', bg: '#FAF3E8', mark: '#1F1410' },
  { name: 'cream-on-dark', bg: '#1F1410', mark: '#FAF3E8' },
  { name: 'white', bg: '#FFFFFF', mark: '#1F1410' },
];

for (const v of variants) {
  const tintedSvg = rawSvg.replace('fill="currentColor"', `fill="${v.mark}"`);
  const markBuffer = await sharp(Buffer.from(tintedSvg))
    .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const { r, g, b } = hexToRgb(v.bg);
  const outPath = resolve(outDir, `wedillybird-avatar-${v.name}-1080.png`);
  await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { r, g, b, alpha: 1 } },
  })
    .composite([{ input: markBuffer, top: markOffset, left: markOffset }])
    .png()
    .toFile(outPath);
  console.log('✓', outPath);
}

function hexToRgb(hex) {
  const m = hex.replace('#', '');
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}
