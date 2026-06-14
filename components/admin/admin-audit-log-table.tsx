'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';

type AuditEntry = {
  _id: string;
  adminName: string | null;
  adminEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  details?: string;
  createdAt: number;
};

const TARGET_VARIANT: Record<string, 'neutral' | 'primary' | 'accent' | 'warning'> = {
  user: 'primary',
  event: 'accent',
  payment: 'warning',
  organization: 'neutral',
  photo: 'neutral',
  template: 'neutral',
  newsletter: 'neutral',
};

export function AdminAuditLogTable({ logs }: { logs: AuditEntry[] }) {
  const t = useTranslations('Admin');
  const locale = useLocale();
  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            <Th>{t('auditLog.colDate')}</Th>
            <Th>{t('auditLog.colAdmin')}</Th>
            <Th>{t('auditLog.colAction')}</Th>
            <Th>{t('auditLog.colTarget')}</Th>
            <Th>{t('auditLog.colDetails')}</Th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-10 text-center text-sm text-[color:var(--color-muted-foreground)]"
              >
                {t('auditLog.empty')}
              </td>
            </tr>
          ) : null}
          {logs.map((l) => (
            <tr
              key={l._id}
              className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-elevated)]/50"
            >
              <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(l.createdAt))}
              </td>
              <td className="px-4 py-3 font-medium">{l.adminName ?? l.adminEmail ?? '—'}</td>
              <td className="px-4 py-3">
                {t.has(`auditActions.${l.action}`) ? t(`auditActions.${l.action}`) : l.action}
              </td>
              <td className="px-4 py-3">
                <Badge variant={TARGET_VARIANT[l.targetType] ?? 'neutral'}>{l.targetType}</Badge>
                <span className="ml-2 font-mono text-xs text-[color:var(--color-muted-foreground)]">
                  {l.targetId.slice(0, 12)}…
                </span>
              </td>
              <td className="max-w-xs truncate px-4 py-3 text-xs text-[color:var(--color-muted-foreground)]">
                {l.details ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-muted-foreground)] uppercase">
      {children}
    </th>
  );
}
