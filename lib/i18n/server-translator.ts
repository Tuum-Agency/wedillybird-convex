/**
 * Helper de traduction côté serveur (hors React) — utilisable depuis :
 *  - les actions Convex Node (envoi d'emails)
 *  - les API routes Next.js
 *  - la génération PDF de factures (server-side render)
 *
 * S'appuie sur `createTranslator` de next-intl/use-intl, qui ne nécessite
 * pas de contexte React. Les JSON de messages sont chargés une fois au boot.
 *
 * NB : importe les 7 fichiers messages, donc ne convient PAS aux Convex
 * mutations/queries (V8 isolate). Pour ces dernières, importer
 * `lib/i18n/locale-tags.ts` (sans dépendance JSON).
 */
import { createTranslator } from 'next-intl';
import type { Locale } from '../../i18n/routing';
import { resolveLocale } from './locale-tags';

import frMessages from '../../messages/fr.json';
import enMessages from '../../messages/en.json';
import esMessages from '../../messages/es.json';
import itMessages from '../../messages/it.json';
import ptMessages from '../../messages/pt.json';
import deMessages from '../../messages/de.json';
import arMessages from '../../messages/ar.json';

type Messages = typeof frMessages;

const MESSAGES: Record<Locale, Messages> = {
  fr: frMessages,
  en: enMessages as Messages,
  es: esMessages as Messages,
  it: itMessages as Messages,
  pt: ptMessages as Messages,
  de: deMessages as Messages,
  ar: arMessages as Messages,
};

export { resolveLocale, toIntlTag, toOgLocale } from './locale-tags';

export function getServerTranslator(locale: Locale | string | undefined) {
  const resolved = resolveLocale(locale);
  return createTranslator({
    locale: resolved,
    messages: MESSAGES[resolved],
  });
}

export function getMessages(locale: Locale | string | undefined): Messages {
  return MESSAGES[resolveLocale(locale)];
}
