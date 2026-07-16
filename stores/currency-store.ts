import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Currency } from '@/lib/payments/plans';
import { isCurrency } from '@/lib/payments/plans';

/**
 * Préférence de devise pour l'affichage marketing/pricing.
 *
 * `selected` :
 *  - `null` : pas d'override → la page utilise la devise dérivée de la locale
 *    (cf. `defaultCurrencyForLocale` dans `lib/payments/currency.ts`).
 *  - sinon : devise explicitement choisie par l'utilisateur via le sélecteur
 *    footer, persistée en localStorage et appliquée partout côté client.
 *
 * Le store n'a pas d'impact sur le checkout : la devise réelle du paiement est
 * re-validée côté serveur (`/api/checkout`) avec le routing Stripe.
 */
interface CurrencyState {
  selected: Currency | null;
  setCurrency: (currency: Currency) => void;
  clearCurrency: () => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      selected: null,
      setCurrency: (currency) => set({ selected: currency }),
      clearCurrency: () => set({ selected: null }),
    }),
    {
      name: 'wbb_currency',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ selected: state.selected }),
      // Sanity check : si localStorage a été manipulé manuellement (ou si le
      // schema a changé) on tombe sur null plutôt que de crasher.
      merge: (persisted, current) => {
        const p = persisted as { selected?: unknown } | undefined;
        if (p && typeof p.selected === 'string' && isCurrency(p.selected)) {
          return { ...current, selected: p.selected };
        }
        return { ...current, selected: null };
      },
    },
  ),
);

const emptySubscribe = () => () => {};

/**
 * Devise par défaut dérivée de la GÉOGRAPHIE, lue depuis le cookie `wbb_ccy`
 * posé par `proxy.ts` à partir du header géoIP Vercel. C'est le pivot du
 * découplage devise↔langue : le défaut suit le pays de facturation, pas la
 * langue d'UI. Retourne `null` côté serveur, si le cookie est absent (dev/local
 * sans signal géo) ou si sa valeur est corrompue → l'appelant retombe alors sur
 * le défaut locale.
 */
export function readGeoCurrencyCookie(): Currency | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)wbb_ccy=([^;]+)/);
  if (!match) return null;
  const value = decodeURIComponent(match[1]!);
  return isCurrency(value) ? value : null;
}

/**
 * `true` après le premier paint côté client, `false` pendant SSR et au tout
 * premier render client (avant l'hydratation React). Sert à différer la lecture
 * d'une valeur persistée pour matcher exactement le SSR — sans ça, un
 * utilisateur ayant choisi USD verrait son prix flasher (EUR → USD) à
 * l'hydratation.
 */
function useHasHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * Hook pratique : renvoie la devise effective à afficher. Ordre de priorité :
 *  1. Override explicite de l'utilisateur (sélecteur footer, persisté).
 *  2. Devise géo (cookie `wbb_ccy`, pays de facturation) — le découplage
 *     devise↔langue : le prix suit la géographie, pas la langue d'UI.
 *  3. `defaultCurrency` passé en argument (dérivé de la locale côté server) —
 *     ultime filet quand aucun signal géo n'est disponible (dev/local).
 *
 * Pendant la phase d'hydratation initiale, retourne `defaultCurrency` pour
 * éviter les mismatches SSR. Le composant ré-rend une fois le store hydraté,
 * moment où le cookie géo et l'override localStorage deviennent lisibles.
 */
export function useEffectiveCurrency(defaultCurrency: Currency): Currency {
  const selected = useCurrencyStore((state) => state.selected);
  const mounted = useHasHydrated();
  if (!mounted) return defaultCurrency;
  return selected ?? readGeoCurrencyCookie() ?? defaultCurrency;
}
