import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import type { McScreenKey } from '@/components/mon-mariage/app';
import { getMessages } from '@/lib/i18n/server-translator';
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
  // Bloquée uniquement en *vraie* production (wedillybird.com). Autorisée en dev
  // et sur les déploiements **preview** Vercel (captures vidéo, protégés par la
  // preview protection). Aucune donnée réelle : rend la démo mock client-only.
  if (process.env.VERCEL_ENV === 'production') notFound();

  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const initialScreen: McScreenKey = (SCREENS as readonly string[]).includes(sp.screen ?? '')
    ? (sp.screen as McScreenKey)
    : 'home';
  const forfaitView = sp.view === 'choix' ? 'choix' : 'actif';

  // Le composant est rendu client-only (ssr:false) : aucune chaîne n'est lue côté
  // serveur, donc le provider du layout ne forwarde aucun message en prod (build
  // optimisé). On fournit explicitement les messages complets à cette route de
  // capture pour que les libellés s'affichent (sinon clés brutes type
  // « MonMariage.budget.title » sur la preview).
  const messages = getMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CaptureClient initialScreen={initialScreen} forfaitView={forfaitView} />
    </NextIntlClientProvider>
  );
}
