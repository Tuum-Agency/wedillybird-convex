// Espace couple self-serve — adaptateurs bundle Convex → view-models des écrans.
// Les écrans mon-mariage travaillent en unités MAJEURES (dollars/euros entiers)
// et en dates ISO 'YYYY-MM-DD' ; le backend en centimes et epoch ms. Toutes les
// conversions vivent ici (et uniquement ici).

import type {
  McActive,
  McCouple,
  McGuest,
  McPayment,
  McPhase,
  McRsvp,
  McUsage,
  McVendor,
} from '@/components/mon-mariage/data';
import type { SeatCatKey, SeatGuest, SeatTable } from '@/components/mon-mariage/seating-model';
import { rsvpBreakdown, rsvpToCouple, guestPartySize, phaseStates } from '@/convex/lib/coupleModel';
import type {
  MmBundle,
  MmEvent,
  MmGuest,
  MmPayment,
  MmPhase,
  MmTable,
  MmVendor,
} from '@/lib/mon-mariage/types';

/* ============================ Dates & montants ============================ */

/** epoch ms → 'YYYY-MM-DD' dans le fuseau de l'event (celui du lieu du mariage). */
export function toIsoDate(epochMs: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(epochMs));
  } catch {
    return new Date(epochMs).toISOString().slice(0, 10);
  }
}

/** 'YYYY-MM-DD' (saisie écran) → epoch ms à midi UTC (stable toutes zones). */
export function fromIsoDate(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getTime();
}

export const toMajor = (minor: number): number => Math.round(minor) / 100;
export const toMinor = (major: number): number => Math.round(major * 100);

/* ============================ Couple / RSVP / usage ============================ */

export function coupleFromEvent(event: MmEvent): McCouple {
  return {
    names: `${event.coupleNames.partnerA} & ${event.coupleNames.partnerB}`,
    weddingDate: toIsoDate(event.eventDate, event.timezone),
    venue: event.venue ? event.venue.name : '',
    slug: event.slug,
  };
}

export function rsvpFromGuests(guests: ReadonlyArray<MmGuest>): McRsvp {
  const b = rsvpBreakdown(guests);
  return {
    confirmed: b.confirmed,
    pending: b.pending,
    declined: b.declined,
    noreply: b.noreply,
    expected: b.expected,
  };
}

export function usageFromBundle(bundle: MmBundle): McUsage {
  return {
    guests: bundle.usage.invitations,
    storageGo: Math.round((bundle.usage.storageBytes / 1e9) * 10) / 10,
  };
}

/** Forfait actif — null tant que rien n'est payé (vue « choix »). */
export function activeFromEvent(event: MmEvent): McActive | null {
  if (!event.planTier || !event.paidAt) return null;
  const premium = event.planTier === 'premium';
  return {
    planId: premium ? 'premium' : 'essentiel',
    purchasedAt: toIsoDate(event.paidAt, event.timezone),
    galleryExpires: event.galleryExpiresAt ? toIsoDate(event.galleryExpiresAt, event.timezone) : '',
    guestCap: event.maxGuests,
    storageCap: premium ? 25 : 5,
  };
}

/* ============================ Invités ============================ */

export function guestFromMm(g: MmGuest): McGuest {
  return {
    id: g.id,
    name: g.fullName,
    group: g.category ?? '',
    cc: '',
    phone: g.phone ?? '',
    count: guestPartySize(g.plusOnesAllowed),
    status: rsvpToCouple(g.rsvpStatus),
  };
}

/* ============================ Prestataires & budget ============================ */

export function vendorFromMm(x: MmVendor): McVendor {
  return {
    id: x.id,
    name: x.name,
    cat: x.category as McVendor['cat'],
    status: x.status,
    amount: toMajor(x.amountMinor),
    paid: toMajor(x.paidMinor),
    doc: null,
    contact: x.contact,
    email: x.email,
    ...(x.note ? { note: x.note } : {}),
    attachments: x.attachments.map((a, i) => ({ id: `${x.id}-a${i}`, name: a.name, kind: a.kind })),
  };
}

export function paymentFromMm(x: MmPayment, timezone: string): McPayment {
  const fullyPaid = x.amountMinor > 0 && x.paidMinor >= x.amountMinor;
  return {
    id: x.id,
    vendor: x.vendorName,
    cat: x.category as McPayment['cat'],
    kind: `MonMariage.data.paymentKind.${x.kind}`,
    date: toIsoDate(x.dueDate, timezone),
    amount: toMajor(x.amountMinor),
    paid: fullyPaid,
    ...(x.paidMinor > 0 && !fullyPaid ? { paidAmount: toMajor(x.paidMinor) } : {}),
    payDate: x.paidAt ? toIsoDate(x.paidAt, timezone) : null,
    factures: x.attachments.map((a, i) => ({ id: `${x.id}-f${i}`, name: a.name, kind: a.kind })),
  };
}

/* ============================ Rétroplanning ============================ */

export function phasesFromMm(phases: ReadonlyArray<MmPhase>, timezone: string): McPhase[] {
  const states = phaseStates(
    phases.map((p) => ({ tasks: p.tasks.map((t) => ({ status: t.status })) })),
  );
  return phases.map((p, i) => ({
    id: p.id,
    label: p.labelKey ?? p.label ?? '',
    sub: p.subKey ?? p.sub ?? '',
    ...(states[i]!.current ? { current: true } : {}),
    tasks: p.tasks.map((t) => ({
      id: t.id,
      label: t.labelKey ?? t.label ?? '',
      status: t.status,
      ...(t.dueDate != null ? { due: toIsoDate(t.dueDate, timezone) } : {}),
    })),
  }));
}

/* ============================ Plan de table ============================ */

const SEAT_CAT_MAP: Record<string, SeatCatKey> = {
  family: 'family',
  famille: 'family',
  friends: 'friends',
  amis: 'friends',
  colleagues: 'colleagues',
  collègues: 'colleagues',
  collegues: 'colleagues',
  pro: 'pro',
  travail: 'colleagues',
};

export function seatCatFromCategory(category: string | null): SeatCatKey {
  if (!category) return 'friends';
  return SEAT_CAT_MAP[category.trim().toLowerCase()] ?? 'friends';
}

export function seatGuestFromMm(g: MmGuest): SeatGuest {
  return {
    id: g.id,
    name: g.fullName,
    category: seatCatFromCategory(g.category),
    partySize: guestPartySize(g.plusOnesAllowed),
    status: rsvpToCouple(g.rsvpStatus),
    ...(g.tableId ? { tableId: g.tableId } : {}),
  };
}

/** Position de repli en grille pour les tables jamais posées sur le plan. */
function fallbackPos(i: number): { x: number; y: number } {
  return { x: 3 + (i % 4) * 3.6, y: 3 + Math.floor(i / 4) * 3.6 };
}

export function seatTableFromMm(t: MmTable, index: number): SeatTable {
  const pos = t.x == null || t.y == null ? fallbackPos(index) : { x: t.x, y: t.y };
  return {
    id: t.id,
    label: t.name,
    shape: t.shape,
    capacity: t.capacity,
    x: pos.x,
    y: pos.y,
    rotation: t.rotation,
    ...(t.honor ? { honor: true } : {}),
    ...(t.notes ? { notes: t.notes } : {}),
  };
}
