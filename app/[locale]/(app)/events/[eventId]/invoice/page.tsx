import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { AppShell } from '@/components/app/app-shell';
import { buttonVariants } from '@/components/ui/button';
import { formatAmount } from '@/lib/payments/plans';
import { cn } from '@/lib/cn';

type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled';
type PlanTier = 'essential' | 'premium';

const STATUS_STYLES: Record<PaymentStatus, { bg: string; fg: string; dot: string }> = {
  succeeded: {
    bg: 'oklch(96% 0.018 145)',
    fg: 'oklch(50% 0.08 145)',
    dot: 'oklch(50% 0.08 145)',
  },
  pending: {
    bg: 'oklch(96% 0.025 78)',
    fg: 'var(--color-gold-700)',
    dot: 'var(--color-gold-500)',
  },
  failed: {
    bg: 'oklch(96% 0.025 25)',
    fg: 'var(--color-blush-700)',
    dot: 'var(--color-blush-700)',
  },
  cancelled: {
    bg: 'oklch(94% 0.012 78)',
    fg: 'var(--color-ink-500)',
    dot: 'var(--color-ink-500)',
  },
};

/**
 * /events/[eventId]/invoice — liste des paiements de l'event.
 *
 * Owner-only : `events:getById` Convex side fait déjà l'`assertEventOwnership`
 * (FORBIDDEN sinon). En complément, `payments:listByEvent` ne renvoie que les
 * paiements si requesterId === ownerId. Donc double protection.
 *
 * Filtre côté UI : on n'affiche que les paiements `succeeded` (la facture
 * PDF n'est émise qu'à ce statut côté API). On garde les statuts pour debug
 * mais on push les payments non-succeeded en bas / on pourrait les masquer.
 * Choix MVP : afficher uniquement les `succeeded` pour rester clair.
 */
export default async function EventInvoicePage({
  params,
}: {
  params: Promise<{ locale: string; eventId: string }>;
}) {
  const { locale, eventId } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const convex = getConvexServerClient();
  const event = await convex.query(convexApi.getEventById, {
    eventId,
    requesterId: session!.userId,
  });
  if (!event) notFound();

  const payments = await convex.query(convexApi.listPaymentsByEvent, {
    eventId,
    requesterId: session!.userId,
  });

  const user = await convex.query(convexApi.currentUser, { userId: session!.userId });
  const t = await getTranslations('InvoicePage');

  const succeeded = payments.filter((p) => p.status === 'succeeded');

  const planLabel: Record<PlanTier, string> = {
    essential: t('planEssential'),
    premium: t('planPremium'),
  };
  const statusLabel: Record<PaymentStatus, string> = {
    succeeded: t('statusSucceeded'),
    pending: t('statusPending'),
    failed: t('statusFailed'),
    cancelled: t('statusCancelled'),
  };

  const eventTitle = `${event.coupleNames.partnerA} & ${event.coupleNames.partnerB}`;

  return (
    <AppShell userName={user?.fullName}>
      <div className="container-page flex flex-col gap-10 py-12 sm:py-16">
        <header className="flex flex-col gap-4">
          <Link
            href={`/events/${eventId}` as never}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-ink-900)]"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden />
            {t('backToEvent')}
          </Link>
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-gold-700)] uppercase">
            {t('eyebrow')}
          </span>
          <h1
            className="font-display text-balance italic"
            style={{
              fontSize: 'clamp(2rem, 4.5vw, 3rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
              color: 'var(--color-ink-900)',
            }}
          >
            {t('title')}
          </h1>
          <p className="text-base leading-relaxed text-[color:var(--color-ink-500)] sm:text-lg">
            {t('subtitle', { eventTitle })}
          </p>
        </header>

        {succeeded.length === 0 ? (
          <div
            className="rounded-3xl border border-dashed border-[color:var(--color-border)] bg-white p-10 text-center"
            data-testid="invoice-empty"
          >
            <p className="text-base text-[color:var(--color-ink-500)]">{t('empty')}</p>
          </div>
        ) : (
          <section
            className="overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white shadow-[var(--shadow-soft)]"
            data-testid="invoice-list"
          >
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-ivory-50)]">
                  <th
                    scope="col"
                    className="px-5 py-3 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-500)] uppercase"
                  >
                    {t('columnDate')}
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-500)] uppercase"
                  >
                    {t('columnPlan')}
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-500)] uppercase"
                  >
                    {t('columnAmount')}
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-500)] uppercase"
                  >
                    {t('columnStatus')}
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-right font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-500)] uppercase"
                  >
                    {t('columnActions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {succeeded.map((payment) => {
                  const dateLabel = new Intl.DateTimeFormat('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(payment.createdAt));
                  const status = STATUS_STYLES[payment.status];
                  return (
                    <tr
                      key={payment._id}
                      data-testid="invoice-row"
                      data-payment-id={payment._id}
                      className="border-b border-[color:var(--color-border)] last:border-b-0"
                    >
                      <td className="px-5 py-4 text-[color:var(--color-ink-700)]">{dateLabel}</td>
                      <td className="px-5 py-4 text-[color:var(--color-ink-900)]">
                        {planLabel[payment.plan]}
                      </td>
                      <td className="px-5 py-4 font-medium text-[color:var(--color-ink-900)] tabular-nums">
                        {formatAmount(payment.amountMinor, payment.currency)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] uppercase"
                          style={{ background: status.bg, color: status.fg }}
                        >
                          <span
                            aria-hidden
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ background: status.dot }}
                          />
                          {statusLabel[payment.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <a
                          href={`/api/payments/${payment._id}/invoice.pdf`}
                          download
                          className={cn(
                            buttonVariants({ variant: 'outline', size: 'sm' }),
                            'inline-flex',
                          )}
                          data-testid="invoice-download"
                        >
                          <Download className="h-4 w-4" strokeWidth={2} aria-hidden />
                          {t('downloadCta')}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </AppShell>
  );
}
