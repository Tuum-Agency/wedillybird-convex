/**
 * Prestataires — types et helpers purs (catégories, filtrage, prix). UI + tests.
 */

export const VENDOR_CATEGORIES = [
  'Lieu',
  'Traiteur',
  'Photo / Vidéo',
  'Décoration & Fleurs',
  'Musique / DJ',
  'Beauté',
  'Pâtisserie',
  'Papeterie',
  'Transport',
  'Animation',
  'Autre',
] as const;

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

export interface VendorLike {
  name: string;
  category: string;
  location?: string;
  priceRange?: number;
}

/** Gamme de prix 1–3 → « € » / « €€ » / « €€€ ». */
export function priceLabel(range: number | undefined): string {
  if (!range || range < 1) return '—';
  return '€'.repeat(Math.min(3, Math.round(range)));
}

/** Libellé de gamme de prix (1 → Économique, 2 → Modéré, 3 → Premium). */
export function priceWord(range: number | undefined): string | null {
  const r = range ? Math.round(range) : 0;
  return r === 1 ? 'Économique' : r === 2 ? 'Modéré' : r === 3 ? 'Premium' : null;
}

/** Teinte OKLCH (hue) par catégorie de prestataire (cartes, icônes, pastilles). */
const VENDOR_CATEGORY_HUE: Record<string, number> = {
  Lieu: 22,
  Traiteur: 60,
  'Photo / Vidéo': 265,
  'Décoration & Fleurs': 340,
  'Musique / DJ': 150,
  Beauté: 320,
  Pâtisserie: 40,
  Papeterie: 85,
  Transport: 30,
  Animation: 200,
  Autre: 0,
};
export function vendorCategoryHue(category: string): number {
  const h = VENDOR_CATEGORY_HUE[category];
  if (h != null) return h;
  let acc = 0;
  for (let i = 0; i < category.length; i++) acc = (acc * 31 + category.charCodeAt(i)) % 360;
  return acc;
}

/** Initiales d'un prestataire (« Studio Lumen » → « SL »). */
export function vendorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const ini = parts
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('');
  return (ini || name.trim().charAt(0) || '·').toUpperCase();
}

/** Filtre par texte (nom/catégorie/lieu) et catégorie. Pur. */
export function filterVendors<T extends VendorLike>(
  vendors: readonly T[],
  opts: { query?: string; category?: string },
): T[] {
  const q = opts.query?.trim().toLowerCase() ?? '';
  const cat = opts.category && opts.category !== 'all' ? opts.category : null;
  return vendors.filter((v) => {
    if (cat && v.category !== cat) return false;
    if (!q) return true;
    return (
      v.name.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      (v.location ?? '').toLowerCase().includes(q)
    );
  });
}

/** Catégories présentes dans une liste (pour le filtre), ordonnées canoniquement. */
export function usedCategories(vendors: readonly VendorLike[]): string[] {
  const present = new Set(vendors.map((v) => v.category));
  const ordered = (VENDOR_CATEGORIES as readonly string[]).filter((c) => present.has(c));
  const extra = [...present].filter((c) => !(VENDOR_CATEGORIES as readonly string[]).includes(c));
  return [...ordered, ...extra];
}

/* -------------------------------------------------------------------------- */
/*  Engagements prestataire ↔ mariage (« Par mariage »)                       */
/* -------------------------------------------------------------------------- */

export const ENGAGEMENT_STATUSES = ['contacted', 'quoted', 'booked', 'confirmed'] as const;
export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number];

export const ENGAGEMENT_STATUS_META: Record<
  EngagementStatus,
  { label: string; bg: string; fg: string; dot: string }
> = {
  contacted: {
    label: 'Contacté',
    bg: 'var(--color-surface-elevated)',
    fg: 'var(--color-muted-foreground)',
    dot: 'var(--color-muted-foreground)',
  },
  quoted: {
    label: 'Devis reçu',
    bg: 'oklch(28% 0.022 78)',
    fg: 'oklch(85% 0.05 78)',
    dot: 'oklch(78% 0.08 78)',
  },
  booked: {
    label: 'Réservé',
    bg: 'oklch(28% 0.04 265)',
    fg: 'oklch(85% 0.06 265)',
    dot: 'oklch(78% 0.09 265)',
  },
  confirmed: {
    label: 'Confirmé',
    bg: 'oklch(26% 0.04 145)',
    fg: 'oklch(82% 0.07 145)',
    dot: 'oklch(72% 0.08 145)',
  },
};

export function isEngagementStatus(value: unknown): value is EngagementStatus {
  return (ENGAGEMENT_STATUSES as readonly string[]).includes(value as string);
}

export interface EngagementLike {
  status: EngagementStatus;
  plannedMinor?: number;
}

export interface EngagementKpis {
  total: number;
  confirmed: number;
  budgetMinor: number;
}

/** KPIs de la surface « Par mariage » : nb prestataires, confirmés, budget rattaché. */
export function engagementKpis(engagements: readonly EngagementLike[]): EngagementKpis {
  return {
    total: engagements.length,
    confirmed: engagements.filter((e) => e.status === 'confirmed').length,
    budgetMinor: engagements.reduce((s, e) => s + (e.plannedMinor ?? 0), 0),
  };
}
