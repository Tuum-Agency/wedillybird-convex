import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { Button } from '@/components/ui/button';
import { getPaymentDriver } from '@/lib/payments';
import type { ProviderName } from '@/lib/payments/country';

function isProviderName(value: string | undefined): value is ProviderName {
  return value === 'stripe' || value === 'cinetpay' || value === 'mock';
}

export default async function UpgradeSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; eventId: string }>;
  searchParams: Promise<{ session_id?: string; provider?: string }>;
}) {
  const { locale, eventId } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect({ href: '/sign-in', locale });
  }

  const convex = getConvexServerClient();

  // Fallback finalization: if the Stripe webhook hasn't fired yet (or in dev
  // without `stripe listen`), reconcile the payment using the session_id query
  // param Stripe appends to the success URL. The mutations are idempotent.
  let reconciliationFailed = false;
  if (sp.session_id) {
    try {
      const provider: ProviderName = isProviderName(sp.provider) ? sp.provider : 'stripe';
      const driver = getPaymentDriver(provider);
      const status = await driver.retrieveSessionStatus(sp.session_id);
      if (status.paid) {
        await convex.mutation(convexApi.markPaymentSucceeded, {
          provider,
          providerSessionId: status.providerSessionId,
          providerEventId: status.providerEventId,
        });
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

  const t = await getTranslations('Upgrade');
  // Webhook hasn't reconciled yet (or payment failed). UI shows a processing state.
  const isPending = event.planTier === undefined;

  return (
    <main className="container-page flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {isPending ? t('processingTitle') : t('successTitle')}
      </h1>
      <p className="text-base text-[color:var(--color-muted)]">
        {isPending
          ? t('processingBody')
          : t('successBody', {
              plan: t(`plans.${event.planTier!}` as const),
              days: event.planTier === 'premium' ? 180 : 30,
            })}
      </p>
      {isPending && reconciliationFailed ? (
        <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
          {t('errors.reconciliation')}
        </p>
      ) : null}
      <Link href={`/events/${eventId}`}>
        <Button>{t('backToEvent')}</Button>
      </Link>
    </main>
  );
}
