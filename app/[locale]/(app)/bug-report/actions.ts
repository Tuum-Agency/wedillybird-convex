'use server';

import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

export type BugReportInput = {
  url: string;
  pathname: string;
  description: string;
  userAgent?: string;
  viewport?: string;
  locale?: string;
  /** data URL image compressée (≤ ~600 Ko) ou absente. */
  screenshot?: string;
  consoleErrors?: string[];
};

export type BugReportResult = { ok: true } | { ok: false; error: string };

/**
 * Enregistre un rapport de bug. L'auteur (session) est attaché quand présent
 * mais n'est pas requis — le formulaire vit dans l'espace authentifié, mais on
 * ne bloque jamais un signalement. La capture est déjà compressée côté client.
 */
export async function submitBugReportAction(input: BugReportInput): Promise<BugReportResult> {
  const description = input.description?.trim() ?? '';
  if (description.length < 3) return { ok: false, error: 'DESCRIPTION_TOO_SHORT' };

  const session = await getSession();
  try {
    await getConvexServerClient().mutation(convexApi.submitBugReport, {
      reporterId: session?.userId,
      url: input.url.slice(0, 2000),
      pathname: input.pathname.slice(0, 500),
      description,
      userAgent: input.userAgent?.slice(0, 500),
      viewport: input.viewport?.slice(0, 40),
      locale: input.locale?.slice(0, 12),
      screenshot: input.screenshot,
      consoleErrors: input.consoleErrors?.slice(0, 20),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'SUBMIT_FAILED' };
  }
}
