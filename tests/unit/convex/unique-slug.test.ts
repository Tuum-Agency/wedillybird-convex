import { describe, expect, it, vi } from 'vitest';
import { pickUniqueSlug } from '../../../convex/lib/uniqueSlug';

/**
 * Mock minimal d'un MutationCtx Convex juste assez pour piloter le helper.
 * On simule la chaîne `ctx.db.query(table).withIndex(name, fn).first()` en
 * gardant un Set de slugs déjà pris.
 */
function makeCtx(takenSlugs: Iterable<string>): {
  ctx: { db: unknown };
  taken: Set<string>;
} {
  const taken = new Set(takenSlugs);
  let lastCandidate = '';
  const builder = {
    withIndex(_name: string, fn: (q: { eq: (k: string, v: string) => unknown }) => unknown) {
      const eqFn = (_k: string, v: string) => {
        lastCandidate = v;
        return {};
      };
      // Trigger the callback so the candidate is captured.
      fn({ eq: eqFn });
      return {
        first: async () => (taken.has(lastCandidate) ? { _id: 'fake' } : null),
      };
    },
  };
  const ctx = {
    db: {
      query: () => builder,
    },
  };
  return { ctx, taken };
}

describe('pickUniqueSlug', () => {
  it('returns the base slug when free', async () => {
    const { ctx } = makeCtx([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slug = await pickUniqueSlug(ctx as any, 'events', 'by_slug', 'slug', 'alice-bob');
    expect(slug).toBe('alice-bob');
  });

  it('falls back to a suffixed slug when base is taken', async () => {
    const { ctx } = makeCtx(['alice-bob']);
    // Patch Math.random for determinism.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slug = await pickUniqueSlug(ctx as any, 'events', 'by_slug', 'slug', 'alice-bob');
    expect(slug).not.toBe('alice-bob');
    expect(slug).toMatch(/^alice-bob-[a-z0-9]{1,4}$/);
    vi.restoreAllMocks();
  });

  it('throws SLUG_GENERATION_FAILED after maxAttempts', async () => {
    // Spy on Math.random so the suffix is always the same → always taken.
    vi.spyOn(Math, 'random').mockReturnValue(0.123456);
    const fixedSuffix = (0.123456).toString(36).slice(2, 6);
    const taken = new Set<string>(['alice-bob', `alice-bob-${fixedSuffix}`]);
    const { ctx } = makeCtx(taken);

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pickUniqueSlug(ctx as any, 'events', 'by_slug', 'slug', 'alice-bob', 3),
    ).rejects.toThrow('SLUG_GENERATION_FAILED');

    vi.restoreAllMocks();
  });
});
