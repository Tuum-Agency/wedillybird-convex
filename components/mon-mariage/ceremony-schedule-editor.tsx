'use client';

// Éditeur du déroulé de la journée (planning de cérémonie) affiché sur
// l'invitation publique. Optimiste via le store ; persiste au blur des champs
// et immédiatement à l'ajout/retrait d'une étape. Non gaté (info de base du
// mariage, tous forfaits).

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMonMariage } from '@/stores/mon-mariage';
import type { CeremonyStep } from '@/lib/mon-mariage/types';
import { Icon } from './icons';
import { McBtn } from './parts';

const MAX_STEPS = 20;

export function CeremonyScheduleEditor() {
  const t = useTranslations('CeremonySchedule');
  const saved = useMonMariage((s) => s.event?.ceremonySchedule ?? []);
  const persist = useMonMariage((s) => s.setCeremonySchedule);
  const [rows, setRows] = useState<CeremonyStep[]>(saved);

  function commit(next: CeremonyStep[]) {
    void persist(next);
  }

  function update(i: number, patch: Partial<CeremonyStep>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addStep() {
    if (rows.length >= MAX_STEPS) return;
    setRows((prev) => [...prev, { time: '', title: '' }]);
  }

  function removeStep(i: number) {
    setRows((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      commit(next);
      return next;
    });
  }

  return (
    <div className="mc-sched">
      <div className="mc-field-label mc-cinelabel">{t('section')}</div>
      <p className="mc-sched-hint">{t('hint')}</p>

      <div className="mc-sched-list">
        {rows.map((row, i) => (
          <div key={i} className="mc-sched-row">
            <input
              className="mc-sched-time"
              value={row.time}
              placeholder={t('timePlaceholder')}
              aria-label={t('timeLabel')}
              onChange={(e) => update(i, { time: e.target.value })}
              onBlur={() => commit(rows)}
            />
            <input
              className="mc-sched-title"
              value={row.title}
              placeholder={t('titlePlaceholder')}
              aria-label={t('titleLabel')}
              onChange={(e) => update(i, { title: e.target.value })}
              onBlur={() => commit(rows)}
            />
            <button
              type="button"
              className="mc-sched-del"
              onClick={() => removeStep(i)}
              aria-label={t('remove')}
            >
              <Icon name="Trash2" size={14} stroke={2} />
            </button>
          </div>
        ))}
      </div>

      {rows.length < MAX_STEPS && (
        <McBtn variant="outline" size="sm" onClick={addStep}>
          <Icon name="Plus" size={14} stroke={2.2} />
          {t('add')}
        </McBtn>
      )}
    </div>
  );
}
