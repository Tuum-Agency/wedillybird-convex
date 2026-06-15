import { describe, expect, it } from 'vitest';
import { summarizeGuestRsvp } from '../../../convex/lib/guestStats';

/**
 * Stats RSVP de l'espace couple (suivi). « Têtes attendues » = invités confirmés
 * (attending) + leurs accompagnants nommés ; les autres statuts ne comptent pas.
 */
describe('summarizeGuestRsvp', () => {
  it('compte par statut + têtes attendues', () => {
    const stats = summarizeGuestRsvp([
      { rsvpStatus: 'attending', plusOnesNames: ['Accompagnant'] },
      { rsvpStatus: 'attending' },
      { rsvpStatus: 'declined' },
      { rsvpStatus: 'pending' },
      { rsvpStatus: 'maybe' },
    ]);
    expect(stats).toEqual({
      total: 5,
      attending: 2,
      declined: 1,
      maybe: 1,
      pending: 1,
      expectedHeadcount: 3, // 2 confirmés + 1 accompagnant
    });
  });

  it('liste vide → tout à 0', () => {
    expect(summarizeGuestRsvp([])).toEqual({
      total: 0,
      attending: 0,
      declined: 0,
      maybe: 0,
      pending: 0,
      expectedHeadcount: 0,
    });
  });

  it('accompagnants multiples comptés ; statuts non-confirmés exclus du headcount', () => {
    const stats = summarizeGuestRsvp([
      { rsvpStatus: 'attending', plusOnesNames: ['A', 'B'] },
      { rsvpStatus: 'attending', plusOnesNames: [] },
      { rsvpStatus: 'pending', plusOnesNames: ['ignoré'] },
    ]);
    expect(stats.attending).toBe(2);
    expect(stats.expectedHeadcount).toBe(4); // (1+2) + (1+0) ; pending exclu
  });
});
