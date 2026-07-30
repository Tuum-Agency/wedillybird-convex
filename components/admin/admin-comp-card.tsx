'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Loader2, Search } from 'lucide-react';
import {
  adminFindEventsByEmailAction,
  adminCompEventPlanAction,
} from '@/app/[locale]/(app)/admin/actions';

type CompEventRow = {
  eventId: string;
  title: string;
  eventDate: number;
  planTier: 'essential' | 'premium' | null;
  paidAt: number | null;
  ownerEmail: string;
};

const inputCls =
  'h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5 text-sm text-[color:var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]';
const labelCls =
  'mb-1 block font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-ink-500)] uppercase';

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Offrir un forfait particulier sans paiement — sert le « Premium offert pour ton
 * propre mariage » promis aux partenaires affiliés. Recherche le mariage par
 * email du couple, puis applique le forfait (réconciliation côté Convex, trace €0).
 */
export function AdminCompCard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [events, setEvents] = useState<CompEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function search() {
    setError(null);
    setNotice(null);
    const q = email.trim();
    if (!q) return;
    startTransition(async () => {
      const res = await adminFindEventsByEmailAction(q);
      if (!res.ok) {
        setError(res.error);
        setEvents(null);
        return;
      }
      setEvents(res.events);
      if (res.events.length === 0) setNotice('Aucun mariage trouvé pour cet email.');
    });
  }

  function comp(eventId: string, tier: 'essential' | 'premium') {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await adminCompEventPlanAction({ eventId, tier });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice(`Forfait ${tier === 'premium' ? 'Premium' : 'Essentiel'} offert ✓`);
      // Rafraîchit la liste pour refléter le nouveau forfait.
      const refreshed = await adminFindEventsByEmailAction(email.trim());
      if (refreshed.ok) setEvents(refreshed.events);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      <div className="mb-4 flex items-center gap-2">
        <Gift className="h-4 w-4 text-[color:var(--color-accent)]" strokeWidth={1.8} aria-hidden />
        <div>
          <h2 className="text-sm font-semibold">Offrir un forfait</h2>
          <p className="text-xs text-[color:var(--color-ink-500)]">
            « Premium offert pour ton propre mariage » — cherche le mariage par email, offre le
            forfait sans paiement.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className={labelCls}>Email du particulier</label>
          <input
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') search();
            }}
            placeholder="norah@…"
            type="email"
          />
        </div>
        <button
          type="button"
          onClick={search}
          disabled={pending || !email.trim()}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-[color:var(--color-border)] px-4 text-sm font-medium hover:bg-[color:var(--color-muted)] disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
          ) : (
            <Search className="h-4 w-4" strokeWidth={2} aria-hidden />
          )}
          Chercher
        </button>
      </div>

      {error ? <p className="mt-2 text-sm text-[color:var(--color-destructive)]">{error}</p> : null}
      {notice ? <p className="mt-2 text-sm text-[color:var(--color-ink-500)]">{notice}</p> : null}

      {events && events.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-[color:var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-muted)] text-left font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-ink-500)] uppercase">
              <tr>
                <th className="px-4 py-2.5">Mariage</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Forfait actuel</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.eventId} className="border-t border-[color:var(--color-border)]">
                  <td className="px-4 py-2.5 font-medium">{ev.title || '—'}</td>
                  <td className="px-4 py-2.5 text-[color:var(--color-ink-500)]">
                    {fmtDate(ev.eventDate)}
                  </td>
                  <td className="px-4 py-2.5">
                    {ev.planTier ? (ev.planTier === 'premium' ? 'Premium' : 'Essentiel') : '—'}
                    {ev.planTier && !ev.paidAt ? (
                      <span className="text-[color:var(--color-ink-500)]"> (non payé)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => comp(ev.eventId, 'essential')}
                      disabled={pending}
                      className="mr-2 rounded-md border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[color:var(--color-muted)] disabled:opacity-50"
                    >
                      Offrir Essentiel
                    </button>
                    <button
                      type="button"
                      onClick={() => comp(ev.eventId, 'premium')}
                      disabled={pending}
                      className="rounded-md border border-[color:var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10 disabled:opacity-50"
                    >
                      Offrir Premium
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
