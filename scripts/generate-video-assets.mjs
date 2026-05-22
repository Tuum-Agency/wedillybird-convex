import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('/Users/rrr/conductor/workspaces/wedillybird-convex/nicosia/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp');

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, '.context/attachments/video-assets');
mkdirSync(outDir, { recursive: true });

const rawSvg = readFileSync(resolve(root, 'public/wedillybird-mark.svg'), 'utf-8');

const W = 1080;
const H = 1920;
const TERRACOTTA = '#C2613E';
const IVORY = '#FAF3E8';
const INK = '#1F1410';

function tintedMark(color) {
  return rawSvg.replace('fill="currentColor"', `fill="${color}"`);
}

async function renderMarkPng(color, size) {
  return sharp(Buffer.from(tintedMark(color)))
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hexToRgb(hex) {
  const m = hex.replace('#', '');
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

// --- End card 1080×1920 (terracotta) -----------------------------------------
async function buildEndCard({ bg, mark, ink, accent, outFile }) {
  const markSize = 460;
  const markBuffer = await renderMarkPng(mark, markSize);
  const markTop = 540;
  const markLeft = Math.round((W - markSize) / 2);

  // Text on a transparent SVG layer, composited above the mark
  const textSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <text x="${W / 2}" y="${markTop + markSize + 130}" text-anchor="middle"
        font-family="'Georgia','Times New Roman',serif" font-style="italic"
        font-size="120" fill="${ink}" letter-spacing="-2">Wedillybird</text>
  <text x="${W / 2}" y="${markTop + markSize + 220}" text-anchor="middle"
        font-family="'SF Mono','Menlo',monospace" font-size="28"
        fill="${accent}" letter-spacing="8">PLAN YOURS IN 2 MINUTES</text>
  <text x="${W / 2}" y="${markTop + markSize + 280}" text-anchor="middle"
        font-family="'SF Mono','Menlo',monospace" font-size="32"
        fill="${ink}" opacity="0.7" letter-spacing="6">WEDILLYBIRD.COM</text>
</svg>`;

  const bgRgb = hexToRgb(bg);
  await sharp({
    create: { width: W, height: H, channels: 4, background: { ...bgRgb, alpha: 1 } },
  })
    .composite([
      { input: markBuffer, top: markTop, left: markLeft },
      { input: Buffer.from(textSvg), top: 0, left: 0 },
    ])
    .png()
    .toFile(resolve(outDir, outFile));
  console.log(`✓ ${outFile}`);
}

await buildEndCard({
  bg: TERRACOTTA,
  mark: IVORY,
  ink: IVORY,
  accent: '#FFE2CC',
  outFile: 'endcard-terracotta-1080x1920.png',
});
await buildEndCard({
  bg: IVORY,
  mark: TERRACOTTA,
  ink: INK,
  accent: TERRACOTTA,
  outFile: 'endcard-ivory-1080x1920.png',
});

// --- Watermark 240×240 transparent (bottom-right corner of every scene) ------
async function buildWatermark(color, file) {
  const mark = await renderMarkPng(color, 200);
  await sharp({
    create: { width: 240, height: 240, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: mark, top: 20, left: 20 }])
    .png()
    .toFile(resolve(outDir, file));
  console.log(`✓ ${file}`);
}
await buildWatermark(IVORY, 'watermark-ivory-240.png');
await buildWatermark(INK, 'watermark-ink-240.png');

// --- Text overlays 1080×1920 with mark watermark bottom-right ----------------
const titleCards = [
  {
    file: 'overlay-01-pov.png',
    eyebrow: 'SCENE 01 · 0:00 → 0:02',
    title: 'POV: your best friend\nis getting married →',
    serifItalic: false,
  },
  {
    file: 'overlay-02-reveal.png',
    eyebrow: 'SCENE 02 · 0:02 → 0:06',
    title: 'and the invitation is…\n🤯',
    serifItalic: false,
  },
  {
    file: 'overlay-03-rsvp.png',
    eyebrow: 'SCENE 03 · 0:06 → 0:10',
    title: 'RSVP in 3 taps.\nNo login. No download.',
    serifItalic: false,
  },
  {
    file: 'overlay-04-depth.png',
    eyebrow: 'SCENE 04 · 0:10 → 0:16',
    title: 'Gallery · Face search\nCheck-in · All your photos',
    serifItalic: false,
  },
  {
    file: 'overlay-05-payoff.png',
    eyebrow: 'SCENE 05 · 0:16 → 0:20',
    title: 'All the wedding.\nNone of the stress.',
    serifItalic: true,
  },
  {
    file: 'overlay-06-cta.png',
    eyebrow: 'SCENE 06 · 0:20 → 0:22',
    title: 'Plan yours in 2 minutes ↗\nwedillybird.com',
    serifItalic: false,
  },
];

const watermarkSmall = await renderMarkPng(IVORY, 100);

for (const card of titleCards) {
  const lines = card.title.split('\n');
  const family = card.serifItalic
    ? "'Georgia','Times New Roman',serif"
    : "'Geist','Helvetica Neue',sans-serif";
  const fontStyle = card.serifItalic ? 'italic' : 'normal';
  const fontSize = card.serifItalic ? 110 : 84;
  const lineHeight = card.serifItalic ? 134 : 108;
  const startY = H / 2 - ((lines.length - 1) * lineHeight) / 2;

  const tspans = lines
    .map(
      (line, i) => `<tspan x="${W / 2}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join('');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="vignette" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${INK}" stop-opacity="0.55"/>
      <stop offset="40%" stop-color="${INK}" stop-opacity="0.15"/>
      <stop offset="60%" stop-color="${INK}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${INK}" stop-opacity="0.65"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
  <text x="${W / 2}" y="320" text-anchor="middle"
        font-family="'SF Mono','Menlo',monospace" font-size="24"
        fill="${IVORY}" opacity="0.7" letter-spacing="6">${escapeXml(card.eyebrow)}</text>
  <text text-anchor="middle"
        font-family="${family}" font-style="${fontStyle}" font-weight="500" font-size="${fontSize}"
        fill="${IVORY}" letter-spacing="-1">${tspans}</text>
</svg>`;

  await sharp(Buffer.from(svg))
    .composite([{ input: watermarkSmall, top: H - 160, left: W - 160 }])
    .png()
    .toFile(resolve(outDir, card.file));
  console.log(`✓ ${card.file}`);
}
