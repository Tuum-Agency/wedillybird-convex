// AUTO-PORTED from Claude Design bundle (couple/mc-data.jsx + mc-data2.jsx), typed.
// Espace couple self-serve (achat one-shot) : le couple gère SON mariage en direct.
// Données mock — remplacées par Convex via les props du serveur lorsque câblé.
// Démo : « aujourd'hui » figé au 11 juin 2026 → mariage 5 sept. 2026 = J−86.
//
// i18n : les LIBELLÉS d'interface (catégories, statuts, étapes, phases, forfaits,
// dépassements…) sont des CLÉS next-intl (`MonMariage.data.*`) traduites côté
// composant via `t(item.label)`. Les formateurs date/nombre/montant reçoivent la
// `locale` active (jamais de `fr-FR` codé en dur). Les enregistrements purement
// mock (noms du couple, prestataires, téléphones, n° de facture, pièces jointes)
// restent littéraux : ils seront remplacés par les données Convex.

import type { BudgetCurrency } from '@/lib/currency';

export const MC_TODAY = new Date('2026-06-11T09:00:00');

/* ============================ COUPLE & MARIAGE ============================ */
export interface McCouple {
  names: string;
  weddingDate: string;
  venue: string;
  slug: string;
}
export const MC_COUPLE: McCouple = {
  names: 'Camille & Hugo',
  weddingDate: '2026-09-05',
  venue: 'Mas des Oliviers · Saint-Rémy-de-Provence',
  slug: 'camille-et-hugo',
};

/* ============================ FORFAIT (achat unique) ============================ */
export type McPlanId = 'essentiel' | 'premium';
export interface McPlan {
  id: McPlanId;
  /** clé i18n du nom du forfait */
  name: string;
  price: number;
  /** clé i18n de l'accroche */
  tagline: string;
  guestCap: number;
  storageCap: number;
  featured?: boolean;
  /** [clé i18n de la feature, 0|1 (1 = mise en avant)] */
  feats: ReadonlyArray<[string, 0 | 1]>;
}
export const MC_PLANS: Record<McPlanId, McPlan> = {
  essentiel: {
    id: 'essentiel',
    name: 'MonMariage.data.plans.essentiel.name',
    price: 29,
    tagline: 'MonMariage.data.plans.essentiel.tagline',
    guestCap: 100,
    storageCap: 5,
    feats: [
      ['MonMariage.data.plans.essentiel.feats.guests', 1],
      ['MonMariage.data.plans.essentiel.feats.gallery', 1],
      ['MonMariage.data.plans.essentiel.feats.invitations', 0],
      ['MonMariage.data.plans.essentiel.feats.rsvp', 0],
      ['MonMariage.data.plans.essentiel.feats.galleryLink', 0],
    ],
  },
  premium: {
    id: 'premium',
    name: 'MonMariage.data.plans.premium.name',
    price: 59,
    featured: true,
    tagline: 'MonMariage.data.plans.premium.tagline',
    guestCap: 250,
    storageCap: 25,
    feats: [
      ['MonMariage.data.plans.premium.feats.guests', 1],
      ['MonMariage.data.plans.premium.feats.gallery', 1],
      ['MonMariage.data.plans.premium.feats.essential', 0],
      ['MonMariage.data.plans.premium.feats.albums', 0],
      ['MonMariage.data.plans.premium.feats.faceSearch', 0],
    ],
  },
};

export interface McActive {
  planId: McPlanId;
  purchasedAt: string;
  galleryExpires: string;
  guestCap: number;
  storageCap: number;
}
export const MC_ACTIVE: McActive = {
  planId: 'premium',
  purchasedAt: '2026-05-18',
  galleryExpires: '2027-05-18',
  guestCap: 250,
  storageCap: 25,
};

export const MC_HD = { price: 29 };

export interface McInvoice {
  id: string;
  /** clé i18n du libellé de la facture */
  label: string;
  date: string;
  amount: number;
  status: string;
}
export const MC_INVOICES: McInvoice[] = [
  {
    id: 'WB-2026-0518',
    label: 'MonMariage.data.invoices.premiumPlan',
    date: '2026-05-18',
    amount: 59,
    status: 'paid',
  },
];

// [labelKey, subKey, priceKey] — le prix est une clé i18n (valeur formatée selon la locale).
export const MC_OVERAGES: ReadonlyArray<[string, string, string]> = [
  [
    'MonMariage.data.overages.guest.label',
    'MonMariage.data.overages.guest.sub',
    'MonMariage.data.overages.guest.price',
  ],
  [
    'MonMariage.data.overages.message.label',
    'MonMariage.data.overages.message.sub',
    'MonMariage.data.overages.message.price',
  ],
  [
    'MonMariage.data.overages.storage.label',
    'MonMariage.data.overages.storage.sub',
    'MonMariage.data.overages.storage.price',
  ],
];

/* ============================ RSVP ============================ */
export interface McRsvp {
  confirmed: number;
  pending: number;
  declined: number;
  noreply: number;
  expected: number;
}
export const MC_RSVP: McRsvp = {
  confirmed: 96,
  pending: 41,
  declined: 11,
  noreply: 18,
  expected: 184,
};

/* ============================ QUOTAS consommés ============================ */
export interface McUsage {
  guests: number;
  storageGo: number;
}
export const MC_USAGE: McUsage = { guests: 184, storageGo: 9.4 };

/* ============================ INVITÉS (échantillon) ============================ */
export type McGuestStatus = 'confirmed' | 'pending' | 'declined' | 'noreply';
export interface McGuest {
  id: string;
  name: string;
  group: string;
  cc: string;
  phone: string;
  count: number;
  status: McGuestStatus;
}
export const MC_GUESTS: McGuest[] = [
  {
    id: 'g1',
    name: 'Ashley Carter',
    group: 'Family',
    cc: '+1',
    phone: '415 555 0142',
    count: 2,
    status: 'confirmed',
  },
  {
    id: 'g2',
    name: 'Sarah & James Bennett',
    group: 'Friends',
    cc: '+1',
    phone: '212 555 0178',
    count: 2,
    status: 'confirmed',
  },
  {
    id: 'g3',
    name: 'Michael Brooks',
    group: 'Friends',
    cc: '+1',
    phone: '312 555 0193',
    count: 1,
    status: 'pending',
  },
  {
    id: 'g4',
    name: 'David Mitchell',
    group: 'Family',
    cc: '+1',
    phone: '305 555 0125',
    count: 4,
    status: 'confirmed',
  },
  {
    id: 'g5',
    name: 'Emily Walker',
    group: 'Friends',
    cc: '+1',
    phone: '646 555 0167',
    count: 1,
    status: 'noreply',
  },
  {
    id: 'g6',
    name: 'Jennifer Hayes',
    group: 'Family',
    cc: '+1',
    phone: '213 555 0149',
    count: 3,
    status: 'pending',
  },
  {
    id: 'g7',
    name: 'Rachel Green',
    group: 'Colleagues',
    cc: '+1',
    phone: '617 555 0188',
    count: 2,
    status: 'declined',
  },
  {
    id: 'g8',
    name: 'Daniel & Claire Foster',
    group: 'Friends',
    cc: '+1',
    phone: '404 555 0136',
    count: 2,
    status: 'confirmed',
  },
  {
    id: 'g9',
    name: 'Olivia Reed',
    group: 'Friends',
    cc: '+1',
    phone: '206 555 0154',
    count: 1,
    status: 'confirmed',
  },
];

/* ============================ RÉTROPLANNING LÉGER (dashboard) ============================ */
export interface McStep {
  id: string;
  /** clé i18n du libellé de l'étape */
  label: string;
  /** clé i18n du repère temporel */
  when: string;
  done?: boolean;
  current?: boolean;
  /** clé i18n de la note */
  note: string;
}
export const MC_STEPS: McStep[] = [
  {
    id: 's1',
    label: 'MonMariage.data.steps.s1.label',
    when: 'MonMariage.data.steps.s1.when',
    done: true,
    note: 'MonMariage.data.steps.s1.note',
  },
  {
    id: 's2',
    label: 'MonMariage.data.steps.s2.label',
    when: 'MonMariage.data.steps.s2.when',
    done: true,
    note: 'MonMariage.data.steps.s2.note',
  },
  {
    id: 's3',
    label: 'MonMariage.data.steps.s3.label',
    when: 'MonMariage.data.steps.s3.when',
    current: true,
    note: 'MonMariage.data.steps.s3.note',
  },
  {
    id: 's4',
    label: 'MonMariage.data.steps.s4.label',
    when: 'MonMariage.data.steps.s4.when',
    done: false,
    note: 'MonMariage.data.steps.s4.note',
  },
  {
    id: 's5',
    label: 'MonMariage.data.steps.s5.label',
    when: 'MonMariage.data.steps.s5.when',
    done: false,
    note: 'MonMariage.data.steps.s5.note',
  },
];

/* ============================ HELPERS (locale-aware) ============================
   Les formateurs reçoivent la `locale` active (next-intl `useLocale()`). La devise
   des forfaits one-shot est l'EUR : on localise séparateurs/placement sans figer
   `fr-FR`. Pour les libellés (mois, « J− »…) on passe par next-intl côté composant. */
const MC_DASH = '—';

/**
 * Devise du budget de démo (espace couple self-serve, mock). Reflète le choix
 * fait à l'onboarding ; ici on cible le lancement anglophone (USD). Quand le
 * câblage Convex sera fait, remplacer par `event.currency`. Une seule constante
 * à changer pour passer toute la démo dans une autre devise.
 */
export const MC_CURRENCY: BudgetCurrency = 'USD';

/** Montant entier, formaté selon la locale et la devise (défaut: MC_CURRENCY). */
export function mcEUR(
  n: number | null | undefined,
  locale: string,
  currency: BudgetCurrency = MC_CURRENCY,
): string {
  if (n == null) return MC_DASH;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Montant avec centimes si nécessaire, formaté selon la locale et la devise. */
export function mcEURc(n: number, locale: string, currency: BudgetCurrency = MC_CURRENCY): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Nombre simple formaté selon la locale. */
export function mcNum(n: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(n);
}

/** Gigaoctets formatés selon la locale (unité « Go » localisée). */
export function mcGo(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'gigabyte',
    maximumFractionDigits: 1,
  }).format(n);
}

/** Date longue localisée (ex. « vendredi 5 septembre 2026 »). */
export function mcDateLong(iso: string, locale: string): string {
  const d = new Date(iso + 'T12:00:00');
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/** Date longue sans le jour de la semaine (ex. « 5 septembre 2026 »). */
export function mcDateLongNoWeekday(iso: string, locale: string): string {
  const d = new Date(iso + 'T12:00:00');
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/** Date courte localisée (ex. « 5 sept. 2026 »). */
export function mcDateShort(iso: string, locale: string): string {
  const d = new Date(iso + 'T12:00:00');
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** Jour + mois court localisés (ex. « 5 sept. »). */
export function mcDateNum(iso: string, locale: string): string {
  const d = new Date(iso + 'T12:00:00');
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d);
}

export type McJKind = 'before' | 'day' | 'after';
/** Compte à rebours « J− » : `now` = horloge serveur passée en prop (hydration-safe) ;
    défaut MC_TODAY pour la démo/capture. Libellé traduit côté composant via
    `MonMariage.common.jBefore/jDay/jAfter`. */
export function mcJ(iso: string, now: number = MC_TODAY.getTime()): { kind: McJKind; n: number } {
  const n = Math.round((new Date(iso + 'T12:00:00').getTime() - now) / 86400000);
  if (n > 0) return { kind: 'before', n };
  if (n === 0) return { kind: 'day', n: 0 };
  return { kind: 'after', n: -n };
}

/** [pillKind, clé i18n du libellé de statut]. */
export function mcGuestStatusMeta(s: string): [string, string] {
  return (
    (
      {
        confirmed: ['ok', 'MonMariage.data.guestStatus.confirmed'],
        pending: ['wait', 'MonMariage.data.guestStatus.pending'],
        declined: ['no', 'MonMariage.data.guestStatus.declined'],
        noreply: ['muted', 'MonMariage.data.guestStatus.noreply'],
      } as Record<string, [string, string]>
    )[s] || ['muted', 'MonMariage.data.guestStatus.unknown']
  );
}
export function mcInitials(name: string): string {
  return String(name)
    .split(/\s|&/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0] ?? '')
    .join('')
    .toUpperCase();
}

/* ============================ RÉTROPLANNING PERSO (template) ============================ */
export type McTaskStatus = 'todo' | 'doing' | 'done';
export interface McTask {
  id: string;
  /** clé i18n OU libellé libre (tâches créées par le couple) */
  label: string;
  status: McTaskStatus;
  due?: string;
}
export interface McPhase {
  id: string;
  /** clé i18n OU libellé libre (phases créées par le couple) */
  label: string;
  /** clé i18n OU sous-titre libre */
  sub: string;
  current?: boolean;
  tasks: McTask[];
}
export const MC_PHASES: McPhase[] = [
  {
    id: 'p1',
    label: 'MonMariage.data.phases.p1.label',
    sub: 'MonMariage.data.phases.p1.sub',
    tasks: [
      { id: 't1', label: 'MonMariage.data.phases.p1.tasks.t1', status: 'done' },
      { id: 't2', label: 'MonMariage.data.phases.p1.tasks.t2', status: 'done' },
      { id: 't3', label: 'MonMariage.data.phases.p1.tasks.t3', status: 'done' },
    ],
  },
  {
    id: 'p2',
    label: 'MonMariage.data.phases.p2.label',
    sub: 'MonMariage.data.phases.p2.sub',
    tasks: [
      { id: 't4', label: 'MonMariage.data.phases.p2.tasks.t4', status: 'done' },
      { id: 't5', label: 'MonMariage.data.phases.p2.tasks.t5', status: 'done' },
      { id: 't6', label: 'MonMariage.data.phases.p2.tasks.t6', status: 'done' },
    ],
  },
  {
    id: 'p3',
    label: 'MonMariage.data.phases.p3.label',
    sub: 'MonMariage.data.phases.p3.sub',
    current: true,
    tasks: [
      {
        id: 't7',
        label: 'MonMariage.data.phases.p3.tasks.t7',
        status: 'doing',
        due: '2026-06-18',
      },
      { id: 't8', label: 'MonMariage.data.phases.p3.tasks.t8', status: 'todo', due: '2026-06-25' },
      { id: 't9', label: 'MonMariage.data.phases.p3.tasks.t9', status: 'todo', due: '2026-06-30' },
      {
        id: 't10',
        label: 'MonMariage.data.phases.p3.tasks.t10',
        status: 'todo',
        due: '2026-07-05',
      },
    ],
  },
  {
    id: 'p4',
    label: 'MonMariage.data.phases.p4.label',
    sub: 'MonMariage.data.phases.p4.sub',
    tasks: [
      {
        id: 't11',
        label: 'MonMariage.data.phases.p4.tasks.t11',
        status: 'todo',
        due: '2026-08-10',
      },
      {
        id: 't12',
        label: 'MonMariage.data.phases.p4.tasks.t12',
        status: 'todo',
        due: '2026-08-15',
      },
      {
        id: 't13',
        label: 'MonMariage.data.phases.p4.tasks.t13',
        status: 'todo',
        due: '2026-08-20',
      },
    ],
  },
  {
    id: 'p5',
    label: 'MonMariage.data.phases.p5.label',
    sub: 'MonMariage.data.phases.p5.sub',
    tasks: [
      { id: 't14', label: 'MonMariage.data.phases.p5.tasks.t14', status: 'todo' },
      { id: 't15', label: 'MonMariage.data.phases.p5.tasks.t15', status: 'todo' },
      { id: 't16', label: 'MonMariage.data.phases.p5.tasks.t16', status: 'todo' },
    ],
  },
  {
    id: 'p6',
    label: 'MonMariage.data.phases.p6.label',
    sub: 'MonMariage.data.phases.p6.sub',
    tasks: [
      { id: 't17', label: 'MonMariage.data.phases.p6.tasks.t17', status: 'todo' },
      { id: 't18', label: 'MonMariage.data.phases.p6.tasks.t18', status: 'todo' },
      { id: 't19', label: 'MonMariage.data.phases.p6.tasks.t19', status: 'todo' },
    ],
  },
];

/* ============================ CATÉGORIES PRESTATAIRES ============================ */
export type McVendorCat =
  | 'lieu'
  | 'traiteur'
  | 'photo'
  | 'musique'
  | 'fleurs'
  | 'patisserie'
  | 'tenues'
  | 'papeterie';
export interface McCat {
  /** clé i18n du libellé de catégorie */
  label: string;
  icon: string;
  tint: string;
}
export const MC_CATS: Record<McVendorCat, McCat> = {
  lieu: { label: 'MonMariage.data.cats.lieu', icon: 'MapPin', tint: 'oklch(62% 0.10 222)' },
  traiteur: {
    label: 'MonMariage.data.cats.traiteur',
    icon: 'Utensils',
    tint: 'oklch(60% 0.12 40)',
  },
  photo: { label: 'MonMariage.data.cats.photo', icon: 'Camera', tint: 'oklch(56% 0.12 300)' },
  musique: { label: 'MonMariage.data.cats.musique', icon: 'Music', tint: 'oklch(56% 0.12 265)' },
  fleurs: { label: 'MonMariage.data.cats.fleurs', icon: 'Flower', tint: 'oklch(58% 0.10 150)' },
  patisserie: {
    label: 'MonMariage.data.cats.patisserie',
    icon: 'CakeSlice',
    tint: 'oklch(68% 0.10 70)',
  },
  tenues: { label: 'MonMariage.data.cats.tenues', icon: 'Shirt', tint: 'oklch(58% 0.11 18)' },
  papeterie: { label: 'MonMariage.data.cats.papeterie', icon: 'Mail', tint: 'oklch(62% 0.09 340)' },
};

export type McVendorStatus = 'a_contacter' | 'contacte' | 'devis' | 'reserve' | 'paye';
/** [pillKind, clé i18n du libellé de statut prestataire]. */
export function mcVendorStatusMeta(s: string): [string, string] {
  return (
    (
      {
        a_contacter: ['muted', 'MonMariage.data.vendorStatus.a_contacter'],
        contacte: ['wait', 'MonMariage.data.vendorStatus.contacte'],
        devis: ['gold', 'MonMariage.data.vendorStatus.devis'],
        reserve: ['brand', 'MonMariage.data.vendorStatus.reserve'],
        paye: ['ok', 'MonMariage.data.vendorStatus.paye'],
      } as Record<string, [string, string]>
    )[s] || ['muted', 'MonMariage.data.vendorStatus.unknown']
  );
}

export interface McAttachment {
  id: string;
  name: string;
  kind: string;
  size?: number;
}
export interface McVendor {
  id: string;
  name: string;
  cat: McVendorCat;
  status: McVendorStatus;
  amount: number;
  paid: number;
  doc?: string | null;
  contact?: string | null;
  email?: string | null;
  note?: string;
  attachments?: McAttachment[];
}
export const MC_VENDORS: McVendor[] = [
  {
    id: 'v1',
    name: 'The Olive Grove Estate',
    cat: 'lieu',
    status: 'reserve',
    amount: 6500,
    paid: 1950,
    doc: 'Signed contract',
    contact: '+1 415 555 0142',
    note: 'Reception until 2 a.m.',
  },
  {
    id: 'v2',
    name: 'The Grand Table Catering',
    cat: 'traiteur',
    status: 'reserve',
    amount: 7200,
    paid: 2160,
    doc: 'Quote approved',
    contact: '+1 415 555 0177',
    note: '120 covers · seasonal menu.',
  },
  {
    id: 'v3',
    name: 'Emma Carter Photography',
    cat: 'photo',
    status: 'devis',
    amount: 2400,
    paid: 0,
    doc: 'Quote received',
    contact: '+1 415 555 0198',
    note: 'Scout visit on Jul 12.',
  },
  {
    id: 'v4',
    name: 'DJ Neo',
    cat: 'musique',
    status: 'contacte',
    amount: 1200,
    paid: 0,
    doc: null,
    contact: '+1 415 555 0110',
    note: 'Call back to confirm availability.',
  },
  {
    id: 'v5',
    name: 'Bloom & Co.',
    cat: 'fleurs',
    status: 'devis',
    amount: 1500,
    paid: 0,
    doc: 'Quote received',
    contact: '+1 415 555 0165',
    note: 'Arch + table centerpieces.',
  },
  {
    id: 'v6',
    name: 'Aria Bakery',
    cat: 'patisserie',
    status: 'a_contacter',
    amount: 600,
    paid: 0,
    doc: null,
    contact: null,
    note: 'Three-tier cake, vanilla & berries.',
  },
  {
    id: 'v7',
    name: 'The Bridal Atelier',
    cat: 'tenues',
    status: 'reserve',
    amount: 1800,
    paid: 900,
    doc: 'Purchase order',
    contact: '+1 415 555 0133',
    note: 'Fitting on Jul 5.',
  },
  {
    id: 'v8',
    name: 'Lila Paper Co.',
    cat: 'papeterie',
    status: 'paye',
    amount: 400,
    paid: 400,
    doc: 'Invoice',
    contact: '+1 415 555 0188',
    note: 'Invitations delivered.',
  },
];

/* ============================ BUDGET PERSO ============================ */
export const MC_BUDGET_TOTAL = 22000;

export interface McPoste {
  cat: McVendorCat;
  planned: number;
  paid: number;
  vendors: string[];
}
export function mcBudgetPostes(vendors: McVendor[] = MC_VENDORS): McPoste[] {
  const map: Partial<Record<McVendorCat, McPoste>> = {};
  for (const v of vendors) {
    if (!map[v.cat]) map[v.cat] = { cat: v.cat, planned: 0, paid: 0, vendors: [] };
    const p = map[v.cat]!;
    p.planned += v.amount;
    p.paid += v.paid;
    p.vendors.push(v.name);
  }
  return Object.values(map).sort((a, b) => b.planned - a.planned);
}

export interface McPayment {
  id: string;
  vendor: string;
  cat: McVendorCat;
  /** clé i18n du type d'échéance (acompte / solde) */
  kind: string;
  date: string;
  amount: number;
  paid: boolean;
  paidAmount?: number;
  payDate?: string | null;
  factures?: McAttachment[];
}
export const MC_PAYMENTS: McPayment[] = [
  {
    id: 'e1',
    vendor: 'Mas des Oliviers',
    cat: 'lieu',
    kind: 'MonMariage.data.paymentKind.deposit',
    date: '2026-05-18',
    amount: 1950,
    paid: true,
  },
  {
    id: 'e2',
    vendor: 'Papeterie Lila',
    cat: 'papeterie',
    kind: 'MonMariage.data.paymentKind.balance',
    date: '2026-05-30',
    amount: 400,
    paid: true,
  },
  {
    id: 'e3',
    vendor: 'Atelier Nuptial',
    cat: 'tenues',
    kind: 'MonMariage.data.paymentKind.deposit',
    date: '2026-06-02',
    amount: 900,
    paid: true,
  },
  {
    id: 'e4',
    vendor: 'Maison Tellier',
    cat: 'traiteur',
    kind: 'MonMariage.data.paymentKind.deposit',
    date: '2026-06-05',
    amount: 2160,
    paid: true,
  },
  {
    id: 'e5',
    vendor: 'Margaux Lefort',
    cat: 'photo',
    kind: 'MonMariage.data.paymentKind.deposit',
    date: '2026-06-20',
    amount: 720,
    paid: false,
  },
  {
    id: 'e6',
    vendor: 'Fleurs & Sens',
    cat: 'fleurs',
    kind: 'MonMariage.data.paymentKind.balance',
    date: '2026-08-10',
    amount: 1500,
    paid: false,
  },
  {
    id: 'e7',
    vendor: 'Mas des Oliviers',
    cat: 'lieu',
    kind: 'MonMariage.data.paymentKind.balance',
    date: '2026-08-22',
    amount: 4550,
    paid: false,
  },
  {
    id: 'e8',
    vendor: 'Maison Tellier',
    cat: 'traiteur',
    kind: 'MonMariage.data.paymentKind.balance',
    date: '2026-08-28',
    amount: 5040,
    paid: false,
  },
  {
    id: 'e9',
    vendor: 'Atelier Nuptial',
    cat: 'tenues',
    kind: 'MonMariage.data.paymentKind.balance',
    date: '2026-08-30',
    amount: 900,
    paid: false,
  },
];

export function mcDaysTo(iso: string, now: number = MC_TODAY.getTime()): number {
  return Math.round((new Date(iso + 'T12:00:00').getTime() - now) / 86400000);
}
