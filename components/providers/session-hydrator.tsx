'use client';

import { useEffect } from 'react';
import { useSessionStore } from '@/stores/session-store';

type Role = 'couple' | 'pro' | 'guest' | 'admin';

/**
 * Hydrate le store de session (Zustand) pour tout l'espace authentifié.
 * Permet aux composants client des shells (ex. cloche de notifications du
 * back-office agence, où l'`userId` ne peut être threadé partout) de connaître
 * l'utilisateur courant. Aucune donnée sensible : id + rôle + nom d'affichage.
 */
export function SessionHydrator({
  userId,
  role,
  phone,
  fullName,
}: {
  userId: string;
  role?: Role;
  phone?: string;
  fullName?: string;
}) {
  useEffect(() => {
    useSessionStore.getState().setUser({
      id: userId,
      phone: phone ?? '',
      role: role ?? 'guest',
      ...(fullName ? { fullName } : {}),
    });
    return () => useSessionStore.getState().reset();
  }, [userId, role, phone, fullName]);
  return null;
}
