'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient, sessionTokenArg } from '@/lib/auth/convex-server';

export type VendorActionResult = { ok: true; id?: string } | { ok: false; error: string };

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function num(fd: FormData, key: string): number | undefined {
  const s = str(fd, key);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'UNKNOWN';
}

export async function createVendorAction(formData: FormData): Promise<VendorActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  const sessionToken = await sessionTokenArg();
  const org = await convex.query(convexApi.myOrganization, { sessionToken });
  if (!org) return { ok: false, error: 'NO_ORG' };
  const name = str(formData, 'name');
  if (!name) return { ok: false, error: 'INVALID_NAME' };
  try {
    const r = await convex.mutation(convexApi.createVendor, {
      organizationId: org._id,
      sessionToken,
      name,
      category: str(formData, 'category') ?? 'Autre',
      location: str(formData, 'location'),
      phone: str(formData, 'phone'),
      email: str(formData, 'email'),
      whatsapp: str(formData, 'whatsapp'),
      website: str(formData, 'website'),
      priceRange: num(formData, 'priceRange'),
      rating: num(formData, 'rating'),
      notes: str(formData, 'notes'),
    });
    revalidatePath('/pro/vendors');
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function updateVendorAction(
  vendorId: string,
  formData: FormData,
): Promise<VendorActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const name = str(formData, 'name');
  if (!name) return { ok: false, error: 'INVALID_NAME' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.updateVendor, {
      vendorId,
      sessionToken: await sessionTokenArg(),
      name,
      category: str(formData, 'category') ?? 'Autre',
      location: str(formData, 'location') ?? '',
      phone: str(formData, 'phone') ?? '',
      email: str(formData, 'email') ?? '',
      whatsapp: str(formData, 'whatsapp') ?? '',
      website: str(formData, 'website') ?? '',
      priceRange: num(formData, 'priceRange') ?? 0,
      rating: num(formData, 'rating') ?? 0,
      notes: str(formData, 'notes') ?? '',
    });
    revalidatePath('/pro/vendors');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function removeVendorAction(vendorId: string): Promise<VendorActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.removeVendor, {
      vendorId,
      sessionToken: await sessionTokenArg(),
    });
    revalidatePath('/pro/vendors');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/* ---- Engagements « Par mariage » ---- */

type EngStatus = 'contacted' | 'quoted' | 'booked' | 'confirmed';

export async function attachVendorAction(input: {
  vendorId: string;
  eventId: string;
  status: EngStatus;
  plannedMinor?: number;
  createBudgetLine?: boolean;
}): Promise<VendorActionResult & { budgetLineCreated?: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  const sessionToken = await sessionTokenArg();
  const org = await convex.query(convexApi.myOrganization, { sessionToken });
  if (!org) return { ok: false, error: 'NO_ORG' };
  try {
    const r = await convex.mutation(convexApi.vendorAttach, {
      organizationId: org._id,
      sessionToken,
      vendorId: input.vendorId,
      eventId: input.eventId,
      status: input.status,
      plannedMinor: input.plannedMinor,
      createBudgetLine: input.createBudgetLine,
    });
    revalidatePath('/pro/vendors');
    return { ok: true, id: r.id, budgetLineCreated: r.budgetLineCreated };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function setEngagementStatusAction(
  engagementId: string,
  status: EngStatus,
): Promise<VendorActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.vendorSetEngagementStatus, {
      engagementId,
      sessionToken: await sessionTokenArg(),
      status,
    });
    revalidatePath('/pro/vendors');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function detachVendorAction(engagementId: string): Promise<VendorActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.vendorDetach, {
      engagementId,
      sessionToken: await sessionTokenArg(),
    });
    revalidatePath('/pro/vendors');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
