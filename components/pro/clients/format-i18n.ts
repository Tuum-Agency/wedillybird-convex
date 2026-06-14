'use client';

/**
 * Hooks de formatage localisés pour le CRM clients.
 *
 * Remplacent les helpers FR figés de `lib/pro/format` / `lib/pro/clients` côté
 * affichage : libellés d'étape, source, montants, dates et dates relatives sont
 * rendus dans la locale active (next-intl), jamais en `fr-FR` codé en dur.
 */

import { useFormatter, useTranslations } from 'next-intl';
import type { ClientStage } from '@/lib/pro/clients';

/** Valeurs canoniques de `CLIENT_SOURCES` (stockées en base) → clé i18n. */
const SOURCE_KEY: Record<string, string> = {
  Recommandation: 'recommendation',
  Instagram: 'instagram',
  Salon: 'fair',
  'Site web': 'website',
  Autre: 'other',
};

/** Libellé d'étape localisé (« Lead », « Devis envoyé », …). */
export function useStageLabel(): (stage: ClientStage) => string {
  const t = useTranslations('Pro.clientsBoard');
  return (stage) => t(`stages.${stage}`);
}

/** Libellé d'étape au pluriel pour les en-têtes kanban (« Leads », …). */
export function useStagePluralLabel(): (stage: ClientStage) => string {
  const t = useTranslations('Pro.clientsBoard');
  return (stage) => t(`stagesPlural.${stage}`);
}

/**
 * Libellé de source localisé. La valeur stockée reste la chaîne canonique ;
 * seule l'étiquette affichée est traduite (repli sur la valeur brute si inconnue).
 */
export function useSourceLabel(): (source: string | null | undefined) => string {
  const t = useTranslations('Pro.clientsBoard');
  return (source) => {
    if (!source) return '';
    const key = SOURCE_KEY[source];
    return key ? t(`sources.${key}`) : source;
  };
}

/** Centimes d'euro → montant localisé (« 18 000 € »), ou tiret si absent. */
export function useEurFormat(): (minor: number | null | undefined) => string {
  const format = useFormatter();
  return (minor) => {
    if (minor == null) return '—';
    const eur = minor / 100;
    const maximumFractionDigits = Number.isInteger(eur) ? 0 : 2;
    return format.number(eur, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits,
    });
  };
}

/** Timestamp ms → date localisée (« 12 sept. 2026 »), ou tiret si absent. */
export function useDateFormat(): (ms: number | null | undefined) => string {
  const format = useFormatter();
  return (ms) => {
    if (ms == null) return '—';
    return format.dateTime(new Date(ms), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };
}

/** Timestamp ms → date relative localisée (« il y a 3 h »), ou tiret si absent. */
export function useRelative(): (ms: number | null | undefined, now: number) => string {
  const format = useFormatter();
  return (ms, now) => {
    if (ms == null) return '—';
    return format.relativeTime(new Date(ms), now);
  };
}
