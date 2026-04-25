'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  checkInByTokenAction,
  undoCheckInAction,
  type CheckInResult,
} from '@/app/[locale]/(app)/events/[eventId]/check-in/actions';
import {
  cacheGuestsForEvent,
  countPendingCheckIns,
  drainPendingCheckIns,
  findGuestByToken,
  getCacheMeta,
  markCachedCheckedIn,
  queueCheckIn,
} from '@/lib/offline/guests-db';

const QrScanner = dynamic(() => import('./qr-scanner').then((m) => m.QrScanner), {
  ssr: false,
});

type ToastStatus = 'success' | 'already' | 'error' | 'offline';

interface Toast {
  id: string;
  status: ToastStatus;
  guestName: string;
  guestId?: string;
  plusOnesAllowed: number;
  timestamp: number;
}

interface GuestForCheckIn {
  _id: string;
  fullName: string;
  category?: string;
  plusOnesAllowed: number;
  rsvpStatus: 'pending' | 'attending' | 'declined' | 'maybe';
  qrCodeToken: string;
  checkedInAt?: number;
}

interface Props {
  eventId: string;
  initialGuests: GuestForCheckIn[];
}

const UNDO_WINDOW_MS = 30_000;
const COOLDOWN_MS = 2_000;

export function CheckInManager({ eventId, initialGuests }: Props) {
  const t = useTranslations('Checkin');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paused, setPaused] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [manualInput, setManualInput] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [now, setNow] = useState<number>(() => Date.now());
  const [pending, startTransition] = useTransition();
  const lastScannedRef = useRef<{ token: string; at: number } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      await cacheGuestsForEvent(eventId, initialGuests);
      const meta = await getCacheMeta(eventId);
      if (meta) setLastSyncedAt(meta.lastSyncedAt);
      setPendingCount(await countPendingCheckIns(eventId));
    })();
  }, [eventId, initialGuests]);

  const refreshPendingCount = useCallback(async () => {
    setPendingCount(await countPendingCheckIns(eventId));
  }, [eventId]);

  const drain = useCallback(async () => {
    const result = await drainPendingCheckIns();
    await refreshPendingCount();
    return result;
  }, [refreshPendingCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (online) void drain();
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [drain]);

  const pushToast = useCallback((toast: Toast) => {
    setToasts((prev) => [toast, ...prev].slice(0, 5));
  }, []);

  const handleResult = useCallback(
    (result: CheckInResult, token: string) => {
      if (result.ok) {
        const toast: Toast = {
          id: `${token}-${Date.now()}`,
          status: result.alreadyCheckedIn ? 'already' : 'success',
          guestName: result.guest.fullName,
          guestId: result.guest._id,
          plusOnesAllowed: result.guest.plusOnesAllowed,
          timestamp: result.checkedInAt,
        };
        pushToast(toast);
        void markCachedCheckedIn(eventId, token, result.checkedInAt);
        return;
      }
      pushToast({
        id: `${token}-err-${Date.now()}`,
        status: 'error',
        guestName: result.error === 'GUEST_NOT_FOUND' ? t('unknownGuest') : t('errorGeneric'),
        plusOnesAllowed: 0,
        timestamp: Date.now(),
      });
    },
    [eventId, pushToast, t],
  );

  const handleOfflineScan = useCallback(
    async (token: string) => {
      const cached = await findGuestByToken(eventId, token);
      if (!cached) {
        pushToast({
          id: `${token}-offline-404-${Date.now()}`,
          status: 'offline',
          guestName: t('unknownGuestOffline'),
          plusOnesAllowed: 0,
          timestamp: Date.now(),
        });
        return;
      }
      // Queue for later sync. Idempotent on (eventId, token).
      await queueCheckIn(eventId, token);
      await refreshPendingCount();
      pushToast({
        id: `${token}-offline-${Date.now()}`,
        status: 'offline',
        guestName: cached.fullName,
        plusOnesAllowed: cached.plusOnesAllowed,
        timestamp: Date.now(),
      });
    },
    [eventId, pushToast, refreshPendingCount, t],
  );

  const submit = useCallback(
    (token: string) => {
      const now = Date.now();
      const last = lastScannedRef.current;
      if (last && last.token === token && now - last.at < COOLDOWN_MS) return;
      lastScannedRef.current = { token, at: now };

      setPaused(true);
      setTimeout(() => setPaused(false), COOLDOWN_MS);

      if (!navigator.onLine) {
        void handleOfflineScan(token);
        return;
      }

      startTransition(async () => {
        const result = await checkInByTokenAction(eventId, token);
        handleResult(result, token);
      });
    },
    [eventId, handleOfflineScan, handleResult],
  );

  function onManualSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = manualInput.trim();
    if (!token) return;
    submit(token);
    setManualInput('');
  }

  function handleUndo(toast: Toast) {
    if (!toast.guestId) return;
    startTransition(async () => {
      const result = await undoCheckInAction(eventId, toast.guestId!);
      if (result.ok) {
        setToasts((prev) => prev.filter((x) => x.id !== toast.id));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--color-muted)]">
        <span data-testid="connection-status">
          {isOnline ? t('online') : t('offline')} ·{' '}
          {lastSyncedAt
            ? t('lastSync', {
                time: new Intl.DateTimeFormat('fr', { timeStyle: 'short' }).format(
                  new Date(lastSyncedAt),
                ),
              })
            : t('neverSynced')}
          {pendingCount > 0 ? (
            <span data-testid="pending-checkins" className="ml-2 font-medium">
              · {t('pendingSync', { count: pendingCount })}
            </span>
          ) : null}
        </span>
        <span>{t('guestsCached', { count: initialGuests.length })}</span>
      </div>

      <QrScanner onScan={submit} paused={paused || pending} />

      <form onSubmit={onManualSubmit} className="flex gap-2" data-testid="manual-form">
        <Input
          placeholder={t('manualPlaceholder')}
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          data-testid="manual-token"
        />
        <Button type="submit" variant="ghost" disabled={pending} data-testid="manual-submit">
          {t('manualSubmit')}
        </Button>
      </form>

      <ul className="flex flex-col gap-2" data-testid="toast-list">
        {toasts.map((toast) => {
          const undoable =
            toast.status === 'success' && toast.guestId && now - toast.timestamp < UNDO_WINDOW_MS;
          return (
            <li
              key={toast.id}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-sm ${
                toast.status === 'success'
                  ? 'border-[color:var(--color-accent)] bg-[color:var(--color-surface)]'
                  : toast.status === 'already'
                    ? 'border-[color:var(--color-border)] bg-[color:var(--color-surface)]'
                    : toast.status === 'offline'
                      ? 'border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)]'
                      : 'border-[color:var(--color-destructive)] bg-[color:var(--color-surface)]'
              }`}
              data-testid="toast"
              data-status={toast.status}
            >
              <div className="flex flex-col">
                <span className="font-medium">{toast.guestName}</span>
                <span className="text-xs text-[color:var(--color-muted)]">
                  {toast.status === 'success' && t('toastSuccess')}
                  {toast.status === 'already' && t('toastAlready')}
                  {toast.status === 'offline' && t('toastOffline')}
                  {toast.status === 'error' && t('toastError')}
                  {toast.plusOnesAllowed > 0 ? ` · +${toast.plusOnesAllowed}` : ''}
                </span>
              </div>
              {undoable ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUndo(toast)}
                  data-testid="undo-check-in"
                >
                  {t('undo')}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
