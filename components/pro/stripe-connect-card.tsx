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
 * Carte de connexion Stripe : l'agence connecte SON propre compte Stripe via
 * l'onboarding hébergé par Stripe. Une fois l'onboarding terminé, les liens de
 * paiement sont encaissés directement sur son compte — Wedillybird ne touche
 * jamais les fonds et ne prélève aucune commission. Trois états : non connecté,
 * onboarding à terminer, connecté.
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

  const accountExists = status.accountId != null;
  const active = accountExists && status.chargesEnabled;
  const incomplete = accountExists && !status.chargesEnabled;

  const connectResult = searchParams.get('connect');
  // Messages de retour dérivés du paramètre d'URL (pas de setState dans l'effet).
  const returnError = connectResult === 'error' ? 'La connexion Stripe a échoué. Réessayez.' : null;
  const returnInfo =
    connectResult === 'incomplete'
      ? 'Configuration Stripe non terminée — continuez pour activer l’encaissement.'
      : null;
  const shownError = error ?? returnError;

  // Au retour d'un onboarding réussi, on nettoie le paramètre d'URL (navigation
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
              active
                ? {
                    background: 'color-mix(in oklch, var(--color-sage-500) 18%, transparent)',
                    color: 'var(--color-sage-500)',
                  }
                : incomplete
                  ? {
                      background: 'color-mix(in oklch, var(--color-gold-500) 18%, transparent)',
                      color: 'var(--color-gold-500)',
                    }
                  : { background: 'var(--color-surface-elevated)', color: 'var(--color-blush-300)' }
            }
          >
            {active ? (
              <CheckCircle2 className="h-5 w-5" strokeWidth={1.9} />
            ) : incomplete ? (
              <AlertTriangle className="h-5 w-5" strokeWidth={1.9} />
            ) : (
              <CreditCard className="h-5 w-5" strokeWidth={1.9} />
            )}
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg text-[color:var(--color-foreground)] italic">
              Paiements en ligne
            </h2>
            <p className="max-w-prose text-sm text-[color:var(--color-muted-foreground)]">
              {active
                ? 'Votre compte Stripe est connecté. Les liens de paiement sont encaissés directement sur votre compte — Wedillybird ne prélève aucune commission et ne touche jamais vos fonds.'
                : incomplete
                  ? 'Votre configuration Stripe n’est pas terminée. Continuez l’onboarding Stripe pour activer l’encaissement en ligne.'
                  : 'Connectez votre propre compte Stripe pour encaisser vos couples (carte, virement). L’argent va directement sur votre compte, sans commission Wedillybird.'}
            </p>
          </div>
        </div>
        {active ? (
          <span
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] uppercase"
            style={{ background: 'oklch(27% 0.05 145)', color: 'oklch(83% 0.08 145)' }}
          >
            <CheckCircle2 className="h-3 w-3" strokeWidth={2.2} aria-hidden />
            Connecté
          </span>
        ) : incomplete ? (
          <span
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] uppercase"
            style={{ background: 'oklch(29% 0.05 80)', color: 'oklch(87% 0.09 85)' }}
          >
            <AlertTriangle className="h-3 w-3" strokeWidth={2.2} aria-hidden />À terminer
          </span>
        ) : null}
      </div>

      {accountExists && status.accountId ? (
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
      ) : returnInfo ? (
        <p className="flex items-center gap-2 text-sm text-[color:var(--color-muted-foreground)]">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" strokeWidth={2} aria-hidden />
          {returnInfo}
        </p>
      ) : null}

      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          {!accountExists ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onConnect}
              disabled={pending}
            >
              <CreditCard className="h-4 w-4" strokeWidth={2} aria-hidden />
              {pending ? 'Redirection…' : 'Connecter mon compte Stripe'}
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
          ) : incomplete ? (
            <>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={onConnect}
                disabled={pending}
              >
                <CreditCard className="h-4 w-4" strokeWidth={2} aria-hidden />
                {pending ? 'Redirection…' : 'Continuer la configuration'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setConfirmingDisconnect(true)}
                disabled={pending}
              >
                Déconnecter
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
