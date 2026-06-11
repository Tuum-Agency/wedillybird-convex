'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import type { DocStatus, LineItem, QuoteDocType } from '@/lib/pro/quotes';

export type QuoteActionResult =
  | { ok: true; id?: string; number?: string }
  | { ok: false; error: string };

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'UNKNOWN';
}

interface DocPayload {
  type: QuoteDocType;
  clientId?: string;
  eventId?: string;
  lineItems: LineItem[];
  discountMinor?: number;
  taxRate?: number;
  schedule?: { label: string; amountMinor: number; dueDate?: number; paid: boolean }[];
  status?: DocStatus;
}

export async function createDocAction(
  organizationId: string,
  payload: DocPayload,
): Promise<QuoteActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    const r = await convex.mutation(convexApi.quotesCreate, {
      organizationId,
      requesterId: session.userId,
      type: payload.type,
      clientId: payload.clientId,
      eventId: payload.eventId,
      lineItems: payload.lineItems,
      discountMinor: payload.discountMinor,
      taxRate: payload.taxRate,
      schedule: payload.schedule,
      status: payload.status,
    });
    revalidatePath('/pro/quotes');
    return { ok: true, id: r.id, number: r.number };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function updateDocAction(
  docId: string,
  payload: DocPayload,
): Promise<QuoteActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.quotesUpdate, {
      docId,
      requesterId: session.userId,
      clientId: payload.clientId,
      eventId: payload.eventId,
      lineItems: payload.lineItems,
      discountMinor: payload.discountMinor,
      taxRate: payload.taxRate,
      schedule: payload.schedule,
    });
    if (payload.status) {
      await convex.mutation(convexApi.quotesUpdateStatus, {
        docId,
        requesterId: session.userId,
        status: payload.status,
      });
    }
    revalidatePath('/pro/quotes');
    return { ok: true, id: docId };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function updateStatusAction(
  docId: string,
  status: DocStatus,
): Promise<QuoteActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.quotesUpdateStatus, {
      docId,
      requesterId: session.userId,
      status,
    });
    revalidatePath('/pro/quotes');
    return { ok: true, id: docId };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function recordPaymentAction(
  docId: string,
  index: number,
): Promise<QuoteActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.quotesRecordSchedulePayment, {
      docId,
      requesterId: session.userId,
      index,
    });
    revalidatePath('/pro/quotes');
    return { ok: true, id: docId };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function convertDocAction(docId: string): Promise<QuoteActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    const r = await convex.mutation(convexApi.quotesConvertToInvoice, {
      docId,
      requesterId: session.userId,
    });
    revalidatePath('/pro/quotes');
    return { ok: true, id: r.id, number: r.number };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function removeDocAction(docId: string): Promise<QuoteActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.quotesRemove, { docId, requesterId: session.userId });
    revalidatePath('/pro/quotes');
    return { ok: true, id: docId };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
