'use client';

import { useState, useTransition } from 'react';
import { useLocale } from 'next-intl';
import { Copy, ExternalLink, Link2, MessageSquare } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { paymentRequestMessage } from '@/lib/pro/payments';
import { createInvoicePaymentLinkAction } from '@/app/[locale]/(app)/pro/payments/actions';

export const LINK_ERR: Record<string, string> = {
  STRIPE_NOT_CONNECTED: 'Connectez d’abord votre compte Stripe.',
  PAYMENTS_NOT_CONFIGURED: 'Le paiement en ligne n’est pas encore configuré.',
  FEATURE_NOT_IN_PLAN: 'Réservé au forfait Business.',
  ALREADY_PAID: 'Cette échéance est déjà réglée.',
  INVALID_AMOUNT: 'Montant invalide.',
  INVALID_DESCRIPTION: 'Indiquez un libellé.',
  INVALID_SCHEDULE: 'Échéance introuvable.',
};
export const linkErr = (c: string) => LINK_ERR[c] ?? 'Création du lien impossible. Réessayez.';

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
  const locale = useLocale();
  const [link, setLink] = useState<CreatedLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!connected) {
    return (
      <span className="font-mono text-[10px] tracking-[0.08em] text-[color:var(--color-muted-foreground)]">
        Connectez votre Stripe pour générer un lien
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
      toast.success('Message prêt à envoyer copié');
    };
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(link.url);
            toast.success('Lien copié');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-2.5 py-1.5 text-xs text-[color:var(--color-ink-700)] hover:border-[color:var(--color-blush-400)] hover:text-[color:var(--color-foreground)]"
        >
          <Copy className="h-3 w-3" strokeWidth={1.9} aria-hidden />
          Copier le lien
        </button>
        <button
          type="button"
          onClick={copyMessage}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-2.5 py-1.5 text-xs text-[color:var(--color-ink-700)] hover:border-[color:var(--color-blush-400)] hover:text-[color:var(--color-foreground)]"
        >
          <MessageSquare className="h-3 w-3" strokeWidth={1.9} aria-hidden />
          Copier le message
        </button>
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-2.5 py-1.5 text-xs text-[color:var(--color-ink-700)] hover:border-[color:var(--color-sage-500)] hover:text-[color:var(--color-foreground)]"
        >
          <ExternalLink className="h-3 w-3" strokeWidth={1.9} aria-hidden />
          Ouvrir
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
            toast.success('Lien de paiement créé et copié');
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-2.5 py-1.5 text-xs text-[color:var(--color-ink-700)] hover:border-[color:var(--color-blush-400)] hover:text-[color:var(--color-foreground)] disabled:opacity-60"
      >
        <Link2 className="h-3 w-3" strokeWidth={1.9} aria-hidden />
        {pending ? 'Création…' : 'Lien de paiement'}
      </button>
      {error ? (
        <span role="alert" className="text-[10px] text-[color:var(--color-danger)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
