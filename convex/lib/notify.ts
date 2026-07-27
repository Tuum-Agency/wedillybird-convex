import type { MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';

export type NotificationType =
  | 'rsvp_response'
  | 'rsvp_config_changed'
  | 'planning_task'
  | 'generic';

export type EventRole = 'owner' | 'couple';

export interface NotificationData {
  guestName?: string;
  rsvpStatus?: string;
  actorName?: string;
  taskTitle?: string;
  coupleLabel?: string;
  text?: string;
}

/**
 * Lien de destination selon le rôle du destinataire vis-à-vis de l'event.
 * Pur → testable : couple rattaché → portail couple ; propriétaire → back-office
 * agence si event d'orga, sinon page event du couple solo.
 */
export function resolveNotificationLink(
  event: { _id: string; organizationId?: unknown },
  role: EventRole,
): string {
  if (role === 'couple') return `/espace-couple/${event._id}`;
  return event.organizationId ? `/pro/weddings/${event._id}` : `/events/${event._id}`;
}

/**
 * Sélectionne les destinataires (propriétaire + couples rattachés), déduplique
 * (un propriétaire déjà présent n'est pas rétrogradé en couple) et exclut
 * l'auteur de l'action. Pur → testable.
 */
export function selectNotificationRecipients(input: {
  ownerId: string;
  coupleCollaboratorIds: readonly string[];
  includeOwner?: boolean;
  includeCouple?: boolean;
  excludeUserId?: string;
}): Array<{ userId: string; role: EventRole }> {
  const map = new Map<string, EventRole>();
  if (input.includeOwner !== false) map.set(input.ownerId, 'owner');
  if (input.includeCouple !== false) {
    for (const id of input.coupleCollaboratorIds) {
      if (!map.has(id)) map.set(id, 'couple');
    }
  }
  const out: Array<{ userId: string; role: EventRole }> = [];
  for (const [userId, role] of map) {
    if (input.excludeUserId && userId === input.excludeUserId) continue;
    out.push({ userId, role });
  }
  return out;
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

  let coupleCollaboratorIds: string[] = [];
  if (opts.includeCouple !== false) {
    const collabs = await ctx.db
      .query('eventCollaborators')
      .withIndex('by_event', (q) => q.eq('eventId', opts.eventId))
      .collect();
    coupleCollaboratorIds = collabs.filter((c) => c.role === 'couple').map((c) => c.userId);
  }

  const recipients = selectNotificationRecipients({
    ownerId: event.ownerId,
    coupleCollaboratorIds,
    includeOwner: opts.includeOwner,
    includeCouple: opts.includeCouple,
    excludeUserId: opts.excludeUserId,
  });

  for (const r of recipients) {
    await createNotification(ctx, {
      userId: r.userId as Id<'users'>,
      type: opts.type,
      eventId: opts.eventId,
      data: opts.data,
      link: resolveNotificationLink(event, r.role),
    });
  }
  return recipients.length;
}
