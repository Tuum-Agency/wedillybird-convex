import { describe, it, expect } from 'vitest';
import {
  categoryHue,
  envelopeState,
  donutSegments,
  budgetAlerts,
  summarizeBudget,
  type BudgetLineLike,
} from '../../../lib/pro/budget';

describe('categoryHue', () => {
  it('teintes connues + fallback déterministe', () => {
    expect(categoryHue('Lieu')).toBe(22);
    expect(categoryHue('Traiteur')).toBe(60);
    const h = categoryHue('Catégorie inconnue');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
    expect(categoryHue('Catégorie inconnue')).toBe(h);
  });
});

describe('envelopeState', () => {
  it('under / near / over', () => {
    expect(envelopeState(10000, 0)).toBe('under'); // pas d'enveloppe
    expect(envelopeState(10000, 20000)).toBe('under');
    expect(envelopeState(19000, 20000)).toBe('near'); // ≥ 92 %
    expect(envelopeState(21000, 20000)).toBe('over');
  });
});

describe('donutSegments', () => {
  it('parts en %, catégories vides exclues', () => {
    const segs = donutSegments([
      { category: 'Lieu', plannedMinor: 80000 },
      { category: 'Traiteur', plannedMinor: 20000 },
      { category: 'Vide', plannedMinor: 0 },
    ]);
    expect(segs).toHaveLength(2);
    expect(segs[0]!.pct).toBeCloseTo(0.8, 5);
    expect(segs[1]!.pct).toBeCloseTo(0.2, 5);
  });
  it('total 0 → liste vide', () => {
    expect(donutSegments([{ category: 'x', plannedMinor: 0 }])).toEqual([]);
  });
});

describe('budgetAlerts', () => {
  const NOW = Date.UTC(2026, 5, 8, 12, 0, 0);
  it('dépassement enveloppe + surcoût + retard', () => {
    const lines: BudgetLineLike[] = [
      { category: 'Lieu', plannedMinor: 100000, paidMinor: 120000 }, // surcoût
      { category: 'Traiteur', plannedMinor: 100000, paidMinor: 0, dueDate: NOW - 86_400_000 }, // retard
    ];
    const sum = summarizeBudget(lines);
    const alerts = budgetAlerts(lines, sum, 150000, NOW); // prévu 200000 > enveloppe 150000
    expect(alerts.map((a) => a.kind).sort()).toEqual(['envelope', 'overdue', 'overrun']);
  });
  it('aucun problème → aucune alerte', () => {
    const lines: BudgetLineLike[] = [{ category: 'Lieu', plannedMinor: 100000, paidMinor: 50000 }];
    expect(budgetAlerts(lines, summarizeBudget(lines), 200000, NOW)).toEqual([]);
  });
});
