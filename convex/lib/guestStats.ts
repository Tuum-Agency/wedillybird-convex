/** Statistiques RSVP couple-safe, dérivées de la liste d'invités. Pur → testable. */

export interface GuestRsvpInput {
  rsvpStatus: string;
  plusOnesNames?: string[];
}

export interface GuestRsvpStats {
  total: number;
  attending: number;
  declined: number;
  maybe: number;
  pending: number;
  /** Têtes attendues = confirmés + leurs accompagnants nommés. */
  expectedHeadcount: number;
}

export function summarizeGuestRsvp(guests: GuestRsvpInput[]): GuestRsvpStats {
  const count = (s: string) => guests.filter((g) => g.rsvpStatus === s).length;
  return {
    total: guests.length,
    attending: count('attending'),
    declined: count('declined'),
    maybe: count('maybe'),
    pending: count('pending'),
    expectedHeadcount: guests
      .filter((g) => g.rsvpStatus === 'attending')
      .reduce((a, g) => a + 1 + (g.plusOnesNames?.length ?? 0), 0),
  };
}
