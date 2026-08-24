import { NextResponse } from 'next/server';
import { convexSessionToken } from '@/lib/auth/convex-server';

/**
 * Jeton de session Convex pour le navigateur.
 *
 * Les composants clients appellent Convex en direct (`useQuery`/`useMutation`
 * via `NEXT_PUBLIC_CONVEX_URL`) : ils doivent donc porter une preuve
 * d'identité. Le cookie de session est `httpOnly` — volontairement illisible
 * par le JS — d'où ce point d'entrée, qui échange le cookie vérifié contre un
 * jeton `kind: 'client'` à TTL court (1 h côté Convex).
 *
 * Ce jeton n'authentifie QUE Convex : il ne vaut pas cookie et ne permet pas
 * d'appeler les routes Next authentifiées. Un vol par XSS reste borné par le
 * TTL et par la révocation (`authSessions.revokeAllForUser`).
 *
 * Pas de garde CSRF nécessaire : requête GET sans effet de bord, et la réponse
 * d'une origine tierce est bloquée par la politique CORS du navigateur.
 */

export const runtime = 'nodejs';
// Un jeton par session : jamais mis en cache par un intermédiaire.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { sessionToken } = await convexSessionToken('client');
    return NextResponse.json(
      { sessionToken },
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  } catch {
    // Session absente, expirée ou révoquée : le client repassera par la
    // connexion. On ne distingue pas les cas (pas d'oracle d'énumération).
    return NextResponse.json(
      { error: 'UNAUTHENTICATED' },
      { status: 401, headers: { 'Cache-Control': 'no-store, private' } },
    );
  }
}
