import { describe, it, expect } from 'vitest';
import {
  buildLedger,
  buildPlans,
  milestoneStatus,
  milestoneType,
  nextDueMilestone,
  computeFee,
  stripeFeeMinor,
  PAY_STATUS_LABEL,
  PAYMENT_MODE_META,
  PAYMENT_MODE_ORDER,
  PAYOUT_SCHEDULE_LABEL,
  payoutScheduleHelp,
  TERM_LABELS,
  type InvoiceLike,
} from '../../../lib/pro/payments';

const NOW = Date.UTC(2026, 5, 6, 12, 0, 0); // 6 juin 2026
const DAY = 86_400_000;

const invoices: InvoiceLike[] = [
  {
    _id: 'i1',
    number: 'FAC-2026-031',
    clientName: 'Awa & Karim',
    status: 'partial',
    schedule: [
      { label: 'Acompte 30 %', amountMinor: 75_000, paid: true },
      { label: 'Solde', amountMinor: 175_000, dueDate: NOW + 30 * DAY, paid: false },
    ],
  },
  {
    _id: 'i2',
    number: 'FAC-2026-022',
    clientName: 'Léa & Tom',
    status: 'overdue',
    schedule: [{ label: 'Acompte', amountMinor: 150_000, dueDate: NOW - 5 * DAY, paid: false }],
  },
  { _id: 'i3', number: 'FAC-2026-040', clientName: 'Sans échéancier', status: 'sent' }, // ignorée
];

describe('milestoneStatus', () => {
  it('payé / en retard / à venir', () => {
    expect(milestoneStatus(true, NOW - DAY, NOW)).toBe('paid');
    expect(milestoneStatus(false, NOW - DAY, NOW)).toBe('overdue');
    expect(milestoneStatus(false, NOW + DAY, NOW)).toBe('upcoming');
    expect(milestoneStatus(false, undefined, NOW)).toBe('upcoming');
  });
});

describe('buildLedger', () => {
  it('aplatit les échéances des factures', () => {
    const { milestones } = buildLedger(invoices, NOW);
    expect(milestones).toHaveLength(3); // i3 sans schedule → exclue
    expect(milestones.map((m) => m.status).sort()).toEqual(['overdue', 'paid', 'upcoming']);
  });
  it('agrège les KPIs', () => {
    const { kpis } = buildLedger(invoices, NOW);
    expect(kpis.collectedMinor).toBe(75_000);
    expect(kpis.upcomingMinor).toBe(175_000);
    expect(kpis.overdueMinor).toBe(150_000);
  });
  it('liste vide → zéro', () => {
    expect(buildLedger([], NOW)).toEqual({
      milestones: [],
      kpis: { collectedMinor: 0, upcomingMinor: 0, overdueMinor: 0 },
    });
  });
});

describe('frais', () => {
  it('stripeFeeMinor FR vs US', () => {
    expect(stripeFeeMinor(540_000, 'FR')).toBe(8125); // 1,5 % + 0,25 €
    expect(stripeFeeMinor(540_000, 'US')).toBe(15_690); // 2,9 % + 0,30 €
  });
  it('computeFee : net = montant − frais Stripe (Wedillybird hors du flux)', () => {
    const f = computeFee(540_000, 'FR');
    expect(f.clientPaysMinor).toBe(540_000);
    expect(f.stripeFeeMinor).toBe(8125);
    expect(f.netReceivedMinor).toBe(531_875);
  });
});

describe('libellés', () => {
  it('PAY_STATUS_LABEL', () => {
    expect(PAY_STATUS_LABEL.paid).toBe('Payé');
    expect(PAY_STATUS_LABEL.overdue).toBe('En retard');
    expect(PAY_STATUS_LABEL.upcoming).toBe('À venir');
  });
});

describe('milestoneType', () => {
  it('1re = acompte, dernière = solde, milieu = échéance', () => {
    expect(milestoneType(0, 3)).toBe('acompte');
    expect(milestoneType(1, 3)).toBe('echeance');
    expect(milestoneType(2, 3)).toBe('solde');
  });
  it('échéance unique → solde (index 0 = dernière)', () => {
    // index 0 prime sur la dernière → acompte pour la 1re entrée
    expect(milestoneType(0, 1)).toBe('acompte');
  });
});

describe('buildPlans', () => {
  it('regroupe par facture avec progression et type', () => {
    const plans = buildPlans(invoices, NOW);
    expect(plans).toHaveLength(2); // i3 sans schedule → exclue
    const awa = plans.find((p) => p.clientName === 'Awa & Karim')!;
    expect(awa.totalCount).toBe(2);
    expect(awa.paidCount).toBe(1);
    expect(awa.paidMinor).toBe(75_000);
    expect(awa.totalMinor).toBe(250_000);
    expect(awa.milestones[0]!.type).toBe('acompte');
    expect(awa.milestones[1]!.type).toBe('solde');
  });
  it('liste vide → []', () => {
    expect(buildPlans([], NOW)).toEqual([]);
  });
});

describe('nextDueMilestone', () => {
  it('prend l’échéance non réglée la plus proche dans le futur', () => {
    const { milestones } = buildLedger(invoices, NOW);
    const next = nextDueMilestone(milestones, NOW);
    expect(next?.clientName).toBe('Awa & Karim'); // solde NOW+30j (le seul à venir)
  });
  it('aucune échéance future → null', () => {
    expect(nextDueMilestone([], NOW)).toBeNull();
  });
});

describe('modes & versements', () => {
  it('PAYMENT_MODE_META : byop recommandé, pas de mode managé', () => {
    expect(PAYMENT_MODE_ORDER).toEqual(['byop', 'manual']);
    expect(PAYMENT_MODE_META.byop.recommended).toBe(true);
    expect(PAYMENT_MODE_META.manual.recommended).toBeUndefined();
    expect('managed' in PAYMENT_MODE_META).toBe(false);
  });
  it('libellés & aide de fréquence', () => {
    expect(PAYOUT_SCHEDULE_LABEL.daily).toBe('Quotidien');
    expect(payoutScheduleHelp('weekly')).toContain('lundi');
    expect(payoutScheduleHelp('manual')).toContain('manuellement');
  });
  it('TERM_LABELS couvre arrhes/acompte/retainer', () => {
    expect(TERM_LABELS.arrhes.label).toBe('Arrhes');
    expect(TERM_LABELS.acompte.note).toContain('ferme');
    expect(TERM_LABELS.retainer.label).toContain('retainer');
  });
});
