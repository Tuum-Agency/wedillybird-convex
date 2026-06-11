import { describe, expect, it } from 'vitest';
import {
  CLIENT_STAGES,
  groupByStage,
  isClientStage,
  pipelineTotals,
  coupleInitials,
  coupleHue,
  relativeFr,
  daysUntil,
  type ClientLike,
} from '../../../lib/pro/clients';
import { formatEurMinor, parseEurToMinor, eurToMinor } from '../../../lib/pro/format';

const sample: ClientLike[] = [
  { stage: 'lead', budgetMinor: 1_000_00 },
  { stage: 'lead' },
  { stage: 'quote', budgetMinor: 2_000_00 },
  { stage: 'booked', budgetMinor: 18_000_00 },
  { stage: 'in_progress', budgetMinor: 5_000_00 },
  { stage: 'delivered', budgetMinor: 12_000_00 },
];

describe('groupByStage', () => {
  it('crée les 6 colonnes dans l’ordre canonique, vides incluses', () => {
    const cols = groupByStage(sample);
    expect(cols.map((c) => c.stage)).toEqual([...CLIENT_STAGES]);
    const contacted = cols.find((c) => c.stage === 'contacted')!;
    expect(contacted.count).toBe(0);
    expect(contacted.items).toEqual([]);
  });

  it('compte et somme les budgets par étape', () => {
    const cols = groupByStage(sample);
    const lead = cols.find((c) => c.stage === 'lead')!;
    expect(lead.count).toBe(2);
    expect(lead.budgetMinor).toBe(1_000_00); // un lead sans budget compte pour 0
    const booked = cols.find((c) => c.stage === 'booked')!;
    expect(booked.budgetMinor).toBe(18_000_00);
  });
});

describe('pipelineTotals', () => {
  it('agrège total, budget, réservés et taux de conversion', () => {
    const t = pipelineTotals(sample);
    expect(t.count).toBe(6);
    expect(t.budgetMinor).toBe(38_000_00);
    expect(t.bookedCount).toBe(3); // booked + in_progress + delivered
    expect(t.conversionRate).toBeCloseTo(0.5, 5);
  });

  it('liste vide → conversion 0, pas de division par zéro', () => {
    const t = pipelineTotals([]);
    expect(t).toEqual({ count: 0, budgetMinor: 0, bookedCount: 0, conversionRate: 0 });
  });
});

describe('isClientStage', () => {
  it('valide les étapes connues', () => {
    expect(isClientStage('booked')).toBe(true);
    expect(isClientStage('archived')).toBe(false);
    expect(isClientStage(null)).toBe(false);
  });
});

describe('coupleInitials', () => {
  it('« Awa & Karim » → « AK »', () => {
    expect(coupleInitials('Awa & Karim')).toBe('AK');
  });
  it('nom simple → première lettre', () => {
    expect(coupleInitials('Awa')).toBe('A');
  });
});

describe('coupleHue', () => {
  it('déterministe et borné [0, 360[', () => {
    const h = coupleHue('Awa & Karim');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
    expect(coupleHue('Awa & Karim')).toBe(h);
  });
});

describe('relativeFr', () => {
  const NOW = Date.UTC(2026, 5, 5, 12, 0, 0);
  it('minutes / heures / hier', () => {
    expect(relativeFr(NOW - 5 * 60_000, NOW)).toBe('il y a 5 min');
    expect(relativeFr(NOW - 3 * 3_600_000, NOW)).toBe('il y a 3 h');
    expect(relativeFr(NOW - 24 * 3_600_000, NOW)).toBe('hier');
  });
  it('null → tiret', () => {
    expect(relativeFr(null, NOW)).toBe('—');
  });
});

describe('daysUntil', () => {
  const NOW = Date.UTC(2026, 5, 5, 12, 0, 0);
  it('compte les jours jusqu’à une date future', () => {
    expect(daysUntil(NOW + 42 * 86_400_000, NOW)).toBe(42);
    expect(daysUntil(NOW + 86_400_000, NOW)).toBe(1);
  });
  it('négatif si la date est passée', () => {
    expect(daysUntil(NOW - 3 * 86_400_000, NOW)).toBe(-3);
  });
  it('null si pas de date', () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil(undefined, NOW)).toBeNull();
  });
});

describe('format euros', () => {
  it('parseEurToMinor accepte espaces, € et virgule', () => {
    expect(parseEurToMinor('18 000')).toBe(18_000_00);
    expect(parseEurToMinor('1 250,50 €')).toBe(125_050);
    expect(parseEurToMinor('')).toBeNull();
    expect(parseEurToMinor('abc')).toBeNull();
    expect(parseEurToMinor('-5')).toBeNull();
  });

  it('eurToMinor / formatEurMinor', () => {
    expect(eurToMinor(99)).toBe(9900);
    expect(formatEurMinor(null)).toBe('—');
    // 18 000 € sans décimales ; espace insécable selon l'environnement Intl.
    expect(formatEurMinor(18_000_00).replace(/ | /g, ' ')).toBe('18 000 €');
  });
});
