/**
 * Currency conversion — EUR-anchored grid.
 *
 * EUR est la **source de vérité unique** (cf. CLAUDE.md "Pricing — source de
 * vérité"). Tous les autres montants sont **dérivés** de la valeur EUR via une
 * conversion statique. Pas d'overlay régional, pas de prix spécial Afrique :
 * un mariage à 19 € coûte 19 € converti pour tout le monde.
 *
 * Les taux sont figés dans le code — pas d'appel API à un service de FX en
 * runtime (perf + dépendance externe inutile pour un usage marketing). À
 * refresh à la main si la parité EUR/XX dérive trop, ou à brancher sur une
 * source de vérité plus tard (ECB feed, etc.).
 *
 * Pour les paiements eux-mêmes, Stripe applique sa propre conversion au moment
 * du charge ; ces taux servent **uniquement à l'affichage marketing**.
 */
import type { Locale } from '@/i18n/routing';
import type { Currency } from './plans';

/**
 * Taux de change EUR → devise cible (1 EUR vaut N unités de la devise).
 *
 * - **USD** : ~1,08 (rolling moyen 2025-2026, plage 1,05-1,10).
 * - **XOF** : 655,957 (peg fixe Franc CFA, Trésor français depuis 1999).
 * - **MAD** : ~10,7 (parité de fait, dirham flottant managé par Bank Al-Maghrib).
 * - **TND** : ~3,4 (dinar tunisien, parité de fait).
 */
export const EUR_CONVERSION_RATE: Record<Currency, number> = {
  EUR: 1,
  USD: 1.08,
  XOF: 655.957,
  MAD: 10.7,
  TND: 3.4,
};

/**
 * Divisor pour passer d'un montant en unités mineures (cents, centimes, etc.)
 * à un montant en unités majeures (euros, dollars, francs CFA…).
 *
 * EUR/USD/XOF/MAD : 100 (cents-style).
 * TND : 1000 (le dinar tunisien est subdivisé en millimes).
 *
 * XOF n'a pas de subdivision officielle, mais on stocke en centimes pour
 * uniformiser l'arithmétique de conversion (jamais de float, toujours du int).
 */
export const MINOR_UNIT_DIVISOR: Record<Currency, number> = {
  EUR: 100,
  USD: 100,
  XOF: 100,
  MAD: 100,
  TND: 1000,
};

/**
 * Convertit un montant exprimé en **centimes d'euro** vers la devise cible,
 * en unités mineures de cette devise.
 *
 * Exemple : convertFromEur(1900, 'USD') → environ 2052 (= 19 € × 1,08 = 20,52 $).
 * Exemple : convertFromEur(1900, 'XOF') → 1 246 318 (= 19 € × 655,957 ≈ 12 463,18 FCFA,
 *           stocké en centimes).
 *
 * Arrondi : à l'entier mineur le plus proche. Pour XOF/MAD on garde 2 décimales
 * de centimes dans la valeur stockée même si la devise n'a pas de centimes en
 * pratique — le formatter Intl masquera les décimales à l'affichage.
 */
export function convertFromEur(eurMinor: number, target: Currency): number {
  if (target === 'EUR') return eurMinor;
  // EUR utilise 2 décimales (× 100). On convertit en EUR major (÷100), on
  // applique le taux, puis on remonte en mineur cible (× divisor cible).
  const eurMajor = eurMinor / MINOR_UNIT_DIVISOR.EUR;
  const targetMajor = eurMajor * EUR_CONVERSION_RATE[target];
  return Math.round(targetMajor * MINOR_UNIT_DIVISOR[target]);
}

/**
 * Construit la table `Record<Currency, number>` (en unités mineures) à partir
 * d'un prix canonique en centimes d'euro. Préserve l'API historique
 * `definition.prices[currency]` tout en faisant d'EUR la source unique.
 */
export function pricesFromEur(eurMinor: number): Record<Currency, number> {
  return {
    EUR: eurMinor,
    USD: convertFromEur(eurMinor, 'USD'),
    XOF: convertFromEur(eurMinor, 'XOF'),
    MAD: convertFromEur(eurMinor, 'MAD'),
    TND: convertFromEur(eurMinor, 'TND'),
  };
}

/**
 * Devise par défaut associée à une locale. Le français, l'allemand, l'italien,
 * l'espagnol et le portugais affichent en EUR ; l'anglais en USD ; l'arabe
 * tombe sur EUR (RTL ne dicte pas la devise — l'utilisateur peut overrider via
 * le sélecteur footer s'il préfère MAD/TND/XOF).
 */
export const LOCALE_DEFAULT_CURRENCY: Record<Locale, Currency> = {
  fr: 'EUR',
  en: 'USD',
  es: 'EUR',
  it: 'EUR',
  pt: 'EUR',
  de: 'EUR',
  ar: 'EUR',
};

export function defaultCurrencyForLocale(locale: Locale): Currency {
  return LOCALE_DEFAULT_CURRENCY[locale];
}

/**
 * Liste des devises proposées à l'utilisateur dans le sélecteur footer.
 * Ordre : major (EUR, USD) puis local-Africa pour les utilisateurs qui
 * voudraient voir le prix dans leur monnaie locale.
 */
export const SELECTABLE_CURRENCIES: ReadonlyArray<Currency> = ['EUR', 'USD', 'MAD'];
