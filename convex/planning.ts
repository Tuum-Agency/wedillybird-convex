import { v } from 'convex/values';
import { mutation, query, type MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { assertOrgRead, assertOrgWrite } from './lib/orgAuth';

/**
 * Rétroplanning — back-office agence (tous tiers). Tâches par phase rattachées à
 * un mariage (`events`) + son organisation (dénormalisée pour l'autorisation).
 */

const PHASE = v.union(
  v.literal('m12'),
  v.literal('m6'),
  v.literal('m3'),
  v.literal('m1'),
  v.literal('d7'),
  v.literal('dday'),
  v.literal('after'),
);

const PRIORITY = v.union(v.literal('low'), v.literal('normal'), v.literal('high'));
const STATUS = v.union(v.literal('todo'), v.literal('doing'), v.literal('done'));

async function loadTaskForWrite(
  ctx: MutationCtx,
  taskId: Id<'planningTasks'>,
  requesterId: Id<'users'>,
) {
  const task = await ctx.db.get(taskId);
  if (!task) throw new Error('NOT_FOUND');
  await assertOrgWrite(ctx, task.organizationId, requesterId);
  return task;
}

export const listByEvent = query({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    const event = await ctx.db.get(eventId);
    if (!event || !event.organizationId) return null;
    await assertOrgRead(ctx, event.organizationId, requesterId);
    const tasks = await ctx.db
      .query('planningTasks')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    return {
      eventId: event._id,
      coupleNames: event.coupleNames,
      eventDate: event.eventDate,
      tasks: tasks
        .map((t) => ({
          _id: t._id,
          phase: t.phase,
          title: t.title,
          done: t.done,
          // Statut tri-état : explicite si présent, sinon dérivé de `done`.
          status: t.status ?? (t.done ? ('done' as const) : ('todo' as const)),
          notes: t.notes,
          subtasks: t.subtasks ?? [],
          dueDate: t.dueDate,
          assigneeId: t.assigneeId,
          priority: t.priority,
          order: t.order,
        }))
        .sort((a, b) => a.order - b.order),
    };
  },
});

export const createTask = mutation({
  args: {
    eventId: v.id('events'),
    requesterId: v.id('users'),
    phase: PHASE,
    title: v.string(),
    dueDate: v.optional(v.number()),
    assigneeId: v.optional(v.id('users')),
    priority: v.optional(PRIORITY),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || !event.organizationId) throw new Error('NOT_AN_ORG_EVENT');
    await assertOrgWrite(ctx, event.organizationId, args.requesterId);
    const title = args.title.trim();
    if (title.length < 1 || title.length > 200) throw new Error('INVALID_TITLE');
    const now = Date.now();
    const id = await ctx.db.insert('planningTasks', {
      eventId: args.eventId,
      organizationId: event.organizationId,
      phase: args.phase,
      title,
      done: false,
      ...(args.dueDate ? { dueDate: args.dueDate } : {}),
      ...(args.assigneeId ? { assigneeId: args.assigneeId } : {}),
      ...(args.priority ? { priority: args.priority } : {}),
      order: now,
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  },
});

/** Insertion en masse (application d'un modèle). */
export const createTasks = mutation({
  args: {
    eventId: v.id('events'),
    requesterId: v.id('users'),
    tasks: v.array(v.object({ phase: PHASE, title: v.string() })),
  },
  handler: async (ctx, { eventId, requesterId, tasks }) => {
    const event = await ctx.db.get(eventId);
    if (!event || !event.organizationId) throw new Error('NOT_AN_ORG_EVENT');
    await assertOrgWrite(ctx, event.organizationId, requesterId);
    const now = Date.now();
    let i = 0;
    for (const t of tasks) {
      const title = t.title.trim();
      if (!title) continue;
      await ctx.db.insert('planningTasks', {
        eventId,
        organizationId: event.organizationId,
        phase: t.phase,
        title,
        done: false,
        order: now + i,
        createdAt: now,
        updatedAt: now,
      });
      i += 1;
    }
    return { created: i };
  },
});

export const toggleTask = mutation({
  args: { taskId: v.id('planningTasks'), requesterId: v.id('users'), done: v.boolean() },
  handler: async (ctx, { taskId, requesterId, done }) => {
    await loadTaskForWrite(ctx, taskId, requesterId);
    // Garde `status` cohérent avec `done` (coché ⇒ done, décoché ⇒ todo).
    await ctx.db.patch(taskId, { done, status: done ? 'done' : 'todo', updatedAt: Date.now() });
    return { ok: true as const };
  },
});

/** Remplace la checklist de sous-tâches d'une tâche. */
export const setSubtasks = mutation({
  args: {
    taskId: v.id('planningTasks'),
    requesterId: v.id('users'),
    subtasks: v.array(v.object({ label: v.string(), done: v.boolean() })),
  },
  handler: async (ctx, { taskId, requesterId, subtasks }) => {
    await loadTaskForWrite(ctx, taskId, requesterId);
    const cleaned = subtasks
      .map((s) => ({ label: s.label.trim().slice(0, 200), done: s.done }))
      .filter((s) => s.label.length > 0)
      .slice(0, 30);
    await ctx.db.patch(taskId, { subtasks: cleaned, updatedAt: Date.now() });
    return { ok: true as const };
  },
});

/** Change le statut tri-état (vue Tableau) et synchronise `done`. */
export const setTaskStatus = mutation({
  args: { taskId: v.id('planningTasks'), requesterId: v.id('users'), status: STATUS },
  handler: async (ctx, { taskId, requesterId, status }) => {
    await loadTaskForWrite(ctx, taskId, requesterId);
    await ctx.db.patch(taskId, { status, done: status === 'done', updatedAt: Date.now() });
    return { ok: true as const };
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id('planningTasks'),
    requesterId: v.id('users'),
    title: v.optional(v.string()),
    phase: v.optional(PHASE),
    notes: v.optional(v.string()),
    clearNotes: v.optional(v.boolean()),
    dueDate: v.optional(v.number()),
    clearDueDate: v.optional(v.boolean()),
    assigneeId: v.optional(v.id('users')),
    clearAssignee: v.optional(v.boolean()),
    priority: v.optional(PRIORITY),
  },
  handler: async (ctx, args) => {
    await loadTaskForWrite(ctx, args.taskId, args.requesterId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (!t) throw new Error('INVALID_TITLE');
      patch.title = t;
    }
    if (args.phase !== undefined) patch.phase = args.phase;
    if (args.clearNotes) patch.notes = undefined;
    else if (args.notes !== undefined) patch.notes = args.notes.trim().slice(0, 2000) || undefined;
    if (args.clearDueDate) patch.dueDate = undefined;
    else if (args.dueDate !== undefined) patch.dueDate = args.dueDate;
    if (args.clearAssignee) patch.assigneeId = undefined;
    else if (args.assigneeId !== undefined) patch.assigneeId = args.assigneeId;
    if (args.priority !== undefined) patch.priority = args.priority;
    await ctx.db.patch(args.taskId, patch);
    return { ok: true as const };
  },
});

export const removeTask = mutation({
  args: { taskId: v.id('planningTasks'), requesterId: v.id('users') },
  handler: async (ctx, { taskId, requesterId }) => {
    await loadTaskForWrite(ctx, taskId, requesterId);
    await ctx.db.delete(taskId);
    return { ok: true as const };
  },
});

/* -------------------------------------------------------------------------- */
/*  Modèles de rétroplanning personnalisés (org-level)                        */
/* -------------------------------------------------------------------------- */

/** Plafond de modèles maison par organisation. */
const TEMPLATE_LIMIT = 20;

/** Liste les modèles personnalisés d'une organisation (ordre alpha). */
export const listTemplates = query({
  args: { organizationId: v.id('organizations'), requesterId: v.id('users') },
  handler: async (ctx, { organizationId, requesterId }) => {
    await assertOrgRead(ctx, organizationId, requesterId);
    const templates = await ctx.db
      .query('planningTemplates')
      .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
      .collect();
    return templates
      .map((t) => ({
        _id: t._id,
        name: t.name,
        tasks: t.tasks.map((task) => ({ phase: task.phase, title: task.title })),
        createdAt: t.createdAt,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  },
});

/**
 * Enregistre le rétroplanning courant d'un mariage comme modèle réutilisable
 * (instantané des tâches : phase + titre, sans dates ni statuts).
 */
export const saveTemplateFromEvent = mutation({
  args: { eventId: v.id('events'), requesterId: v.id('users'), name: v.string() },
  handler: async (ctx, { eventId, requesterId, name }) => {
    const event = await ctx.db.get(eventId);
    if (!event || !event.organizationId) throw new Error('NOT_AN_ORG_EVENT');
    await assertOrgWrite(ctx, event.organizationId, requesterId);

    const cleanName = name.trim();
    if (cleanName.length < 1 || cleanName.length > 80) throw new Error('INVALID_NAME');

    const existing = await ctx.db
      .query('planningTemplates')
      .withIndex('by_organization', (q) => q.eq('organizationId', event.organizationId!))
      .collect();
    if (existing.length >= TEMPLATE_LIMIT) throw new Error('TEMPLATE_LIMIT_REACHED');

    const tasks = await ctx.db
      .query('planningTasks')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    const snapshot = tasks
      .sort((a, b) => a.order - b.order)
      .map((t) => ({ phase: t.phase, title: t.title }));
    if (snapshot.length === 0) throw new Error('EMPTY_PLANNING');

    const now = Date.now();
    const id = await ctx.db.insert('planningTemplates', {
      organizationId: event.organizationId,
      name: cleanName,
      tasks: snapshot,
      createdBy: requesterId,
      createdAt: now,
      updatedAt: now,
    });
    return { id, count: snapshot.length };
  },
});

/** Applique un modèle personnalisé à un mariage (insertion en masse des tâches). */
export const applyTemplate = mutation({
  args: {
    eventId: v.id('events'),
    requesterId: v.id('users'),
    templateId: v.id('planningTemplates'),
  },
  handler: async (ctx, { eventId, requesterId, templateId }) => {
    const event = await ctx.db.get(eventId);
    if (!event || !event.organizationId) throw new Error('NOT_AN_ORG_EVENT');
    await assertOrgWrite(ctx, event.organizationId, requesterId);

    const template = await ctx.db.get(templateId);
    if (!template) throw new Error('TEMPLATE_NOT_FOUND');
    // Cloisonnement multi-tenant : le modèle doit appartenir à la même organisation.
    if (template.organizationId !== event.organizationId) throw new Error('FORBIDDEN');

    const now = Date.now();
    let i = 0;
    for (const t of template.tasks) {
      const title = t.title.trim();
      if (!title) continue;
      await ctx.db.insert('planningTasks', {
        eventId,
        organizationId: event.organizationId,
        phase: t.phase,
        title,
        done: false,
        order: now + i,
        createdAt: now,
        updatedAt: now,
      });
      i += 1;
    }
    return { created: i };
  },
});

/** Supprime un modèle personnalisé. */
export const deleteTemplate = mutation({
  args: { templateId: v.id('planningTemplates'), requesterId: v.id('users') },
  handler: async (ctx, { templateId, requesterId }) => {
    const template = await ctx.db.get(templateId);
    if (!template) throw new Error('TEMPLATE_NOT_FOUND');
    await assertOrgWrite(ctx, template.organizationId, requesterId);
    await ctx.db.delete(templateId);
    return { ok: true as const };
  },
});
