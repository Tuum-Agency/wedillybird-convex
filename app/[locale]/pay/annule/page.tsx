import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { XCircle } from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Pay' });
  return { title: t('cancel.metaTitle') };
}

/**
 * Page affichée si le couple annule (ou ferme) le paiement en ligne avant de
 * régler. Le lien reste valable : il peut réessayer depuis le lien d'origine.
 */
export default async function PaymentCancelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Pay');
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[color:var(--color-background)] px-6 py-16">
      <div className="flex max-w-md flex-col items-center gap-5 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-8 py-12 text-center shadow-[var(--shadow-popover)]">
        <span
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background: 'color-mix(in oklch, var(--color-muted-foreground) 14%, transparent)',
            color: 'var(--color-muted-foreground)',
          }}
        >
          <XCircle className="h-8 w-8" strokeWidth={1.8} />
        </span>
        <h1
          className="font-display italic"
          style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
            letterSpacing: '-0.02em',
            color: 'var(--color-foreground)',
          }}
        >
          {t('cancel.title')}
        </h1>
        <p className="text-sm leading-relaxed text-[color:var(--color-muted-foreground)]">
          {t('cancel.body')}
        </p>
        <span className="font-mono text-[10px] tracking-[0.22em] text-[color:var(--color-muted-foreground)] uppercase">
          Wedillybird
        </span>
      </div>
    </main>
  );
}
