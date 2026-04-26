'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { MessageCircle, Users, QrCode, Camera, type LucideIcon } from 'lucide-react';
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
 * Landing — 4 piliers V4.
 *
 * Refonte typo : Geist Sans en H3 (pas Fraunces italic partout — diktat de
 * l'audit : Fraunces réservé aux 5 moments cinématiques). Eyebrow chapitre
 * en mono caps. Bullets avec fleurons gold ✦ — pas de checks verts sage qui
 * cassaient la palette.
 *
 * Cards en composition asymétrique : la première (Invitations WhatsApp,
 * pilier signature) est plus grande, les 3 autres en grid 3 colonnes en
 * dessous. Pattern Linear features grid.
 */
export function LandingFeaturesGrid() {
  const t = useTranslations('Landing.features');

  return (
    <section id="features" className="paper-grain relative bg-[color:var(--color-ivory-100)] py-32">
      <div className="container-page">
        {/* Eyebrow chapitre */}
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={inViewOnce}
          className="mb-12 inline-block font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase"
        >
          {t('chapter')}
        </motion.span>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mb-16 grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20"
        >
          <motion.div variants={scrollReveal} className="flex flex-col">
            <span className="text-xs font-medium tracking-[0.24em] text-[color:var(--color-gold-700)] uppercase">
              {t('eyebrow')}
            </span>
            <h2
              className="font-display mt-5 text-balance italic"
              style={{
                fontSize: 'clamp(2.25rem, 5.5vw, 4rem)',
                lineHeight: 1.0,
                letterSpacing: '-0.025em',
                color: 'var(--color-ink-900)',
              }}
            >
              {t('title')}
            </h2>
          </motion.div>
          <motion.div variants={scrollReveal} className="flex items-end">
            <p className="max-w-md text-base leading-relaxed text-[color:var(--color-ink-500)] sm:text-lg">
              {t('subtitle')}
            </p>
          </motion.div>
        </motion.div>

        {/* Grille asymétrique : 1ère card large + 3 cards moyennes en dessous */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="grid gap-5 md:grid-cols-2 lg:grid-cols-6"
        >
          {FEATURES.map(({ key, Icon, highlightCount }, idx) => (
            <motion.article
              key={key}
              variants={scrollReveal}
              className={[
                'group relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white p-8 transition-[transform,box-shadow,border-color] duration-300',
                '[@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:border-[color:var(--color-blush-300)] [@media(hover:hover)]:hover:shadow-[var(--shadow-blush)]',
                idx === 0 ? 'lg:col-span-3 lg:row-span-2' : 'lg:col-span-2',
              ].join(' ')}
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
                  className="text-2xl font-medium tracking-tight text-[color:var(--color-ink-900)] sm:text-3xl"
                  style={{ letterSpacing: '-0.022em', lineHeight: 1.05 }}
                >
                  {t(`${key}.title`)}
                </h3>
                <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)] sm:text-base">
                  {t(`${key}.description`)}
                </p>
              </div>

              <ul className="mt-auto flex flex-col gap-2 border-t border-[color:var(--color-border)] pt-5">
                {Array.from({ length: highlightCount }).map((_, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-[color:var(--color-ink-700)]"
                  >
                    <span
                      aria-hidden
                      className="font-display mt-0.5 inline-block flex-shrink-0 text-[color:var(--color-gold-500)] italic"
                      style={{ fontSize: '14px', lineHeight: 1, letterSpacing: 0 }}
                    >
                      ✦
                    </span>
                    {t(`${key}.highlights.${i}`)}
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
