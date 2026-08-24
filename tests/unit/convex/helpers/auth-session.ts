/**
 * Aide de test pour les fonctions Convex migrées vers `sessionToken`.
 *
 * Depuis l'audit archi 2026-08-23, les fonctions publiques ne reçoivent plus un
 * `requesterId` : elles résolvent l'appelant via `requireUserId(ctx, sessionToken)`,
 * qui lit la table `authSessions`. Les mocks de `ctx.db.query` doivent donc
 * savoir répondre pour cette table, sinon les handlers throw
 * `Unexpected query on table=authSessions`.
 *
 * Le mock ignore le filtre d'index (on ne teste pas le hachage du jeton ici,
 * couvert séparément) : il renvoie simplement la session de `userId`.
 */

/** Jeton factice à passer aux handlers sous test. Sa valeur n'a pas d'importance. */
export const TEST_SESSION_TOKEN = 'test-session-token';

export interface MockAuthSession {
  _id: string;
  tokenHash: string;
  userId: string;
  kind: 'server' | 'client';
  createdAt: number;
  expiresAt: number;
  revokedAt?: number;
}

/**
 * Branche `authSessions` d'un mock `ctx.db.query`.
 *
 * @param userId identité que la session doit résoudre — passer l'id de
 *   l'« intrus » pour reproduire un accès non autorisé.
 * @param opts.revoked / opts.expired pour tester les rejets `UNAUTHENTICATED`.
 */
export function mockAuthSessionsQuery(
  userId: string,
  opts: { revoked?: boolean; expired?: boolean } = {},
) {
  const now = Date.now();
  const session: MockAuthSession = {
    _id: 'authsession_test',
    tokenHash: 'hash_test',
    userId,
    kind: 'server',
    createdAt: now - 1000,
    expiresAt: opts.expired ? now - 1 : now + 60 * 60 * 1000,
    ...(opts.revoked ? { revokedAt: now - 1 } : {}),
  };

  return {
    withIndex: (_indexName: string, _filter?: unknown) => ({
      first: async () => session,
      unique: async () => session,
      collect: async () => [session],
    }),
  };
}

/**
 * Enveloppe un `ctx.db.query` existant pour lui ajouter la branche
 * `authSessions`, sans toucher aux autres tables déjà mockées.
 *
 * ```ts
 * const query = withAuthSessions(baseQuery, 'user_1');
 * ```
 */
export function withAuthSessions<T extends (table: string) => unknown>(
  baseQuery: T,
  userId: string,
  opts: { revoked?: boolean; expired?: boolean } = {},
): (table: string) => unknown {
  return (table: string) => {
    if (table === 'authSessions') return mockAuthSessionsQuery(userId, opts);
    return baseQuery(table);
  };
}
