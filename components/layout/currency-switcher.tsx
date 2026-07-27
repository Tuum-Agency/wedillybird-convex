'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { readGeoCurrencyCookie, useCurrencyStore } from '@/stores/currency-store';
import { defaultCurrencyForLocale, SELECTABLE_CURRENCIES } from '@/lib/payments/currency';
import type { Currency } from '@/lib/payments/plans';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/cn';

const emptySubscribe = () => () => {};
/**
 * Sentinel SSR-safe pour différer la lecture du store persisté à
 * l'hydratation. Évite le mismatch SSR ↔ client quand l'utilisateur a une
 * préférence en localStorage : on rend `defaultCurrency` côté server puis on
 * passe à `selected` une fois monté côté client.
 */
function useHasMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '€',
  USD: '$',
  XOF: 'CFA',
  MAD: 'DH',
  TND: 'DT',
};

/**
 * Sélecteur de devise pour le footer. Permet à l'utilisateur d'overrider la
 * devise dérivée de la locale (FR/ES/IT/PT/DE/AR → EUR, EN → USD). La
 * préférence est persistée en localStorage via `useCurrencyStore`.
 */
export function CurrencySwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('CurrencySwitcher');
  const selected = useCurrencyStore((state) => state.selected);
  const setCurrency = useCurrencyStore((state) => state.setCurrency);
  const [open, setOpen] = useState(false);
  const mounted = useHasMounted();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Avant l'hydratation, on rend toujours la devise locale-default pour éviter
  // un mismatch SSR (le store et le cookie géo ne sont lisibles que côté
  // client). Une fois monté : override explicite > devise géo (cookie `wbb_ccy`,
  // pays de facturation) > défaut locale. Même ordre que `useEffectiveCurrency`.
  const effective: Currency = mounted
    ? (selected ?? readGeoCurrencyCookie() ?? defaultCurrencyForLocale(locale))
    : defaultCurrencyForLocale(locale);

  function onSelect(next: Currency) {
    setOpen(false);
    setCurrency(next);
  }

  return (
    <div ref={containerRef} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('label', { currency: effective })}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm leading-none transition-colors hover:bg-[color:var(--color-surface-elevated)]"
      >
        <span aria-hidden className="font-mono text-xs tracking-wide">
          {CURRENCY_SYMBOLS[effective]}
        </span>
        <span className="font-mono text-xs tracking-wide">{effective}</span>
        <ChevronDown
          className={cn(
            'h-3 w-3 text-[color:var(--color-muted-foreground)] transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
          strokeWidth={2.5}
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={t('chooseLabel')}
          className="absolute end-0 bottom-[calc(100%+0.5rem)] z-40 min-w-[12rem] overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-1 shadow-lg"
        >
          {SELECTABLE_CURRENCIES.map((cur) => {
            const isCurrent = cur === effective;
            return (
              <li key={cur}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isCurrent}
                  onClick={() => onSelect(cur)}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                    isCurrent
                      ? 'bg-[color:var(--color-surface-elevated)] font-medium text-[color:var(--color-foreground)]'
                      : 'text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface-elevated)]',
                  )}
                >
                  <span aria-hidden className="w-8 font-mono text-xs tracking-wide">
                    {CURRENCY_SYMBOLS[cur]}
                  </span>
                  <span className="font-mono text-xs tracking-wide">{cur}</span>
                  <span className="ml-auto text-xs text-[color:var(--color-muted-foreground)]">
                    {t(`names.${cur}` as Parameters<typeof t>[0])}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
