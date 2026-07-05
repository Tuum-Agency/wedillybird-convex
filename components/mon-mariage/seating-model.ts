// Wedillybird — Plan de table · MODÈLE (types, géométrie à l'échelle, catalogues, helpers)
// Tout est pensé en MÈTRES réels : la salle, les tables, les éléments. Le rendu
// convertit en pixels via BASE_PPM (px / mètre) puis applique le zoom. Le modèle
// reste pur (aucun JSX) → réutilisable et testable. Source de vérité d'un invité
// = guest.tableId ; l'occupation d'une table se recalcule depuis les invités.
// Modèle UNIT-PERSONS : un invité « +2 » occupe 3 places.

/* ============================ ÉCHELLE ============================ */
export const BASE_PPM = 40; // pixels par mètre à zoom = 1
export const GRID_M = 1; // pas de grille en mètres
export const TILT_3D = 55; // inclinaison du sol en vue 3D (degrés)
export const mPx = (m: number): number => m * BASE_PPM;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const r2 = (v: number): number => Math.round(v * 100) / 100;

/* ============================ TYPES ============================ */
export type SeatCatKey = 'family' | 'friends' | 'colleagues' | 'pro';
export type TableShape = 'round' | 'oval' | 'rect' | 'square' | 'imperial' | 'sweetheart' | 'head';
export type ElementKind =
  | 'dancefloor'
  | 'stage'
  | 'dj'
  | 'bar'
  | 'buffet'
  | 'cake'
  | 'photobooth'
  | 'gifts'
  | 'guestbook'
  | 'entrance'
  | 'arch'
  | 'plant';
export type FloorKind = 'parquet' | 'marble' | 'carpet' | 'grass' | 'concrete';
export type RsvpStatus = 'confirmed' | 'pending' | 'declined' | 'noreply';
export type ViewMode = '3d' | 'plan';
export type SeatObjectKind = 'table' | 'element';

export interface SeatGuest {
  id: string;
  name: string;
  category: SeatCatKey;
  partySize: number;
  status?: RsvpStatus;
  tableId?: string;
}

export interface SeatTable {
  id: string;
  label: string;
  shape: TableShape;
  capacity: number;
  /** centre, en mètres depuis le coin haut-gauche de la salle */
  x: number;
  y: number;
  /** rotation en degrés */
  rotation: number;
  /** table mise en avant (honneur) → ornement gold */
  honor?: boolean;
  notes?: string;
}

export interface RoomElement {
  id: string;
  kind: ElementKind;
  /** centre, en mètres */
  x: number;
  y: number;
  /** dimensions en mètres (avant rotation) */
  w: number;
  h: number;
  rotation: number;
  label?: string;
}

export interface RoomConfig {
  name: string;
  widthM: number;
  lengthM: number;
  floor: FloorKind;
}

export interface SeatView {
  x: number;
  y: number;
  k: number;
  mode: ViewMode;
}

export interface SeatTotals {
  total: number;
  seated: number;
  pool: number;
}

/* ============================ CATÉGORIES (LIGHT premium) ============================
   couleur = lien de groupe. `color` lisible sur ivoire (AA), `soft` = fond de chip,
   `ink` = texte posé sur la couleur. Les libellés sont des clés i18n. */
export const SEAT_CATS: Record<
  SeatCatKey,
  { label: string; short: string; color: string; soft: string; ink: string }
> = {
  family: {
    label: 'MonMariage.seating.cats.family.label',
    short: 'MonMariage.seating.cats.family.short',
    color: 'oklch(64% 0.13 18)',
    soft: 'oklch(94% 0.035 22)',
    ink: 'oklch(99% 0.01 60)',
  },
  friends: {
    label: 'MonMariage.seating.cats.friends.label',
    short: 'MonMariage.seating.cats.friends.short',
    color: 'oklch(60% 0.095 150)',
    soft: 'oklch(94% 0.03 150)',
    ink: 'oklch(99% 0.01 150)',
  },
  colleagues: {
    label: 'MonMariage.seating.cats.colleagues.label',
    short: 'MonMariage.seating.cats.colleagues.short',
    color: 'oklch(66% 0.105 70)',
    soft: 'oklch(95% 0.035 80)',
    ink: 'oklch(28% 0.04 70)',
  },
  pro: {
    label: 'MonMariage.seating.cats.pro.label',
    short: 'MonMariage.seating.cats.pro.short',
    color: 'oklch(58% 0.085 255)',
    soft: 'oklch(94% 0.028 255)',
    ink: 'oklch(99% 0.01 255)',
  },
};
export const SEAT_CAT_KEYS: SeatCatKey[] = ['family', 'friends', 'colleagues', 'pro'];

/* ============================ CATALOGUE DE FORMES ============================ */
export interface ShapeSpec {
  labelKey: string;
  shortKey: string;
  icon: string;
  defaultCap: number;
  minCap: number;
  maxCap: number;
  /** capacité éditable (sweetheart = non) */
  fixedCap?: boolean;
}
export const TABLE_SHAPES: Record<TableShape, ShapeSpec> = {
  round: {
    labelKey: 'shapeRound',
    shortKey: 'shapeRoundShort',
    icon: 'Circle',
    defaultCap: 8,
    minCap: 4,
    maxCap: 12,
  },
  oval: {
    labelKey: 'shapeOval',
    shortKey: 'shapeOvalShort',
    icon: 'Circle',
    defaultCap: 10,
    minCap: 6,
    maxCap: 14,
  },
  rect: {
    labelKey: 'shapeRect',
    shortKey: 'shapeRectShort',
    icon: 'RectangleH',
    defaultCap: 8,
    minCap: 4,
    maxCap: 16,
  },
  square: {
    labelKey: 'shapeSquare',
    shortKey: 'shapeSquareShort',
    icon: 'Square',
    defaultCap: 4,
    minCap: 2,
    maxCap: 8,
  },
  imperial: {
    labelKey: 'shapeImperial',
    shortKey: 'shapeImperialShort',
    icon: 'RectangleH',
    defaultCap: 16,
    minCap: 8,
    maxCap: 30,
  },
  sweetheart: {
    labelKey: 'shapeSweetheart',
    shortKey: 'shapeSweetheartShort',
    icon: 'Heart',
    defaultCap: 2,
    minCap: 2,
    maxCap: 2,
    fixedCap: true,
  },
  head: {
    labelKey: 'shapeHead',
    shortKey: 'shapeHeadShort',
    icon: 'Crown',
    defaultCap: 8,
    minCap: 4,
    maxCap: 20,
  },
};
export const TABLE_SHAPE_KEYS: TableShape[] = [
  'round',
  'oval',
  'rect',
  'square',
  'imperial',
  'sweetheart',
  'head',
];

/* ============================ GÉOMÉTRIE (en mètres) ============================ */
/* plateau (surface de la table) selon forme + capacité */
export function tableSurfaceM(shape: TableShape, cap: number): { w: number; h: number } {
  switch (shape) {
    case 'round': {
      const d = clamp(1.0 + cap * 0.13, 1.2, 2.8);
      return { w: d, h: d };
    }
    case 'square': {
      const s = clamp(0.7 + cap * 0.16, 0.9, 2.0);
      return { w: s, h: s };
    }
    case 'oval': {
      const w = clamp(1.2 + cap * 0.18, 1.6, 3.6);
      return { w, h: 1.05 };
    }
    case 'rect': {
      const top = Math.ceil(cap / 2);
      return { w: clamp(0.4 + top * 0.62, 1.2, 6), h: 0.95 };
    }
    case 'imperial': {
      const top = Math.ceil(cap / 2);
      return { w: clamp(0.4 + top * 0.62, 2.0, 8.5), h: 1.15 };
    }
    case 'sweetheart':
      return { w: 1.4, h: 0.75 };
    case 'head':
      return { w: clamp(0.5 + cap * 0.62, 1.8, 7), h: 0.85 };
  }
}

/* empreinte totale (plateau + dégagement chaises) — sert au cadrage & aux collisions */
export function tableFootprintM(shape: TableShape, cap: number): { w: number; h: number } {
  const s = tableSurfaceM(shape, cap);
  const one = shape === 'head' || shape === 'sweetheart';
  return { w: s.w + 1.0, h: s.h + (one ? 0.7 : 1.0) };
}

const CH_GAP = 0.32; // distance plateau → centre de la chaise (m)
function lineSlots(n: number, span: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];
  const usable = Math.max(span - 0.5, 0.3);
  return Array.from({ length: n }, (_, i) => -usable / 2 + (usable * i) / (n - 1));
}

/* positions des chaises autour d'une table, en mètres (relatif au centre).
   rot = orientation de la chaise (dossier vers l'extérieur). */
export function tableChairsM(
  shape: TableShape,
  cap: number,
): Array<{ x: number; y: number; rot: number }> {
  const { w, h } = tableSurfaceM(shape, cap);
  const out: Array<{ x: number; y: number; rot: number }> = [];
  if (shape === 'round' || shape === 'oval') {
    if (shape === 'oval') {
      // ovale : sièges sur les deux grands côtés
      const top = Math.ceil(cap / 2);
      const bot = cap - top;
      lineSlots(top, w).forEach((x) => out.push({ x, y: -(h / 2 + CH_GAP), rot: 0 }));
      lineSlots(bot, w).forEach((x) => out.push({ x, y: h / 2 + CH_GAP, rot: 180 }));
      return out;
    }
    const r = w / 2 + CH_GAP;
    for (let i = 0; i < cap; i++) {
      const a = (i / cap) * 2 * Math.PI - Math.PI / 2;
      const x = r * Math.cos(a);
      const y = r * Math.sin(a);
      out.push({ x, y, rot: (Math.atan2(y, x) * 180) / Math.PI + 90 });
    }
    return out;
  }
  if (shape === 'square') {
    // réparti sur les 4 côtés
    const per = [0, 0, 0, 0];
    for (let i = 0; i < cap; i++) per[i % 4]!++;
    const off = w / 2 + CH_GAP;
    lineSlots(per[0]!, w).forEach((x) => out.push({ x, y: -off, rot: 0 }));
    lineSlots(per[1]!, h).forEach((y) => out.push({ x: off, y, rot: 90 }));
    lineSlots(per[2]!, w).forEach((x) => out.push({ x, y: off, rot: 180 }));
    lineSlots(per[3]!, h).forEach((y) => out.push({ x: -off, y, rot: 270 }));
    return out;
  }
  if (shape === 'rect' || shape === 'imperial') {
    const top = Math.ceil(cap / 2);
    const bot = cap - top;
    lineSlots(top, w).forEach((x) => out.push({ x, y: -(h / 2 + CH_GAP), rot: 0 }));
    lineSlots(bot, w).forEach((x) => out.push({ x, y: h / 2 + CH_GAP, rot: 180 }));
    return out;
  }
  // head / sweetheart : une seule rangée, face à la salle (+y)
  lineSlots(cap, w).forEach((x) => out.push({ x, y: -(h / 2 + CH_GAP), rot: 0 }));
  return out;
}

/* ============================ CATALOGUE D'ÉLÉMENTS DE SALLE ============================ */
export type ElementVariant = 'floor' | 'raised' | 'round' | 'soft' | 'line';
export interface ElementSpec {
  labelKey: string;
  icon: string;
  w: number;
  h: number;
  variant: ElementVariant;
  /** accent : 'gold' | 'blush' | 'sage' | 'ink' */
  accent: string;
}
export const ELEMENT_KINDS: Record<ElementKind, ElementSpec> = {
  dancefloor: {
    labelKey: 'elDancefloor',
    icon: 'Sparkles',
    w: 5,
    h: 5,
    variant: 'floor',
    accent: 'gold',
  },
  stage: { labelKey: 'elStage', icon: 'Music', w: 5, h: 2.4, variant: 'raised', accent: 'ink' },
  dj: { labelKey: 'elDj', icon: 'Music', w: 1.8, h: 1.0, variant: 'raised', accent: 'ink' },
  bar: { labelKey: 'elBar', icon: 'Wine', w: 3.6, h: 0.8, variant: 'raised', accent: 'blush' },
  buffet: {
    labelKey: 'elBuffet',
    icon: 'Utensils',
    w: 3.6,
    h: 1.0,
    variant: 'soft',
    accent: 'sage',
  },
  cake: {
    labelKey: 'elCake',
    icon: 'CakeSlice',
    w: 1.1,
    h: 1.1,
    variant: 'round',
    accent: 'blush',
  },
  photobooth: {
    labelKey: 'elPhotobooth',
    icon: 'Camera',
    w: 1.8,
    h: 1.8,
    variant: 'soft',
    accent: 'ink',
  },
  gifts: { labelKey: 'elGifts', icon: 'Gift', w: 1.4, h: 0.7, variant: 'soft', accent: 'gold' },
  guestbook: {
    labelKey: 'elGuestbook',
    icon: 'FileText',
    w: 1.0,
    h: 0.6,
    variant: 'soft',
    accent: 'gold',
  },
  entrance: {
    labelKey: 'elEntrance',
    icon: 'DoorOpen',
    w: 1.8,
    h: 0.4,
    variant: 'line',
    accent: 'ink',
  },
  arch: { labelKey: 'elArch', icon: 'Flower', w: 2.6, h: 0.5, variant: 'line', accent: 'sage' },
  plant: {
    labelKey: 'elPlant',
    icon: 'Flower',
    w: 0.85,
    h: 0.85,
    variant: 'round',
    accent: 'sage',
  },
};
export const ELEMENT_KEYS: ElementKind[] = [
  'dancefloor',
  'stage',
  'dj',
  'bar',
  'buffet',
  'cake',
  'photobooth',
  'gifts',
  'guestbook',
  'arch',
  'plant',
  'entrance',
];

/* ============================ GABARITS DE SALLE ============================ */
export interface RoomTemplate {
  key: string;
  nameKey: string;
  icon: string;
  widthM: number;
  lengthM: number;
  floor: FloorKind;
  elements: Array<{
    kind: ElementKind;
    x: number;
    y: number;
    rotation?: number;
    w?: number;
    h?: number;
  }>;
}
export const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    key: 'ballroom',
    nameKey: 'tplBallroom',
    icon: 'Sparkles',
    widthM: 18,
    lengthM: 13,
    floor: 'parquet',
    elements: [
      { kind: 'stage', x: 9, y: 1.6 },
      { kind: 'dancefloor', x: 9, y: 6.4 },
      { kind: 'bar', x: 16, y: 4 },
      { kind: 'buffet', x: 16, y: 10 },
      { kind: 'entrance', x: 2.4, y: 12.6 },
    ],
  },
  {
    key: 'tent',
    nameKey: 'tplTent',
    icon: 'Home',
    widthM: 22,
    lengthM: 15,
    floor: 'grass',
    elements: [
      { kind: 'dancefloor', x: 11, y: 7.4, w: 6, h: 6 },
      { kind: 'dj', x: 11, y: 2.4 },
      { kind: 'bar', x: 19, y: 4 },
      { kind: 'buffet', x: 4, y: 4 },
      { kind: 'arch', x: 11, y: 13.6 },
    ],
  },
  {
    key: 'restaurant',
    nameKey: 'tplRestaurant',
    icon: 'Utensils',
    widthM: 13,
    lengthM: 9,
    floor: 'carpet',
    elements: [
      { kind: 'bar', x: 11, y: 1.4 },
      { kind: 'cake', x: 6.5, y: 1.6 },
      { kind: 'entrance', x: 2, y: 8.6 },
    ],
  },
  {
    key: 'garden',
    nameKey: 'tplGarden',
    icon: 'Flower',
    widthM: 17,
    lengthM: 17,
    floor: 'grass',
    elements: [
      { kind: 'arch', x: 8.5, y: 1.6 },
      { kind: 'dancefloor', x: 8.5, y: 9, w: 5, h: 5 },
      { kind: 'bar', x: 15, y: 5 },
      { kind: 'plant', x: 2, y: 2 },
      { kind: 'plant', x: 15, y: 14.5 },
    ],
  },
];

export const FLOOR_KEYS: FloorKind[] = ['parquet', 'marble', 'carpet', 'grass', 'concrete'];
export const FLOOR_LABEL_KEYS: Record<FloorKind, string> = {
  parquet: 'floorParquet',
  marble: 'floorMarble',
  carpet: 'floorCarpet',
  grass: 'floorGrass',
  concrete: 'floorConcrete',
};

/* ============================ HELPERS ============================ */
export function tableOccupancy(guests: SeatGuest[], tableId: string): number {
  return guests.filter((g) => g.tableId === tableId).reduce((a, g) => a + g.partySize, 0);
}
export function tableGuests(guests: SeatGuest[], tableId: string): SeatGuest[] {
  return guests.filter((g) => g.tableId === tableId);
}
export function seatTotals(guests: SeatGuest[]): SeatTotals {
  const total = guests.reduce((a, g) => a + g.partySize, 0);
  const seated = guests.filter((g) => g.tableId).reduce((a, g) => a + g.partySize, 0);
  return { total, seated, pool: total - seated };
}
export function occState(occ: number, cap: number): 'over' | 'full' | 'ok' | 'empty' {
  if (occ > cap) return 'over';
  if (occ === cap) return 'full';
  if (occ === 0) return 'empty';
  return 'ok';
}
export function seatInitials(name: string): string {
  const clean = name.replace(/[«»]/g, '').trim();
  const parts = clean.split(/[\s&]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}
export function totalSeats(tables: SeatTable[]): number {
  return tables.reduce((a, t) => a + t.capacity, 0);
}
export function roomAreaM2(room: RoomConfig): number {
  return r2(room.widthM * room.lengthM);
}
/** m² de plancher par convive (confort) ; ~1,1+ = à l'aise, < 0,8 = serré */
export function comfortPerGuest(room: RoomConfig, persons: number): number {
  if (persons <= 0) return roomAreaM2(room);
  return r2(roomAreaM2(room) / persons);
}
export function comfortState(ratio: number): 'tight' | 'cosy' | 'roomy' {
  if (ratio < 0.85) return 'tight';
  if (ratio < 1.6) return 'cosy';
  return 'roomy';
}
export const fmtM = (m: number): string => (Number.isInteger(m) ? String(m) : m.toFixed(1));
