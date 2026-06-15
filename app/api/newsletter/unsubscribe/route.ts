import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { verifyUnsubscribe } from '@/lib/email/unsubscribe-token';

/**
 * GET /api/newsletter/unsubscribe?email=<e>&token=<hmac>
 *
 * Lien one-click depuis les emails de campagne. Le token HMAC empêche de
 * désinscrire une adresse arbitraire. Rend une page HTML de confirmation
 * (pas de JSON — c'est cliqué dans un client mail).
 */

function page(title: string, message: string, status: number): Response {
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#FBF6EE;color:#2E250F;">
<div style="max-width:480px;margin:80px auto;padding:32px;background:#fff;border:1px solid #efe6d8;border-radius:16px;text-align:center;">
<p style="font-size:22px;font-style:italic;font-weight:600;color:#C68567;margin:0 0 12px;">Wedillybird</p>
<h1 style="font-size:18px;margin:0 0 8px;">${title}</h1>
<p style="font-size:14px;line-height:1.6;color:#7a6b50;margin:0;">${message}</p>
</div></body></html>`;
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const email = url.searchParams.get('email') ?? '';
  const token = url.searchParams.get('token') ?? '';

  if (!email || !token || !verifyUnsubscribe(email, token)) {
    return page('Lien invalide', 'Ce lien de désinscription est invalide ou a expiré.', 400);
  }

  try {
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.newsletterUnsubscribe, { email });
  } catch {
    return page(
      'Une erreur est survenue',
      'Impossible de traiter votre désinscription pour le moment. Réessayez plus tard.',
      502,
    );
  }

  return page(
    'Désinscription confirmée',
    'Vous ne recevrez plus la newsletter Wedillybird. Vous pouvez vous réinscrire à tout moment depuis notre site.',
    200,
  );
}
