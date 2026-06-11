'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import {
  isPlanningPhase,
  PLANNING_TEMPLATES,
  isTemplateKey,
  type PlanningPhase,
} from '@/lib/pro/planning';

export type PlanningActionResult =
  | { ok: true; id?: string; created?: number }
  | { ok: false; error: string };

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function dateMs(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : undefined;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'UNKNOWN';
}

export async function createTaskAction(
  eventId: string,
  formData: FormData,
): Promise<PlanningActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const title = str(formData, 'title');
  if (!title) return { ok: false, error: 'INVALID_TITLE' };
  const phaseRaw = str(formData, 'phase');
  const phase: PlanningPhase = isPlanningPhase(phaseRaw) ? phaseRaw : 'm3';
  const convex = getConvexServerClient();
  try {
    const r = await convex.mutation(convexApi.createPlanningTask, {
      eventId,
      requesterId: session.userId,
      phase,
      title,
      dueDate: dateMs(str(formData, 'dueDate')),
    });
    revalidatePath('/pro/planning');
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function updateTaskAction(
  taskId: string,
  formData: FormData,
): Promise<PlanningActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const title = str(formData, 'title');
  if (!title) return { ok: false, error: 'INVALID_TITLE' };
  const phaseRaw = str(formData, 'phase');
  const phase: PlanningPhase = isPlanningPhase(phaseRaw) ? phaseRaw : 'm3';
  const dueRaw = str(formData, 'dueDate');
  const due = dateMs(dueRaw);
  const priorityRaw = str(formData, 'priority');
  const priority =
    priorityRaw === 'low' || priorityRaw === 'normal' || priorityRaw === 'high'
      ? priorityRaw
      : undefined;
  const assigneeId = str(formData, 'assigneeId');
  const notes = str(formData, 'notes');
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.updatePlanningTask, {
      taskId,
      requesterId: session.userId,
      title,
      phase,
      ...(due !== undefined ? { dueDate: due } : { clearDueDate: true }),
      ...(priority ? { priority } : {}),
      ...(assigneeId ? { assigneeId } : { clearAssignee: true }),
      ...(notes ? { notes } : { clearNotes: true }),
    });
    revalidatePath('/pro/planning');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function setSubtasksAction(
  taskId: string,
  subtasks: Array<{ label: string; done: boolean }>,
): Promise<PlanningActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.setPlanningSubtasks, {
      taskId,
      requesterId: session.userId,
      subtasks: subtasks.map((s) => ({ label: String(s.label), done: !!s.done })),
    });
    revalidatePath('/pro/planning');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function toggleTaskAction(
  taskId: string,
  done: boolean,
): Promise<PlanningActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.togglePlanningTask, {
      taskId,
      requesterId: session.userId,
      done,
    });
    revalidatePath('/pro/planning');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function setTaskStatusAction(
  taskId: string,
  status: 'todo' | 'doing' | 'done',
): Promise<PlanningActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.setPlanningTaskStatus, {
      taskId,
      requesterId: session.userId,
      status,
    });
    revalidatePath('/pro/planning');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function removeTaskAction(taskId: string): Promise<PlanningActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.removePlanningTask, { taskId, requesterId: session.userId });
    revalidatePath('/pro/planning');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function applyTemplateAction(
  eventId: string,
  templateKey: string,
): Promise<PlanningActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  if (!isTemplateKey(templateKey)) return { ok: false, error: 'INVALID_TEMPLATE' };
  const convex = getConvexServerClient();
  try {
    const r = await convex.mutation(convexApi.createPlanningTasks, {
      eventId,
      requesterId: session.userId,
      tasks: PLANNING_TEMPLATES[templateKey].tasks.map((t) => ({ phase: t.phase, title: t.title })),
    });
    revalidatePath('/pro/planning');
    return { ok: true, created: r.created };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/* -------------------------------------------------------------------------- */
/*  Modèles personnalisés (org-level)                                         */
/* -------------------------------------------------------------------------- */

export type SaveTemplateResult =
  | { ok: true; id: string; count: number }
  | { ok: false; error: string };

/** Enregistre le rétroplanning courant comme modèle réutilisable. */
export async function saveTemplateAction(
  eventId: string,
  name: string,
): Promise<SaveTemplateResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: 'INVALID_NAME' };
  const convex = getConvexServerClient();
  try {
    const r = await convex.mutation(convexApi.planningSaveTemplateFromEvent, {
      eventId,
      requesterId: session.userId,
      name: cleanName,
    });
    revalidatePath('/pro/planning');
    return { ok: true, id: r.id, count: r.count };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Applique un modèle personnalisé (par id) au mariage courant. */
export async function applyCustomTemplateAction(
  eventId: string,
  templateId: string,
): Promise<PlanningActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    const r = await convex.mutation(convexApi.planningApplyTemplate, {
      eventId,
      requesterId: session.userId,
      templateId,
    });
    revalidatePath('/pro/planning');
    return { ok: true, created: r.created };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Supprime un modèle personnalisé. */
export async function deleteTemplateAction(templateId: string): Promise<PlanningActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.planningDeleteTemplate, {
      templateId,
      requesterId: session.userId,
    });
    revalidatePath('/pro/planning');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
