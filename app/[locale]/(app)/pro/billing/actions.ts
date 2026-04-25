'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

/**
 * `redirect()` with `typedRoutes: true` rejects strings it can't statically
 * verify (Stripe Checkout URLs, query-string variants). This thin wrapper
 * narrows the cast to a single line at each call site.
 */
function redirectUnsafe(url: string): never {
  return redirect(url as never);
}
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { createSubscriptionCheckout, openCustomerPortal } from '@/lib/payments/drivers/stripe';
import { isSubscriptionTier, type SubscriptionTier } from '@/lib/payments/subscriptions';

async function appOrigin(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (explicit) return explicit;
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'wedillybird.com';
  return `${proto}://${host}`;
}

export async function subscribeAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirectUnsafe('/login?next=/pro/billing');

  const tierRaw = formData.get('tier');
  if (typeof tierRaw !== 'string' || !isSubscriptionTier(tierRaw)) {
    redirectUnsafe('/pro/billing?status=error&code=invalid_tier');
  }
  const tier: SubscriptionTier = tierRaw;

  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org) redirectUnsafe('/pro/onboarding');

  const user = await convex.query(convexApi.getUserById, { userId: session.userId });
  if (!user?.email) redirectUnsafe('/pro/billing?status=error&code=email_required');

  const origin = await appOrigin();
  const checkout = await createSubscriptionCheckout({
    organizationId: org._id,
    requesterId: session.userId,
    tier,
    customerEmail: user.email,
    stripeCustomerId: org.stripeCustomerId,
    successUrl: `${origin}/pro/billing?status=success`,
    cancelUrl: `${origin}/pro/billing?status=cancel`,
  });
  redirectUnsafe(checkout.redirectUrl);
}

export async function openBillingPortalAction(): Promise<void> {
  const session = await getSession();
  if (!session) redirectUnsafe('/login?next=/pro/billing');

  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org?.stripeCustomerId) redirectUnsafe('/pro/billing?status=error&code=no_customer');

  const origin = await appOrigin();
  const { url } = await openCustomerPortal(org.stripeCustomerId, `${origin}/pro/billing`);
  redirectUnsafe(url);
}
