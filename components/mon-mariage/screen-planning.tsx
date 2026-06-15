'use client';
/* Wedillybird — Espace couple · Écran — Rétroplanning (perso)
   Checklist perso, template par phases. Le couple peut CRÉER ses propres phases
   (« dans un an », « dans 6 mois »…) et ajouter des tâches dans chaque phase.
   PAS d'assignation équipe, PAS de multi-event. */

import { useState, type KeyboardEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from './icons';
import { McBtn, Fleuron, McPill } from './parts';
import { McModal, McField, McInput } from './modal';
import { MC_PHASES, mcDateNum, mcDaysTo, type McPhase, type McTask } from './data';

/** [pillKind, clé i18n du statut de tâche]. */
function mcTaskStatusMeta(s: string): [string, string] {
  return (
    (
      {
        todo: ['muted', 'statusTodo'],
        doing: ['wait', 'statusDoing'],
        done: ['ok', 'statusDone'],
      } as Record<string, [string, string]>
    )[s] || ['muted', 'statusUnknown']
  );
}

/** Une phase/tâche porte soit une clé i18n (`MonMariage.…`), soit un libellé libre
    saisi par le couple. On traduit seulement les clés. */
function maybeTranslate(label: string, tRoot: (k: string) => string): string {
  return label.startsWith('MonMariage.') ? tRoot(label.replace(/^MonMariage\./, '')) : label;
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: McTask;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('MonMariage.planning');
  const tRoot = useTranslations('MonMariage');
  const locale = useLocale();
  const [kind, labelKey] = mcTaskStatusMeta(task.status);
  const days = task.due ? mcDaysTo(task.due) : null;
  const soon = task.status !== 'done' && days != null && days >= 0 && days <= 16;
  return (
    <div className={'mc-task' + (task.status === 'done' ? ' done' : '')}>
      <button
        className="ck"
        onClick={onToggle}
        aria-pressed={task.status === 'done'}
        aria-label={t('changeStatus')}
      >
        {task.status === 'done' && <Icon name="Check" size={14} stroke={2.8} />}
        {task.status === 'doing' && <span className="half" />}
      </button>
      <div className="tk">
        <b>{maybeTranslate(task.label, tRoot)}</b>
        <span className="tm">
          {task.due && (
            <span className="due">
              <Icon name="Calendar" size={11} stroke={1.9} />
              {mcDateNum(task.due, locale)}
            </span>
          )}
          {soon && (
            <span className="rem">
              <Icon name="BellRing" size={11} stroke={2} />
              {days === 0 ? t('today') : days <= 7 ? t('thisWeek') : t('soon')}
            </span>
          )}
        </span>
      </div>
      <McPill kind={kind}>{t(labelKey)}</McPill>
      <button className="mc-row-x" onClick={onDelete} aria-label={t('deleteTask')}>
        <Icon name="Trash2" size={14} stroke={1.85} />
      </button>
    </div>
  );
}

/* ajout de tâche inline dans une phase */
function PhaseAddTask({ onAdd }: { onAdd: (label: string, due?: string) => void }) {
  const t = useTranslations('MonMariage.planning');
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [due, setDue] = useState('');
  const submit = () => {
    if (!label.trim()) return;
    onAdd(label.trim(), due || undefined);
    setLabel('');
    setDue('');
    setOpen(false);
  };
  if (!open)
    return (
      <button className="mc-addtask" onClick={() => setOpen(true)}>
        <Icon name="Plus" size={15} stroke={2.1} />
        {t('addTask')}
      </button>
    );
  return (
    <div className="mc-addtask-row">
      <span className="mc-inp" style={{ flex: 1 }}>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && submit()}
          placeholder={t('newTaskPlaceholder')}
        />
      </span>
      <span className="mc-inp" style={{ width: 150 }}>
        <Icon name="Calendar" size={14} stroke={1.85} />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          aria-label={t('dueAria')}
        />
      </span>
      <McBtn variant="primary" size="sm" onClick={submit}>
        {t('ok')}
      </McBtn>
      <button className="mc-row-x" onClick={() => setOpen(false)} aria-label={t('cancel')}>
        <Icon name="X" size={15} stroke={2} />
      </button>
    </div>
  );
}

/* modale de création de phase */
function PhaseModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (label: string, sub: string) => void;
}) {
  const t = useTranslations('MonMariage.planning');
  const [label, setLabel] = useState('');
  const [sub, setSub] = useState('');
  const create = () => {
    if (!label.trim()) return;
    onCreate(label.trim(), sub.trim());
    onClose();
  };
  return (
    <McModal
      eyebrow={t('eyebrow')}
      title={t('newPhase')}
      onClose={onClose}
      footer={
        <>
          <McBtn variant="ghost" size="md" onClick={onClose}>
            {t('cancel')}
          </McBtn>
          <McBtn variant="halo" size="md" onClick={create}>
            <Icon name="Plus" size={16} stroke={2.1} />
            {t('createPhase')}
          </McBtn>
        </>
      }
    >
      <div className="mc-formgrid">
        <McField label={t('phaseTitleLabel')} hint={t('phaseTitleHint')} full>
          <McInput
            icon="Flag"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('phaseTitlePlaceholder')}
            autoFocus
          />
        </McField>
        <McField label={t('phaseSubLabel')} hint={t('optional')} full>
          <McInput
            value={sub}
            onChange={(e) => setSub(e.target.value)}
            placeholder={t('phaseSubPlaceholder')}
          />
        </McField>
      </div>
    </McModal>
  );
}

export function PlanningScreen() {
  const t = useTranslations('MonMariage.planning');
  const tRoot = useTranslations('MonMariage');
  const [phases, setPhases] = useState<McPhase[]>(MC_PHASES);
  const [modal, setModal] = useState(false);

  const all = phases.flatMap((p) => p.tasks);
  const done = all.filter((t) => t.status === 'done').length;
  const doing = all.filter((t) => t.status === 'doing').length;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;

  const cycle = (pid: string, tid: string) =>
    setPhases((ps) =>
      ps.map((p) =>
        p.id !== pid
          ? p
          : {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id !== tid
                  ? t
                  : {
                      ...t,
                      status: t.status === 'done' ? 'todo' : t.status === 'todo' ? 'doing' : 'done',
                    },
              ),
            },
      ),
    );
  const delTask = (pid: string, tid: string) =>
    setPhases((ps) =>
      ps.map((p) => (p.id !== pid ? p : { ...p, tasks: p.tasks.filter((t) => t.id !== tid) })),
    );
  const addTask = (pid: string, label: string, due?: string) =>
    setPhases((ps) =>
      ps.map((p) =>
        p.id !== pid
          ? p
          : { ...p, tasks: [...p.tasks, { id: 'x' + Date.now(), label, due, status: 'todo' }] },
      ),
    );
  const createPhase = (label: string, sub: string) =>
    setPhases((ps) => [
      ...ps,
      { id: 'ph' + Date.now(), label, sub: sub || t('customPhase'), tasks: [] },
    ]);

  return (
    <>
      <header className="mc-pagehead">
        <div className="ph-l">
          <span className="mc-eyebrow">{t('eyebrow')}</span>
          <h1>{t('title')}</h1>
        </div>
        <p className="ph-sub">{t('subtitle')}</p>
      </header>

      <section className="mc-card feature">
        <div className="mc-prog">
          <div className="mc-prog-top">
            <div>
              <span className="mc-eyebrow">{t('progress')}</span>
              <div className="mc-prog-h">
                <span className="big">{t('percent', { pct })}</span>
                <span className="sm">{t('tasksRatio', { done, total: all.length })}</span>
              </div>
            </div>
            <span className="mc-pill wait">
              <span className="d" />
              {t('inProgressCount', { count: doing })}
            </span>
          </div>
          <div className="mc-prog-track">
            <i style={{ width: pct + '%' }} />
          </div>
        </div>
      </section>

      <div className="mc-phases">
        {phases.map((ph) => {
          const pd = ph.tasks.filter((tk) => tk.status === 'done').length;
          return (
            <section className={'mc-phase' + (ph.current ? ' current' : '')} key={ph.id}>
              <div className="mc-phase-head">
                <Fleuron size={14} />
                <div className="ttl">
                  <h2>{maybeTranslate(ph.label, tRoot)}</h2>
                  <span className="sb">{maybeTranslate(ph.sub, tRoot)}</span>
                </div>
                <span className="cnt">
                  {pd}/{ph.tasks.length}
                </span>
              </div>
              <div className="mc-tasks">
                {ph.tasks.map((tk) => (
                  <TaskRow
                    key={tk.id}
                    task={tk}
                    onToggle={() => cycle(ph.id, tk.id)}
                    onDelete={() => delTask(ph.id, tk.id)}
                  />
                ))}
              </div>
              <PhaseAddTask onAdd={(l, d) => addTask(ph.id, l, d)} />
            </section>
          );
        })}
      </div>

      <button className="mc-addphase" onClick={() => setModal(true)}>
        <Icon name="Plus" size={18} stroke={2} />
        {t('addPhase')}
      </button>

      {modal && <PhaseModal onClose={() => setModal(false)} onCreate={createPhase} />}
    </>
  );
}
