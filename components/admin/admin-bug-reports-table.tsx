'use client';

import { useState } from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useServerAction } from '@/components/admin/use-admin-action';
import {
  adminUpdateBugStatusAction,
  adminGetBugScreenshotAction,
} from '@/app/[locale]/(app)/admin/actions';

type Status = 'open' | 'triaged' | 'resolved';

interface BugReport {
  _id: string;
  reporterId?: string;
  url: string;
  pathname: string;
  description: string;
  userAgent?: string;
  viewport?: string;
  locale?: string;
  consoleErrors?: string[];
  status: Status;
  createdAt: number;
  hasScreenshot: boolean;
}

const STATUS_LABEL: Record<Status, string> = {
  open: 'À traiter',
  triaged: 'En cours',
  resolved: 'Résolu',
};
const STATUS_ORDER: Status[] = ['open', 'triaged', 'resolved'];

function fmtDate(ms: number): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

export function AdminBugReportsTable({ reports }: { reports: BugReport[] }) {
  if (reports.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[color:var(--color-border)] p-10 text-center text-sm text-[color:var(--color-muted-foreground)]">
        Aucun signalement de bug pour le moment.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {reports.map((r) => (
        <BugRow key={r._id} report={r} />
      ))}
    </div>
  );
}

function BugRow({ report }: { report: BugReport }) {
  const { execute, loading, error } = useServerAction(adminUpdateBugStatusAction);
  const [shot, setShot] = useState<string | null>(null);
  const [shotOpen, setShotOpen] = useState(false);
  const [shotLoading, setShotLoading] = useState(false);

  async function viewShot() {
    setShotOpen(true);
    if (shot) return;
    setShotLoading(true);
    const res = await adminGetBugScreenshotAction(report._id);
    setShotLoading(false);
    if (res.ok) setShot(res.screenshot);
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 sm:flex-row sm:items-start sm:justify-between"
      data-status={report.status}
    >
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="font-medium text-[color:var(--color-foreground)]">
          {report.description}
        </span>
        <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
          {fmtDate(report.createdAt)} · {report.pathname}
          {report.viewport ? ` · ${report.viewport}` : ''}
          {report.locale ? ` · ${report.locale}` : ''}
        </span>
        {report.consoleErrors && report.consoleErrors.length > 0 ? (
          <details className="text-xs text-[color:var(--color-muted-foreground)]">
            <summary className="cursor-pointer">
              {report.consoleErrors.length} erreur
              {report.consoleErrors.length > 1 ? 's' : ''} console
            </summary>
            <pre className="mt-1 max-w-full overflow-x-auto rounded-md bg-[color:var(--color-surface-elevated)] p-2 font-mono text-[11px] whitespace-pre-wrap">
              {report.consoleErrors.join('\n')}
            </pre>
          </details>
        ) : null}
        {error ? (
          <span role="alert" className="text-xs text-[color:var(--color-destructive)]">
            {error}
          </span>
        ) : null}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {report.hasScreenshot ? (
          <button
            type="button"
            onClick={() => void viewShot()}
            className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)] transition-colors hover:bg-[color:var(--color-surface-elevated)]"
          >
            <ImageIcon className="h-4 w-4" strokeWidth={1.8} />
            Capture
          </button>
        ) : null}
        <Select
          value={report.status}
          onValueChange={(v) => execute(report._id, v as Status)}
          disabled={loading}
        >
          <SelectTrigger className="min-w-[130px] rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Dialog open={shotOpen} onOpenChange={setShotOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Capture du signalement</DialogTitle>
          </DialogHeader>
          {shotLoading ? (
            <div className="flex items-center justify-center py-16 text-[color:var(--color-muted-foreground)]">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : shot ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL stockée en base
            <img
              src={shot}
              alt="Capture du bug"
              className="w-full rounded-lg border border-[color:var(--color-border)]"
            />
          ) : (
            <p className="py-10 text-center text-sm text-[color:var(--color-muted-foreground)]">
              Capture indisponible.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
