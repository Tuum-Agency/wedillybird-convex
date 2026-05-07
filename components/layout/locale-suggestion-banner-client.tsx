'use client';

import { useState, useTransition } from 'react';
import { X } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/cn';

const SUGGESTION_LABELS: Record<Locale, { suggestion: string; accept: string; dismiss: string }> = {
  fr: {
    suggestion: 'On dirait que vous parlez français.',
    accept: 'Voir en français',
    dismiss: 'Fermer la suggestion de langue',
  },
  en: {
    suggestion: 'It looks like you speak English.',
    accept: 'View in English',
    dismiss: 'Dismiss language suggestion',
  },
  es: {
    suggestion: 'Parece que hablas español.',
    accept: 'Ver en español',
    dismiss: 'Cerrar sugerencia de idioma',
  },
  it: {
    suggestion: 'Sembra che tu parli italiano.',
    accept: 'Vedi in italiano',
    dismiss: 'Chiudi suggerimento lingua',
  },
  pt: {
    suggestion: 'Parece que você fala português.',
    accept: 'Ver em português',
    dismiss: 'Fechar sugestão de idioma',
  },
  de: {
    suggestion: 'Es scheint, dass Sie Deutsch sprechen.',
    accept: 'Auf Deutsch ansehen',
    dismiss: 'Sprachvorschlag schließen',
  },
  ar: {
    suggestion: 'يبدو أنك تتحدث العربية.',
    accept: 'عرض بالعربية',
    dismiss: 'إغلاق اقتراح اللغة',
  },
};

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function setDismissCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=1; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

export function LocaleSuggestionBannerClient({
  currentLocale,
  suggestedLocale,
  suggestedLabel,
  suggestedFlag,
  dismissCookieName,
}: {
  currentLocale: Locale;
  suggestedLocale: Locale;
  suggestedLabel: string;
  suggestedFlag: string;
  dismissCookieName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [isPending, startTransition] = useTransition();

  const labels = SUGGESTION_LABELS[suggestedLocale] ?? SUGGESTION_LABELS.en;

  function handleAccept() {
    setDismissCookie(dismissCookieName);
    startTransition(() => {
      router.replace(pathname, { locale: suggestedLocale });
    });
    setHidden(true);
  }

  function handleDismiss() {
    setDismissCookie(dismissCookieName);
    setHidden(true);
  }

  if (hidden) return null;

  return (
    <div
      role="region"
      aria-label={labels.suggestion}
      className="border-b border-[color:var(--color-border)] bg-[color:var(--color-ivory-100)]"
    >
      <div className="container-page flex flex-col items-stretch gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-[color:var(--color-ink-700)]">
          <span aria-hidden className="text-base leading-none">
            {suggestedFlag}
          </span>
          <span>{labels.suggestion}</span>
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={isPending}
            lang={suggestedLocale}
            className={cn(
              'focus-ring inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-primary)] px-4 py-2 text-sm font-medium text-[color:var(--color-primary-foreground)] transition-opacity disabled:opacity-60',
              '[@media(hover:hover)]:hover:opacity-90',
            )}
          >
            <span aria-hidden>{suggestedFlag}</span>
            {labels.accept}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={labels.dismiss}
            className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--color-ink-700)] [@media(hover:hover)]:hover:bg-[color:var(--color-ivory-200)]"
          >
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
