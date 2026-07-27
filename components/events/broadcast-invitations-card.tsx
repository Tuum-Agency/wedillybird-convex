'use client';

import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Send, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { broadcastInvitationsAction } from '@/app/[locale]/(app)/events/actions';

interface Counts {
  total: number;
  invited: number;
  withPhone: number;
}

/** Livraison SMS réelle (webhook StatusCallback + cron de réconciliation). */
interface Delivery {
  total: number;
  delivered: number;
  pending: number;
  undelivered: number;
  failed: number;
  undeliveredRate: number;
}

type SendState =
  | { kind: 'idle' }
  | { kind: 'success'; sent: number; failed: number; total: number; mock: boolean }
  | { kind: 'error'; message: string };

/**
 * BroadcastInvitationsCard — déclencheur d'envoi de masse des invitations
 * WhatsApp aux guests qui n'ont pas encore reçu leur lien personnalisé.
 *
 * États conditionnels :
 *  - event.status !== 'active' → bouton disabled + hint "publiez d'abord"
 *  - aucun guest avec phone → bouton disabled + hint "ajoutez des invités"
 *  - tous déjà envoyés → état "tout est parti" en succès
 *  - normal → bouton "Envoyer aux N invités"
 *
 * Confirmation native window.confirm avant envoi (mass action irréversible).
 */
export function BroadcastInvitationsCard({
  eventId,
  eventStatus,
  counts,
  delivery,
}: {
  eventId: string;
  eventStatus: 'draft' | 'active' | 'archived' | 'cancelled';
  counts: Counts;
  delivery: Delivery;
}) {
  const t = useTranslations('Events');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SendState>({ kind: 'idle' });

  const isPublished = eventStatus === 'active';
  const remaining = Math.max(0, counts.withPhone - counts.invited);
  const allSent = counts.withPhone > 0 && remaining === 0;
  const noPhones = counts.withPhone === 0;

  function handleClick() {
    if (!isPublished || remaining === 0) return;
    const confirmed = window.confirm(t('broadcastConfirm', { count: remaining }));
    if (!confirmed) return;

    setState({ kind: 'idle' });
    startTransition(async () => {
      const result = await broadcastInvitationsAction(eventId);
      if (result.ok) {
        setState({
          kind: 'success',
          sent: result.sent,
          failed: result.failed,
          total: result.total,
          mock: result.mock,
        });
        router.refresh();
        return;
      }
      const message =
        result.error === 'EVENT_NOT_PUBLISHED'
          ? t('broadcastErrorNotPublished')
          : result.error === 'FORBIDDEN'
            ? t('broadcastErrorForbidden')
            : t('broadcastErrorGeneric');
      setState({ kind: 'error', message });
    });
  }

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-[color:var(--color-border)] bg-white p-7 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-blush-700)] uppercase">
          {t('broadcastEyebrow')}
        </span>
        <h2
          className="font-display italic"
          style={{
            fontSize: 'clamp(1.5rem, 2.4vw, 2rem)',
            lineHeight: 1.15,
            letterSpacing: '-0.018em',
            color: 'var(--color-ink-900)',
          }}
        >
          {t('broadcastTitle')}
        </h2>

        {/* Stats progress */}
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[color:var(--color-ink-700)]">
              {t.rich('broadcastProgress', {
                invited: counts.invited,
                withPhone: counts.withPhone,
                strong: (chunks) => (
                  <strong className="text-[color:var(--color-ink-900)]">{chunks}</strong>
                ),
                muted: (chunks) => (
                  <span className="text-[color:var(--color-ink-500)]">{chunks}</span>
                ),
              })}
            </span>
            {counts.total > counts.withPhone ? (
              <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-500)] uppercase">
                {t('broadcastWithoutPhone', { count: counts.total - counts.withPhone })}
              </span>
            ) : null}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-border)]">
            <motion.span
              className="block h-full bg-[color:var(--color-blush-700)]"
              initial={{ width: '0%' }}
              animate={{
                width:
                  counts.withPhone > 0 ? `${(counts.invited / counts.withPhone) * 100}%` : '0%',
                transition: { duration: 0.6, ease: 'easeOut' },
              }}
            />
          </div>
        </div>
      </div>

      {/* Hints conditionnels */}
      {!isPublished ? (
        <div className="flex items-start gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-ivory-100)] p-4">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--color-gold-700)]"
            strokeWidth={2}
            aria-hidden
          />
          <p className="text-sm leading-relaxed text-[color:var(--color-ink-700)]">
            {t('broadcastHintNotPublished')}
          </p>
        </div>
      ) : null}

      {isPublished && noPhones ? (
        <div className="flex items-start gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-ivory-100)] p-4">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--color-gold-700)]"
            strokeWidth={2}
            aria-hidden
          />
          <p className="text-sm leading-relaxed text-[color:var(--color-ink-700)]">
            {t('broadcastHintNoPhones')}
          </p>
        </div>
      ) : null}

      {isPublished && allSent ? (
        <div className="flex items-start gap-3 rounded-xl border border-[color:var(--color-blush-200)] bg-[color:var(--color-blush-50)] p-4">
          <CheckCircle2
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--color-blush-700)]"
            strokeWidth={2}
            aria-hidden
          />
          <p className="text-sm leading-relaxed text-[color:var(--color-blush-800)]">
            {t('broadcastAllSent')}
          </p>
        </div>
      ) : null}

      {state.kind === 'success' ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.35 } }}
          className="flex items-start gap-3 rounded-xl border border-[color:var(--color-blush-200)] bg-[color:var(--color-blush-50)] p-4"
          role="status"
        >
          <CheckCircle2
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--color-blush-700)]"
            strokeWidth={2}
            aria-hidden
          />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-[color:var(--color-blush-800)]">
              {t('broadcastSuccess', { count: state.sent })}
              {state.failed > 0 ? ` ${t('broadcastFailures', { count: state.failed })}` : ''}
            </p>
            {!state.mock ? (
              <p className="text-xs leading-relaxed text-[color:var(--color-ink-500)]">
                {t('broadcastQueuedNote')}
              </p>
            ) : null}
            {state.mock ? (
              <p className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase">
                {t('broadcastMockNotice')}
              </p>
            ) : null}
          </div>
        </motion.div>
      ) : null}

      {state.kind === 'error' ? (
        <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
          {state.message}
        </p>
      ) : null}

      {/* Livraison RÉELLE (F4) — remplace le compteur trompeur « X envoyés ». */}
      {delivery.total > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-ivory-100)] p-4">
          <span className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase">
            {t('deliverySectionTitle')}
          </span>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            <DeliveryStat label={t('deliveryDelivered')} value={delivery.delivered} tone="ok" />
            <DeliveryStat label={t('deliveryPending')} value={delivery.pending} tone="muted" />
            <DeliveryStat
              label={t('deliveryUndelivered')}
              value={delivery.undelivered}
              tone="warn"
            />
            <DeliveryStat label={t('deliveryFailed')} value={delivery.failed} tone="warn" />
          </div>
          {delivery.undelivered + delivery.failed > 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-[color:var(--color-border)] bg-white p-3">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--color-gold-700)]"
                strokeWidth={2}
                aria-hidden
              />
              <p className="text-sm leading-relaxed text-[color:var(--color-ink-700)]">
                {t('deliveryWarning', { count: delivery.undelivered + delivery.failed })}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={handleClick}
        disabled={pending || !isPublished || remaining === 0 || noPhones}
        className="self-start"
      >
        <Send className="h-4 w-4" strokeWidth={2} aria-hidden />
        {pending
          ? t('broadcastButtonSending')
          : remaining === 0
            ? noPhones
              ? t('broadcastButtonNoPhones')
              : t('broadcastButtonAllSent')
            : t('broadcastButtonSend', { count: remaining })}
      </Button>
    </section>
  );
}

function DeliveryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ok' | 'muted' | 'warn';
}) {
  const color =
    tone === 'ok'
      ? 'var(--color-blush-700)'
      : tone === 'warn'
        ? 'var(--color-destructive)'
        : 'var(--color-ink-500)';
  return (
    <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-start sm:gap-0.5">
      <span className="text-sm text-[color:var(--color-ink-500)]">{label}</span>
      <span className="font-mono text-base font-medium" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
