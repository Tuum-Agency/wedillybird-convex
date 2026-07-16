import type { ReactNode } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { WedillybirdLogo } from '@/components/brand/wedillybird-logo';

/**
 * Layout auth V4 — split éditorial mariage premium.
 *
 * Desktop (≥lg) : 50/50.
 *   - Gauche : photo couple Provence regradée, overlay blush, tagline italique
 *     en surimpression bas + filet gold ornemental.
 *   - Droite : zone formulaire ivoire avec paper-grain, card centrée max-w-md.
 *
 * Mobile : stack vertical. Photo masquée (perf 3G Afrique), juste le brand
 * en haut + form en card centrée.
 *
 * Pattern Linear sign-in / Mercury onboarding / Stripe checkout.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthAside />
      <main className="paper-grain relative flex flex-col bg-[color:var(--color-ivory-50)]">
        <AuthHeader />
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-md">{children}</div>
        </div>
        <AuthFooter />
      </main>
    </div>
  );
}

function AuthAside() {
  const t = useTranslations('Landing.hero');
  const tAuth = useTranslations('Auth');
  return (
    <aside className="relative hidden overflow-hidden lg:block" aria-hidden>
      <Image
        src="https://images.unsplash.com/photo-1606216794074-735e91aa2c92?auto=format&fit=crop&w=1600&q=85"
        alt=""
        fill
        priority
        sizes="50vw"
        className="object-cover"
      />
      {/* Overlay blush + ivoire pour réchauffer la photo et soutenir le texte */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'linear-gradient(180deg, oklch(98.5% 0.008 85 / 25%) 0%, oklch(48% 0.085 22 / 35%) 100%)',
            'radial-gradient(50% 50% at 50% 100%, oklch(48% 0.085 22 / 45%) 0%, transparent 75%)',
          ].join(', '),
        }}
      />
      {/* Texture grain papier */}
      <div className="paper-grain pointer-events-none absolute inset-0" />

      {/* Brand en haut-gauche — logo PNG en blanc via filtre invert
          (logo natif est sombre sur ivoire ; sur fond photo on le retourne). */}
      <Link
        href="/"
        className="absolute top-8 left-8 inline-flex items-center [filter:brightness(0)_invert(1)]"
        aria-label="Wedillybird"
      >
        <WedillybirdLogo />
      </Link>

      {/* Tagline éditorial en bas-gauche */}
      <div className="absolute right-8 bottom-12 left-8 flex flex-col gap-4">
        <span className="font-mono text-[10px] tracking-[0.32em] text-white/80 uppercase">
          {tAuth('tagline')}
        </span>
        <p
          className="font-display text-balance text-white italic"
          style={{
            fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.022em',
            textShadow: '0 2px 8px oklch(22% 0.018 28 / 30%)',
          }}
        >
          {t('title')} <span style={{ color: 'oklch(95% 0.025 22)' }}>{t('titleAccent')}</span>
        </p>
        {/* Filet ornemental gold */}
        <span
          aria-hidden
          className="mt-2 inline-block h-px w-16"
          style={{ background: 'oklch(78% 0.075 78)' }}
        />
      </div>
    </aside>
  );
}

function AuthHeader() {
  const tCommon = useTranslations('Common');
  return (
    <header className="flex h-20 items-center justify-between px-6 lg:hidden">
      <Link
        href="/"
        className="focus-ring inline-flex items-center"
        aria-label={tCommon('appName')}
      >
        <WedillybirdLogo priority />
      </Link>
      <Link
        href="/"
        className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-ink-900)]"
      >
        ← {tCommon('home')}
      </Link>
    </header>
  );
}

function AuthFooter() {
  const t = useTranslations('Auth');
  return (
    <footer className="flex justify-center px-6 pb-8 lg:pb-10">
      <p className="max-w-sm text-center font-mono text-[10px] leading-relaxed tracking-[0.16em] text-[color:var(--color-ink-400)] uppercase">
        {t('privacy')}
      </p>
    </footer>
  );
}
