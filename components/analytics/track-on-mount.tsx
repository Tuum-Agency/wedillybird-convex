'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics/posthog-client';

/**
 * Émet un event analytics au montage. Permet de tracker une « vue » sur une
 * page rendue côté serveur (Server Component) sans la convertir en client :
 * il suffit d'y monter ce petit composant client.
 *
 * Ex. (haut de funnel / boucle virale) :
 *   <TrackOnMount event="invitation_viewed" properties={{ white_label: true }} />
 */
export function TrackOnMount({
  event,
  properties,
}: {
  event: string;
  properties?: Record<string, unknown>;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, properties);
    // Volontairement monté une seule fois : pas de dépendances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
