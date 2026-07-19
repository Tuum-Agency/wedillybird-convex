'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, ChevronUp, ChevronDown, Lock, Save, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import {
  normalizeRsvpConfig,
  CHOICE_TYPES,
  QUESTION_TYPES,
  MAX_CUSTOM_QUESTIONS,
  MAX_OPTIONS,
  type QuestionType,
  type RsvpQuestion,
  type RsvpConfig,
} from '@/lib/rsvp/questions';
import { updateRsvpConfigAction } from '@/app/[locale]/(app)/events/actions';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `q_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

interface Props {
  eventId: string;
  initialConfig?: RsvpConfig | null;
  /** Feature déverrouillée (Premium / Pro) ? Sinon on montre l'upsell. */
  unlocked: boolean;
  /** Lien vers l'upgrade (checkout / tarifs) montré quand verrouillé. */
  upgradeHref: string;
}

/**
 * Éditeur des questions du formulaire RSVP (couple + agence). Pilote
 * `events.rsvpConfig` : (dé)activation + renommage des champs standard et
 * questions custom typées. Persisté via `updateRsvpConfigAction`.
 *
 * Placé hors du `<form>` d'édition de l'event (formulaire autonome, propre
 * bouton d'enregistrement).
 */
export function RsvpQuestionsEditor({ eventId, initialConfig, unlocked, upgradeHref }: Props) {
  const t = useTranslations('RsvpEditor');
  const n = normalizeRsvpConfig(initialConfig);

  const [askPlusOnes, setAskPlusOnes] = useState(n.askPlusOnes);
  const [askDietary, setAskDietary] = useState(n.askDietary);
  const [dietaryLabel, setDietaryLabel] = useState(n.dietaryLabel ?? '');
  const [askNotes, setAskNotes] = useState(n.askNotes);
  const [notesLabel, setNotesLabel] = useState(n.notesLabel ?? '');
  const [questions, setQuestions] = useState<RsvpQuestion[]>(n.customQuestions);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [pending, startTransition] = useTransition();

  function patchQuestion(id: string, patch: Partial<RsvpQuestion>) {
    setStatus('idle');
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function addQuestion() {
    if (questions.length >= MAX_CUSTOM_QUESTIONS) return;
    setStatus('idle');
    setQuestions((qs) => [...qs, { id: newId(), type: 'short_text', label: '' }]);
  }

  function removeQuestion(id: string) {
    setStatus('idle');
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  }

  function move(id: string, dir: -1 | 1) {
    setStatus('idle');
    setQuestions((qs) => {
      const i = qs.findIndex((q) => q.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  function changeType(id: string, type: QuestionType) {
    const needsOptions = CHOICE_TYPES.has(type);
    patchQuestion(id, {
      type,
      options: needsOptions ? (questions.find((q) => q.id === id)?.options ?? ['', '']) : undefined,
    });
  }

  function setOption(id: string, idx: number, value: string) {
    setQuestions((qs) =>
      qs.map((q) => {
        if (q.id !== id) return q;
        const options = [...(q.options ?? [])];
        options[idx] = value;
        return { ...q, options };
      }),
    );
  }

  function addOption(id: string) {
    setQuestions((qs) =>
      qs.map((q) => {
        if (q.id !== id) return q;
        const options = [...(q.options ?? [])];
        if (options.length >= MAX_OPTIONS) return q;
        return { ...q, options: [...options, ''] };
      }),
    );
  }

  function removeOption(id: string, idx: number) {
    setQuestions((qs) =>
      qs.map((q) =>
        q.id === id ? { ...q, options: (q.options ?? []).filter((_, i) => i !== idx) } : q,
      ),
    );
  }

  function save() {
    const config: RsvpConfig = {
      askPlusOnes,
      askDietary,
      askNotes,
      dietaryLabel: dietaryLabel.trim() || undefined,
      notesLabel: notesLabel.trim() || undefined,
      customQuestions: questions,
    };
    startTransition(async () => {
      const res = await updateRsvpConfigAction(eventId, config);
      setStatus(res.ok ? 'saved' : 'error');
    });
  }

  if (!unlocked) {
    return (
      <section className="flex flex-col gap-5 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-7 shadow-[var(--shadow-soft)] sm:p-9">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-primary-soft)] px-6 py-10 text-center">
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-surface)] text-[color:var(--color-primary)] shadow-[var(--shadow-soft)]"
          >
            <Lock className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <p className="max-w-sm text-sm leading-relaxed text-[color:var(--color-foreground)] sm:text-base">
            {t('lockedBody')}
          </p>
          <Link
            href={upgradeHref as never}
            className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {t('lockedCta')}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-8 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-7 shadow-[var(--shadow-soft)] sm:p-9">
      <SectionHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Champs standard */}
      <div className="flex flex-col gap-4">
        <h3 className="font-mono text-[10px] tracking-[0.28em] text-[color:var(--color-muted-foreground)] uppercase">
          {t('builtinSectionTitle')}
        </h3>
        <ToggleRow
          label={t('fieldPlusOnes')}
          hint={t('fieldPlusOnesHint')}
          on={askPlusOnes}
          onChange={(v) => {
            setStatus('idle');
            setAskPlusOnes(v);
          }}
        />
        <ToggleRow
          label={t('fieldDietary')}
          on={askDietary}
          onChange={(v) => {
            setStatus('idle');
            setAskDietary(v);
          }}
        >
          {askDietary ? (
            <Input
              aria-label={t('labelOverride')}
              placeholder={t('labelOverridePlaceholder')}
              value={dietaryLabel}
              onChange={(e) => {
                setStatus('idle');
                setDietaryLabel(e.target.value);
              }}
            />
          ) : null}
        </ToggleRow>
        <ToggleRow
          label={t('fieldNotes')}
          on={askNotes}
          onChange={(v) => {
            setStatus('idle');
            setAskNotes(v);
          }}
        >
          {askNotes ? (
            <Input
              aria-label={t('labelOverride')}
              placeholder={t('labelOverridePlaceholder')}
              value={notesLabel}
              onChange={(e) => {
                setStatus('idle');
                setNotesLabel(e.target.value);
              }}
            />
          ) : null}
        </ToggleRow>
      </div>

      {/* Questions personnalisées */}
      <div className="flex flex-col gap-4 border-t border-[color:var(--color-border)] pt-7">
        <div className="flex flex-col gap-1">
          <h3 className="font-mono text-[10px] tracking-[0.28em] text-[color:var(--color-muted-foreground)] uppercase">
            {t('customSectionTitle')}
          </h3>
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            {t('customSectionHint', { max: MAX_CUSTOM_QUESTIONS })}
          </p>
        </div>

        {questions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[color:var(--color-border)] px-5 py-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
            {t('empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                q={q}
                index={i}
                total={questions.length}
                t={t}
                onPatch={patchQuestion}
                onChangeType={changeType}
                onRemove={removeQuestion}
                onMove={move}
                onSetOption={setOption}
                onAddOption={addOption}
                onRemoveOption={removeOption}
              />
            ))}
          </ul>
        )}

        <div>
          <Button
            type="button"
            variant="outline"
            onClick={addQuestion}
            disabled={questions.length >= MAX_CUSTOM_QUESTIONS}
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            {questions.length >= MAX_CUSTOM_QUESTIONS
              ? t('maxReached', { max: MAX_CUSTOM_QUESTIONS })
              : t('addQuestion')}
          </Button>
        </div>
      </div>

      {/* Barre d'enregistrement */}
      <div className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-6 sm:flex-row sm:items-center sm:justify-end">
        {status === 'saved' ? (
          <p className="text-sm text-[color:var(--color-success)] sm:mr-auto" role="status">
            {t('saved')}
          </p>
        ) : null}
        {status === 'error' ? (
          <p className="text-sm text-[color:var(--color-destructive)] sm:mr-auto" role="alert">
            {t('errorSave')}
          </p>
        ) : null}
        <Button type="button" variant="primary" size="lg" onClick={save} disabled={pending}>
          <Save className="h-4 w-4" strokeWidth={2} aria-hidden />
          {t('save')}
        </Button>
      </div>
    </section>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2
        className="font-display italic"
        style={{
          fontSize: 'clamp(1.25rem, 1.8vw, 1.5rem)',
          lineHeight: 1.2,
          letterSpacing: '-0.018em',
          color: 'var(--color-foreground)',
        }}
      >
        {title}
      </h2>
      <p className="text-sm text-[color:var(--color-muted-foreground)]">{subtitle}</p>
    </div>
  );
}

/** Toggle light (pouce positionné par `left` — piège Tailwind v4). */
function ToggleRow({
  label,
  hint,
  on,
  onChange,
  children,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-[color:var(--color-foreground)]">{label}</span>
          {hint ? (
            <span className="text-xs text-[color:var(--color-muted-foreground)]">{hint}</span>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          onClick={() => onChange(!on)}
          className={cn(
            'focus-ring relative h-6 w-11 flex-shrink-0 rounded-full transition-colors',
            on ? 'bg-[color:var(--color-primary)]' : 'bg-[color:var(--color-border-strong)]',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200 ease-out',
              on ? 'left-[22px]' : 'left-0.5',
            )}
          />
        </button>
      </div>
      {children}
    </div>
  );
}

function QuestionCard({
  q,
  index,
  total,
  t,
  onPatch,
  onChangeType,
  onRemove,
  onMove,
  onSetOption,
  onAddOption,
  onRemoveOption,
}: {
  q: RsvpQuestion;
  index: number;
  total: number;
  t: ReturnType<typeof useTranslations>;
  onPatch: (id: string, patch: Partial<RsvpQuestion>) => void;
  onChangeType: (id: string, type: QuestionType) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onSetOption: (id: string, idx: number, value: string) => void;
  onAddOption: (id: string) => void;
  onRemoveOption: (id: string, idx: number) => void;
}) {
  const isChoice = CHOICE_TYPES.has(q.type);
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-5">
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor={`q-label-${q.id}`}>{t('questionLabel')}</Label>
          <Input
            id={`q-label-${q.id}`}
            value={q.label}
            placeholder={t('questionLabelPlaceholder')}
            onChange={(e) => onPatch(q.id, { label: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1 pt-7">
          <button
            type="button"
            aria-label={t('moveUp')}
            disabled={index === 0}
            onClick={() => onMove(q.id, -1)}
            className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-surface-elevated)] disabled:opacity-30"
          >
            <ChevronUp className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t('moveDown')}
            disabled={index === total - 1}
            onClick={() => onMove(q.id, 1)}
            className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-surface-elevated)] disabled:opacity-30"
          >
            <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`q-type-${q.id}`}>{t('typeLabel')}</Label>
        <Select value={q.type} onValueChange={(v) => onChangeType(q.id, v as QuestionType)}>
          <SelectTrigger
            id={`q-type-${q.id}`}
            className="focus-ring h-11 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`type.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isChoice ? (
        <div className="flex flex-col gap-2">
          <Label>{t('optionsLabel')}</Label>
          <div className="flex flex-col gap-2">
            {(q.options ?? []).map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={opt}
                  placeholder={t('optionPlaceholder', { index: idx + 1 })}
                  onChange={(e) => onSetOption(q.id, idx, e.target.value)}
                />
                <button
                  type="button"
                  aria-label={t('removeOption')}
                  onClick={() => onRemoveOption(q.id, idx)}
                  className="focus-ring flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-primary-soft)] hover:text-[color:var(--color-primary)]"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onAddOption(q.id)}
            disabled={(q.options ?? []).length >= MAX_OPTIONS}
            className="focus-ring inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[color:var(--color-primary)] transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            {t('addOption')}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[color:var(--color-border)] pt-4">
        <InlineToggle
          label={t('requiredLabel')}
          on={q.required ?? false}
          onChange={(v) => onPatch(q.id, { required: v })}
        />
        <InlineToggle
          label={t('onlyIfAttendingLabel')}
          on={q.onlyIfAttending ?? false}
          onChange={(v) => onPatch(q.id, { onlyIfAttending: v })}
        />
        <button
          type="button"
          onClick={() => onRemove(q.id)}
          className="focus-ring ml-auto inline-flex items-center gap-1.5 text-sm text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-primary)]"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          {t('removeQuestion')}
        </button>
      </div>
    </li>
  );
}

function InlineToggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--color-foreground)]">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={cn(
          'focus-ring relative h-5 w-9 flex-shrink-0 rounded-full transition-colors',
          on ? 'bg-[color:var(--color-primary)]' : 'bg-[color:var(--color-border-strong)]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ease-out',
            on ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </button>
      {label}
    </label>
  );
}
