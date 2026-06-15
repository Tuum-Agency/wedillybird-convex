'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  X,
  Phone,
  MessageSquare,
  Mail,
  Heart,
  ArrowUpRight,
  Hourglass,
  CalendarCheck,
  Calendar,
  MapPin,
  CalendarPlus,
  Send,
  SlidersHorizontal,
  ChevronDown,
  Check,
  StickyNote,
  PhoneCall,
  AtSign,
  RefreshCw,
  Banknote,
  Inbox,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { CLIENT_STAGES, coupleInitials, coupleHue, type ClientStage } from '@/lib/pro/clients';
import { nowMs } from '@/lib/pro/format';
import {
  useStageLabel,
  useSourceLabel,
  useEurFormat,
  useDateFormat,
  useRelative,
} from '@/components/pro/clients/format-i18n';
import { STAGE_PILL } from '@/components/pro/clients/stage-colors';
import type { ClientRow } from '@/components/pro/clients/types';
import {
  getClientNotesAction,
  addClientNoteAction,
  type ClientNote,
} from '@/app/[locale]/(app)/pro/clients/actions';

const NOTE_ICON: Record<ClientNote['type'], LucideIcon> = {
  note: StickyNote,
  call: PhoneCall,
  email: AtSign,
  status: RefreshCw,
  payment: Banknote,
};

function coupleLabel(c: ClientRow): string {
  return c.partnerB ? `${c.partnerA} & ${c.partnerB}` : c.partnerA;
}

function Avatar({ name, size = 46 }: { name: string; size?: number }) {
  const hue = coupleHue(name);
  return (
    <span
      aria-hidden
      className="flex flex-shrink-0 items-center justify-center rounded-full font-mono font-medium"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.34),
        background: `oklch(42% 0.07 ${hue})`,
        color: `oklch(94% 0.03 ${hue})`,
      }}
    >
      {coupleInitials(name)}
    </span>
  );
}

export function ClientDetail({
  client,
  onClose,
  onChangeStage,
  onEdit,
  onConvert,
}: {
  client: ClientRow;
  onClose: () => void;
  onChangeStage: (stage: ClientStage) => void;
  onEdit: () => void;
  onConvert: () => void;
}) {
  const t = useTranslations('Pro.clientsBoard');
  const stageLabel = useStageLabel();
  const sourceLabel = useSourceLabel();
  const formatEur = useEurFormat();
  const formatDate = useDateFormat();
  const relative = useRelative();
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [stageMenu, setStageMenu] = useState(false);
  const [pending, startTransition] = useTransition();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    getClientNotesAction(client._id).then((n) => {
      if (!alive) return;
      // Chargement asynchrone de la timeline à l'ouverture de la fiche.
      setNotes(n);
      setLoadingNotes(false);
    });
    return () => {
      alive = false;
    };
  }, [client._id]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function submitNote() {
    const t = noteText.trim();
    if (!t) return;
    setNoteText('');
    const optimistic: ClientNote = {
      _id: `tmp_${nowMs()}`,
      type: 'note',
      text: t,
      createdAt: nowMs(),
    };
    setNotes((prev) => [optimistic, ...prev]);
    startTransition(async () => {
      await addClientNoteAction(client._id, t);
      const fresh = await getClientNotesAction(client._id);
      setNotes(fresh);
    });
  }

  function pickStage(stage: ClientStage) {
    setStageMenu(false);
    if (stage === client.stage) return;
    onChangeStage(stage);
    // Reflète la note de statut auto-générée côté serveur.
    const optimistic: ClientNote = {
      _id: `tmp_${nowMs()}`,
      type: 'status',
      text: t('statusChanged', {
        from: stageLabel(client.stage),
        to: stageLabel(stage),
      }),
      createdAt: nowMs(),
    };
    setNotes((prev) => [optimistic, ...prev]);
  }

  const pill = STAGE_PILL[client.stage];
  const booked = client.budgetBookedMinor ?? 0;
  const pct = client.budgetMinor
    ? Math.min(100, Math.round((booked / client.budgetMinor) * 100))
    : 0;
  const now = nowMs();
  const waHref = client.whatsapp
    ? `https://wa.me/${client.whatsapp.replace(/[^0-9]/g, '')}`
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={t('detailAria', { couple: coupleLabel(client) })}
    >
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        data-theme="dark"
        className="relative flex h-full w-full max-w-md flex-col overflow-hidden border-l border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-[var(--shadow-popover)]"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-[color:var(--color-border)] p-5">
          <Avatar name={coupleLabel(client)} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
              {client.assigneeName
                ? t('detailEyebrowAssigned', { name: client.assigneeName })
                : t('detailEyebrowUnassigned')}
            </span>
            <h2 className="font-display text-xl leading-tight text-[color:var(--color-foreground)] italic">
              {client.partnerA}{' '}
              {client.partnerB ? (
                <>
                  <span style={{ color: 'var(--color-gold-500)' }}>&amp;</span> {client.partnerB}
                </>
              ) : null}
            </h2>
            <div className="relative mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStageMenu((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] uppercase"
                style={{ background: pill.bg, color: pill.fg }}
                aria-haspopup="menu"
                aria-expanded={stageMenu}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: pill.dot }}
                  aria-hidden
                />
                {stageLabel(client.stage)}
                <ChevronDown className="h-3 w-3" strokeWidth={2} aria-hidden />
              </button>
              {stageMenu ? (
                <div className="absolute top-full left-0 z-10 mt-1 flex w-48 flex-col rounded-xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] p-1 shadow-[var(--shadow-popover)]">
                  <span className="px-2 py-1 font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                    {t('changeStatus')}
                  </span>
                  {CLIENT_STAGES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => pickStage(s)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-[color:var(--color-surface)]',
                        s === client.stage
                          ? 'text-[color:var(--color-foreground)]'
                          : 'text-[color:var(--color-muted-foreground)]',
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: STAGE_PILL[s].dot }}
                        aria-hidden
                      />
                      <span className="flex-1">{stageLabel(s)}</span>
                      {s === client.stage ? (
                        <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            aria-label={t('closeDetail')}
            className="focus-ring rounded-lg p-1.5 text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-2">
            <QuickContact
              href={client.phone ? `tel:${client.phone.replace(/\s/g, '')}` : undefined}
              Icon={Phone}
              label={t('call')}
            />
            <QuickContact href={waHref} Icon={MessageSquare} label={t('whatsapp')} external />
            <QuickContact
              href={client.email ? `mailto:${client.email}` : undefined}
              Icon={Mail}
              label={t('emailAction')}
            />
          </div>

          {/* Coordonnées */}
          <Section
            title={t('contactInfo')}
            action={{ label: t('edit'), onClick: onEdit, Icon: SlidersHorizontal }}
          >
            <KvRow
              Icon={Phone}
              label={t('form.phone')}
              value={client.phone}
              emptyLabel={t('notProvided')}
              mono
            />
            <KvRow
              Icon={Mail}
              label={t('form.email')}
              value={client.email}
              emptyLabel={t('notProvided')}
            />
            <KvRow
              Icon={MessageSquare}
              label={t('form.whatsapp')}
              value={client.whatsapp}
              emptyLabel={t('notProvided')}
              mono
            />
            <KvRow
              Icon={Inbox}
              label={t('form.source')}
              value={sourceLabel(client.source) || undefined}
              emptyLabel={t('notProvided')}
            />
          </Section>

          {/* Mariage lié */}
          <Section title={t('linkedWedding')}>
            {client.eventId ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-4">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-surface)] text-[color:var(--color-blush-300)]"
                  >
                    <Heart className="h-5 w-5" strokeWidth={1.7} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-display text-base text-[color:var(--color-foreground)] italic">
                      {coupleLabel(client)}
                    </span>
                    <Link
                      href={`/pro/weddings/${client.eventId}` as never}
                      className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-blush-300)] uppercase"
                    >
                      {t('openWedding')} <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
                    </Link>
                  </div>
                  {client.weddingDate ? (
                    client.weddingDate >= now ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                        <Hourglass className="h-3 w-3" strokeWidth={1.8} aria-hidden />
                        {t('countdownPrefix')}
                        {Math.ceil((client.weddingDate - now) / 86_400_000)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[color:var(--color-sage-500)]">
                        <CalendarCheck className="h-3 w-3" strokeWidth={1.8} aria-hidden />
                        {t('past')}
                      </span>
                    )
                  ) : null}
                </div>
                <div className="flex flex-col gap-1 border-t border-[color:var(--color-border)] pt-3 text-sm text-[color:var(--color-muted-foreground)]">
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                    {formatDate(client.weddingDate)}
                  </span>
                  {client.venue ? (
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                      {client.venue}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)]/40 px-5 py-6 text-center">
                <span
                  aria-hidden
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--color-surface)] text-[color:var(--color-blush-300)]"
                >
                  <Heart className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <p className="text-sm text-[color:var(--color-muted-foreground)]">
                  {t('noLinkedWedding')}
                </p>
                <button
                  type="button"
                  onClick={onConvert}
                  disabled={pending}
                  className="focus-ring inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-[color:var(--color-primary-foreground)] hover:bg-[color:var(--color-primary-hover)] disabled:opacity-50"
                >
                  <CalendarPlus className="h-4 w-4" strokeWidth={2} aria-hidden />
                  {t('createWedding')}
                </button>
              </div>
            )}
          </Section>

          {/* Budget */}
          <Section title={t('budget')}>
            {client.budgetMinor ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-4">
                <div className="flex gap-6">
                  <div className="flex flex-col">
                    <span className="font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                      {t('planned')}
                    </span>
                    <span className="font-mono text-lg text-[color:var(--color-foreground)] tabular-nums">
                      {formatEur(client.budgetMinor)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-blush-300)] uppercase">
                      {t('booked')}
                    </span>
                    <span className="font-mono text-lg text-[color:var(--color-foreground)] tabular-nums">
                      {formatEur(booked)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                    <span>{t('committed', { pct: pct / 100 })}</span>
                    <span>
                      {t('remaining', { amount: formatEur(client.budgetMinor - booked) })}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface)]">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${pct}%`, background: 'var(--color-blush-400)' }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)]/40 p-4 text-sm text-[color:var(--color-muted-foreground)]">
                {t('budgetNotEstimated')}
              </p>
            )}
          </Section>

          {/* Notes & activité */}
          <Section title={t('notesActivity')} meta={t('entryCount', { count: notes.length })}>
            <div className="flex items-end gap-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={t('addNotePlaceholder')}
                aria-label={t('addNoteAria')}
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitNote();
                }}
                className="focus-ring flex-1 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 py-2 text-sm text-[color:var(--color-foreground)]"
              />
              <button
                type="button"
                onClick={submitNote}
                disabled={pending || !noteText.trim()}
                aria-label={t('saveNote')}
                className="focus-ring flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] hover:bg-[color:var(--color-primary-hover)] disabled:opacity-50"
              >
                <Send className="h-4 w-4" strokeWidth={1.9} />
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              {loadingNotes ? (
                <p className="text-sm text-[color:var(--color-muted-foreground)]">{t('loading')}</p>
              ) : notes.length === 0 ? (
                <p className="text-sm text-[color:var(--color-muted-foreground)]">
                  {t('noActivity')}
                </p>
              ) : (
                notes.map((n) => {
                  const NIcon = NOTE_ICON[n.type];
                  return (
                    <div key={n._id} className="flex gap-2.5">
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]"
                      >
                        <NIcon className="h-3.5 w-3.5" strokeWidth={1.9} />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm text-[color:var(--color-foreground)]">
                          {n.text}
                        </span>
                        <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                          {relative(n.createdAt, now)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Section>

          {/* Documents */}
          <Section title={t('documents')}>
            <p className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)]/40 p-4 text-sm text-[color:var(--color-muted-foreground)]">
              {t('noDocuments')}
            </p>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-[color:var(--color-border)] p-4">
          <button
            type="button"
            onClick={onEdit}
            className="focus-ring inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]"
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.9} aria-hidden />
            {t('edit')}
          </button>
          <span className="flex-1" />
          {client.eventId ? (
            <Link
              href={`/pro/weddings/${client.eventId}` as never}
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-[color:var(--color-primary-foreground)] hover:bg-[color:var(--color-primary-hover)]"
            >
              <Heart className="h-4 w-4" strokeWidth={1.9} aria-hidden />
              {t('openWedding')}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onConvert}
              disabled={pending}
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-[color:var(--color-primary-foreground)] hover:bg-[color:var(--color-primary-hover)] disabled:opacity-50"
            >
              <CalendarPlus className="h-4 w-4" strokeWidth={2} aria-hidden />
              {t('createWedding')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: string;
  action?: { label: string; onClick: () => void; Icon: LucideIcon };
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-muted-foreground)] uppercase">
          {title}
        </span>
        {meta ? (
          <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
            {meta}
          </span>
        ) : null}
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-blush-300)] uppercase"
          >
            <action.Icon className="h-3 w-3" strokeWidth={1.9} aria-hidden />
            {action.label}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function KvRow({
  Icon,
  label,
  value,
  emptyLabel,
  mono,
}: {
  Icon: LucideIcon;
  label: string;
  value?: string;
  /** Texte affiché quand `value` est vide (« Non renseigné »). */
  emptyLabel: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span aria-hidden className="text-[color:var(--color-muted-foreground)]">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </span>
      <span className="w-20 flex-shrink-0 text-[color:var(--color-muted-foreground)]">{label}</span>
      <span
        className={cn(
          'flex-1 truncate',
          value
            ? 'text-[color:var(--color-foreground)]'
            : 'text-[color:var(--color-muted-foreground)]/60',
          mono && value && 'font-mono text-xs',
        )}
      >
        {value || emptyLabel}
      </span>
    </div>
  );
}

function QuickContact({
  href,
  Icon,
  label,
  external,
}: {
  href?: string;
  Icon: LucideIcon;
  label: string;
  external?: boolean;
}) {
  const cls =
    'flex items-center justify-center gap-1.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-2 py-2.5 text-xs font-medium transition-colors';
  if (!href) {
    return (
      <span
        className={cn(
          cls,
          'cursor-not-allowed text-[color:var(--color-muted-foreground)] opacity-50',
        )}
        aria-disabled
      >
        <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden />
        {label}
      </span>
    );
  }
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={cn(
        cls,
        'text-[color:var(--color-foreground)] hover:border-[color:var(--color-border-strong)]',
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden />
      {label}
    </a>
  );
}
