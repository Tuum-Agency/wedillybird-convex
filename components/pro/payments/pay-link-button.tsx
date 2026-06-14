'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Copy, ExternalLink, Link2, MessageSquare } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { paymentRequestMessage } from '@/lib/pro/payments';
import { createInvoicePaymentLinkAction } from '@/app/[locale]/(app)/pro/payments/actions';

/** Codes d'erreur serveur disposant d'un libellé dédié (sinon message générique). */
const LINK_ERR_CODES = new Set([
  'STRIPE_NOT_CONNECTED',
  'PAYMENTS_NOT_CONFIGURED',
  'FEATURE_NOT_IN_PLAN',
  'ALREADY_PAID',
  'INVALID_AMOUNT',
  'INVALID_DESCRIPTION',
  'INVALID_SCHEDULE',
]);

/** Hook : traduit un code d'erreur de création de lien (fallback générique). */
export function useLinkErr() {
  const t = useTranslations('Pro.payments');
  return (code: string) =>
    LINK_ERR_CODES.has(code) ? t(`linkErrors.${code}` as const) : t('linkErrors.generic');
}

interface CreatedLink {
  url: string;
  amountMinor: number;
  description: string;
}

/**
 * Crée un VRAI lien de paiement Stripe pour une échéance de facture (charge
 * directe sur le compte de l'agence). Une fois créé : copier le lien, copier un
 * message prêt-à-envoyer (dans la langue de l'agence), ou ouvrir. Sans compte
 * connecté → invite à connecter. Partagé entre le cockpit Paiements et Devis & Factures.
 */
export function PayLinkButton({
  docId,
  index,
  connected,
  clientName,
}: {
  docId: string;
  index: number;
  connected: boolean;
  clientName?: string;
}) {
  const t = useTranslations('Pro.payments');
  const linkErr = useLinkErr();
  const locale = useLocale();
  const [link, setLink] = useState<CreatedLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!connected) {
    return (
      <span className="font-mono text-[10px] tracking-[0.08em] text-[color:var(--color-muted-foreground)]">
        {t('payLink.connectPrompt')}
      </span>
    );
  }

  if (link) {
    const copyMessage = () => {
      const msg = paymentRequestMessage(locale, {
        clientName,
        amountMinor: link.amountMinor,
        description: link.description,
        url: link.url,
      });
      void navigator.clipboard?.writeText(msg);
      toast.success(t('toasts.messageCopied'));
    };
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(link.url);
            toast.success(t('toasts.linkCopied'));
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-2.5 py-1.5 text-xs text-[color:var(--color-ink-700)] hover:border-[color:var(--color-blush-400)] hover:text-[color:var(--color-foreground)]"
        >
          <Copy className="h-3 w-3" strokeWidth={1.9} aria-hidden />
          {t('actions.copyLink')}
        </button>
        <button
          type="button"
          onClick={copyMessage}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-2.5 py-1.5 text-xs text-[color:var(--color-ink-700)] hover:border-[color:var(--color-blush-400)] hover:text-[color:var(--color-foreground)]"
        >
          <MessageSquare className="h-3 w-3" strokeWidth={1.9} aria-hidden />
          {t('actions.copyMessage')}
        </button>
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-2.5 py-1.5 text-xs text-[color:var(--color-ink-700)] hover:border-[color:var(--color-sage-500)] hover:text-[color:var(--color-foreground)]"
        >
          <ExternalLink className="h-3 w-3" strokeWidth={1.9} aria-hidden />
          {t('actions.open')}
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await createInvoicePaymentLinkAction(docId, index);
            if (!res.ok) {
              setError(linkErr(res.error));
              return;
            }
            setLink({ url: res.url, amountMinor: res.amountMinor, description: res.description });
            void navigator.clipboard?.writeText(res.url);
            toast.success(t('toasts.linkCreated'));
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-2.5 py-1.5 text-xs text-[color:var(--color-ink-700)] hover:border-[color:var(--color-blush-400)] hover:text-[color:var(--color-foreground)] disabled:opacity-60"
      >
        <Link2 className="h-3 w-3" strokeWidth={1.9} aria-hidden />
        {pending ? t('actions.creating') : t('payLink.cta')}
      </button>
      {error ? (
        <span role="alert" className="text-[10px] text-[color:var(--color-danger)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
