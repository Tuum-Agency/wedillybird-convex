import { describe, expect, it } from 'vitest';
import {
  BUDGET_CATEGORIES,
  groupByCategory,
  lineStatus,
  summarizeBudget,
  sumPaidMinor,
  type BudgetLineLike,
} from '../../../lib/pro/budget';

const NOW = Date.UTC(2026, 5, 1);
const DAY = 86_400_000;

describe('sumPaidMinor', () => {
  it('additionne uniquement les paiements encaissés (succeeded)', () => {
    expect(
      sumPaidMinor([
        { amountMinor: 500_00, status: 'succeeded' },
        { amountMinor: 300_00, status: 'succeeded' },
        { amountMinor: 200_00, status: 'pending' }, // ignoré
        { amountMinor: 100_00, status: 'failed' }, // ignoré
      ]),
    ).toBe(800_00);
  });

  it('liste vide → 0', () => {
    expect(sumPaidMinor([])).toBe(0);
  });
});

describe('summarizeBudget', () => {
  it('agrège prévu / payé / reste et détecte les dépassements', () => {
    const lines: BudgetLineLike[] = [
      { category: 'Lieu', plannedMinor: 1000_00, paidMinor: 500_00 },
      { category: 'Traiteur', plannedMinor: 2000_00, paidMinor: 2000_00 },
      { category: 'Divers', plannedMinor: 0, paidMinor: 100_00 }, // payé > prévu
    ];
    const s = summarizeBudget(lines);
    expect(s.plannedMinor).toBe(3000_00);
    expect(s.paidMinor).toBe(2600_00);
    expect(s.remainingMinor).toBe(400_00);
    expect(s.overPaid).toBe(true);
    expect(s.lineCount).toBe(3);
  });

  it('liste vide → tout à zéro', () => {
    expect(summarizeBudget([])).toEqual({
      plannedMinor: 0,
      paidMinor: 0,
      remainingMinor: 0,
      overPaid: false,
      lineCount: 0,
    });
  });
});

describe('lineStatus', () => {
  it('payé intégralement → paid', () => {
    expect(lineStatus({ category: 'x', plannedMinor: 1000, paidMinor: 1000 }, NOW)).toBe('paid');
  });
  it('échéance passée et non soldée → overdue', () => {
    expect(
      lineStatus({ category: 'x', plannedMinor: 1000, paidMinor: 200, dueDate: NOW - DAY }, NOW),
    ).toBe('overdue');
  });
  it('paiement partiel sans échéance dépassée → partial', () => {
    expect(lineStatus({ category: 'x', plannedMinor: 1000, paidMinor: 200 }, NOW)).toBe('partial');
  });
  it('rien payé → todo', () => {
    expect(lineStatus({ category: 'x', plannedMinor: 1000, paidMinor: 0 }, NOW)).toBe('todo');
  });
  it('soldé prime sur échéance passée', () => {
    expect(
      lineStatus({ category: 'x', plannedMinor: 1000, paidMinor: 1000, dueDate: NOW - DAY }, NOW),
    ).toBe('paid');
  });
});

describe('groupByCategory', () => {
  it('ordonne selon BUDGET_CATEGORIES, custom en fin, vides exclues', () => {
    const lines: BudgetLineLike[] = [
      { category: 'Traiteur', plannedMinor: 100, paidMinor: 0 },
      { category: 'Surprise', plannedMinor: 50, paidMinor: 0 }, // hors-liste
      { category: 'Lieu', plannedMinor: 200, paidMinor: 100 },
      { category: 'Lieu', plannedMinor: 300, paidMinor: 0 },
    ];
    const groups = groupByCategory(lines);
    expect(groups.map((g) => g.category)).toEqual(['Lieu', 'Traiteur', 'Surprise']);
    const lieu = groups[0]!;
    expect(lieu.items).toHaveLength(2);
    expect(lieu.plannedMinor).toBe(500);
    expect(lieu.paidMinor).toBe(100);
  });

  it('toutes les catégories canoniques sont reconnues', () => {
    for (const cat of BUDGET_CATEGORIES) {
      const groups = groupByCategory([{ category: cat, plannedMinor: 1, paidMinor: 0 }]);
      expect(groups[0]!.category).toBe(cat);
    }
  });
});
