import { setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { WedillybirdLogo } from '@/components/brand/wedillybird-logo';
import { LegalFooter } from '@/components/layout/legal-footer';

export default async function TemplatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-[color:var(--color-ivory-50)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-ivory-50)]/65">
        <div className="container-page flex items-center justify-between gap-6 py-4">
          <Link href="/" className="focus-ring inline-flex items-center">
            <WedillybirdLogo />
          </Link>
          <Link
            href="/"
            className="focus-ring inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-ink-900)]"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            Retour
          </Link>
        </div>
      </header>

      <main className="container-page flex min-h-[60vh] flex-1 flex-col items-center justify-center py-32 text-center">
        <h1 className="font-display text-4xl text-[color:var(--color-ink-900)] italic">
          Templates d&apos;invitation
        </h1>
        <p className="mt-4 max-w-md text-[color:var(--color-ink-500)]">
          Notre galerie de templates WhatsApp sera bientôt disponible. En attendant, créez un compte
          pour voir nos modèles par défaut.
        </p>
      </main>

      <LegalFooter />
    </>
  );
}
