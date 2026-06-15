'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Upload, ArrowRight, ArrowLeft, Check, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import {
  parseCsv,
  autoMapColumns,
  buildClientRows,
  markDuplicates,
  type ClientField,
} from '@/lib/pro/csv';
import { createClientAction } from '@/app/[locale]/(app)/pro/clients/actions';

const FIELDS: ClientField[] = ['partnerA', 'partnerB', 'email', 'phone', 'ignore'];

/** Étapes de l'assistant, dans l'ordre. La clé sert d'identifiant React stable. */
const STEPS = ['upload', 'map', 'result'] as const;

export function CsvImport({ existingNames }: { existingNames: string[] }) {
  const t = useTranslations('Pro.integrations');
  const router = useRouter();
  const [step, setStep] = useState<'upload' | 'map' | 'result'>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ClientField[]>([]);
  const [paste, setPaste] = useState('');
  const [result, setResult] = useState({ imported: 0, skipped: 0 });
  const [pending, start] = useTransition();

  const existingKeys = useMemo(
    () => new Set(existingNames.map((n) => n.toLowerCase())),
    [existingNames],
  );
  const rows = useMemo(
    () =>
      step === 'upload' ? [] : markDuplicates(buildClientRows(dataRows, mapping), existingKeys),
    [step, dataRows, mapping, existingKeys],
  );
  const toImport = rows.filter((r) => !r.duplicate);
  const dupCount = rows.length - toImport.length;

  function ingest(text: string) {
    const all = parseCsv(text);
    if (all.length < 2) return;
    setHeaders(all[0]!);
    setDataRows(all.slice(1));
    setMapping(autoMapColumns(all[0]!));
    setStep('map');
  }

  function runImport() {
    start(async () => {
      let imported = 0;
      let skipped = 0;
      for (const r of rows) {
        if (r.duplicate) {
          skipped++;
          continue;
        }
        const fd = new FormData();
        fd.set('partnerA', r.partnerA);
        if (r.partnerB) fd.set('partnerB', r.partnerB);
        if (r.email) fd.set('email', r.email);
        if (r.phone) fd.set('phone', r.phone);
        const res = await createClientAction(fd);
        if (res.ok) imported++;
        else skipped++;
      }
      setResult({ imported, skipped });
      setStep('result');
      router.refresh();
    });
  }

  function reset() {
    setStep('upload');
    setHeaders([]);
    setDataRows([]);
    setMapping([]);
    setPaste('');
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--color-blush-500)]/15 text-[color:var(--color-blush-300)]">
          <Users className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
        </span>
        <div className="flex flex-col">
          <span className="font-display text-base text-[color:var(--color-foreground)] italic">
            {t('title')}
          </span>
          <span className="text-xs text-[color:var(--color-muted-foreground)]">
            {t('subtitle')}
          </span>
        </div>
      </div>

      {/* Étapes */}
      <ol className="flex items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-[color:var(--color-muted-foreground)] uppercase">
        {STEPS.map((s, i) => {
          const active = s === step;
          const done = STEPS.indexOf(step) > i;
          return (
            <li key={s} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border text-[9px]',
                  active
                    ? 'border-[color:var(--color-blush-400)] text-[color:var(--color-blush-300)]'
                    : done
                      ? 'border-[color:var(--color-sage-500)] text-[color:var(--color-sage-500)]'
                      : 'border-[color:var(--color-border)]',
                )}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={2.4} /> : `0${i + 1}`}
              </span>
              {t(`steps.${s}`)}
              {i < STEPS.length - 1 ? (
                <span className="text-[color:var(--color-border-strong)]">·</span>
              ) : null}
            </li>
          );
        })}
      </ol>

      {step === 'upload' ? (
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-6 py-8 text-center focus-within:border-[color:var(--color-blush-400)]">
            <Upload
              className="h-6 w-6 text-[color:var(--color-muted-foreground)]"
              strokeWidth={1.6}
              aria-hidden
            />
            <span className="text-sm text-[color:var(--color-foreground)]">{t('dropzone')}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              data-testid="csv-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void f.text().then(ingest);
              }}
            />
          </label>
          <span className="text-center font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
            {t('orPaste')}
          </span>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={4}
            placeholder={t('pastePlaceholder')}
            aria-label={t('pasteAria')}
            data-testid="csv-paste"
            className="focus-ring rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3 py-2 font-mono text-xs text-[color:var(--color-foreground)]"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={!paste.trim()}
              onClick={() => ingest(paste)}
              data-testid="csv-parse"
            >
              {t('parse')}
              <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
            </Button>
          </div>
        </div>
      ) : step === 'map' ? (
        <div className="flex flex-col gap-3">
          {/* mapping */}
          <div className="grid gap-2 sm:grid-cols-2">
            {headers.map((h, i) => (
              <label
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3 py-2 text-sm"
              >
                <span
                  className="min-w-0 flex-1 truncate text-[color:var(--color-foreground)]"
                  title={h}
                >
                  {h || t('columnFallback', { n: i + 1 })}
                </span>
                <Select
                  value={mapping[i] ?? 'ignore'}
                  onValueChange={(v) =>
                    setMapping((m) => m.map((x, j) => (j === i ? (v as ClientField) : x)))
                  }
                >
                  <SelectTrigger
                    aria-label={t('mapColumn', { column: h || t('columnFallback', { n: i + 1 }) })}
                    className="focus-ring h-auto w-auto rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-1 text-xs text-[color:var(--color-foreground)]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELDS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {t(`fields.${f}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ))}
          </div>
          {/* preview */}
          <div className="flex items-center justify-between font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
            <span>
              {t.rich('toImport', {
                count: toImport.length,
                b: (chunks) => <b className="text-[color:var(--color-foreground)]">{chunks}</b>,
              })}
            </span>
            {dupCount > 0 ? (
              <span>
                {t.rich('duplicatesSkipped', {
                  count: dupCount,
                  b: (chunks) => <b className="text-[color:var(--color-warning)]">{chunks}</b>,
                })}
              </span>
            ) : null}
          </div>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-[color:var(--color-border)]">
            <table className="w-full border-collapse text-xs">
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr
                    key={i}
                    className={cn(
                      'border-b border-[color:var(--color-border)] last:border-0',
                      r.duplicate && 'opacity-50',
                    )}
                  >
                    <td className="px-3 py-1.5 text-[color:var(--color-foreground)]">
                      {r.partnerA}
                      {r.partnerB ? ` & ${r.partnerB}` : ''}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[color:var(--color-muted-foreground)]">
                      {[r.email, r.phone].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {r.duplicate ? (
                        <span className="font-mono text-[9px] text-[color:var(--color-warning)] uppercase">
                          {t('duplicateBadge')}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between">
            <Button type="button" variant="ghost" size="md" onClick={reset}>
              <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
              {t('back')}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={pending || toImport.length === 0}
              onClick={runImport}
              data-testid="csv-import"
            >
              {pending ? t('importing') : t('importCta', { count: toImport.length })}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-sage-500)]/15 text-[color:var(--color-sage-500)]">
            <Check className="h-6 w-6" strokeWidth={2.2} aria-hidden />
          </span>
          <span className="font-display text-lg text-[color:var(--color-foreground)] italic">
            {t('resultImported', { count: result.imported })}
          </span>
          {result.skipped > 0 ? (
            <span className="text-xs text-[color:var(--color-muted-foreground)]">
              {t('resultSkipped', { count: result.skipped })}
            </span>
          ) : null}
          <Button type="button" variant="outline" size="md" onClick={reset}>
            {t('importAnother')}
          </Button>
        </div>
      )}
    </div>
  );
}
