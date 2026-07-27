/**
 * Helpers purs du plan de table (agence, dark) — couleurs de catégories,
 * géométrie des tables/sièges, états d'occupation. Aucune dépendance React/DOM
 * → testable. Le board immutable vit dans `lib/seating/board.ts` (réutilisé).
 */

export interface SeatCatMeta {
  label: string;
  short: string;
  color: string;
  soft: string;
}

/** Teintes de marque par catégorie connue (FR), sinon dérivée du nom. */
const KNOWN_CAT_HUE: Record<string, number> = {
  famille: 22,
  family: 22,
  amis: 150,
  friends: 150,
  collègues: 80,
  collegues: 80,
  colleagues: 80,
  travail: 80,
  témoins: 320,
  temoins: 320,
  cortège: 320,
  cortege: 320,
  prestataires: 250,
  pro: 250,
  vendors: 250,
  enfants: 60,
};

function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function categoryHue(category?: string): number {
  const key = (category ?? '').trim().toLowerCase();
  if (!key) return 28;
  return KNOWN_CAT_HUE[key] ?? hueFromString(key);
}

/** Métadonnées d'affichage d'une catégorie (couleur pleine + tuile sombre). */
export function categoryMeta(category?: string): SeatCatMeta {
  const label = category?.trim() || 'Autre';
  const hue = categoryHue(category);
  return {
    label,
    short: label.length > 6 ? `${label.slice(0, 5)}.` : label,
    color: `oklch(73% 0.095 ${hue})`,
    soft: `oklch(30% 0.05 ${hue})`,
  };
}

/** Initiales depuis un nom (« Famille Ndiaye » → « FN », « Awa & Karim » → « AK »). */
export function seatInitials(name: string): string {
  const clean = name.replace(/[«»]/g, '').trim();
  const parts = clean.split(/[\s&]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

export type OccState = 'over' | 'full' | 'ok' | 'empty';
export function occState(occ: number, cap: number): OccState {
  if (occ > cap) return 'over';
  if (cap > 0 && occ === cap) return 'full';
  if (occ === 0) return 'empty';
  return 'ok';
}

/** Dimensions (px) d'une table sur le canvas selon forme + capacité. */
export function tableDims(
  shape: 'round' | 'rect' | undefined,
  capacity: number,
): { w: number; h: number } {
  if (shape === 'rect') return { w: 130 + capacity * 9, h: 96 };
  const d = 92 + capacity * 8;
  return { w: d, h: d };
}

/** Positions des sièges autour d'une table (round = cercle, rect = haut/bas). */
export function seatPositions(
  shape: 'round' | 'rect' | undefined,
  count: number,
  w: number,
  h: number,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const cx = w / 2;
  const cy = h / 2;
  if (shape !== 'rect') {
    const rx = w / 2 + 16;
    const ry = h / 2 + 16;
    for (let i = 0; i < count; i++) {
      const a = (i / Math.max(1, count)) * 2 * Math.PI - Math.PI / 2;
      pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
  } else {
    const top = Math.ceil(count / 2);
    const bot = count - top;
    const pad = 26;
    for (let i = 0; i < top; i++) {
      pts.push({ x: pad + (w - 2 * pad) * (top === 1 ? 0.5 : i / (top - 1)), y: -16 });
    }
    for (let i = 0; i < bot; i++) {
      pts.push({ x: pad + (w - 2 * pad) * (bot === 1 ? 0.5 : i / (bot - 1)), y: h + 16 });
    }
  }
  return pts;
}

/** Réglages du placement automatique (exposés dans le popover « Auto-placer »). */
export interface AutoPlaceSettings {
  groupByCategory: boolean;
  keepGroupsTogether: boolean;
  balanceTables: boolean;
  createTables: boolean;
}

export const AUTO_PLACE_PRESET: AutoPlaceSettings = {
  groupByCategory: true,
  keepGroupsTogether: true,
  balanceTables: false,
  createTables: true,
};

/** Parse un id d'unité-personne (`guestId` ou `guestId:memberIndex`). */
export function parseSeatUnit(unitId: string): { guestId: string; memberIndex: number } {
  const sep = unitId.lastIndexOf(':');
  if (sep === -1) return { guestId: unitId, memberIndex: 0 };
  return {
    guestId: unitId.slice(0, sep),
    memberIndex: Number.parseInt(unitId.slice(sep + 1), 10) || 0,
  };
}
