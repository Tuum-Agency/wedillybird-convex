import { describe, expect, it } from 'vitest';
import {
  PLANNING_PHASES,
  PLANNING_STATUSES,
  PLANNING_TEMPLATES,
  groupByPhase,
  groupByStatus,
  dueInfo,
  nextStatus,
  overdueCount,
  isPlanningPhase,
  isTaskStatus,
  isTemplateKey,
  planningProgress,
  type TaskLike,
  type TaskStatus,
} from '../../../lib/pro/planning';

const tasks: TaskLike[] = [
  { phase: 'm12', done: true },
  { phase: 'm12', done: false },
  { phase: 'm3', done: true },
  { phase: 'dday', done: false },
];

describe('groupByPhase', () => {
  it('crée les 7 phases dans l’ordre (vides incluses par défaut)', () => {
    const cols = groupByPhase(tasks);
    expect(cols.map((c) => c.phase)).toEqual([...PLANNING_PHASES]);
    const m12 = cols.find((c) => c.phase === 'm12')!;
    expect(m12.total).toBe(2);
    expect(m12.done).toBe(1);
  });

  it('exclut les phases vides quand includeEmpty=false', () => {
    const cols = groupByPhase(tasks, false);
    expect(cols.map((c) => c.phase)).toEqual(['m12', 'm3', 'dday']);
  });
});

describe('planningProgress', () => {
  it('calcule done/total/pct', () => {
    expect(planningProgress(tasks)).toEqual({ done: 2, total: 4, pct: 50 });
  });
  it('liste vide → 0 % sans division par zéro', () => {
    expect(planningProgress([])).toEqual({ done: 0, total: 0, pct: 0 });
  });
});

describe('isPlanningPhase / isTemplateKey', () => {
  it('valide les phases connues', () => {
    expect(isPlanningPhase('dday')).toBe(true);
    expect(isPlanningPhase('xxx')).toBe(false);
  });
  it('valide les clés de modèle', () => {
    expect(isTemplateKey('classic')).toBe(true);
    expect(isTemplateKey('intimate')).toBe(true);
    expect(isTemplateKey('nope')).toBe(false);
  });
});

describe('modèles de rétroplanning', () => {
  it('contiennent des tâches avec des phases valides', () => {
    for (const key of Object.keys(PLANNING_TEMPLATES) as Array<keyof typeof PLANNING_TEMPLATES>) {
      const { tasks: tpl } = PLANNING_TEMPLATES[key];
      expect(tpl.length).toBeGreaterThan(5);
      for (const t of tpl) {
        expect(isPlanningPhase(t.phase)).toBe(true);
        expect(t.title.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('statut tri-état', () => {
  it('cycle À faire → En cours → Fait → À faire', () => {
    expect(nextStatus('todo')).toBe('doing');
    expect(nextStatus('doing')).toBe('done');
    expect(nextStatus('done')).toBe('todo');
  });
  it('isTaskStatus valide les trois statuts', () => {
    expect(isTaskStatus('doing')).toBe(true);
    expect(isTaskStatus('archived')).toBe(false);
  });
  it('groupByStatus regroupe dans l’ordre canonique', () => {
    const rows: Array<{ status: TaskStatus }> = [
      { status: 'todo' },
      { status: 'done' },
      { status: 'doing' },
      { status: 'todo' },
    ];
    const cols = groupByStatus(rows);
    expect(cols.map((c) => c.status)).toEqual([...PLANNING_STATUSES]);
    expect(cols.find((c) => c.status === 'todo')!.items).toHaveLength(2);
    expect(cols.find((c) => c.status === 'doing')!.items).toHaveLength(1);
    expect(cols.find((c) => c.status === 'done')!.items).toHaveLength(1);
  });
});

describe('échéances relatives', () => {
  const DAY = 86_400_000;
  const now = 1_000 * DAY;
  it('classe overdue / today / soon / ok et formate le badge', () => {
    expect(dueInfo(now - 3 * DAY, now)).toMatchObject({ kind: 'overdue', badge: 'J+3' });
    expect(dueInfo(now, now)).toMatchObject({ kind: 'today', badge: 'Jour J' });
    expect(dueInfo(now + 10 * DAY, now)).toMatchObject({ kind: 'soon', badge: 'J−10' });
    expect(dueInfo(now + 40 * DAY, now)).toMatchObject({ kind: 'ok', badge: 'J−40' });
  });
  it('overdueCount ne compte que les tâches non faites dépassées', () => {
    const rows = [
      { done: false, dueDate: now - DAY }, // en retard
      { done: true, dueDate: now - DAY }, // faite → ignorée
      { done: false, dueDate: now + DAY }, // future → ignorée
      { done: false }, // sans échéance → ignorée
    ];
    expect(overdueCount(rows, now)).toBe(1);
  });
});
