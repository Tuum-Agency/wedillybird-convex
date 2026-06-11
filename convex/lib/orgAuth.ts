import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';

/**
 * Helpers d'autorisation organisation (back-office agence), partagés par les
 * modules pro (clients, budget, rétroplanning, prestataires…).
 *
 * RBAC :
 *  - `owner` / `admin` : tout (gestion équipe, branding, facturation incluse).
 *  - `planner`         : crée/édite mariages, clients, budget, prestataires,
 *                        rétroplanning (PAS équipe/branding/facturation).
 *  - `viewer`          : lecture seule.
 *
 * Miroir de la logique privée de `convex/organizations.ts` ; centralisé ici
 * pour les nouvelles tables.
 */

type Ctx = QueryCtx | MutationCtx;

export async function getOrgMembership(
  ctx: Ctx,
  organizationId: Id<'organizations'>,
  userId: Id<'users'>,
): Promise<Doc<'organizationMemberships'> | null> {
  return ctx.db
    .query('organizationMemberships')
    .withIndex('by_org_user', (q) => q.eq('organizationId', organizationId).eq('userId', userId))
    .first();
}

/** Lecture : tout membre actif. Throw `FORBIDDEN` sinon. */
export async function assertOrgRead(
  ctx: Ctx,
  organizationId: Id<'organizations'>,
  userId: Id<'users'>,
): Promise<Doc<'organizationMemberships'>> {
  const m = await getOrgMembership(ctx, organizationId, userId);
  if (!m || m.status !== 'active') throw new Error('FORBIDDEN');
  return m;
}

/** Écriture métier : owner/admin/planner (pas viewer). */
export async function assertOrgWrite(
  ctx: Ctx,
  organizationId: Id<'organizations'>,
  userId: Id<'users'>,
): Promise<Doc<'organizationMemberships'>> {
  const m = await assertOrgRead(ctx, organizationId, userId);
  if (m.role === 'viewer') throw new Error('FORBIDDEN');
  return m;
}

/** Administration : owner/admin uniquement. */
export async function assertOrgManage(
  ctx: Ctx,
  organizationId: Id<'organizations'>,
  userId: Id<'users'>,
): Promise<Doc<'organizationMemberships'>> {
  const m = await assertOrgRead(ctx, organizationId, userId);
  if (m.role !== 'owner' && m.role !== 'admin') throw new Error('FORBIDDEN');
  return m;
}
