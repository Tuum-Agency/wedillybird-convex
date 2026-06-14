import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Garde-fou i18n du dashboard super admin. Le namespace `Admin` est consommé par
 * `getTranslations('Admin')` / `useTranslations('Admin')` dans tout `/admin`.
 * Une clé référencée mais absente du catalogue throw `MISSING_MESSAGE` au runtime
 * (tsc ne le détecte pas). Ce test ferme cette boucle :
 *   1. toute clé `Admin.*` statique du code existe dans fr.json (source de vérité)
 *   2. les 7 locales ont exactement les mêmes clés `Admin` (parité)
 */

const ROOT = resolve(__dirname, '..', '..', '..');
const LOCALES = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ar'];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

function flatten(obj: unknown, pre = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [pre];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, pre ? `${pre}.${k}` : k),
  );
}

function loadAdmin(locale: string): Record<string, unknown> {
  const m = JSON.parse(readFileSync(join(ROOT, 'messages', `${locale}.json`), 'utf8'));
  return m.Admin ?? {};
}

/** Clés `Admin.*` STATIQUES référencées dans le code (hors clés dynamiques `t(`x.${y}`)`). */
function referencedStaticKeys(): Set<string> {
  const dirs = [join(ROOT, 'components', 'admin'), join(ROOT, 'app', '[locale]', '(app)', 'admin')];
  const re = /\bt(?:\.(?:has|rich))?\(\s*['"`]([A-Za-z0-9_.]+)['"`]/g;
  const keys = new Set<string>();
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      const src = readFileSync(file, 'utf8');
      // Le composant doit cibler le namespace Admin pour que les clés en relèvent.
      if (!src.includes("Translations('Admin')")) continue;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) keys.add(m[1]!);
    }
  }
  return keys;
}

describe('i18n — namespace Admin', () => {
  const frKeys = new Set(flatten(loadAdmin('fr')));

  it('fr.json contient un namespace Admin non vide', () => {
    expect(frKeys.size).toBeGreaterThan(100);
  });

  it('chaque clé Admin.* statique du code existe dans fr.json', () => {
    const referenced = referencedStaticKeys();
    expect(referenced.size).toBeGreaterThan(50); // sanity : on a bien trouvé des clés
    const missing = [...referenced].filter((k) => !frKeys.has(k)).sort();
    expect(
      missing,
      `Clés référencées absentes de messages/fr.json:\n${missing.join('\n')}`,
    ).toEqual([]);
  });

  it('les 7 locales ont exactement les mêmes clés Admin (parité)', () => {
    for (const locale of LOCALES) {
      if (locale === 'fr') continue;
      const keys = new Set(flatten(loadAdmin(locale)));
      const missing = [...frKeys].filter((k) => !keys.has(k));
      const extra = [...keys].filter((k) => !frKeys.has(k));
      expect(missing, `${locale}: clés Admin manquantes vs fr`).toEqual([]);
      expect(extra, `${locale}: clés Admin en trop vs fr`).toEqual([]);
    }
  });

  it('préserve les placeholders {param} et le tag <mono> dans toutes les locales', () => {
    const fr = loadAdmin('fr');
    const flatFr = Object.fromEntries(
      flatten(fr).map((k) => [
        k,
        k.split('.').reduce<unknown>((o, part) => (o as Record<string, unknown>)?.[part], fr),
      ]),
    );
    const tokens = (s: unknown) => {
      const str = String(s);
      return [
        ...(str.match(/\{[a-zA-Z0-9_]+\}/g) ?? []),
        ...(str.match(/<\/?[a-zA-Z0-9_]+>/g) ?? []),
      ].sort();
    };
    for (const locale of LOCALES) {
      if (locale === 'fr') continue;
      const loc = loadAdmin(locale);
      for (const [key, frVal] of Object.entries(flatFr)) {
        const locVal = key
          .split('.')
          .reduce<unknown>((o, part) => (o as Record<string, unknown>)?.[part], loc);
        expect(tokens(locVal), `${locale} ${key}: placeholders divergents`).toEqual(tokens(frVal));
      }
    }
  });
});
