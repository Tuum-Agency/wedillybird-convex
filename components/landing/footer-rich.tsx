import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Send } from 'lucide-react';
import { WedillybirdMark } from '@/components/brand/wedillybird-mark';

/**
 * Landing — Footer V4.
 *
 * Fix audit verdicts :
 * - Drapeaux emoji unicode → libellés texte séparés par middots (rendu
 *   homogène cross-OS, plus élégant)
 * - <span> non-cliquables → <Link> ou anchors fonctionnels
 * - "Tuum Agency · Paris & Dakar" leak → retiré (signature Wedillybird seule)
 *
 * Block tagline + newsletter + 4 colonnes (Produit, Pros, Ressources, Légal)
 * + régions + logos paiement (Stripe + CinetPay) + copyright.
 */
const PRODUCT_LINKS = [
  { key: 'features', href: '/#features' as const },
  { key: 'pricing', href: '/#pricing' as const },
  { key: 'demo', href: '/sign-up' as const },
  { key: 'templates', href: '/sign-up' as const },
] as const;

const PROS_LINKS = [
  { key: 'planners', href: '/sign-up' as const },
  { key: 'venues', href: '/sign-up' as const },
  { key: 'agencies', href: '/sign-up' as const },
  { key: 'api', href: '/sign-up' as const },
] as const;

const RESOURCES_LINKS = [
  { key: 'blog', href: '/' as const },
  { key: 'guide', href: '/#faq' as const },
  { key: 'faq', href: '/#faq' as const },
  { key: 'support', href: '/#faq' as const },
] as const;

const LEGAL_LINKS = [
  { key: 'terms', href: '/legal/terms' as const },
  { key: 'privacy', href: '/legal/privacy' as const },
  { key: 'cookies', href: '/legal/cookies' as const },
  { key: 'rgpd', href: '/legal/privacy' as const },
] as const;

const REGIONS = [
  'France',
  'Sénégal',
  'Côte d’Ivoire',
  'Mali',
  'Burkina Faso',
  'Togo',
  'Bénin',
  'Cameroun',
] as const;

export function LandingFooterRich() {
  const t = useTranslations('Landing.footer');
  const tCommon = useTranslations('Common');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-ivory-100)]">
      <div className="container-page py-20">
        {/* Block top : tagline + newsletter */}
        <div className="grid gap-12 border-b border-[color:var(--color-border)] pb-14 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div className="flex flex-col gap-5">
            <Link
              href="/"
              className="font-display inline-flex items-center gap-3 text-2xl tracking-tight text-[color:var(--color-ink-900)] italic"
            >
              <WedillybirdMark className="h-8 w-8 text-[color:var(--color-blush-500)]" />
              {tCommon('appName')}
            </Link>
            <p className="max-w-md text-sm leading-relaxed text-[color:var(--color-ink-500)]">
              {t('tagline')}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h3
              className="font-display text-2xl italic"
              style={{ letterSpacing: '-0.018em', lineHeight: 1.1, color: 'var(--color-ink-900)' }}
            >
              {t('newsletterTitle')}
            </h3>
            <p className="text-sm text-[color:var(--color-ink-500)]">{t('newsletterSubtitle')}</p>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              action="/api/newsletter"
              method="POST"
            >
              <label className="sr-only" htmlFor="footer-newsletter-email">
                Email
              </label>
              <input
                id="footer-newsletter-email"
                type="email"
                name="email"
                required
                placeholder={t('newsletterPlaceholder')}
                className="focus-ring flex-1 rounded-full border border-[color:var(--color-border-strong)] bg-white px-5 py-3 text-sm text-[color:var(--color-ink-900)] placeholder:text-[color:var(--color-ink-300)]"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--color-blush-700)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--color-blush-800)]"
              >
                {t('newsletterCta')}
                <Send className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </button>
            </form>
          </div>
        </div>

        {/* Block middle : 4 colonnes liens cliquables */}
        <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <FooterColumn
            title={t('columns.product.title')}
            links={PRODUCT_LINKS.map((l) => ({
              ...l,
              label: t(`columns.product.links.${l.key}`),
            }))}
          />
          <FooterColumn
            title={t('columns.pros.title')}
            links={PROS_LINKS.map((l) => ({
              ...l,
              label: t(`columns.pros.links.${l.key}`),
            }))}
          />
          <FooterColumn
            title={t('columns.resources.title')}
            links={RESOURCES_LINKS.map((l) => ({
              ...l,
              label: t(`columns.resources.links.${l.key}`),
            }))}
          />
          <FooterColumn
            title={t('columns.legal.title')}
            links={LEGAL_LINKS.map((l) => ({
              ...l,
              label: t(`columns.legal.links.${l.key}`),
            }))}
          />
        </div>

        {/* Block regions + paiements */}
        <div className="flex flex-col gap-6 border-t border-[color:var(--color-border)] pt-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
              {t('regions')}
            </span>
            <p className="text-sm text-[color:var(--color-ink-700)]">
              {REGIONS.map((r, i) => (
                <span key={r}>
                  {r}
                  {i < REGIONS.length - 1 && (
                    <span className="mx-2 text-[color:var(--color-ink-300)]" aria-hidden>
                      ·
                    </span>
                  )}
                </span>
              ))}
            </p>
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
              {t('payments')}
            </span>
            <div className="flex items-center gap-4">
              <span className="rounded-md border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-xs font-bold tracking-wide text-[#635bff]">
                Stripe
              </span>
              <span className="rounded-md border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-xs font-bold tracking-wide text-[oklch(45%_0.13_152)]">
                CinetPay
              </span>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-10 border-t border-[color:var(--color-border)] pt-8 font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-300)] uppercase">
          © {year} Wedillybird · {t('rights')}
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ key: string; label: string; href: string }>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="font-mono text-[11px] font-semibold tracking-[0.24em] text-[color:var(--color-ink-900)] uppercase">
        {title}
      </h4>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.key}>
            <a
              href={link.href}
              className="text-sm text-[color:var(--color-ink-500)] transition-colors hover:text-[color:var(--color-blush-700)]"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
