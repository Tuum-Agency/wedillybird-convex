import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import type { McScreenKey } from '@/components/mon-mariage/app';
import { CaptureClient } from './client';

/**
 * Route de CAPTURE (développement uniquement) — rend l'app « Mon mariage » sans auth
 * ni Convex, pour produire screenshots / enregistrements (simulateur iOS) destinés au
 * design de la vidéo de lancement. Désactivée hors développement. Supprimable sans risque.
 *
 *   /fr/capture-mm?screen=home|dashboard|planning|vendors|budget|seating|forfait
 *   /fr/capture-mm?screen=forfait&view=choix   (page tarifs avant achat)
 */
export const metadata = {
  title: 'Capture — Mon mariage',
  robots: { index: false, follow: false },
};

const SCREENS = [
  'home',
  'dashboard',
  'planning',
  'vendors',
  'budget',
  'seating',
  'forfait',
] as const satisfies readonly McScreenKey[];

export default async function CaptureMonMariagePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ screen?: string; view?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();

  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const initialScreen: McScreenKey = (SCREENS as readonly string[]).includes(sp.screen ?? '')
    ? (sp.screen as McScreenKey)
    : 'home';
  const forfaitView = sp.view === 'choix' ? 'choix' : 'actif';

  return <CaptureClient initialScreen={initialScreen} forfaitView={forfaitView} />;
}
