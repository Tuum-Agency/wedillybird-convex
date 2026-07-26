'use client';

import { useSessionStore } from '@/stores/session-store';
import { NotificationBell } from './notification-bell';

/**
 * Cloche de notifications qui lit l'`userId` depuis le store de session
 * (hydraté par `SessionHydrator` dans le layout `(app)`). Utilisée dans le shell
 * agence `ProSidebarShell`, où threader la prop `userId` sur les 16 pages n'est
 * pas souhaitable. Ne rend rien tant que le store n'est pas hydraté.
 */
export function StoreNotificationBell() {
  const userId = useSessionStore((s) => s.user?.id);
  if (!userId) return null;
  return <NotificationBell userId={userId} />;
}
