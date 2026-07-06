import { cookies, headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { detectPreferredLocale } from '@/lib/i18n/detect-preferred-locale';
import { LOCALE_FLAGS, type Locale } from '@/i18n/routing';
import { LocaleSuggestionBannerClient } from './locale-suggestion-banner-client';

/** Cookie défini quand l'utilisateur ferme la bannière ou accepte la suggestion. */
export const LOCALE_SUGGESTION_DISMISS_COOKIE = 'wbb_locale_suggestion_dismissed';

/**
 * Bannière soft de suggestion de langue, montrée au premier visit si la
 * locale courante diffère de la locale préférée par l'utilisateur (lue dans
 * `Accept-Language`). Pas de redirection forcée — l'utilisateur choisit.
 *
 * Le texte est volontairement rendu dans la locale **suggérée** (et non la
 * locale courante) : on résout donc les libellés côté serveur via
 * `getTranslations({ locale: preferred })` puis on les passe au client.
 *
 * Cachée si :
 *   - l'utilisateur a déjà fermé la bannière (cookie `wbb_locale_suggestion_dismissed`)
 *   - la locale courante = locale préférée
 *   - aucun match supporté dans `Accept-Language`
 */
export async function LocaleSuggestionBanner({ currentLocale }: { currentLocale: Locale }) {
  const cookieStore = await cookies();
  if (cookieStore.get(LOCALE_SUGGESTION_DISMISS_COOKIE)) return null;

  const headersList = await headers();
  const accept = headersList.get('accept-language');
  const preferred = detectPreferredLocale(accept);
  if (!preferred || preferred === currentLocale) return null;

  const t = await getTranslations({ locale: preferred, namespace: 'LocaleBanner' });

  return (
    <LocaleSuggestionBannerClient
      suggestedLocale={preferred}
      suggestedFlag={LOCALE_FLAGS[preferred]}
      dismissCookieName={LOCALE_SUGGESTION_DISMISS_COOKIE}
      suggestionLabel={t('suggestion')}
      acceptLabel={t('accept')}
      dismissLabel={t('dismiss')}
    />
  );
}
