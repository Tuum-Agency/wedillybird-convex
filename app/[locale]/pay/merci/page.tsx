import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = { title: 'Paiement confirmé — Wedillybird' };

/**
 * Page de confirmation après un paiement en ligne (Wedillybird Pay). Affichée au
 * couple qui a réglé via un lien généré depuis le budget de l'agence. Univers
 * clair « mariage éditorial ». Le paiement est réconcilié côté agence par le
 * webhook (le couple n'a rien d'autre à faire).
 */
export default async function PaymentSuccessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[color:var(--color-background)] px-6 py-16">
      <div className="flex max-w-md flex-col items-center gap-5 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-8 py-12 text-center shadow-[var(--shadow-popover)]">
        <span
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background: 'color-mix(in oklch, var(--color-sage-500) 18%, transparent)',
            color: 'var(--color-sage-500)',
          }}
        >
          <CheckCircle2 className="h-8 w-8" strokeWidth={1.8} />
        </span>
        <h1
          className="font-display italic"
          style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
            letterSpacing: '-0.02em',
            color: 'var(--color-foreground)',
          }}
        >
          Paiement confirmé
        </h1>
        <p className="text-sm leading-relaxed text-[color:var(--color-muted-foreground)]">
          Merci, votre paiement a bien été reçu. Un reçu vous a été envoyé par e-mail et votre
          organisateur est automatiquement informé. Vous pouvez fermer cette page.
        </p>
        <span className="font-mono text-[10px] tracking-[0.22em] text-[color:var(--color-muted-foreground)] uppercase">
          Wedillybird
        </span>
      </div>
    </main>
  );
}
