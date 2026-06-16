'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useServerAction } from '@/components/admin/use-admin-action';
import { adminUpdatePhotoBookStatusAction } from '@/app/[locale]/(app)/admin/actions';

type Status = 'requested' | 'in_production' | 'shipped' | 'cancelled';

interface Order {
  _id: string;
  eventId: string;
  eventTitle: string | null;
  status: Status;
  recipientName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  country: string;
  notes?: string;
  ownerName: string | null;
  ownerEmail: string | null;
  createdAt: number;
  updatedAt: number;
}

const STATUS_LABEL: Record<Status, string> = {
  requested: 'Commande reçue',
  in_production: 'En fabrication',
  shipped: 'Expédié',
  cancelled: 'Annulé',
};

const STATUS_ORDER: Status[] = ['requested', 'in_production', 'shipped', 'cancelled'];

function fmtDate(ms: number): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ms));
}

export function AdminPhotoBooksTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[color:var(--color-border)] p-10 text-center text-sm text-[color:var(--color-muted-foreground)]">
        Aucune commande de livre photo pour le moment.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((o) => (
        <PhotoBookRow key={o._id} order={o} />
      ))}
    </div>
  );
}

function PhotoBookRow({ order }: { order: Order }) {
  const { execute, loading, error } = useServerAction(adminUpdatePhotoBookStatusAction);

  const address = [
    order.addressLine1,
    order.addressLine2,
    `${order.postalCode} ${order.city}`,
    order.country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 sm:flex-row sm:items-start sm:justify-between"
      data-testid="photo-book-order-row"
    >
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-[color:var(--color-foreground)]">
          {order.eventTitle ?? '—'}
          <span className="ml-2 font-mono text-xs text-[color:var(--color-muted-foreground)]">
            {fmtDate(order.createdAt)}
          </span>
        </span>
        <span className="text-[color:var(--color-muted-foreground)]">
          {order.recipientName} · {address}
        </span>
        <span className="text-xs text-[color:var(--color-muted-foreground)]">
          {order.ownerName ?? '—'}
          {order.ownerEmail ? ` · ${order.ownerEmail}` : ''}
        </span>
        {order.notes ? (
          <span className="text-xs text-[color:var(--color-muted-foreground)] italic">
            « {order.notes} »
          </span>
        ) : null}
        {error ? (
          <span role="alert" className="text-xs text-[color:var(--color-destructive)]">
            {error}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={order.status}
          onValueChange={(v) => execute(order._id, v as Status)}
          disabled={loading}
        >
          <SelectTrigger
            className="min-w-[170px] rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
            data-testid="photo-book-status-select"
          >
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
    </div>
  );
}
