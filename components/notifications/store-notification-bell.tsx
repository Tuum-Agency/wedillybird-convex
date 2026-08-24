'use client';

import { useSessionStore } from '@/stores/session-store';
import { NotificationBell } from './notification-bell';

/**
 * Cloche de notifications montée uniquement quand le store de session est
 * hydraté (par `SessionHydrator` dans le layout `(app)`). Utilisée dans le
 * shell agence `ProSidebarShell`, où l'on ne veut pas afficher la cloche à un
 * visiteur non connecté. L'identité Convex, elle, vient du `sessionToken`
 * vérifié côté serveur — la cloche ne reçoit plus d'`userId`.
 */
export function StoreNotificationBell() {
  const isSignedIn = useSessionStore((s) => Boolean(s.user?.id));
  if (!isSignedIn) return null;
  return <NotificationBell />;
}
