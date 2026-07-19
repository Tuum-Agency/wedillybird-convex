import type { MutationCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';

export type NotificationType =
  | 'rsvp_response'
  | 'rsvp_config_changed'
  | 'planning_task'
  | 'generic';

export interface NotificationData {
  guestName?: string;
  rsvpStatus?: string;
  actorName?: string;
  taskTitle?: string;
  coupleLabel?: string;
  text?: string;
}

/** Crée une notification in-app pour un utilisateur. */
export async function createNotification(
  ctx: MutationCtx,
  args: {
    userId: Id<'users'>;
    type: NotificationType;
    eventId?: Id<'events'>;
    data?: NotificationData;
    link?: string;
  },
): Promise<void> {
  await ctx.db.insert('notifications', {
    userId: args.userId,
    type: args.type,
    ...(args.eventId ? { eventId: args.eventId } : {}),
    ...(args.data ? { data: args.data } : {}),
    ...(args.link ? { link: args.link } : {}),
    createdAt: Date.now(),
  });
}

/** Lien de destination selon le rôle du destinataire vis-à-vis de l'event. */
function resolveLink(event: Doc<'events'>, role: 'owner' | 'couple'): string {
  if (role === 'couple') return `/espace-couple/${event._id}`;
  return event.organizationId ? `/pro/weddings/${event._id}` : `/events/${event._id}`;
}

/**
 * Notifie les parties prenantes d'un event : le propriétaire (couple solo ou
 * agence) et/ou les couples rattachés (collaborateurs rôle `couple`), en
 * excluant l'auteur de l'action. Le lien est résolu selon le rôle de chacun.
 */
export async function notifyEventParties(
  ctx: MutationCtx,
  opts: {
    eventId: Id<'events'>;
    type: NotificationType;
    data?: NotificationData;
    excludeUserId?: Id<'users'>;
    includeOwner?: boolean;
    includeCouple?: boolean;
  },
): Promise<number> {
  const event = await ctx.db.get(opts.eventId);
  if (!event) return 0;

  const recipients = new Map<Id<'users'>, 'owner' | 'couple'>();
  if (opts.includeOwner !== false) recipients.set(event.ownerId, 'owner');
  if (opts.includeCouple !== false) {
    const collabs = await ctx.db
      .query('eventCollaborators')
      .withIndex('by_event', (q) => q.eq('eventId', opts.eventId))
      .collect();
    for (const c of collabs) {
      // Ne pas rétrograder un propriétaire déjà présent.
      if (c.role === 'couple' && !recipients.has(c.userId)) recipients.set(c.userId, 'couple');
    }
  }

  let count = 0;
  for (const [userId, role] of recipients) {
    if (opts.excludeUserId && userId === opts.excludeUserId) continue;
    await createNotification(ctx, {
      userId,
      type: opts.type,
      eventId: opts.eventId,
      data: opts.data,
      link: resolveLink(event, role),
    });
    count++;
  }
  return count;
}
