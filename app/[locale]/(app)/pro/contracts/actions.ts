'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient, sessionTokenArg } from '@/lib/auth/convex-server';
import type { ContractSection, ContractStatus } from '@/lib/pro/contracts';

export type ContractActionResult =
  | { ok: true; id?: string; number?: string; status?: ContractStatus }
  | { ok: false; error: string };

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'UNKNOWN';
}

export async function createContractAction(
  organizationId: string,
  payload: {
    clientId?: string;
    eventId?: string;
    quoteId?: string;
    totalMinor: number;
    sections: ContractSection[];
    jurisdiction?: string;
  },
): Promise<ContractActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    const r = await convex.mutation(convexApi.contractsCreate, {
      organizationId,
      sessionToken: await sessionTokenArg(),
      clientId: payload.clientId,
      eventId: payload.eventId,
      quoteId: payload.quoteId,
      totalMinor: payload.totalMinor,
      sections: payload.sections,
      jurisdiction: payload.jurisdiction,
    });
    revalidatePath('/pro/contracts');
    return { ok: true, id: r.id, number: r.number };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Met à jour les sections / le montant / la juridiction d'un contrat (éditeur). */
export async function updateContractAction(
  contractId: string,
  payload: { sections?: ContractSection[]; totalMinor?: number; jurisdiction?: string },
): Promise<ContractActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.contractsUpdate, {
      contractId,
      sessionToken: await sessionTokenArg(),
      sections: payload.sections,
      totalMinor: payload.totalMinor,
      jurisdiction: payload.jurisdiction,
    });
    revalidatePath('/pro/contracts');
    return { ok: true, id: contractId };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function advanceContractAction(contractId: string): Promise<ContractActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    const r = await convex.mutation(convexApi.contractsAdvance, {
      contractId,
      sessionToken: await sessionTokenArg(),
    });
    revalidatePath('/pro/contracts');
    return { ok: true, id: contractId, status: r.status };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function cancelContractAction(contractId: string): Promise<ContractActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.contractsSetStatus, {
      contractId,
      sessionToken: await sessionTokenArg(),
      status: 'cancelled',
    });
    revalidatePath('/pro/contracts');
    return { ok: true, id: contractId, status: 'cancelled' };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function removeContractAction(contractId: string): Promise<ContractActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.contractsRemove, {
      contractId,
      sessionToken: await sessionTokenArg(),
    });
    revalidatePath('/pro/contracts');
    return { ok: true, id: contractId };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
