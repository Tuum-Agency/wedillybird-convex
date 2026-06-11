import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { exchangeStripeConnectCode } from '@/lib/payments/drivers/stripe';
import { verifyConnectState, connectStateSecret } from '@/lib/payments/connect-oauth-state';

/**
 * Callback OAuth « Se connecter avec Stripe ». Stripe redirige ici avec `code`
 * + `state` (ou `error` si l'agence a refusé). On vérifie le `state` signé
 * (anti-CSRF, lié à l'org), on s'assure que la session courante est bien celle
 * de cette org (owner/admin), on échange le code contre l'`acct_…` de l'agence,
 * puis on le mémorise. Redirige toujours vers /pro/payments avec un statut.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const back = (status: 'ok' | 'error' | 'denied') =>
    NextResponse.redirect(new URL(`/pro/payments?connect=${status}`, req.url));

  if (url.searchParams.get('error')) return back('denied'); // l'agence a refusé

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return back('error');

  // 1) Vérifie le state signé (CSRF + fraîcheur) → orgId attendu.
  let parsed;
  try {
    parsed = await verifyConnectState(state, connectStateSecret(), Date.now());
  } catch {
    return back('error');
  }
  if (!parsed) return back('error');

  // 2) La session courante doit être celle de l'org initiatrice (owner/admin).
  const session = await getSession();
  if (!session) return back('error');

  try {
    const convex = getConvexServerClient();
    const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
    if (!org || org._id !== parsed.orgId) return back('error');
    if (org.myRole !== 'owner' && org.myRole !== 'admin') return back('error');

    // 3) Échange le code → compte connecté de l'agence, puis mémorise.
    const { accountId } = await exchangeStripeConnectCode(code);
    await convex.mutation(convexApi.connectStripeAccount, {
      organizationId: org._id,
      requesterId: session.userId,
      stripeConnectAccountId: accountId,
    });
    return back('ok');
  } catch {
    return back('error');
  }
}
