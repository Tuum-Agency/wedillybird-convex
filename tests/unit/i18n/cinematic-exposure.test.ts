import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AVAILABLE_CINEMATIC_IDS,
  CINEMATIC_META,
  type CinematicId,
} from '@/components/invitation/cinematics/registry';
import { THEME_SWATCH } from '@/components/invitation/cinematics/theme-visuals';

/**
 * Garde-fou d'EXPOSITION des cinématiques.
 *
 * Ajouter un id à `AVAILABLE_CINEMATIC_IDS` le rend choisissable par les couples
 * et les agences. Si l'univers n'est pas complet, l'invitation plante au runtime
 * (`MISSING_MESSAGE`) — que `tsc` ne voit pas, et que `i18n:validate` ne voit pas
 * non plus : celui-ci compare les locales entre elles, or une clé absente des 7
 * fichiers les laisse en parité.
 *
 * C'est le cas aujourd'hui de `theatre` (`actOne`) et `voyage` (`passDate`,
 * `passGate`, `passSeat`) : ils vivent dans le code, mais les exposer casserait
 * l'invitation. Ce test échouera si on les ajoute sans traduire leurs clés.
 */

const ROOT = resolve(__dirname, '..', '..', '..');
const LOCALES = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ar'] as const;

const catalogues = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(readFileSync(resolve(ROOT, 'messages', `${l}.json`), 'utf8'))]),
) as Record<(typeof LOCALES)[number], Record<string, unknown>>;

/** Descend un chemin pointé ; `undefined` si un maillon manque. */
function get(tree: unknown, dotted: string): unknown {
  let cur: unknown = tree;
  for (const part of dotted.split('.')) {
    if (typeof cur !== 'object' || cur === null || !(part in cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Fichier source du thème (`seal` est le composant v3 historique). */
function sourceOf(id: CinematicId): string {
  const path =
    id === 'seal'
      ? resolve(ROOT, 'components/invitation/cinematic2.tsx')
      : resolve(ROOT, 'components/invitation/cinematics', `${id}.tsx`);
  return readFileSync(path, 'utf8');
}

// `t('x')` non précédé d'un caractère d'identifiant : écarte les faux positifs
// du type `.get('replay')`, dont le suffixe ressemble à `t('`.
const CALL = /(?<![A-Za-z0-9_$.])t\(\s*'([A-Za-z0-9_.]+)'/g;

describe('exposition des cinématiques', () => {
  it('expose au moins le sceau (défaut historique)', () => {
    expect(AVAILABLE_CINEMATIC_IDS).toContain('seal');
  });

  describe.each(AVAILABLE_CINEMATIC_IDS)('« %s »', (id) => {
    it('a des métadonnées et une vignette', () => {
      expect(CINEMATIC_META[id]).toBeDefined();
      expect(CINEMATIC_META[id].id).toBe(id);
      expect(THEME_SWATCH[id]).toBeTruthy();
    });

    it('a un nom et une description dans les 7 locales', () => {
      for (const loc of LOCALES) {
        for (const field of ['name', 'desc'] as const) {
          const value = get(catalogues[loc], `InvitationDesign.themes.${id}.${field}`);
          expect(value, `${loc} → InvitationDesign.themes.${id}.${field}`).toBeTypeOf('string');
          expect((value as string).trim().length, `${loc} → ${id}.${field} vide`).toBeGreaterThan(
            0,
          );
        }
      }
    });

    it("n'appelle aucune clé de traduction absente du catalogue", () => {
      const src = sourceOf(id);
      const ns = src.match(/useTranslations\(\s*'([A-Za-z0-9_.]+)'\s*\)/)?.[1];
      if (!ns) return; // thème sans texte traduit
      const keys = [...src.matchAll(CALL)].map((m) => m[1]);
      for (const key of new Set(keys)) {
        for (const loc of LOCALES) {
          expect(get(catalogues[loc], `${ns}.${key}`), `${loc} → ${ns}.${key}`).toBeDefined();
        }
      }
    });
  });
});
