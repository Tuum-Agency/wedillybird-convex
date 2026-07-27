import { describe, it, expect } from 'vitest';
import type { QueryCtx } from '../../../convex/_generated/server';
import type { Id } from '../../../convex/_generated/dataModel';
import { assertOrgRead, assertOrgWrite, assertOrgManage } from '../../../convex/lib/orgAuth';

/**
 * Matrice RBAC multi-tenant du back-office agence — tests COMPORTEMENTAUX (on
 * exécute les gardes avec un ctx mocké, pas un regex sur le source). Couvre les
 * deux propriétés critiques : (1) isolation tenant (un membre d'une org n'a
 * aucun droit sur une autre) et (2) hiérarchie des rôles owner/admin > planner
 * > viewer. Audit archi 2026-07-19, constat « RBAC testé par regex ».
 */

type Role = 'owner' | 'admin' | 'planner' | 'viewer';
interface Membership {
  organizationId: string;
  userId: string;
  role: Role;
  status: 'active' | 'invited' | 'revoked';
}

function buildCtx(memberships: Membership[]): QueryCtx {
  const ctx = {
    db: {
      query: (table: string) => {
        if (table !== 'organizationMemberships') {
          throw new Error(`Unexpected query on table=${table}`);
        }
        return {
          withIndex: (
            _indexName: string,
            filter: (q: {
              eq: (field: string, value: unknown) => { eq: (f: string, v: unknown) => unknown };
            }) => unknown,
          ) => {
            const captured: Record<string, unknown> = {};
            const fluent = {
              eq: (field: string, value: unknown) => {
                captured[field] = value;
                return fluent;
              },
            };
            filter(fluent);
            return {
              first: async () =>
                memberships.find(
                  (m) =>
                    m.organizationId === captured.organizationId && m.userId === captured.userId,
                ) ?? null,
            };
          },
        };
      },
    },
  };
  return ctx as unknown as QueryCtx;
}

const ORG = 'org_A' as Id<'organizations'>;
const USER = 'usr_1' as Id<'users'>;
const member = (role: Role, status: Membership['status'] = 'active'): Membership => ({
  organizationId: 'org_A',
  userId: 'usr_1',
  role,
  status,
});

describe('orgAuth — isolation tenant', () => {
  it('un membre (owner) de org_A est FORBIDDEN sur org_B', async () => {
    const ctx = buildCtx([
      { organizationId: 'org_A', userId: 'usr_1', role: 'owner', status: 'active' },
    ]);
    await expect(assertOrgRead(ctx, 'org_B' as Id<'organizations'>, USER)).rejects.toThrow(
      'FORBIDDEN',
    );
  });

  it('un non-membre est FORBIDDEN en lecture', async () => {
    const ctx = buildCtx([]);
    await expect(assertOrgRead(ctx, ORG, 'usr_x' as Id<'users'>)).rejects.toThrow('FORBIDDEN');
  });

  it('un membre non-actif (revoked/invited) est FORBIDDEN', async () => {
    await expect(assertOrgRead(buildCtx([member('owner', 'revoked')]), ORG, USER)).rejects.toThrow(
      'FORBIDDEN',
    );
    await expect(assertOrgRead(buildCtx([member('admin', 'invited')]), ORG, USER)).rejects.toThrow(
      'FORBIDDEN',
    );
  });
});

describe('orgAuth — hiérarchie des rôles', () => {
  it('viewer : lecture OK, écriture et administration FORBIDDEN', async () => {
    const ctx = buildCtx([member('viewer')]);
    await expect(assertOrgRead(ctx, ORG, USER)).resolves.toMatchObject({ role: 'viewer' });
    await expect(assertOrgWrite(ctx, ORG, USER)).rejects.toThrow('FORBIDDEN');
    await expect(assertOrgManage(ctx, ORG, USER)).rejects.toThrow('FORBIDDEN');
  });

  it('planner : lecture + écriture OK, administration FORBIDDEN', async () => {
    const ctx = buildCtx([member('planner')]);
    await expect(assertOrgRead(ctx, ORG, USER)).resolves.toMatchObject({ role: 'planner' });
    await expect(assertOrgWrite(ctx, ORG, USER)).resolves.toMatchObject({ role: 'planner' });
    await expect(assertOrgManage(ctx, ORG, USER)).rejects.toThrow('FORBIDDEN');
  });

  it('owner et admin : lecture + écriture + administration OK', async () => {
    for (const role of ['owner', 'admin'] as const) {
      const ctx = buildCtx([member(role)]);
      await expect(assertOrgRead(ctx, ORG, USER)).resolves.toMatchObject({ role });
      await expect(assertOrgWrite(ctx, ORG, USER)).resolves.toMatchObject({ role });
      await expect(assertOrgManage(ctx, ORG, USER)).resolves.toMatchObject({ role });
    }
  });
});
