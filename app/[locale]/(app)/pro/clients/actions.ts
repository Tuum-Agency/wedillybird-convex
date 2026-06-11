'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { parseEurToMinor } from '@/lib/pro/format';
import { isClientStage, type ClientStage } from '@/lib/pro/clients';

export type ClientActionResult =
  | { ok: true; id?: string; eventId?: string }
  | { ok: false; error: string };

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'UNKNOWN';
}

function dateMs(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : undefined;
}

export async function createClientAction(formData: FormData): Promise<ClientActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org) return { ok: false, error: 'NO_ORG' };

  const partnerA = str(formData, 'partnerA');
  if (!partnerA) return { ok: false, error: 'INVALID_PARTNER_A' };
  const stageRaw = str(formData, 'stage');
  const stage = isClientStage(stageRaw) ? stageRaw : undefined;
  const budgetMinor = parseEurToMinor(str(formData, 'budgetEur')) ?? undefined;

  try {
    const r = await convex.mutation(convexApi.createClient, {
      organizationId: org._id,
      requesterId: session.userId,
      partnerA,
      partnerB: str(formData, 'partnerB'),
      phone: str(formData, 'phone'),
      email: str(formData, 'email'),
      whatsapp: str(formData, 'whatsapp'),
      stage,
      source: str(formData, 'source'),
      weddingDate: dateMs(str(formData, 'weddingDate')),
      venue: str(formData, 'venue'),
      budgetMinor,
      budgetBookedMinor: parseEurToMinor(str(formData, 'budgetBookedEur')) ?? undefined,
      assigneeId: str(formData, 'assigneeId'),
      notes: str(formData, 'notes'),
    });
    revalidatePath('/pro/clients');
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function updateClientAction(
  clientId: string,
  formData: FormData,
): Promise<ClientActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();

  const partnerA = str(formData, 'partnerA');
  if (!partnerA) return { ok: false, error: 'INVALID_PARTNER_A' };
  const stageRaw = str(formData, 'stage');
  const stage = isClientStage(stageRaw) ? stageRaw : undefined;
  const assigneeId = str(formData, 'assigneeId');

  try {
    await convex.mutation(convexApi.updateClient, {
      clientId,
      requesterId: session.userId,
      partnerA,
      partnerB: str(formData, 'partnerB') ?? '',
      phone: str(formData, 'phone') ?? '',
      email: str(formData, 'email') ?? '',
      whatsapp: str(formData, 'whatsapp') ?? '',
      stage,
      source: str(formData, 'source') ?? '',
      weddingDate: dateMs(str(formData, 'weddingDate')) ?? 0,
      venue: str(formData, 'venue') ?? '',
      budgetMinor: parseEurToMinor(str(formData, 'budgetEur')) ?? 0,
      budgetBookedMinor: parseEurToMinor(str(formData, 'budgetBookedEur')) ?? 0,
      ...(assigneeId ? { assigneeId } : { clearAssignee: true }),
      notes: str(formData, 'notes') ?? '',
    });
    revalidatePath('/pro/clients');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export type ClientNote = {
  _id: string;
  type: 'note' | 'status' | 'call' | 'email' | 'payment';
  text: string;
  authorName?: string;
  createdAt: number;
};

export async function getClientNotesAction(clientId: string): Promise<ClientNote[]> {
  const session = await getSession();
  if (!session) return [];
  const convex = getConvexServerClient();
  try {
    const notes = await convex.query(convexApi.clientNotesByClient, {
      clientId,
      requesterId: session.userId,
    });
    return notes ?? [];
  } catch {
    return [];
  }
}

export async function addClientNoteAction(
  clientId: string,
  text: string,
): Promise<ClientActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  if (!text.trim()) return { ok: false, error: 'INVALID_NOTE' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.addClientNote, {
      clientId,
      requesterId: session.userId,
      text: text.trim(),
    });
    revalidatePath('/pro/clients');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function updateClientStageAction(
  clientId: string,
  stage: ClientStage,
): Promise<ClientActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  if (!isClientStage(stage)) return { ok: false, error: 'INVALID_STAGE' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.updateClientStage, {
      clientId,
      requesterId: session.userId,
      stage,
    });
    revalidatePath('/pro/clients');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function removeClientAction(clientId: string): Promise<ClientActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.removeClient, { clientId, requesterId: session.userId });
    revalidatePath('/pro/clients');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function convertClientAction(clientId: string): Promise<ClientActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    const r = await convex.mutation(convexApi.convertClientToWedding, {
      clientId,
      requesterId: session.userId,
    });
    revalidatePath('/pro/clients');
    return { ok: true, eventId: r.eventId };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
