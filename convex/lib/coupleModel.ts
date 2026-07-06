// Espace couple self-serve « /mon-mariage » — modèle PUR partagé (aucun import
// Convex) : constantes de validation, template de rétroplanning par défaut,
// mapping RSVP Convex ↔ vocabulaire couple, agrégats budget/RSVP.
// Importé par convex/coupleSpace.ts (serveur), les écrans mon-mariage (client)
// et tests/unit/convex/couple-model.test.ts.

/* ============================ Prestataires ============================ */

export const COUPLE_VENDOR_CATS = [
  'lieu',
  'traiteur',
  'photo',
  'musique',
  'fleurs',
  'patisserie',
  'tenues',
  'papeterie',
] as const;
export type CoupleVendorCat = (typeof COUPLE_VENDOR_CATS)[number];

export const COUPLE_VENDOR_STATUSES = [
  'a_contacter',
  'contacte',
  'devis',
  'reserve',
  'paye',
] as const;
export type CoupleVendorStatus = (typeof COUPLE_VENDOR_STATUSES)[number];

export function isCoupleVendorCat(x: unknown): x is CoupleVendorCat {
  return typeof x === 'string' && (COUPLE_VENDOR_CATS as readonly string[]).includes(x);
}
export function isCoupleVendorStatus(x: unknown): x is CoupleVendorStatus {
  return typeof x === 'string' && (COUPLE_VENDOR_STATUSES as readonly string[]).includes(x);
}

/* ============================ Échéancier ============================ */

export const COUPLE_PAYMENT_KINDS = ['deposit', 'balance', 'other'] as const;
export type CouplePaymentKind = (typeof COUPLE_PAYMENT_KINDS)[number];

/* ============================ Plan de table ============================ */

export const COUPLE_TABLE_SHAPES = [
  'round',
  'oval',
  'rect',
  'square',
  'imperial',
  'sweetheart',
  'head',
] as const;
export type CoupleTableShape = (typeof COUPLE_TABLE_SHAPES)[number];

export const COUPLE_ROOM_FLOORS = ['parquet', 'marble', 'carpet', 'grass', 'concrete'] as const;
export type CoupleRoomFloor = (typeof COUPLE_ROOM_FLOORS)[number];

export const COUPLE_ROOM_ELEMENT_KINDS = [
  'dancefloor',
  'stage',
  'dj',
  'bar',
  'buffet',
  'cake',
  'photobooth',
  'gifts',
  'guestbook',
  'entrance',
  'arch',
  'plant',
] as const;
export type CoupleRoomElementKind = (typeof COUPLE_ROOM_ELEMENT_KINDS)[number];

/* ============================ RSVP mapping ============================ */

/** Statut RSVP côté vocabulaire couple (celui des écrans mon-mariage). */
export type CoupleRsvp = 'confirmed' | 'pending' | 'declined' | 'noreply';

/**
 * Convex `guests.rsvpStatus` → vocabulaire couple :
 * attending = confirmé · maybe = « en attente » (a répondu, hésite) ·
 * pending = sans réponse · declined = décliné.
 */
export function rsvpToCouple(status: string): CoupleRsvp {
  switch (status) {
    case 'attending':
      return 'confirmed';
    case 'maybe':
      return 'pending';
    case 'declined':
      return 'declined';
    default:
      return 'noreply';
  }
}

/** Nombre de personnes qu'une invitation représente (principal + accompagnants). */
export function guestPartySize(plusOnesAllowed: number): number {
  return 1 + Math.max(0, plusOnesAllowed);
}

export interface CoupleRsvpBreakdown {
  confirmed: number;
  pending: number;
  declined: number;
  noreply: number;
  /** Total de personnes invitées (toutes réponses confondues). */
  expected: number;
}

/** Agrégat RSVP en PERSONNES (partySize), pas en invitations. */
export function rsvpBreakdown(
  guests: ReadonlyArray<{ rsvpStatus: string; plusOnesAllowed: number }>,
): CoupleRsvpBreakdown {
  const out: CoupleRsvpBreakdown = {
    confirmed: 0,
    pending: 0,
    declined: 0,
    noreply: 0,
    expected: 0,
  };
  for (const g of guests) {
    const size = guestPartySize(g.plusOnesAllowed);
    out[rsvpToCouple(g.rsvpStatus)] += size;
    out.expected += size;
  }
  return out;
}

/* ============================ Budget ============================ */

export interface CoupleBudgetPoste {
  cat: string;
  plannedMinor: number;
  paidMinor: number;
  vendors: string[];
}

/** Agrégation par poste (catégorie) depuis les prestataires — miroir de mcBudgetPostes. */
export function budgetPostes(
  vendors: ReadonlyArray<{
    category: string;
    name: string;
    amountMinor: number;
    paidMinor: number;
  }>,
): CoupleBudgetPoste[] {
  const map = new Map<string, CoupleBudgetPoste>();
  for (const v of vendors) {
    let poste = map.get(v.category);
    if (!poste) {
      poste = { cat: v.category, plannedMinor: 0, paidMinor: 0, vendors: [] };
      map.set(v.category, poste);
    }
    poste.plannedMinor += v.amountMinor;
    poste.paidMinor += v.paidMinor;
    poste.vendors.push(v.name);
  }
  return [...map.values()].sort((a, b) => b.plannedMinor - a.plannedMinor);
}

/* ============================ Rétroplanning ============================ */

export interface CouplePlanningTemplatePhase {
  /** Clé i18n `MonMariage.data.phases.<id>.label` (résolue côté composant). */
  labelKey: string;
  subKey: string;
  taskKeys: string[];
}

/**
 * Template par défaut, semé à la première visite (idempotent). Les clés
 * miroir de l'ancien mock `MC_PHASES` — les libellés vivent dans
 * `messages/*.json` sous `MonMariage.data.phases.*`.
 */
export const DEFAULT_PLANNING: CouplePlanningTemplatePhase[] = [
  {
    labelKey: 'MonMariage.data.phases.p1.label',
    subKey: 'MonMariage.data.phases.p1.sub',
    taskKeys: [
      'MonMariage.data.phases.p1.tasks.t1',
      'MonMariage.data.phases.p1.tasks.t2',
      'MonMariage.data.phases.p1.tasks.t3',
    ],
  },
  {
    labelKey: 'MonMariage.data.phases.p2.label',
    subKey: 'MonMariage.data.phases.p2.sub',
    taskKeys: [
      'MonMariage.data.phases.p2.tasks.t4',
      'MonMariage.data.phases.p2.tasks.t5',
      'MonMariage.data.phases.p2.tasks.t6',
    ],
  },
  {
    labelKey: 'MonMariage.data.phases.p3.label',
    subKey: 'MonMariage.data.phases.p3.sub',
    taskKeys: [
      'MonMariage.data.phases.p3.tasks.t7',
      'MonMariage.data.phases.p3.tasks.t8',
      'MonMariage.data.phases.p3.tasks.t9',
      'MonMariage.data.phases.p3.tasks.t10',
    ],
  },
  {
    labelKey: 'MonMariage.data.phases.p4.label',
    subKey: 'MonMariage.data.phases.p4.sub',
    taskKeys: [
      'MonMariage.data.phases.p4.tasks.t11',
      'MonMariage.data.phases.p4.tasks.t12',
      'MonMariage.data.phases.p4.tasks.t13',
    ],
  },
  {
    labelKey: 'MonMariage.data.phases.p5.label',
    subKey: 'MonMariage.data.phases.p5.sub',
    taskKeys: [
      'MonMariage.data.phases.p5.tasks.t14',
      'MonMariage.data.phases.p5.tasks.t15',
      'MonMariage.data.phases.p5.tasks.t16',
    ],
  },
  {
    labelKey: 'MonMariage.data.phases.p6.label',
    subKey: 'MonMariage.data.phases.p6.sub',
    taskKeys: [
      'MonMariage.data.phases.p6.tasks.t17',
      'MonMariage.data.phases.p6.tasks.t18',
      'MonMariage.data.phases.p6.tasks.t19',
    ],
  },
];

export const COUPLE_TASK_STATUSES = ['todo', 'doing', 'done'] as const;
export type CoupleTaskStatus = (typeof COUPLE_TASK_STATUSES)[number];

/** Cycle de statut au clic (todo → doing → done → todo), miroir du mock. */
export function nextTaskStatus(s: CoupleTaskStatus): CoupleTaskStatus {
  return s === 'todo' ? 'doing' : s === 'doing' ? 'done' : 'todo';
}

/**
 * Dérive l'état d'une phase pour le rétroplanning léger du dashboard :
 * done = toutes les tâches faites (au moins une), current = première phase
 * non terminée dans l'ordre.
 */
export function phaseStates(
  phases: ReadonlyArray<{ tasks: ReadonlyArray<{ status: CoupleTaskStatus }> }>,
): Array<{ done: boolean; current: boolean }> {
  let currentSeen = false;
  return phases.map((p) => {
    const done = p.tasks.length > 0 && p.tasks.every((t) => t.status === 'done');
    const current = !done && !currentSeen;
    if (current) currentSeen = true;
    return { done, current };
  });
}
