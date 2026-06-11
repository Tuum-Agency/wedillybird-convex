import { describe, it, expect } from 'vitest';
import {
  seatUsage,
  seatLimitForTier,
  memberInitials,
  memberHue,
  roleCan,
  capabilityCount,
  CAPABILITIES,
  ROLES,
  ASSIGNABLE_ROLES,
  type MemberStatus,
  type Role,
} from '../../../lib/pro/team';

describe('sièges', () => {
  it('seatLimitForTier', () => {
    expect(seatLimitForTier('starter')).toBe(2);
    expect(seatLimitForTier('business')).toBe(8);
    expect(seatLimitForTier('agency')).toBeNull();
    expect(seatLimitForTier(null)).toBeNull();
  });
  it('seatUsage compte actifs + en attente (jamais négatif)', () => {
    const m: Array<{ status: MemberStatus }> = [
      { status: 'active' },
      { status: 'active' },
      { status: 'pending' },
      { status: 'revoked' },
    ];
    expect(seatUsage(m, 8)).toEqual({ used: 3, limit: 8, free: 5 });
    expect(seatUsage(m, null)).toEqual({ used: 3, limit: null, free: null });
    expect(seatUsage(m, 2)).toEqual({ used: 3, limit: 2, free: 0 });
  });
});

describe('avatars', () => {
  it('memberInitials', () => {
    expect(memberInitials('Camille Faye')).toBe('CF');
    expect(memberInitials('Alice')).toBe('A');
  });
  it('memberHue déterministe et borné', () => {
    const h = memberHue('Camille');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
    expect(memberHue('Camille')).toBe(h);
  });
});

describe('matrice RBAC', () => {
  it('owner peut tout', () => {
    for (const cap of CAPABILITIES) expect(cap.allow.owner).toBe(true);
  });
  it('viewer : lecture seule', () => {
    const get = (k: string) => CAPABILITIES.find((c) => c.key === k)!;
    expect(get('view').allow.viewer).toBe(true);
    expect(get('edit').allow.viewer).toBe(false);
    expect(get('delete').allow.viewer).toBe(false);
  });
  it('seul owner peut supprimer l’organisation', () => {
    const del = CAPABILITIES.find((c) => c.key === 'delete')!;
    expect(del.allow).toEqual({ owner: true, admin: false, planner: false, viewer: false });
    expect(del.critical).toBe(true);
  });
  it('admin gère équipe/branding/billing, planner non', () => {
    for (const k of ['team', 'branding', 'billing']) {
      const cap = CAPABILITIES.find((c) => c.key === k)!;
      expect(cap.allow.admin).toBe(true);
      expect(cap.allow.planner).toBe(false);
    }
  });
  it('planner peut éditer + galerie', () => {
    expect(CAPABILITIES.find((c) => c.key === 'edit')!.allow.planner).toBe(true);
    expect(CAPABILITIES.find((c) => c.key === 'gallery')!.allow.planner).toBe(true);
  });
  it('ASSIGNABLE_ROLES exclut owner', () => {
    expect(ASSIGNABLE_ROLES).not.toContain('owner');
    expect(ROLES).toContain('owner');
  });
});

describe('matrice des permissions', () => {
  it('roleCan reflète la matrice CAPABILITIES', () => {
    expect(roleCan('owner', 'delete')).toBe(true);
    expect(roleCan('admin', 'delete')).toBe(false);
    expect(roleCan('viewer', 'view')).toBe(true);
    expect(roleCan('viewer', 'edit')).toBe(false);
    expect(roleCan('planner', 'gallery')).toBe(true);
    expect(roleCan('planner', 'team')).toBe(false);
  });

  it('roleCan renvoie false pour une capacité inconnue', () => {
    expect(roleCan('owner', 'inexistant')).toBe(false);
  });

  it('capabilityCount décroît avec le niveau de rôle (owner ≥ admin ≥ planner ≥ viewer)', () => {
    expect(capabilityCount('owner')).toBe(CAPABILITIES.length); // owner peut tout
    expect(capabilityCount('owner')).toBeGreaterThanOrEqual(capabilityCount('admin'));
    expect(capabilityCount('admin')).toBeGreaterThanOrEqual(capabilityCount('planner'));
    expect(capabilityCount('planner')).toBeGreaterThanOrEqual(capabilityCount('viewer'));
  });

  it('héritage : toute capacité d’un rôle inférieur est accordée au supérieur', () => {
    // Invariant affiché à l'utilisateur (« les permissions sont héritées »).
    const order: Role[] = ['viewer', 'planner', 'admin', 'owner'];
    for (const cap of CAPABILITIES) {
      for (let i = 0; i < order.length - 1; i++) {
        const lower = order[i]!;
        const higher = order[i + 1]!;
        if (cap.allow[lower]) expect(cap.allow[higher]).toBe(true);
      }
    }
  });
});
