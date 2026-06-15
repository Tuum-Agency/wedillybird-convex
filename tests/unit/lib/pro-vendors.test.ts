import { describe, expect, it } from 'vitest';
import {
  filterVendors,
  priceLabel,
  usedCategories,
  engagementKpis,
  isEngagementStatus,
  ENGAGEMENT_STATUSES,
  type VendorLike,
  type EngagementLike,
} from '../../../lib/pro/vendors';
import { canAddVendor } from '../../../lib/payments/entitlements';

const vendors: VendorLike[] = [
  { name: 'Domaine de Bellevue', category: 'Lieu', location: 'Provence', priceRange: 3 },
  { name: 'Maison Diop', category: 'Traiteur', location: 'Paris', priceRange: 2 },
  { name: 'Studio Lumen', category: 'Photo / Vidéo', location: 'Lyon', priceRange: 2 },
];

describe('priceLabel', () => {
  it('mappe 1/2/3 vers €/€€/€€€', () => {
    expect(priceLabel(1)).toBe('€');
    expect(priceLabel(2)).toBe('€€');
    expect(priceLabel(3)).toBe('€€€');
    expect(priceLabel(undefined)).toBe('—');
    expect(priceLabel(0)).toBe('—');
  });
});

describe('filterVendors', () => {
  it('filtre par catégorie', () => {
    expect(filterVendors(vendors, { category: 'Lieu' }).map((v) => v.name)).toEqual([
      'Domaine de Bellevue',
    ]);
  });
  it('filtre par texte (nom/catégorie/lieu)', () => {
    expect(filterVendors(vendors, { query: 'paris' }).map((v) => v.name)).toEqual(['Maison Diop']);
    expect(filterVendors(vendors, { query: 'photo' }).map((v) => v.name)).toEqual(['Studio Lumen']);
  });
  it('« all » et requête vide → tout', () => {
    expect(filterVendors(vendors, { category: 'all' })).toHaveLength(3);
    expect(filterVendors(vendors, {})).toHaveLength(3);
  });
});

describe('usedCategories', () => {
  it('retourne les catégories présentes, ordonnées canoniquement', () => {
    expect(usedCategories(vendors)).toEqual(['Lieu', 'Traiteur', 'Photo / Vidéo']);
  });
});

describe('canAddVendor — plafond annuaire', () => {
  it('Starter plafonné à 25', () => {
    expect(canAddVendor('starter', 24)).toBe(true);
    expect(canAddVendor('starter', 25)).toBe(false);
  });
  it('Business / Agency illimité', () => {
    expect(canAddVendor('business', 999)).toBe(true);
    expect(canAddVendor('agency', 999)).toBe(true);
  });
});

describe('engagements « Par mariage »', () => {
  const engagements: EngagementLike[] = [
    { status: 'confirmed', plannedMinor: 800_000 },
    { status: 'booked', plannedMinor: 600_000 },
    { status: 'quoted', plannedMinor: 250_000 },
    { status: 'contacted' },
  ];
  it('engagementKpis : total, confirmés, budget rattaché', () => {
    expect(engagementKpis(engagements)).toEqual({ total: 4, confirmed: 1, budgetMinor: 1_650_000 });
  });
  it('engagementKpis : liste vide → zéros sans NaN', () => {
    expect(engagementKpis([])).toEqual({ total: 0, confirmed: 0, budgetMinor: 0 });
  });
  it('isEngagementStatus valide les 4 statuts canoniques', () => {
    for (const s of ENGAGEMENT_STATUSES) expect(isEngagementStatus(s)).toBe(true);
    expect(isEngagementStatus('signed')).toBe(false);
  });
});
