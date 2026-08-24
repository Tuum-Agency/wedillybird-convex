import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { IDENTITY_ARGS, optionalUserIdCompat, requireAdminCompat } from './lib/verifiedSession';

/** Capture ≤ 800 Ko (data URL) — au-delà on la jette plutôt que de gonfler le doc. */
const MAX_SCREENSHOT_CHARS = 800 * 1024;
const MAX_DESC = 4000;
const MAX_ERRORS = 20;

/**
 * Enregistre un rapport de bug (bouton flottant de l'app). Best-effort côté
 * capture : si la capture dépasse la limite, on l'ignore mais on garde le
 * texte + le contexte. Idempotence non requise (un rapport = une soumission).
 */
export const submitBugReport = mutation({
  args: {
    // Optionnel : le bouton de report est présent sur les pages publiques
    // (invitation invité), où l'auteur n'est pas connecté. Session absente ou
    // invalide → rapport anonyme, jamais un refus.
    ...IDENTITY_ARGS,
    url: v.string(),
    pathname: v.string(),
    description: v.string(),
    userAgent: v.optional(v.string()),
    viewport: v.optional(v.string()),
    locale: v.optional(v.string()),
    screenshot: v.optional(v.string()),
    consoleErrors: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const reporterId = (await optionalUserIdCompat(ctx, args)) ?? undefined;
    const description = args.description.trim().slice(0, MAX_DESC);
    if (description.length < 3) throw new Error('DESCRIPTION_TOO_SHORT');

    const screenshot =
      args.screenshot && args.screenshot.length <= MAX_SCREENSHOT_CHARS
        ? args.screenshot
        : undefined;

    const consoleErrors = args.consoleErrors?.slice(0, MAX_ERRORS).map((e) => e.slice(0, 500));

    const id = await ctx.db.insert('bugReports', {
      reporterId,
      url: args.url.slice(0, 2000),
      pathname: args.pathname.slice(0, 500),
      description,
      userAgent: args.userAgent?.slice(0, 500),
      viewport: args.viewport?.slice(0, 40),
      locale: args.locale?.slice(0, 12),
      screenshot,
      consoleErrors: consoleErrors && consoleErrors.length > 0 ? consoleErrors : undefined,
      status: 'open',
      createdAt: Date.now(),
    });
    return { id };
  },
});

/** Liste des rapports (admin) — récents d'abord, capture exclue du payload. */
export const listBugReports = query({
  args: {
    ...IDENTITY_ARGS,
    status: v.optional(v.union(v.literal('open'), v.literal('triaged'), v.literal('resolved'))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminCompat(ctx, args);
    const limit = Math.min(args.limit ?? 100, 300);
    const rows = args.status
      ? await ctx.db
          .query('bugReports')
          .withIndex('by_status', (q) => q.eq('status', args.status!))
          .order('desc')
          .take(limit)
      : await ctx.db.query('bugReports').withIndex('by_created').order('desc').take(limit);
    // On expose un flag `hasScreenshot` mais pas la data URL (payload lourd) —
    // la capture se récupère via `getBugReport`.
    return rows.map(({ screenshot, ...r }) => ({ ...r, hasScreenshot: !!screenshot }));
  },
});

/** Détail d'un rapport (admin) — inclut la capture. */
export const getBugReport = query({
  args: { ...IDENTITY_ARGS, reportId: v.id('bugReports') },
  handler: async (ctx, args) => {
    await requireAdminCompat(ctx, args);
    return await ctx.db.get(args.reportId);
  },
});

/** Change le statut d'un rapport (admin). */
export const updateBugReportStatus = mutation({
  args: {
    ...IDENTITY_ARGS,
    reportId: v.id('bugReports'),
    status: v.union(v.literal('open'), v.literal('triaged'), v.literal('resolved')),
  },
  handler: async (ctx, args) => {
    await requireAdminCompat(ctx, args);
    await ctx.db.patch(args.reportId, { status: args.status });
    return null;
  },
});
