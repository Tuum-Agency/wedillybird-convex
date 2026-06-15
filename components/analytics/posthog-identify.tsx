'use client';

import { useEffect } from 'react';
import { identifyUser } from '@/lib/analytics/posthog-client';

const MS_PER_DAY = 86_400_000;

/**
 * Identifie l'utilisateur connecté dans PostHog (person-props NON-PII), monté
 * dans le layout authentifié. Lie les events anonymes (parcours marketing) au
 * compte une fois connecté → funnel acquisition → activation complet.
 *
 * Aucune PII (téléphone, email, nom) n'est envoyée : seulement rôle, palier,
 * locale et âge du compte.
 */
export function PostHogIdentify({
  userId,
  role,
  planTier,
  locale,
  createdAt,
}: {
  userId: string;
  role?: 'couple' | 'pro' | 'guest' | 'admin';
  planTier?: string;
  locale?: string;
  createdAt?: number;
}) {
  useEffect(() => {
    if (!userId) return;
    identifyUser(userId, {
      role,
      plan_tier: planTier,
      locale,
      account_age_days:
        typeof createdAt === 'number'
          ? Math.floor((Date.now() - createdAt) / MS_PER_DAY)
          : undefined,
    });
  }, [userId, role, planTier, locale, createdAt]);

  return null;
}
