import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Heart, Send } from 'lucide-react';

/**
 * Landing — Footer riche V3.
 *
 * Block tagline + newsletter + 4 colonnes (Produit, Pros, Ressources, Légal)
 * + drapeaux régions + logos paiement (Stripe + CinetPay) + copyright.
 *
 * Server component (pas de 'use client') — pas d'animation côté footer.
 * Le formulaire newsletter est passive (input + submit) qui pointe vers une
 * future route /api/newsletter (TODO sprint marketing).
 */
const PRODUCT_LINKS = ['features', 'pricing', 'demo', 'templates'] as const;
const PROS_LINKS = ['planners', 'venues', 'agencies', 'api'] as const;
const RESOURCES_LINKS = ['blog', 'guide', 'faq', 'support'] as const;
const LEGAL_LINKS = ['terms', 'privacy', 'cookies', 'rgpd'] as const;

const REGIONS = [
  { code: 'fr', label: 'France', flag: '🇫🇷' },
  { code: 'sn', label: 'Sénégal', flag: '🇸🇳' },
  { code: 'ci', label: 'Côte d’Ivoire', flag: '🇨🇮' },
  { code: 'ml', label: 'Mali', flag: '🇲🇱' },
  { code: 'bf', label: 'Burkina Faso', flag: '🇧🇫' },
  { code: 'tg', label: 'Togo', flag: '🇹🇬' },
  { code: 'bj', label: 'Bénin', flag: '🇧🇯' },
  { code: 'cm', label: 'Cameroun', flag: '🇨🇲' },
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
              className="font-display inline-flex items-center gap-2 text-2xl tracking-tight text-[color:var(--color-ink-900)] italic"
            >
              <Heart
                className="h-5 w-5 fill-[oklch(72%_0.09_20)] text-[oklch(72%_0.09_20)]"
                strokeWidth={1.5}
                aria-hidden
              />
              {tCommon('appName')}
            </Link>
            <p className="max-w-md text-sm leading-relaxed text-[color:var(--color-ink-500)]">
              {t('tagline')}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h3
              className="font-display text-2xl italic"
              style={{ letterSpacing: '-0.018em', lineHeight: 1.1 }}
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

        {/* Block middle : 4 colonnes liens */}
        <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <FooterColumn
            title={t('columns.product.title')}
            links={PRODUCT_LINKS.map((k) => ({
              key: k,
              label: t(`columns.product.links.${k}`),
            }))}
          />
          <FooterColumn
            title={t('columns.pros.title')}
            links={PROS_LINKS.map((k) => ({
              key: k,
              label: t(`columns.pros.links.${k}`),
            }))}
          />
          <FooterColumn
            title={t('columns.resources.title')}
            links={RESOURCES_LINKS.map((k) => ({
              key: k,
              label: t(`columns.resources.links.${k}`),
            }))}
          />
          <FooterColumn
            title={t('columns.legal.title')}
            links={LEGAL_LINKS.map((k) => ({
              key: k,
              label: t(`columns.legal.links.${k}`),
            }))}
          />
        </div>

        {/* Block regions + paiements */}
        <div className="flex flex-col gap-6 border-t border-[color:var(--color-border)] pt-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-wide text-[color:var(--color-ink-500)] uppercase">
              {t('regions')}
            </span>
            <ul className="flex flex-wrap gap-3 text-sm text-[color:var(--color-ink-700)]">
              {REGIONS.map((r) => (
                <li key={r.code} className="inline-flex items-center gap-1.5">
                  <span aria-hidden>{r.flag}</span>
                  <span>{r.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            <span className="text-xs font-medium tracking-wide text-[color:var(--color-ink-500)] uppercase">
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
        <div className="mt-10 flex flex-col items-start gap-2 border-t border-[color:var(--color-border)] pt-8 text-xs text-[color:var(--color-ink-300)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {year} Wedillybird · {t('rights')}
          </span>
          <span>Tuum Agency · Paris &amp; Dakar</span>
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
  links: ReadonlyArray<{ key: string; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold tracking-wide text-[color:var(--color-ink-900)]">
        {title}
      </h4>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.key}>
            <span className="cursor-default text-sm text-[color:var(--color-ink-500)] transition-colors hover:text-[color:var(--color-blush-700)]">
              {link.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
