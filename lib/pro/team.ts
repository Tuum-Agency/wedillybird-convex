/**
 * Équipe — rôles, matrice de permissions et sièges. Données + helpers purs
 * (FR), partagés UI + tests. La matrice reflète les gardes réelles côté Convex
 * (`assertCanManage` pour team/branding/billing ; orgAuth pour edit/gallery).
 */

export type Role = 'owner' | 'admin' | 'planner' | 'viewer';
export type MemberStatus = 'pending' | 'active' | 'revoked';

export const ROLES: Role[] = ['owner', 'admin', 'planner', 'viewer'];
/** Rôles attribuables par invitation / changement (jamais « owner »). */
export const ASSIGNABLE_ROLES: Array<Exclude<Role, 'owner'>> = ['admin', 'planner', 'viewer'];

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Propriétaire',
  admin: 'Admin',
  planner: 'Planner',
  viewer: 'Lecteur',
};

export const ROLE_SUB: Record<Role, string> = {
  owner: 'Accès total',
  admin: 'Équipe · marque · facturation',
  planner: 'Mariages · clients · budget',
  viewer: 'Lecture seule',
};

export const ROLE_DESC: Record<Role, string> = {
  owner:
    'Accès complet et illimité. Le propriétaire détient l’organisation : il peut tout gérer, transférer la propriété et supprimer le compte. Unique et non révocable.',
  admin:
    'Gère l’équipe, le branding en marque blanche et la facturation, en plus de tout ce que fait un planner. Le bras droit du propriétaire au quotidien.',
  planner:
    'Crée et pilote les mariages, les clients, le budget, les prestataires et le rétroplanning. N’accède pas à l’équipe, à la facturation ni au branding.',
  viewer:
    'Consulte les mariages et les clients en lecture seule. Idéal pour un·e stagiaire, un·e prestataire de confiance ou un regard externe.',
};

export const STATUS_LABEL: Record<MemberStatus, string> = {
  pending: 'Invité',
  active: 'Actif',
  revoked: 'Révoqué',
};

export interface Capability {
  key: string;
  label: string;
  /** Ligne critique (suppression de l'organisation). */
  critical?: boolean;
  allow: Record<Role, boolean>;
}

/** Matrice capacité × rôle (les permissions sont héritées : admin ⊇ planner ⊇ viewer). */
export const CAPABILITIES: Capability[] = [
  {
    key: 'view',
    label: 'Voir les mariages & clients',
    allow: { owner: true, admin: true, planner: true, viewer: true },
  },
  {
    key: 'edit',
    label: 'Créer / éditer mariages, clients, budget, prestataires, rétroplanning',
    allow: { owner: true, admin: true, planner: true, viewer: false },
  },
  {
    key: 'gallery',
    label: 'Gérer la galerie & le check-in du jour J',
    allow: { owner: true, admin: true, planner: true, viewer: false },
  },
  {
    key: 'team',
    label: 'Inviter et gérer l’équipe',
    allow: { owner: true, admin: true, planner: false, viewer: false },
  },
  {
    key: 'branding',
    label: 'Gérer le branding & la marque blanche',
    allow: { owner: true, admin: true, planner: false, viewer: false },
  },
  {
    key: 'billing',
    label: 'Gérer l’abonnement & la facturation',
    allow: { owner: true, admin: true, planner: false, viewer: false },
  },
  {
    key: 'delete',
    label: 'Supprimer l’organisation',
    critical: true,
    allow: { owner: true, admin: false, planner: false, viewer: false },
  },
];

/** Un rôle a-t-il une capacité donnée ? (faux si la capacité est inconnue). */
export function roleCan(role: Role, capabilityKey: string): boolean {
  const cap = CAPABILITIES.find((c) => c.key === capabilityKey);
  return cap?.allow[role] ?? false;
}

/** Nombre de capacités accordées à un rôle (utilisé pour résumer/trier). */
export function capabilityCount(role: Role): number {
  return CAPABILITIES.filter((c) => c.allow[role]).length;
}

/** Limite de sièges par forfait (grille v3 ; null = illimité). */
export const SEAT_LIMIT: Record<'starter' | 'business' | 'agency', number | null> = {
  starter: 2,
  business: 8,
  agency: null,
};

export function seatLimitForTier(
  tier: 'starter' | 'business' | 'agency' | null | undefined,
): number | null {
  if (!tier) return null;
  return SEAT_LIMIT[tier];
}

export interface SeatUsage {
  used: number;
  limit: number | null;
  free: number | null;
}

/** Sièges occupés (membres actifs + invitations en attente) vs limite du forfait. */
export function seatUsage(
  members: Array<{ status: MemberStatus }>,
  limit: number | null,
): SeatUsage {
  const used = members.filter((m) => m.status === 'active' || m.status === 'pending').length;
  return { used, limit, free: limit == null ? null : Math.max(0, limit - used) };
}

/** Initiales d'un nom (« Camille Faye » → « CF »). */
export function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const ini = parts
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('');
  return (ini || name.charAt(0) || '·').toUpperCase();
}

/** Teinte stable dérivée du nom (hue 0–359). */
export function memberHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}
