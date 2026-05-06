import type { ReactNode } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { WedillybirdLogo } from '@/components/brand/wedillybird-logo';

/**
 * Onboarding layout V4 — split éditorial dédié, identique en grammaire au
 * AuthLayout pour assurer la continuité visuelle post sign-in/verify.
 *
 * Le wizard (client component) est rendu côté droit, la photo de Provence
 * regradée + le tagline éditorial à gauche soutiennent le moment.
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <OnboardingAside />
      <main className="paper-grain relative flex flex-col bg-[color:var(--color-ivory-50)]">
        <OnboardingHeader />
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}

function OnboardingAside() {
  return (
    <aside className="relative hidden overflow-hidden lg:block" aria-hidden>
      <Image
        src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=85"
        alt=""
        fill
        priority
        sizes="50vw"
        className="object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background: [
            'linear-gradient(180deg, oklch(98.5% 0.008 85 / 25%) 0%, oklch(48% 0.085 22 / 35%) 100%)',
            'radial-gradient(50% 50% at 50% 100%, oklch(48% 0.085 22 / 45%) 0%, transparent 75%)',
          ].join(', '),
        }}
      />
      <div className="paper-grain pointer-events-none absolute inset-0" />

      {/* Brand top-left — logo blanc via filtre invert (PNG natif sombre). */}
      <Link
        href="/"
        className="absolute top-8 left-8 inline-flex items-center [filter:brightness(0)_invert(1)]"
        aria-label="Wedillybird"
      >
        <WedillybirdLogo />
      </Link>

      <div className="absolute right-8 bottom-12 left-8 flex flex-col gap-4">
        <span className="font-mono text-[10px] tracking-[0.32em] text-white/80 uppercase">
          Bienvenue
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
          Votre mariage commence <span style={{ color: 'oklch(95% 0.025 22)' }}>maintenant.</span>
        </p>
        <span
          aria-hidden
          className="mt-2 inline-block h-px w-16"
          style={{ background: 'oklch(78% 0.075 78)' }}
        />
      </div>
    </aside>
  );
}

function OnboardingHeader() {
  const tCommon = useTranslations('Common');
  return (
    <header className="flex h-20 items-center px-6 lg:hidden">
      <Link
        href="/"
        className="focus-ring inline-flex items-center"
        aria-label={tCommon('appName')}
      >
        <WedillybirdLogo priority />
      </Link>
    </header>
  );
}
