import { NextResponse } from 'next/server';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { retrieveConnectedAccountStatus } from '@/lib/payments/drivers/stripe';

/**
 * Retour de l'onboarding Stripe Connect d'une influenceuse (versement des
 * commissions). Le lien est cliqué par l'INFLUENCEUSE, pas par un admin
 * connecté — on ne peut donc pas s'appuyer sur une session admin. On rafraîchit
 * le statut du compte via une mutation gardée par `CONVEX_WEBHOOK_SECRET`
 * (`affiliates.applyConnectStatus`), puis on affiche une page de confirmation.
 *
 * L'`influencerId` provient du `return_url` qu'on a nous-mêmes construit à la
 * création du lien (cf. `adminStartInfluencerOnboardingAction`).
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const influencerId = url.searchParams.get('influencer');

  const page = (title: string, body: string) =>
    new NextResponse(
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title><style>body{font-family:system-ui,sans-serif;background:#faf7f2;color:#2a2320;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}main{max-width:32rem;text-align:center}h1{font-style:italic;font-weight:500}p{color:#6b625a;line-height:1.5}</style></head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`,
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );

  if (!influencerId) {
    return page(
      'Lien invalide',
      'Le lien d’onboarding est incomplet. Contactez l’équipe Wedillybird.',
    );
  }

  const webhookSecret = process.env.CONVEX_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return page('Configuration manquante', 'Réessayez plus tard.');
  }

  try {
    const convex = getConvexServerClient();
    const influencer = await convex.query(convexApi.affiliateGetConnectForReturn, {
      webhookSecret,
      influencerId,
    });
    if (!influencer?.stripeConnectAccountId) {
      return page('Compte introuvable', 'Aucun compte de versement associé à ce lien.');
    }

    const st = await retrieveConnectedAccountStatus(influencer.stripeConnectAccountId);
    await convex.mutation(convexApi.affiliateApplyConnectStatus, {
      webhookSecret,
      influencerId,
      chargesEnabled: st.chargesEnabled,
      detailsSubmitted: st.detailsSubmitted,
      payoutsEnabled: st.payoutsEnabled,
    });

    return st.payoutsEnabled
      ? page(
          'Merci, tout est prêt ✨',
          'Votre compte de versement est configuré. Vos commissions Wedillybird vous seront versées automatiquement.',
        )
      : page(
          'Presque terminé',
          'Il manque encore quelques informations pour activer les versements. Rouvrez le lien reçu pour finaliser.',
        );
  } catch {
    return page('Une erreur est survenue', 'Réessayez dans quelques instants.');
  }
}
