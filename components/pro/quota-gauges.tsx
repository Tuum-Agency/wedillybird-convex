'use client';

import {
  buildQuotaGauges,
  type ProUsage,
  type QuotaStatus,
  type QuotaLevel,
} from '@/lib/payments/entitlements';
import type { SubscriptionTier } from '@/lib/payments/subscriptions';

const NF = new Intl.NumberFormat('fr-FR');
const formatGo = (bytes: number) => `${(bytes / 1_000_000_000).toFixed(1)} Go`;
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
  const g = buildQuotaGauges(tier, usage);
  const rows: Array<{ label: string; status: QuotaStatus; fmt: (n: number) => string }> = [
    { label: 'Mariages actifs', status: g.events, fmt: (n) => NF.format(n) },
    { label: 'Messages ce mois', status: g.messages, fmt: (n) => NF.format(n) },
    { label: 'Stockage', status: g.storage, fmt: formatGo },
    { label: 'Sièges équipe', status: g.seats, fmt: (n) => NF.format(n) },
  ];
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
        Consommation ce mois
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
                  {r.status.unlimited ? ' · illimité' : ` / ${r.fmt(r.status.included ?? 0)}`}
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
                  Dépassement : {r.fmt(r.status.overage)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
