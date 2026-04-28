'use client';

import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Send, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { broadcastInvitationsAction } from '@/app/[locale]/(app)/events/actions';

interface Counts {
  total: number;
  invited: number;
  withPhone: number;
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
}: {
  eventId: string;
  eventStatus: 'draft' | 'active' | 'archived' | 'cancelled';
  counts: Counts;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SendState>({ kind: 'idle' });

  const isPublished = eventStatus === 'active';
  const remaining = Math.max(0, counts.withPhone - counts.invited);
  const allSent = counts.withPhone > 0 && remaining === 0;
  const noPhones = counts.withPhone === 0;

  function handleClick() {
    if (!isPublished || remaining === 0) return;
    const confirmed = window.confirm(
      `Confirmer l'envoi à ${remaining} invité${remaining > 1 ? 's' : ''} ? Cette action est irréversible — chaque invité recevra son lien personnalisé sur WhatsApp.`,
    );
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
          ? "L'événement doit être publié pour envoyer les invitations."
          : result.error === 'FORBIDDEN'
            ? 'Vous n’avez pas les droits sur cet événement.'
            : "Échec de l'envoi. Réessayez dans un instant.";
      setState({ kind: 'error', message });
    });
  }

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-[color:var(--color-border)] bg-white p-7 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-blush-700)] uppercase">
          Envoi des invitations
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
          Faites partir vos invitations WhatsApp
        </h2>

        {/* Stats progress */}
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[color:var(--color-ink-700)]">
              <strong className="text-[color:var(--color-ink-900)]">{counts.invited}</strong>{' '}
              <span className="text-[color:var(--color-ink-500)]">/ {counts.withPhone}</span>{' '}
              invitations envoyées
            </span>
            {counts.total > counts.withPhone ? (
              <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-500)] uppercase">
                {counts.total - counts.withPhone} sans téléphone
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
            Publiez d&apos;abord votre événement (section ci-dessus) pour activer l&apos;envoi des
            invitations.
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
            Ajoutez des invités avec un numéro WhatsApp pour pouvoir leur envoyer une invitation.
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
            Toutes les invitations sont parties. Si vous ajoutez de nouveaux invités, le bouton
            ré-apparaîtra pour eux.
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
              {state.sent} invitation{state.sent > 1 ? 's' : ''} envoyée
              {state.sent > 1 ? 's' : ''} avec succès.
              {state.failed > 0 ? ` ${state.failed} échec${state.failed > 1 ? 's' : ''}.` : ''}
            </p>
            {state.mock ? (
              <p className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase">
                Mode mock — pas d&apos;envoi réel (credentials WhatsApp absents).
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
          ? 'Envoi en cours…'
          : remaining === 0
            ? noPhones
              ? 'Aucun invité avec téléphone'
              : 'Tout est envoyé'
            : `Envoyer à ${remaining} invité${remaining > 1 ? 's' : ''}`}
      </Button>
    </section>
  );
}
