'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Archive, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoBookOrderDialog } from '@/components/payments/photo-book-order-dialog';
import { formatAmount, getUpsellPrice, type Currency } from '@/lib/payments/plans';

type PhotoBookStatus = 'requested' | 'in_production' | 'shipped' | 'cancelled';

interface Props {
  eventId: string;
  currency: Currency;
  /** Déjà acheté ? → on affiche l'état « archive débloquée » au lieu du CTA. */
  purchased: boolean;
  /** Commande de livre photo en cours (null = aucune / annulée). */
  photoBook?: { status: PhotoBookStatus } | null;
}

/**
 * Carte d'upsell HD post-event (+29 €), affichée sur la page d'un event déjà
 * payé. Prolonge la galerie à 5 ans et débloque l'archive HD. Paiement one-shot
 * via `/api/checkout/upsell`.
 */
export function PostEventUpsellCard({ eventId, currency, purchased, photoBook }: Props) {
  const t = useTranslations('Upgrade.upsell');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (purchased) {
    const hasActiveOrder = photoBook != null && photoBook.status !== 'cancelled';
    return (
      <section
        className="flex flex-col gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5"
        data-testid="upsell-card-purchased"
      >
        <header className="flex items-center gap-3">
          <span aria-hidden className="text-[color:var(--color-accent)]">
            <Check className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="text-sm text-[color:var(--color-muted)]">{t('purchased')}</span>
        </header>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/${locale}/events/${eventId}/gallery/download-zip`}
            download
            className="focus-ring inline-flex items-center gap-2 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm font-medium transition-colors hover:bg-[color:var(--color-ivory-100)]"
            data-testid="upsell-download-hd"
          >
            <Download className="h-4 w-4" strokeWidth={1.9} aria-hidden />
            {t('downloadHd')}
          </a>
          {hasActiveOrder ? (
            <span
              className="inline-flex items-center gap-2 rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm text-[color:var(--color-muted)]"
              data-testid="photo-book-status"
            >
              {t(`photoBook.statusLabel.${photoBook!.status}` as const)}
            </span>
          ) : (
            <PhotoBookOrderDialog eventId={eventId} />
          )}
        </div>
      </section>
    );
  }

  function handleBuy() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/checkout/upsell', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, currency }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? 'UNKNOWN');
          return;
        }
        const body = (await res.json()) as { redirectUrl: string };
        window.location.assign(body.redirectUrl);
      } catch {
        setError('NETWORK');
      }
    });
  }

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5"
      data-testid="upsell-card"
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'oklch(95% 0.025 22)', color: 'var(--color-blush-700)' }}
        >
          <Archive className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
            {t('eyebrow')}
          </span>
          <h2 className="font-display text-xl font-semibold">{t('title')}</h2>
          <p className="text-sm text-[color:var(--color-muted)]">{t('subtitle')}</p>
        </div>
      </header>
      <ul className="flex flex-col gap-1.5 text-sm">
        <li className="flex items-start gap-1.5">
          <span aria-hidden className="mt-0.5 text-[color:var(--color-accent)]">
            ✓
          </span>
          <span>{t('benefitRetention')}</span>
        </li>
        <li className="flex items-start gap-1.5">
          <span aria-hidden className="mt-0.5 text-[color:var(--color-accent)]">
            ✓
          </span>
          <span>{t('benefitHd')}</span>
        </li>
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-display text-2xl break-keep">
          {formatAmount(getUpsellPrice(currency), currency)}
        </span>
        <Button
          onClick={handleBuy}
          disabled={pending}
          data-testid="upsell-cta"
          className="shrink-0"
        >
          <Download className="h-4 w-4" strokeWidth={2} aria-hidden />
          {pending ? t('redirecting') : t('cta')}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
          {t(`errors.${error.toLowerCase()}` as const)}
        </p>
      ) : null}
    </section>
  );
}
