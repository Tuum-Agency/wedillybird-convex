/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, afterEach, vi } from 'vitest';
import {
  requireUserIdCompat,
  optionalUserIdCompat,
  requireAdminCompat,
} from '../../../convex/lib/verifiedSession';

/**
 * Fenêtre de compatibilité `requesterId` ⇄ `sessionToken` (bascule prod).
 *
 * Ce repli est du code transitoire qui ré-autorise temporairement une identité
 * auto-déclarée : c'est exactement le motif que l'audit a fermé. Les tests
 * ci-dessous verrouillent les invariants qui empêchent la fenêtre de devenir
 * un contournement permanent — en particulier le fait qu'un jeton INVALIDE ne
 * retombe JAMAIS sur `requesterId` (sinon il suffirait d'envoyer un jeton bidon
 * avec l'id de sa cible pour usurper son identité, fenêtre ouverte).
 */

const VALID_TOKEN = 'jeton-valide';

function buildCtx(opts: { session?: { userId: string } | null; role?: string } = {}) {
  const { session = null, role } = opts;
  return {
    db: {
      query: (table: string) => {
        if (table !== 'authSessions') throw new Error(`Unexpected query on table=${table}`);
        return {
          withIndex: () => ({
            first: async () =>
              session
                ? {
                    _id: 'authsession_1',
                    tokenHash: 'hash',
                    userId: session.userId,
                    kind: 'server',
                    createdAt: Date.now() - 1000,
                    expiresAt: Date.now() + 3_600_000,
                  }
                : null,
          }),
        };
      },
      get: async (id: string) => (role ? { _id: id, role } : null),
    },
  } as any;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('requireUserIdCompat — fenêtre FERMÉE (défaut, et état final)', () => {
  it("ignore requesterId : sans variable d'environnement, une identité auto-déclarée est refusée", async () => {
    await expect(requireUserIdCompat(buildCtx(), { requesterId: 'user_1' as any })).rejects.toThrow(
      'UNAUTHENTICATED',
    );
  });

  it('accepte toujours un sessionToken valide', async () => {
    const ctx = buildCtx({ session: { userId: 'user_1' } });
    await expect(requireUserIdCompat(ctx, { sessionToken: VALID_TOKEN })).resolves.toBe('user_1');
  });
});

describe('requireUserIdCompat — fenêtre OUVERTE', () => {
  it('accepte requesterId en dernier recours (c’est la raison d’être de la fenêtre)', async () => {
    vi.stubEnv('LEGACY_IDENTITY_WINDOW', '1');
    await expect(requireUserIdCompat(buildCtx(), { requesterId: 'user_1' as any })).resolves.toBe(
      'user_1',
    );
  });

  it('un jeton VALIDE prime sur un requesterId contradictoire (pas d’usurpation par ajout d’argument)', async () => {
    vi.stubEnv('LEGACY_IDENTITY_WINDOW', '1');
    const ctx = buildCtx({ session: { userId: 'user_legitime' } });
    await expect(
      requireUserIdCompat(ctx, {
        sessionToken: VALID_TOKEN,
        requesterId: 'user_victime' as any,
      }),
    ).resolves.toBe('user_legitime');
  });

  it('INVARIANT CRITIQUE : un jeton INVALIDE ne retombe pas sur requesterId', async () => {
    vi.stubEnv('LEGACY_IDENTITY_WINDOW', '1');
    // Session introuvable → jeton rejeté. Si le repli s'appliquait ici, envoyer
    // un jeton bidon accompagné de l'id d'autrui suffirait à se faire passer
    // pour lui pendant toute la fenêtre.
    const ctx = buildCtx({ session: null });
    await expect(
      requireUserIdCompat(ctx, {
        sessionToken: 'jeton-forge',
        requesterId: 'user_victime' as any,
      }),
    ).rejects.toThrow('UNAUTHENTICATED');
  });

  it('refuse aussi quand aucune identité n’est fournie', async () => {
    vi.stubEnv('LEGACY_IDENTITY_WINDOW', '1');
    await expect(requireUserIdCompat(buildCtx(), {})).rejects.toThrow('UNAUTHENTICATED');
  });
});

describe('optionalUserIdCompat — surfaces mixtes invité/connecté', () => {
  it('renvoie null (anonyme) au lieu de throw, fenêtre fermée', async () => {
    await expect(
      optionalUserIdCompat(buildCtx(), { requesterId: 'user_1' as any }),
    ).resolves.toBeNull();
  });

  it('renvoie null pour un jeton invalide plutôt que de retomber sur requesterId', async () => {
    vi.stubEnv('LEGACY_IDENTITY_WINDOW', '1');
    const ctx = buildCtx({ session: null });
    await expect(
      optionalUserIdCompat(ctx, { sessionToken: 'jeton-forge', requesterId: 'user_1' as any }),
    ).resolves.toBeNull();
  });
});

describe('requireAdminCompat — le rôle reste vérifié en base', () => {
  it('refuse FORBIDDEN si l’id hérité ne correspond pas à un admin', async () => {
    vi.stubEnv('LEGACY_IDENTITY_WINDOW', '1');
    // Chemin hérité : même en acceptant l'id auto-déclaré, le rôle est relu en
    // base — c'est précisément ce contrôle qui manquait avant l'audit.
    const ctx = buildCtx({ role: 'couple' });
    await expect(requireAdminCompat(ctx, { adminId: 'user_1' as any })).rejects.toThrow(
      'FORBIDDEN',
    );
  });

  it('accepte un admin authentifié par jeton', async () => {
    const ctx = buildCtx({ session: { userId: 'user_admin' }, role: 'admin' });
    await expect(requireAdminCompat(ctx, { sessionToken: VALID_TOKEN })).resolves.toMatchObject({
      role: 'admin',
    });
  });
});
