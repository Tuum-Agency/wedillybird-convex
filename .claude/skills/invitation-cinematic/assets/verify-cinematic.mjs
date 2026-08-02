/**
 * Vérificateur de cinématique au RENDU RÉEL.
 *
 * `typecheck` et les tests unitaires ne prouvent rien ici : les deux bugs les
 * plus coûteux rencontrés (classes de phase sans préfixe → tout reste
 * `opacity: 0` ; mismatch d'hydratation sur `prefers-reduced-motion`) passaient
 * les deux au vert. Seuls le DOM calculé et une capture les révèlent.
 *
 * Usage :
 *   node verify-cinematic.mjs --url http://localhost:3001/cine-test --prefix cineFl
 *   node verify-cinematic.mjs --url ... --prefix cineFl --gate    # porte musique
 *
 * Contrôle : erreurs console + MISSING_MESSAGE · hydratation (2 modes) ·
 * opacités par phase · profondeur (parallaxe mesurée) · captures.
 */
import { chromium } from '@playwright/test';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const has = (n) => process.argv.includes(`--${n}`);

const URL = arg('url', 'http://localhost:3001/cine-test');
const P = arg('prefix', 'cineFl'); // préfixe de classes du thème
const OUT = arg('out', '.context/cine-verify');
const GATE = has('gate'); // franchir la porte « Ouvrir l'invitation »

// La bannière RGPD masque le bas de scène ET se remonte si on la supprime
// après coup : poser le consentement AVANT tout rendu.
const CONSENT = () => {
  try {
    localStorage.setItem('wedillybird-cookie-consent', 'accepted');
  } catch {}
};
const HIDE_DEV = () => {
  const add = () => {
    const s = document.createElement('style');
    s.textContent = 'nextjs-portal{display:none !important}';
    document.head?.appendChild(s);
  };
  if (document.head) add();
  else document.addEventListener('DOMContentLoaded', add);
};

async function open(browser, { reducedMotion, settle = 1200 } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    ...(reducedMotion ? { reducedMotion } : {}),
  });
  await ctx.addInitScript(CONSENT);
  const page = await ctx.newPage();
  await page.addInitScript(HIDE_DEV);
  const issues = [];
  page.on('console', (m) => {
    const t = m.text();
    if (/MISSING_MESSAGE|hydrat|did not match|server rendered|Warning/i.test(t))
      issues.push(`[${m.type()}] ${t.slice(0, 200)}`);
  });
  page.on('pageerror', (e) => issues.push(`PAGEERROR ${e.message.slice(0, 200)}`));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(settle);
  if (GATE) {
    // La porte n'apparaît que si l'event porte une musique.
    const b = await page
      .waitForSelector('[class*="inv-gate"] button', { timeout: 8000 })
      .catch(() => null);
    if (b) await b.click();
  }
  return { ctx, page, issues };
}

/**
 * Lit l'état DÈS que la scène est montée.
 *
 * Indispensable : le shell DÉMONTE la cinématique dès `onDone` — au bout de
 * ~10 s en animé, mais de 600 ms seulement en mouvement réduit. Mesurer après
 * un délai fixe fait conclure à tort « la cinématique ne s'affiche pas »
 * (les captures d'écran, à elles seules, consomment plus que cette fenêtre).
 */
async function readState(page, prefix) {
  await page.waitForSelector(`[class*="${prefix}-stage"]`, { timeout: 15000 });
  return page.evaluate((p) => {
    const st = document.querySelector(`[class*="${p}-stage"]`);
    const op = (s) => {
      const e = document.querySelector(s);
      return e ? +getComputedStyle(e).opacity : null;
    };
    return {
      classes: st?.className ?? null,
      phase: st?.getAttribute('data-phase') ?? null,
      vidéoMontée: !!document.querySelector('video'),
      imageFixe: !!document.querySelector(`[class*="${p}-plate-still"]`),
      // texte présent dans le DOM mais opacité 0 => classes de phase mal préfixées
      opacités: {
        eyebrow: op(`[class*="${p}-eyebrow"]`),
        noms: op(`[class*="${p}-names"]`),
        date: op(`[class*="${p}-date"]`),
      },
      textes: [
        ...document.querySelectorAll(
          `[class*="${p}-eyebrow"],[class*="${p}-name"],[class*="${p}-date"],[class*="${p}-venue"]`,
        ),
      ]
        .map((e) => e.textContent)
        .filter(Boolean),
    };
  }, prefix);
}

const browser = await chromium.launch();
const report = {};

/* --- 1. Déroulé animé : un état + une capture À CHAQUE phase ------------ */
{
  const { ctx, page, issues } = await open(browser);
  const shots = [
    ['1-ouverture', 1600],
    ['2-transition', 5200],
    ['3-eyebrow', 6300],
    ['4-prenoms', 7500],
  ];
  const étapes = [];
  let prev = 0;
  for (const [name, at] of shots) {
    await page.waitForTimeout(Math.max(0, at - prev));
    prev = at;
    // état AVANT la capture : un screenshot coûte des centaines de ms
    const s = await readState(page, P).catch(() => null);
    if (s) étapes.push({ étape: name, phase: s.phase, opacités: s.opacités });
    await page.screenshot({ path: `${OUT}/${name}.png` });
  }
  const dernier = await readState(page, P).catch(() => null);
  report.animé = {
    étapes,
    final: dernier && {
      phase: dernier.phase,
      classes: dernier.classes,
      opacités: dernier.opacités,
      textes: dernier.textes,
    },
    problèmes: issues.length ? issues : 'AUCUN',
  };
  await ctx.close();
}

/* --- 2. Mouvement réduit : état apaisé, image fixe, aucune vidéo -------- */
{
  // `settle: 0` : en reduced la scène ne vit que ~600 ms — on lit immédiatement.
  const { ctx, page, issues } = await open(browser, { reducedMotion: 'reduce', settle: 0 });
  const s = await readState(page, P).catch(() => null);
  await page.screenshot({ path: `${OUT}/reduced.png` });
  report.mouvementRéduit = s
    ? {
        phase: s.phase,
        vidéoMontée: s.vidéoMontée, // doit être false
        imageFixe: s.imageFixe, // doit être true
        opacités: s.opacités, // tout doit être à 1 d'emblée
        problèmes: issues.length ? issues : 'AUCUN',
      }
    : { erreur: 'scène jamais montée (démontée avant lecture ?)', problèmes: issues };
  await ctx.close();
}

/* --- 3. Profondeur : déplacement de chaque plan sous rotation ----------- */
{
  const { ctx, page } = await open(browser);
  await page.waitForTimeout(7000);
  // Figer les animations : sinon le mouvement propre des particules fausse tout.
  await page.addStyleTag({ content: '*{animation-play-state:paused !important}' });
  await page.waitForTimeout(300);
  const centres = () =>
    page.evaluate((p) => {
      const x = (s) => {
        const e = document.querySelector(s);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return +(r.x + r.width / 2).toFixed(1);
      };
      return {
        fond: x(`.${p}-plate`),
        loin: x(`.${p}-depth-far .${p}-petal`),
        texte: x(`.${p}-names`),
        milieu: x(`.${p}-depth-mid .${p}-petal`),
        proche: x(`.${p}-depth-near .${p}-petal`),
      };
    }, P);
  const cam = (ry) =>
    page.evaluate(
      ({ v, p }) => {
        const s = document.querySelector(`.${p}-stage`);
        s?.style.setProperty('--ry', `${v}deg`);
        s?.style.setProperty('--rx', '0deg');
      },
      { v: ry, p: P },
    );
  await cam(0);
  await page.waitForTimeout(800);
  const a = await centres();
  await cam(10);
  await page.waitForTimeout(800);
  const b = await centres();
  await page.screenshot({ path: `${OUT}/profondeur.png` });
  report.profondeur_px = Object.fromEntries(
    Object.keys(a).map((k) => [k, a[k] != null && b[k] != null ? +(b[k] - a[k]).toFixed(1) : null]),
  );
  // Attendu : déplacement proportionnel à Z, signes opposés autour du texte (0).
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
console.log(`\nCaptures : ${OUT}/`);
