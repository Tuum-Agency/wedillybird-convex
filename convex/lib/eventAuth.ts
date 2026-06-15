import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

/** Rôles de collaborateur autorisés à gérer l'event (invités, etc.). */
const WRITE_ROLES = new Set(['couple', 'co_owner', 'planner']);

/**
 * Vérifie qu'un user a accès à un event : **propriétaire OU collaborateur**, et
 * renvoie l'event. Pour un accès en écriture (`write: true`), le collaborateur doit
 * avoir un rôle gestionnaire (couple / co_owner / planner). Couvre les couples en
 * direct (propriétaires de leur event) ET les couples rattachés à une agence
 * (collaborateurs rôle `couple`).
 */
export async function assertEventAccess(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<'events'>,
  userId: Id<'users'>,
  opts: { write?: boolean } = {},
): Promise<Doc<'events'>> {
  const event = await ctx.db.get(eventId);
  if (!event) throw new Error('EVENT_NOT_FOUND');
  if (event.ownerId === userId) return event;
  const collab = await ctx.db
    .query('eventCollaborators')
    .withIndex('by_event_user', (q) => q.eq('eventId', eventId).eq('userId', userId))
    .first();
  if (!collab) throw new Error('FORBIDDEN');
  if (opts.write && !WRITE_ROLES.has(collab.role)) throw new Error('FORBIDDEN');
  return event;
}
