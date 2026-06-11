'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Subscriber = {
  _id: string;
  email: string;
  status: 'active' | 'unsubscribed';
  source?: string;
  subscribedAt: number;
  unsubscribedAt?: number;
};

export function AdminNewsletterTable({ subscribers }: { subscribers: Subscriber[] }) {
  const locale = useLocale();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = subscribers.filter((s) => {
    const matchSearch = !search || s.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Rechercher par email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted-foreground)] focus:ring-1 focus:ring-[color:var(--color-border-strong)] focus:outline-none"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="unsubscribed">Désabonnés</SelectItem>
          </SelectContent>
        </Select>
        <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
          {filtered.length} abonné{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
              <Th>Email</Th>
              <Th>Statut</Th>
              <Th>Source</Th>
              <Th>Inscrit le</Th>
              <Th>Désabonné le</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr
                key={s._id}
                className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-elevated)]/50"
              >
                <td className="px-4 py-3 font-medium">{s.email}</td>
                <td className="px-4 py-3">
                  <Badge variant={s.status === 'active' ? 'success' : 'neutral'}>
                    {s.status === 'active' ? 'Actif' : 'Désabonné'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
                  {s.source ?? '—'}
                </td>
                <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                    new Date(s.subscribedAt),
                  )}
                </td>
                <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
                  {s.unsubscribedAt
                    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                        new Date(s.unsubscribedAt),
                      )
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
