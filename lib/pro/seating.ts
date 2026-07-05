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

/** Formes de table disponibles (source de vérité partagée par les deux plans de table agence). */
export type TableShape = 'round' | 'oval' | 'rect' | 'square';
export const TABLE_SHAPES: readonly TableShape[] = ['round', 'oval', 'rect', 'square'] as const;
/** Clés i18n (libellé long / court) par forme — namespace au choix de l'appelant. */
export const TABLE_SHAPE_KEYS: Record<TableShape, { label: string; short: string }> = {
  round: { label: 'shapeRound', short: 'shapeRoundShort' },
  oval: { label: 'shapeOval', short: 'shapeOvalShort' },
  rect: { label: 'shapeRect', short: 'shapeRectShort' },
  square: { label: 'shapeSquare', short: 'shapeSquareShort' },
};

/** Dimensions (px) d'une table sur le canvas selon forme + capacité. */
export function tableDims(
  shape: TableShape | undefined,
  capacity: number,
): { w: number; h: number } {
  if (shape === 'rect') return { w: 130 + capacity * 9, h: 96 };
  if (shape === 'oval') return { w: 128 + capacity * 9, h: 108 };
  if (shape === 'square') {
    const s = 88 + capacity * 7;
    return { w: s, h: s };
  }
  const d = 92 + capacity * 8; // round
  return { w: d, h: d };
}

/** Répartit n points sur un segment [−span/2, span/2] (avec marges). */
function lineSlots(n: number, span: number, pad: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [span / 2];
  return Array.from({ length: n }, (_, i) => pad + (span - 2 * pad) * (i / (n - 1)));
}

/**
 * Positions des sièges autour d'une table :
 *  - round / oval → ellipse (rayons w/2, h/2 + dégagement) ;
 *  - rect → rangées haut / bas (banquet) ;
 *  - square → réparti sur les 4 côtés.
 */
export function seatPositions(
  shape: TableShape | undefined,
  count: number,
  w: number,
  h: number,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const cx = w / 2;
  const cy = h / 2;
  if (shape === 'rect') {
    const top = Math.ceil(count / 2);
    const bot = count - top;
    lineSlots(top, w, 26).forEach((x) => pts.push({ x, y: -16 }));
    lineSlots(bot, w, 26).forEach((x) => pts.push({ x, y: h + 16 }));
  } else if (shape === 'square') {
    const per = [0, 0, 0, 0];
    for (let i = 0; i < count; i++) per[i % 4]!++;
    lineSlots(per[0]!, w, 20).forEach((x) => pts.push({ x, y: -16 }));
    lineSlots(per[1]!, h, 20).forEach((y) => pts.push({ x: w + 16, y }));
    lineSlots(per[2]!, w, 20).forEach((x) => pts.push({ x, y: h + 16 }));
    lineSlots(per[3]!, h, 20).forEach((y) => pts.push({ x: -16, y }));
  } else {
    // round + oval : ellipse
    const rx = w / 2 + 16;
    const ry = h / 2 + 16;
    for (let i = 0; i < count; i++) {
      const a = (i / Math.max(1, count)) * 2 * Math.PI - Math.PI / 2;
      pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
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
