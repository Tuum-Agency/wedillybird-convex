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
import { useServerAction } from '@/components/admin/use-admin-action';
import {
  adminUpdateEventStatusAction,
  adminDeleteEventAction,
} from '@/app/[locale]/(app)/admin/actions';

type Event = {
  _id: string;
  title: string;
  coupleNames: { partnerA: string; partnerB: string };
  eventDate: number;
  timezone: string;
  status: 'draft' | 'active' | 'archived' | 'cancelled';
  planTier?: string;
  maxGuests: number;
  ownerName: string | null;
  ownerEmail: string | null;
  organizationId?: string;
  createdAt: number;
  updatedAt: number;
};

const STATUS_VARIANT: Record<string, 'neutral' | 'success' | 'warning' | 'destructive'> = {
  draft: 'neutral',
  active: 'success',
  archived: 'warning',
  cancelled: 'destructive',
};

export function AdminEventsTable({ events }: { events: Event[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = events.filter((e) => {
    const matchSearch =
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.coupleNames.partnerA.toLowerCase().includes(search.toLowerCase()) ||
      e.coupleNames.partnerB.toLowerCase().includes(search.toLowerCase()) ||
      e.ownerEmail?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Rechercher un événement…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted-foreground)] focus:ring-1 focus:ring-[color:var(--color-border-strong)] focus:outline-none"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="archived">Archivé</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
          </SelectContent>
        </Select>
        <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
          {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
              <Th>Couple</Th>
              <Th>Titre</Th>
              <Th>Date</Th>
              <Th>Statut</Th>
              <Th>Plan</Th>
              <Th>Propriétaire</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <EventRow key={e._id} event={e} />
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

function EventRow({ event }: { event: Event }) {
  const locale = useLocale();
  const { execute: updateStatus, loading: updating } = useServerAction(
    adminUpdateEventStatusAction,
  );
  const { execute: deleteEvent, loading: deleting } = useServerAction(adminDeleteEventAction);

  return (
    <tr className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-elevated)]/50">
      <td className="px-4 py-3 font-medium">
        {event.coupleNames.partnerA} & {event.coupleNames.partnerB}
      </td>
      <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">{event.title}</td>
      <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
        {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(event.eventDate))}
      </td>
      <td className="px-4 py-3">
        <Badge variant={STATUS_VARIANT[event.status] ?? 'neutral'}>{event.status}</Badge>
      </td>
      <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
        {event.planTier ?? '—'}
      </td>
      <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
        {event.ownerName ?? event.ownerEmail ?? '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Select
            value=""
            disabled={updating}
            onValueChange={(v) => {
              const newStatus = v as Event['status'];
              if (confirm(`Changer le statut en "${newStatus}" ?`)) {
                updateStatus(event._id, newStatus);
              }
            }}
          >
            <SelectTrigger className="rounded-md border border-[color:var(--color-border)] bg-transparent px-2 py-1 text-xs text-[color:var(--color-muted-foreground)]">
              <SelectValue placeholder="Statut…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Brouillon</SelectItem>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="archived">Archivé</SelectItem>
              <SelectItem value="cancelled">Annulé</SelectItem>
            </SelectContent>
          </Select>
          {event.status !== 'cancelled' ? (
            <button
              onClick={() => {
                if (confirm(`Supprimer l'événement "${event.title}" ?`)) {
                  deleteEvent(event._id);
                }
              }}
              disabled={deleting}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-400/10 disabled:opacity-50"
            >
              Supprimer
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
