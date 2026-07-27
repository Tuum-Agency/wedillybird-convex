import { describe, expect, it } from 'vitest';
import {
  budgetPostes,
  COUPLE_VENDOR_CATS,
  DEFAULT_PLANNING,
  guestPartySize,
  isCoupleVendorCat,
  isCoupleVendorStatus,
  nextTaskStatus,
  phaseStates,
  rsvpBreakdown,
  rsvpToCouple,
} from '../../../convex/lib/coupleModel';

describe('rsvpToCouple', () => {
  it('mappe le vocabulaire Convex vers le vocabulaire couple', () => {
    expect(rsvpToCouple('attending')).toBe('confirmed');
    expect(rsvpToCouple('maybe')).toBe('pending');
    expect(rsvpToCouple('declined')).toBe('declined');
    expect(rsvpToCouple('pending')).toBe('noreply');
  });

  it('tombe sur noreply pour un statut inconnu', () => {
    expect(rsvpToCouple('weird')).toBe('noreply');
  });
});

describe('guestPartySize', () => {
  it('compte le principal + les accompagnants', () => {
    expect(guestPartySize(0)).toBe(1);
    expect(guestPartySize(3)).toBe(4);
  });

  it('ignore un plusOnesAllowed négatif corrompu', () => {
    expect(guestPartySize(-2)).toBe(1);
  });
});

describe('rsvpBreakdown', () => {
  it('agrège en personnes, pas en invitations', () => {
    const out = rsvpBreakdown([
      { rsvpStatus: 'attending', plusOnesAllowed: 1 }, // 2 personnes
      { rsvpStatus: 'attending', plusOnesAllowed: 0 }, // 1
      { rsvpStatus: 'maybe', plusOnesAllowed: 2 }, // 3 « en attente »
      { rsvpStatus: 'pending', plusOnesAllowed: 0 }, // 1 sans réponse
      { rsvpStatus: 'declined', plusOnesAllowed: 1 }, // 2 déclinées
    ]);
    expect(out).toEqual({ confirmed: 3, pending: 3, noreply: 1, declined: 2, expected: 9 });
  });

  it('liste vide → zéros', () => {
    expect(rsvpBreakdown([])).toEqual({
      confirmed: 0,
      pending: 0,
      declined: 0,
      noreply: 0,
      expected: 0,
    });
  });
});

describe('budgetPostes', () => {
  it('agrège par catégorie et trie par budget prévu décroissant', () => {
    const postes = budgetPostes([
      { category: 'lieu', name: 'Domaine A', amountMinor: 650000, paidMinor: 195000 },
      { category: 'photo', name: 'Studio B', amountMinor: 240000, paidMinor: 0 },
      { category: 'lieu', name: 'Extra tente', amountMinor: 100000, paidMinor: 0 },
    ]);
    expect(postes).toHaveLength(2);
    expect(postes[0]).toEqual({
      cat: 'lieu',
      plannedMinor: 750000,
      paidMinor: 195000,
      vendors: ['Domaine A', 'Extra tente'],
    });
    expect(postes[1]!.cat).toBe('photo');
  });
});

describe('validations vendors', () => {
  it('reconnaît les catégories et statuts canoniques', () => {
    for (const cat of COUPLE_VENDOR_CATS) expect(isCoupleVendorCat(cat)).toBe(true);
    expect(isCoupleVendorCat('spaceships')).toBe(false);
    expect(isCoupleVendorStatus('reserve')).toBe(true);
    expect(isCoupleVendorStatus('unknown')).toBe(false);
  });
});

describe('nextTaskStatus', () => {
  it('cycle todo → doing → done → todo', () => {
    expect(nextTaskStatus('todo')).toBe('doing');
    expect(nextTaskStatus('doing')).toBe('done');
    expect(nextTaskStatus('done')).toBe('todo');
  });
});

describe('phaseStates', () => {
  it('done = toutes les tâches faites, current = première phase non terminée', () => {
    const states = phaseStates([
      { tasks: [{ status: 'done' }, { status: 'done' }] },
      { tasks: [{ status: 'done' }, { status: 'doing' }] },
      { tasks: [{ status: 'todo' }] },
    ]);
    expect(states).toEqual([
      { done: true, current: false },
      { done: false, current: true },
      { done: false, current: false },
    ]);
  });

  it('une phase sans tâche ne compte pas comme terminée', () => {
    const states = phaseStates([{ tasks: [] }]);
    expect(states).toEqual([{ done: false, current: true }]);
  });
});

describe('DEFAULT_PLANNING', () => {
  it('reprend le template mock : 6 phases, 19 tâches, clés i18n bien formées', () => {
    expect(DEFAULT_PLANNING).toHaveLength(6);
    const taskCount = DEFAULT_PLANNING.reduce((a, p) => a + p.taskKeys.length, 0);
    expect(taskCount).toBe(19);
    for (const phase of DEFAULT_PLANNING) {
      expect(phase.labelKey).toMatch(/^MonMariage\.data\.phases\.p\d\.label$/);
      expect(phase.subKey).toMatch(/^MonMariage\.data\.phases\.p\d\.sub$/);
      for (const key of phase.taskKeys) {
        expect(key).toMatch(/^MonMariage\.data\.phases\.p\d\.tasks\.t\d+$/);
      }
    }
  });
});
