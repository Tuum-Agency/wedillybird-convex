'use client';

import { useLocale } from 'next-intl';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ChevronDown } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALE_FLAGS, LOCALE_NATIVE_NAMES, routing, type Locale } from '@/i18n/routing';
import { useCurrencyStore } from '@/stores/currency-store';
import { cn } from '@/lib/cn';

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
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

  function onSelect(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    // Changer de langue réinitialise l'override devise : la nouvelle locale
    // impose sa devise par défaut (en → USD, langues européennes → EUR).
    useCurrencyStore.getState().clearCurrency();
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div ref={containerRef} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${LOCALE_NATIVE_NAMES[locale]}`}
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-base leading-none transition-colors hover:bg-[color:var(--color-surface-elevated)]"
      >
        <span aria-hidden>{LOCALE_FLAGS[locale]}</span>
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
          aria-label="Choose language"
          className="absolute end-0 top-[calc(100%+0.5rem)] z-40 min-w-[10rem] overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-1 shadow-lg"
        >
          {routing.locales.map((loc) => {
            const isCurrent = loc === locale;
            return (
              <li key={loc}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isCurrent}
                  onClick={() => onSelect(loc)}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                    isCurrent
                      ? 'bg-[color:var(--color-surface-elevated)] font-medium text-[color:var(--color-foreground)]'
                      : 'text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface-elevated)]',
                  )}
                >
                  <span aria-hidden className="text-base leading-none">
                    {LOCALE_FLAGS[loc]}
                  </span>
                  <span>{LOCALE_NATIVE_NAMES[loc]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
