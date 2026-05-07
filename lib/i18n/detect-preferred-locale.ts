import { routing, type Locale } from '@/i18n/routing';

/**
 * Parse le header HTTP `Accept-Language` en liste de tags ordonnés par
 * qualité décroissante (q-value, défaut 1).
 *
 *   `fr-FR,fr;q=0.9,en;q=0.8` → `['fr-fr', 'fr', 'en']`
 *
 * Les tags malformés ou avec q=0 sont écartés.
 */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().toLowerCase().startsWith('q='));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      return { tag: (tag ?? '').toLowerCase(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag);
}

/**
 * À partir d'un header `Accept-Language`, retourne la locale **supportée**
 * la plus prioritaire pour l'utilisateur. Match exact (`fr` === `fr`) puis
 * match par préfixe de région (`fr-fr` → `fr`).
 *
 * Retourne `null` si aucune locale supportée n'est trouvée.
 */
export function detectPreferredLocale(acceptLanguage: string | null | undefined): Locale | null {
  const parsed = parseAcceptLanguage(acceptLanguage);
  if (parsed.length === 0) return null;
  const supported = routing.locales as readonly Locale[];
  for (const tag of parsed) {
    const exact = supported.find((l) => tag === l);
    if (exact) return exact;
    const prefix = supported.find((l) => tag.startsWith(`${l}-`));
    if (prefix) return prefix;
  }
  return null;
}
