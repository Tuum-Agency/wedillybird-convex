'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { CONSENT_STORAGE_KEY } from '@/lib/analytics/posthog-client';
import { isMetaConfigured, loadMetaPixel, metaPageView } from '@/lib/analytics/meta-pixel';

/**
 * Monte le pixel Meta si (1) un ID est configuré et (2) le consentement RGPD est
 * déjà « accepté » au chargement. Le cas « accepte pendant la session » est géré
 * par `setAnalyticsConsent` (cf. posthog-client). Émet un PageView Meta à chaque
 * navigation SPA. Ne rend rien.
 */
export function MetaPixel() {
  const pathname = usePathname();
  const firstNav = useRef(true);

  // Chargement initial : visiteur revenant qui a déjà consenti.
  useEffect(() => {
    if (!isMetaConfigured()) return;
    try {
      if (localStorage.getItem(CONSENT_STORAGE_KEY) === 'accepted') loadMetaPixel();
    } catch {
      /* no-op */
    }
  }, []);

  // PageView sur navigation — le 1er est déjà émis par loadMetaPixel/init.
  useEffect(() => {
    if (firstNav.current) {
      firstNav.current = false;
      return;
    }
    metaPageView();
  }, [pathname]);

  return null;
}
