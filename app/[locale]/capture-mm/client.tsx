'use client';

import dynamic from 'next/dynamic';
import type { McScreenKey } from '@/components/mon-mariage/app';
import { buildDemoBundle, DEMO_NOW } from '@/components/mon-mariage/demo-bundle';

// Rendu CLIENT-ONLY (ssr: false) pour les captures : évite tout mismatch
// d'hydratation (les helpers de date de data.ts dépendent du fuseau horaire,
// UTC côté serveur vs local côté client). Réservé à la route de capture dev.
const MonMariageApp = dynamic(
  () => import('@/components/mon-mariage/app').then((m) => m.MonMariageApp),
  { ssr: false },
);

export function CaptureClient({
  initialScreen,
  forfaitView,
}: {
  initialScreen: McScreenKey;
  forfaitView: 'choix' | 'actif';
}) {
  return (
    <MonMariageApp
      bundle={buildDemoBundle()}
      now={DEMO_NOW}
      initialScreen={initialScreen}
      forfaitViewOverride={forfaitView}
    />
  );
}
