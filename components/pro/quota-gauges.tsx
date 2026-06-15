'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  buildQuotaGauges,
  type ProUsage,
  type QuotaStatus,
  type QuotaLevel,
} from '@/lib/payments/entitlements';
import type { SubscriptionTier } from '@/lib/payments/subscriptions';

const LEVEL_COLOR: Record<QuotaLevel, string> = {
  ok: 'var(--color-blush-400)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
};

/**
 * Jauges de consommation (mariages / messages / stockage / sièges) d'une agence,
 * dérivées du forfait + de l'usage réel via `buildQuotaGauges`. Réutilisable
 * (cockpit, facturation). Le stockage est compté en octets, formaté en Go.
 */
export function QuotaGauges({ tier, usage }: { tier: SubscriptionTier; usage: ProUsage }) {
  const t = useTranslations('Pro.main');
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale);
  const formatGo = (bytes: number) =>
    t('quotaGauges.goValue', { value: (bytes / 1_000_000_000).toFixed(1) });
  const g = buildQuotaGauges(tier, usage);
  const rows: Array<{ label: string; status: QuotaStatus; fmt: (n: number) => string }> = [
    { label: t('quotaGauges.activeWeddings'), status: g.events, fmt: (n) => nf.format(n) },
    { label: t('quotaGauges.messagesThisMonth'), status: g.messages, fmt: (n) => nf.format(n) },
    { label: t('quotaGauges.storage'), status: g.storage, fmt: formatGo },
    { label: t('quotaGauges.teamSeats'), status: g.seats, fmt: (n) => nf.format(n) },
  ];
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
        {t('quotaGauges.consumptionThisMonth')}
      </span>
      <div className="flex flex-col gap-4">
        {rows.map((r) => {
          const pct = r.status.unlimited ? 0 : Math.min(100, Math.round(r.status.ratio * 100));
          return (
            <div key={r.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[color:var(--color-ink-700)]">{r.label}</span>
                <span className="font-mono text-[color:var(--color-foreground)] tabular-nums">
                  {r.fmt(r.status.used)}
                  {r.status.unlimited
                    ? ` · ${t('quotaGauges.unlimited')}`
                    : ` / ${r.fmt(r.status.included ?? 0)}`}
                </span>
              </div>
              {!r.status.unlimited ? (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${pct}%`, background: LEVEL_COLOR[r.status.level] }}
                  />
                </div>
              ) : null}
              {r.status.overage > 0 ? (
                <span className="font-mono text-[10px] text-[color:var(--color-danger)]">
                  {t('quotaGauges.overage', { value: r.fmt(r.status.overage) })}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
