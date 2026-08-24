import { makeFunctionReference } from 'convex/server';

export type NotificationType =
  | 'rsvp_response'
  | 'rsvp_config_changed'
  | 'planning_task'
  | 'generic';

export interface NotificationItem {
  _id: string;
  type: NotificationType;
  eventId?: string;
  data?: {
    guestName?: string;
    rsvpStatus?: string;
    actorName?: string;
    taskTitle?: string;
    coupleLabel?: string;
    text?: string;
  };
  link?: string;
  readAt?: number;
  createdAt: number;
}

/**
 * Références de fonctions Convex pour les composants clients.
 *
 * Chaque fonction exige un `sessionToken` vérifié côté Convex : l'identité de
 * l'appelant n'est plus déduite d'un `userId`/`requesterId` fourni par le
 * navigateur. Le jeton vient de `useConvexSessionToken()`
 * (`@/stores/convex-session-store`) — passer `'skip'` à `useQuery` tant qu'il
 * n'est pas disponible.
 */
export const clientApi = {
  countGuestsByEvent: makeFunctionReference<
    'query',
    { eventId: string; sessionToken: string },
    { total: number; attending: number; declined: number; pending: number; maybe: number }
  >('guests:countByEvent'),
  notificationsForUser: makeFunctionReference<
    'query',
    { sessionToken: string },
    { unread: number; items: NotificationItem[] }
  >('notifications:listForUser'),
  markAllNotificationsRead: makeFunctionReference<
    'mutation',
    { sessionToken: string },
    { ok: true; marked: number }
  >('notifications:markAllRead'),
  markNotificationRead: makeFunctionReference<
    'mutation',
    { notificationId: string; sessionToken: string },
    { ok: true }
  >('notifications:markRead'),
};
