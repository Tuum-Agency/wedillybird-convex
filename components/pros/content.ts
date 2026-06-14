/**
 * Structure de la page Pros (`/pros`) — agences & wedding planners.
 *
 * Source de vérité produit : `.context/livrables-wedillybird/Grille-Tarifaire-Pro-v3.md`
 * (mapping forfaits) + `_agencyTax.json` (taxonomie des 11 piliers). Les montants
 * restent pilotés par `lib/payments/subscriptions.ts` (grille canonique) ; ce
 * module ne décrit que la *structure* (icônes, forfaits, identifiants).
 *
 * Les libellés visibles ne vivent plus ici : ils sont résolus par les composants
 * via next-intl (namespace `Pros`), clés indexées par les identifiants stables
 * ci-dessous (`id`, `number`, `step`, `level`, `key`). Cf. le précédent
 * `components/landing/pros-features.tsx`.
 */

import {
  LayoutDashboard,
  Users,
  CalendarClock,
  Wallet,
  FileSignature,
  Sparkles,
  Palette,
  ShieldCheck,
  Cable,
  CreditCard,
  SlidersHorizontal,
  MessageCircle,
  ScanFace,
  CheckCircle2,
  Armchair,
  type LucideIcon,
} from 'lucide-react';

/** Disponibilité d'une fonctionnalité selon le forfait (grille v3). */
export type Tier = 'all' | 'business' | 'agency' | 'addon';

/** Une fonctionnalité d'un pilier : identité structurelle uniquement. */
export interface Feature {
  /** Clé stable → `Pros.pillars.<pillarId>.features.<key>.{name,detail}`. */
  key: string;
  tier: Tier;
}

export interface Pillar {
  id: string;
  number: string;
  icon: LucideIcon;
  features: readonly Feature[];
}

/* -------------------------------------------------------------------------- */
/*  Les 11 piliers fonctionnels — structure (icône, forfait, identifiants)    */
/* -------------------------------------------------------------------------- */

export const PILLARS: readonly Pillar[] = [
  {
    id: 'cockpit',
    number: '01',
    icon: LayoutDashboard,
    features: [
      { key: 'aggregated', tier: 'all' },
      { key: 'trendKpis', tier: 'all' },
      { key: 'quotaGauges', tier: 'all' },
      { key: 'globalSearch', tier: 'all' },
      { key: 'activityFeed', tier: 'all' },
      { key: 'multiEventAnalytics', tier: 'agency' },
    ],
  },
  {
    id: 'crm',
    number: '02',
    icon: Users,
    features: [
      { key: 'clientCards', tier: 'all' },
      { key: 'kanban', tier: 'business' },
      { key: 'bulkActions', tier: 'business' },
      { key: 'leadSources', tier: 'business' },
      { key: 'leadToWedding', tier: 'business' },
      { key: 'teamAssignment', tier: 'business' },
    ],
  },
  {
    id: 'planning',
    number: '03',
    icon: CalendarClock,
    features: [
      { key: 'phasedPlanning', tier: 'all' },
      { key: 'threeViews', tier: 'all' },
      { key: 'templates', tier: 'all' },
      { key: 'subtasks', tier: 'business' },
      { key: 'vendorDirectory', tier: 'all' },
      { key: 'vendorLink', tier: 'business' },
    ],
  },
  {
    id: 'budget',
    number: '04',
    icon: Wallet,
    features: [
      { key: 'tracking', tier: 'all' },
      { key: 'lineEditing', tier: 'business' },
      { key: 'vendorToBudget', tier: 'business' },
      { key: 'pdfExport', tier: 'business' },
      { key: 'csvExport', tier: 'all' },
    ],
  },
  {
    id: 'finance',
    number: '05',
    icon: FileSignature,
    features: [
      { key: 'brandedDocs', tier: 'business' },
      { key: 'schedules', tier: 'business' },
      { key: 'eSign', tier: 'business' },
      { key: 'bookingFile', tier: 'business' },
      { key: 'tracking', tier: 'business' },
      { key: 'stripeCollect', tier: 'addon' },
    ],
  },
  {
    id: 'execution',
    number: '06',
    icon: Sparkles,
    features: [
      { key: 'tabbedHub', tier: 'all' },
      { key: 'cinematicInvite', tier: 'all' },
      { key: 'rsvpWhatsApp', tier: 'all' },
      { key: 'offlineCheckin', tier: 'all' },
      { key: 'seating', tier: 'all' },
      { key: 'faceGallery', tier: 'all' },
    ],
  },
  {
    id: 'whitelabel',
    number: '07',
    icon: Palette,
    features: [
      { key: 'brandColor', tier: 'all' },
      { key: 'subdomainLogo', tier: 'all' },
      { key: 'couplePortal', tier: 'business' },
      { key: 'coupleSignature', tier: 'business' },
      { key: 'domainEmail', tier: 'agency' },
      { key: 'removeBranding', tier: 'agency' },
    ],
  },
  {
    id: 'team',
    number: '08',
    icon: ShieldCheck,
    features: [
      { key: 'rbac', tier: 'all' },
      { key: 'permissionMatrix', tier: 'all' },
      { key: 'invitations', tier: 'all' },
      { key: 'seats', tier: 'all' },
      { key: 'ownershipTransfer', tier: 'agency' },
    ],
  },
  {
    id: 'integrations',
    number: '09',
    icon: Cable,
    features: [
      { key: 'csvImport', tier: 'business' },
      { key: 'honeybook', tier: 'agency' },
      { key: 'zapier', tier: 'agency' },
      { key: 'apiWebhooks', tier: 'agency' },
      { key: 'fieldSource', tier: 'agency' },
      { key: 'ownCrmMode', tier: 'agency' },
    ],
  },
  {
    id: 'billing',
    number: '10',
    icon: CreditCard,
    features: [
      { key: 'manage', tier: 'all' },
      { key: 'changePlan', tier: 'all' },
      { key: 'overageTracking', tier: 'all' },
      { key: 'paygCredits', tier: 'addon' },
      { key: 'monthlyExport', tier: 'all' },
      { key: 'stripePortal', tier: 'all' },
    ],
  },
  {
    id: 'settings',
    number: '11',
    icon: SlidersHorizontal,
    features: [
      { key: 'profile', tier: 'all' },
      { key: 'branding', tier: 'all' },
      { key: 'messaging', tier: 'all' },
      { key: 'notifications', tier: 'all' },
      { key: 'accountSecurity', tier: 'business' },
      { key: 'dangerZone', tier: 'agency' },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*  Parcours « de A à Z » — le constat → la promesse                          */
/* -------------------------------------------------------------------------- */

/** Étapes du parcours — libellés via `Pros.journey.steps.<step>.{title,detail}`. */
export const JOURNEY_STEPS = ['01', '02', '03', '04', '05', '06'] as const;

/* -------------------------------------------------------------------------- */
/*  Le différenciateur (wedge jour J)                                         */
/* -------------------------------------------------------------------------- */

export interface WedgeItem {
  /** Clé stable → `Pros.wedge.items.<key>.{title,detail}`. */
  key: string;
  icon: LucideIcon;
}

export const WEDGE: readonly WedgeItem[] = [
  { key: 'rsvp', icon: MessageCircle },
  { key: 'gallery', icon: ScanFace },
  { key: 'checkin', icon: CheckCircle2 },
  { key: 'seating', icon: Armchair },
];

/* -------------------------------------------------------------------------- */
/*  Marque blanche graduée                                                    */
/* -------------------------------------------------------------------------- */

export interface WhiteLabelLevel {
  /** Clé stable → `Pros.whiteLabel.levels.<key>.*`. */
  key: string;
  /** Numéro de niveau utilisé pour la clé d'intitulé `Pros.whiteLabel.levelLabel`. */
  levelNumber: string;
  tier: Tier;
  /** Nombre de puces — itérées via `Pros.whiteLabel.levels.<key>.points.<i>`. */
  pointCount: number;
}

export const WHITE_LABEL: readonly WhiteLabelLevel[] = [
  { key: 'visible', levelNumber: '1', tier: 'all', pointCount: 3 },
  { key: 'branded', levelNumber: '2', tier: 'business', pointCount: 3 },
  { key: 'total', levelNumber: '3', tier: 'agency', pointCount: 3 },
];

/* -------------------------------------------------------------------------- */
/*  Add-ons & dépassements (transverses, hors tiering)                        */
/* -------------------------------------------------------------------------- */

/** Une ligne de prix : seul l'identifiant est structurel (libellés via i18n). */
export interface PriceLine {
  /** Clé stable → `Pros.pricing.addons.<key>.*` ou `Pros.pricing.overages.<key>.*`. */
  key: string;
}

export const ADDONS: readonly PriceLine[] = [
  { key: 'stripe' },
  { key: 'hdUpsell' },
  { key: 'extraSeat' },
  { key: 'concurrentEvent' },
];

export const OVERAGES: readonly PriceLine[] = [
  { key: 'message' },
  { key: 'guest' },
  { key: 'storage' },
];

/* -------------------------------------------------------------------------- */
/*  Capacités par forfait (garde-fou marge — pas le récit de vente)           */
/* -------------------------------------------------------------------------- */

export interface CapacityRow {
  /** Clé stable → `Pros.pricing.capacities.<key>` (libellé de ligne). */
  key: string;
  starter: string;
  business: string;
  /** Clé i18n si la valeur est textuelle (ex. « Illimités »), sinon valeur brute. */
  agency: string;
  /** `true` quand `agency` est une clé i18n plutôt qu'une valeur affichable telle quelle. */
  agencyIsKey?: boolean;
}

export const CAPACITIES: readonly CapacityRow[] = [
  { key: 'concurrentWeddings', starter: '5', business: '20', agency: '50' },
  { key: 'guestsPerWedding', starter: '150', business: '150', agency: '150' },
  { key: 'messagesPerMonth', starter: '3 000', business: '10 000', agency: '25 000' },
  { key: 'galleryStorage', starter: '50 Go', business: '200 Go', agency: '500 Go' },
  { key: 'teamSeats', starter: '2', business: '8', agency: 'unlimited', agencyIsKey: true },
];

/* -------------------------------------------------------------------------- */
/*  FAQ pros                                                                  */
/* -------------------------------------------------------------------------- */

/** Identifiants des questions — Q/R via `Pros.faq.items.<key>.{q,a}`. */
export const FAQ_KEYS = ['difference', 'money', 'data', 'cancel', 'overage', 'beginner'] as const;
