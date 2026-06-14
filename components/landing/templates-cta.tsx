'use client';

import { Link } from '@/i18n/navigation';
import { analytics } from '@/lib/analytics/posthog-client';

/**
 * CTA de la page Templates, extrait en client component.
 *
 * La page Templates est un server component ; on isole le bouton sign-up ici
 * pour tracker le clic via PostHog. Rend le même `Link` stylé qu'à l'origine.
 */
export function TemplatesCta({ label }: { label: string }) {
  return (
    <Link
      href="/sign-up"
      onClick={() => analytics.ctaClicked({ source: 'templates', destination: '/sign-up' })}
      className="inline-flex h-12 items-center justify-center rounded-full bg-[color:var(--color-ink-900)] px-8 text-sm font-semibold text-white transition-transform hover:scale-105"
    >
      {label}
    </Link>
  );
}
