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
 * Hook pratique : renvoie la devise effective à afficher, en prenant l'override
 * utilisateur si défini, sinon la devise par défaut passée en argument (en
 * général issue de la locale côté server).
 *
 * Pendant la phase d'hydratation initiale, retourne `defaultCurrency` pour
 * éviter les mismatches SSR. Le composant ré-rend une fois le store hydraté.
 */
export function useEffectiveCurrency(defaultCurrency: Currency): Currency {
  const selected = useCurrencyStore((state) => state.selected);
  const mounted = useHasHydrated();
  if (!mounted) return defaultCurrency;
  return selected ?? defaultCurrency;
}
