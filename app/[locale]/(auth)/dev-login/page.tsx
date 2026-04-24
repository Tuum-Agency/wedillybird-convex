import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { TEST_USERS } from '@/lib/dev/test-users';

export const metadata: Metadata = {
  title: 'Dev Login',
  robots: { index: false, follow: false },
};

export default async function DevLoginPage({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Connexion développeur
        </h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Choisissez un utilisateur test pour créer une session sans passer par WhatsApp.
        </p>
        <p className="text-xs text-[color:var(--color-destructive)]">
          Cette page est désactivée en production.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {TEST_USERS.map((user) => (
          <li
            key={user.phone}
            className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{user.fullName}</span>
              <span className="text-xs text-[color:var(--color-muted)]">{user.email}</span>
              <span className="text-xs text-[color:var(--color-muted)]">
                {user.phone} · {user.role === 'pro' ? 'Professionnel' : 'Couple'}
              </span>
            </div>
            <form action="/api/dev/login" method="post">
              <input type="hidden" name="phone" value={user.phone} />
              <input type="hidden" name="redirectTo" value={`/${locale}/dashboard`} />
              <button
                type="submit"
                className="focus-ring h-10 rounded-lg bg-[color:var(--color-primary)] px-4 text-sm font-medium text-[color:var(--color-primary-foreground)] transition-colors hover:bg-[color:var(--color-primary)]/90"
              >
                Se connecter
              </button>
            </form>
          </li>
        ))}
      </ul>

      <p className="text-center text-sm text-[color:var(--color-muted)]">
        <Link href="/" className="underline-offset-4 hover:underline">
          Retour à l’accueil
        </Link>
      </p>
    </section>
  );
}
