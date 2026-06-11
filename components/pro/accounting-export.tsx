'use client';

import { useState } from 'react';
import { FileSpreadsheet, Download, Sparkles } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Export comptable mensuel (design Facturation) — relevé CSV de la facturation
 * agence (abonnement + crédits PAYG). Le bouton pointe vers le route handler
 * `/api/pro/billing-export` qui génère le fichier à la volée.
 */
export function AccountingExport({ months }: { months: { value: string; label: string }[] }) {
  const [month, setMonth] = useState(months[0]?.value ?? '');
  const href = `/api/pro/billing-export?month=${encodeURIComponent(month)}&format=csv`;

  return (
    <section
      className="flex flex-col gap-5 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 sm:flex-row sm:items-center sm:justify-between"
      aria-labelledby="bl-export-h"
      data-testid="accounting-export"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-[color:var(--color-blush-500)]/15 text-[color:var(--color-blush-300)]">
          <FileSpreadsheet className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[color:var(--color-accent-soft)] px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] text-[color:var(--color-gold-300)] uppercase">
            <Sparkles className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
            Nouveau
          </span>
          <h3
            id="bl-export-h"
            className="font-display text-lg text-[color:var(--color-foreground)] italic"
          >
            Export comptable mensuel
          </h3>
          <p className="max-w-md text-[13px] leading-relaxed text-[color:var(--color-muted-foreground)]">
            Générez un relevé des factures d’abonnement et crédits pay-as-you-go du mois — prêt pour
            votre comptable (CSV).
          </p>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-end gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
            Mois
          </span>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger
              aria-label="Mois à exporter"
              className="focus-ring h-10 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 text-sm text-[color:var(--color-foreground)]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <a
          href={href}
          download
          data-testid="accounting-export-btn"
          className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-lg bg-[color:var(--color-blush-400)] px-4 text-sm font-medium text-[oklch(20%_0.02_28)] transition-[filter] hover:brightness-105"
        >
          <Download className="h-4 w-4" strokeWidth={2} aria-hidden />
          Exporter
        </a>
      </div>
    </section>
  );
}
