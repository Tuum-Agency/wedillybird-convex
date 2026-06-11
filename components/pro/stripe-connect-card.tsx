'use client';

import { useEffect, useState, useTransition } from 'react';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreditCard, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  startStripeConnectAction,
  disconnectStripeConnectAction,
} from '@/app/[locale]/(app)/pro/actions';

export interface ConnectStatus {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

const ERROR_LABEL: Record<string, string> = {
  PAYMENTS_NOT_CONFIGURED: 'Le paiement en ligne n’est pas encore activé sur la plateforme.',
  CONNECT_NOT_ENABLED:
    'La connexion Stripe n’est pas finalisée côté plateforme. Réessayez plus tard.',
  FORBIDDEN: 'Seuls le propriétaire et les admins peuvent gérer la connexion Stripe.',
  NO_ORG: 'Organisation introuvable.',
  UNAUTHORIZED: 'Session expirée. Reconnectez-vous.',
};
// Code connu → message FR ; sinon on affiche le message brut (court) pour ne pas
// masquer la vraie cause derrière un générique.
const errLabel = (c: string) =>
  ERROR_LABEL[c] ?? (c && c.length < 200 ? c : 'Une erreur est survenue. Réessayez.');

/**
 * Carte de connexion Stripe : l'agence relie SON propre compte Stripe via OAuth
 * (« Se connecter avec Stripe »). Une fois connectée, les liens de paiement sont
 * encaissés directement sur son compte — Wedillybird ne touche jamais les fonds
 * et ne prélève aucune commission. Deux états : non connecté, connecté.
 */
export function StripeConnectCard({
  status,
  canManage,
}: {
  status: ConnectStatus;
  canManage: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [pending, startTransition] = useTransition();

  const connected = status.accountId != null;
  const connectResult = searchParams.get('connect');
  // Message de retour OAuth dérivé du paramètre d'URL (pas de setState en effet).
  const returnError =
    connectResult === 'error'
      ? 'La connexion Stripe a échoué. Réessayez.'
      : connectResult === 'denied'
        ? 'Connexion annulée.'
        : null;
  const shownError = error ?? returnError;

  // Au retour d'une connexion réussie, on nettoie le paramètre d'URL (navigation
  // seule — pas de setState dans l'effet, cf. règle react-hooks).
  useEffect(() => {
    if (connectResult === 'ok') router.replace('/pro/payments' as Route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectResult]);

  function onConnect() {
    setError(null);
    startTransition(async () => {
      const res = await startStripeConnectAction();
      if (!res.ok) {
        setError(errLabel(res.error));
        return;
      }
      window.location.href = res.url;
    });
  }

  function onDisconnect() {
    setError(null);
    startTransition(async () => {
      const res = await disconnectStripeConnectAction();
      if (!res.ok) {
        setError(errLabel(res.error));
        return;
      }
      setConfirmingDisconnect(false);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
            style={
              connected
                ? {
                    background: 'color-mix(in oklch, var(--color-sage-500) 18%, transparent)',
                    color: 'var(--color-sage-500)',
                  }
                : { background: 'var(--color-surface-elevated)', color: 'var(--color-blush-300)' }
            }
          >
            {connected ? (
              <CheckCircle2 className="h-5 w-5" strokeWidth={1.9} />
            ) : (
              <CreditCard className="h-5 w-5" strokeWidth={1.9} />
            )}
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg text-[color:var(--color-foreground)] italic">
              Paiements en ligne
            </h2>
            <p className="max-w-prose text-sm text-[color:var(--color-muted-foreground)]">
              {connected
                ? 'Votre compte Stripe est connecté. Les liens de paiement sont encaissés directement sur votre compte — Wedillybird ne prélève aucune commission et ne touche jamais vos fonds.'
                : 'Connectez votre propre compte Stripe pour encaisser vos couples par carte. L’argent va directement sur votre compte, sans commission Wedillybird.'}
            </p>
          </div>
        </div>
        {connected ? (
          <span
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] uppercase"
            style={{ background: 'oklch(27% 0.05 145)', color: 'oklch(83% 0.08 145)' }}
          >
            <CheckCircle2 className="h-3 w-3" strokeWidth={2.2} aria-hidden />
            Connecté
          </span>
        ) : null}
      </div>

      {connected && status.accountId ? (
        <p className="font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
          {status.accountId}
        </p>
      ) : null}

      {shownError ? (
        <p
          role="alert"
          className="flex items-center gap-2 text-sm text-[color:var(--color-danger)]"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" strokeWidth={2} aria-hidden />
          {shownError}
        </p>
      ) : null}

      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          {!connected ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onConnect}
              disabled={pending}
            >
              <CreditCard className="h-4 w-4" strokeWidth={2} aria-hidden />
              {pending ? 'Redirection…' : 'Se connecter avec Stripe'}
            </Button>
          ) : confirmingDisconnect ? (
            <>
              <Button
                type="button"
                variant="destructive"
                size="md"
                onClick={onDisconnect}
                disabled={pending}
              >
                {pending ? 'Déconnexion…' : 'Confirmer la déconnexion'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setConfirmingDisconnect(false)}
                disabled={pending}
              >
                Annuler
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setConfirmingDisconnect(true)}
              disabled={pending}
            >
              Déconnecter
            </Button>
          )}
        </div>
      ) : (
        <p className="font-mono text-[10px] tracking-[0.12em] text-[color:var(--color-muted-foreground)] uppercase">
          Gestion de la connexion Stripe réservée au propriétaire et aux admins.
        </p>
      )}
    </section>
  );
}
