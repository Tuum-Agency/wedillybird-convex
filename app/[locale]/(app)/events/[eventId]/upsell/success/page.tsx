import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Archive, ArrowLeft } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { buttonVariants } from '@/components/ui/button';
import { AppShell } from '@/components/app/app-shell';
import { retrievePostEventUpsellSessionStatus } from '@/lib/payments/drivers/stripe';
import { cn } from '@/lib/cn';

/**
 * Page de succès de l'upsell HD post-event. Si le webhook Stripe n'est pas
 * encore arrivé, finalise en repli (idempotent) : on retrouve la session
 * Stripe payée et on applique `applyPostEventUpsell` (gardé par le secret
 * webhook, dont le serveur dispose). Miroir de `upgrade/success`.
 */
export default async function UpsellSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; eventId: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { locale, eventId } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect({ href: '/sign-in', locale });
  }

  const convex = getConvexServerClient();

  let reconciliationFailed = false;
  if (sp.session_id) {
    try {
      const webhookSecret = process.env.CONVEX_WEBHOOK_SECRET;
      const upsell = await retrievePostEventUpsellSessionStatus(sp.session_id);
      if (upsell && webhookSecret) {
        await convex.mutation(convexApi.applyPostEventUpsell, {
          webhookSecret,
          eventId: upsell.eventId,
          requesterId: upsell.requesterId,
          provider: 'stripe',
          providerSessionId: upsell.stripeSessionId,
          amountMinor: upsell.amountMinor,
          currency: upsell.currency,
          creditReservationId: upsell.creditReservationId,
        });
      } else if (upsell && !webhookSecret) {
        reconciliationFailed = true;
      }
    } catch {
      reconciliationFailed = true;
    }
  }

  const event = await convex.query(convexApi.getEventById, {
    eventId,
    requesterId: session!.userId,
  });
  if (!event) notFound();

  const user = await convex.query(convexApi.currentUser, { userId: session!.userId });
  const t = await getTranslations('Upgrade.upsell');
  const isApplied = event.hdUpsellPurchasedAt !== undefined;

  return (
    <AppShell userName={user?.fullName}>
      <div className="container-page mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-7 py-16 text-center">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[var(--shadow-blush)]"
          style={{
            background: isApplied
              ? 'linear-gradient(135deg, oklch(72% 0.09 20) 0%, oklch(58% 0.075 80) 100%)'
              : 'linear-gradient(135deg, oklch(78% 0.075 78) 0%, oklch(58% 0.075 80) 100%)',
          }}
          aria-hidden
        >
          <Archive className="h-7 w-7" strokeWidth={1.75} />
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
          {isApplied ? t('successTitle') : t('processingTitle')}
        </h1>
        <p className="max-w-md text-base leading-relaxed text-[color:var(--color-ink-500)] sm:text-lg">
          {isApplied ? t('successBody') : t('processingBody')}
        </p>
        {!isApplied && reconciliationFailed ? (
          <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
            {t('reconciliation')}
          </p>
        ) : null}
        <Link
          href={`/events/${eventId}`}
          className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'mt-4')}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
          {t('backToEvent')}
        </Link>
      </div>
    </AppShell>
  );
}
