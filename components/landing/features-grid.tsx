'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { MessageCircle, Users, QrCode, Camera, Check, type LucideIcon } from 'lucide-react';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

interface FeatureDef {
  key: 'invites' | 'rsvp' | 'checkin' | 'gallery';
  Icon: LucideIcon;
  highlightCount: 3;
}

const FEATURES: FeatureDef[] = [
  { key: 'invites', Icon: MessageCircle, highlightCount: 3 },
  { key: 'rsvp', Icon: Users, highlightCount: 3 },
  { key: 'checkin', Icon: QrCode, highlightCount: 3 },
  { key: 'gallery', Icon: Camera, highlightCount: 3 },
];

/**
 * Landing — 4 piliers V3.
 *
 * Cards verticales avec icône Lucide (plus d'émojis), titre, description longue,
 * 3 highlights bullet-point. Stagger 80 ms desktop, hover lift -3px.
 *
 * Inspiration : Linear features grid, Vercel platform overview.
 */
export function LandingFeaturesGrid() {
  const t = useTranslations('Landing.features');

  return (
    <section id="features" className="paper-grain relative bg-[color:var(--color-surface)] py-28">
      <div className="container-page">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mx-auto mb-16 flex max-w-3xl flex-col items-center gap-3 text-center"
        >
          <motion.span
            variants={scrollReveal}
            className="text-xs font-medium tracking-[0.2em] text-[color:var(--color-champagne-700)] uppercase"
          >
            {t('eyebrow')}
          </motion.span>
          <motion.h2
            variants={scrollReveal}
            className="font-display text-balance italic"
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
            }}
          >
            {t('title')}
          </motion.h2>
          <motion.p
            variants={scrollReveal}
            className="max-w-xl text-base text-[color:var(--color-ink-500)]"
          >
            {t('subtitle')}
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="grid gap-5 md:grid-cols-2"
        >
          {FEATURES.map(({ key, Icon, highlightCount }) => (
            <motion.article
              key={key}
              variants={scrollReveal}
              className="group relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white p-8 transition-[transform,box-shadow,border-color] duration-300 [@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:border-[color:var(--color-blush-300)] [@media(hover:hover)]:hover:shadow-[var(--shadow-blush)]"
            >
              {/* Halo blush en hover */}
              <span
                aria-hidden
                className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full opacity-0 blur-3xl transition-opacity duration-500 [@media(hover:hover)]:group-hover:opacity-100"
                style={{
                  background:
                    'radial-gradient(closest-side, oklch(85% 0.06 22 / 60%), transparent)',
                }}
              />

              <span
                aria-hidden
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  background:
                    'linear-gradient(135deg, oklch(95% 0.025 22) 0%, oklch(91% 0.045 22) 100%)',
                  color: 'var(--color-blush-700)',
                  boxShadow: '0 1px 0 oklch(91% 0.045 22)',
                }}
              >
                <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
              </span>

              <div className="flex flex-col gap-3">
                <h3
                  className="font-display text-2xl italic sm:text-3xl"
                  style={{ letterSpacing: '-0.018em', lineHeight: 1.05 }}
                >
                  {t(`${key}.title`)}
                </h3>
                <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)]">
                  {t(`${key}.description`)}
                </p>
              </div>

              <ul className="mt-auto flex flex-col gap-2 border-t border-[color:var(--color-border)] pt-5">
                {Array.from({ length: highlightCount }).map((_, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-sm text-[color:var(--color-ink-700)]"
                  >
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ background: 'oklch(82% 0.045 145)' }}
                    >
                      <Check
                        className="h-2.5 w-2.5 text-[color:var(--color-sage-700)]"
                        strokeWidth={3}
                        aria-hidden
                      />
                    </span>
                    {t(`${key}.highlights.${idx}`)}
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
