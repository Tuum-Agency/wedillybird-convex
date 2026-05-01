'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';
import { VisualInvitations, VisualRSVP, VisualCheckin, VisualGallery } from './feature-visuals';

interface FeatureDef {
  key: 'invites' | 'rsvp' | 'checkin' | 'gallery';
  Visual: () => React.JSX.Element;
  /** Largeur en colonnes sur grid-cols-12. La paire (7 + 5) ou (5 + 7) zigzag. */
  span: 7 | 5;
  number: '01' | '02' | '03' | '04';
}

const FEATURES: FeatureDef[] = [
  { key: 'invites', Visual: VisualInvitations, span: 7, number: '01' },
  { key: 'rsvp', Visual: VisualRSVP, span: 5, number: '02' },
  { key: 'checkin', Visual: VisualCheckin, span: 5, number: '03' },
  { key: 'gallery', Visual: VisualGallery, span: 7, number: '04' },
];

/**
 * Landing — 4 piliers V4 (re-refonte après feedback "espace vide à droite").
 *
 * Layout zigzag éditorial 7/5 + 5/7 sur grid-cols-12 (pattern Linear / Vercel
 * features). Pas d'espace mort. Chaque card a un visuel SVG signature qui
 * illustre la fonctionnalité (bulles WhatsApp, donut RSVP, QR code, polaroids).
 *
 * Card large (span 7) : layout horizontal — visuel à droite, texte à gauche.
 * Card moyenne (span 5) : layout vertical — visuel en haut, texte en bas.
 *
 * Numérotation 01/02/03/04 en mono caps qui ancre l'esthétique éditoriale
 * 2026 (Linear, Mercury, Off Menu).
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
          className="mb-10 inline-block font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase"
        >
          {t('chapter')}
        </motion.span>

        {/* Header de section — stack vertical aligné gauche, pattern Aesop /
            Atelier Isabey. Pas de split bancal : eyebrow + titre + subtitle
            en colonne, max-w contraint pour aérer la composition. */}
        <motion.header
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mb-20 flex max-w-4xl flex-col gap-7"
        >
          <motion.span
            variants={scrollReveal}
            className="text-xs font-medium tracking-[0.24em] text-[color:var(--color-gold-700)] uppercase"
          >
            {t('eyebrow')}
          </motion.span>

          <motion.h2
            variants={scrollReveal}
            className="font-display text-balance italic"
            style={{
              fontSize: 'clamp(2.25rem, 5vw, 3.75rem)',
              lineHeight: 1.02,
              letterSpacing: '-0.025em',
              color: 'var(--color-ink-900)',
            }}
          >
            {t('title')}
          </motion.h2>

          <motion.p
            variants={scrollReveal}
            className="max-w-xl text-base leading-relaxed text-[color:var(--color-ink-500)] sm:text-lg"
          >
            {t('subtitle')}
          </motion.p>
        </motion.header>

        {/* Grid 12 cols zigzag — 7+5 puis 5+7. Pas de col-span-2 cabossé. */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="grid grid-cols-1 gap-5 lg:grid-cols-12"
        >
          {FEATURES.map(({ key, Visual, span, number }) => {
            const isWide = span === 7;
            return (
              <motion.article
                key={key}
                variants={scrollReveal}
                className={[
                  'group relative flex flex-col overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white transition-[transform,box-shadow,border-color] duration-300',
                  '[@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:border-[color:var(--color-blush-300)] [@media(hover:hover)]:hover:shadow-[var(--shadow-blush)]',
                  isWide ? 'lg:col-span-7 lg:flex-row' : 'lg:col-span-5',
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

                {/* Visuel SVG — moitié droite si wide, haut si normal */}
                <div
                  className={[
                    'relative flex items-center justify-center overflow-hidden bg-[color:var(--color-ivory-50)]',
                    isWide
                      ? 'aspect-[5/3] lg:order-2 lg:aspect-auto lg:w-[42%] lg:flex-shrink-0'
                      : 'aspect-[5/3]',
                  ].join(' ')}
                  style={{
                    background:
                      'linear-gradient(135deg, oklch(98% 0.012 25) 0%, oklch(95% 0.025 22) 100%)',
                  }}
                >
                  <div className="h-full w-full p-4">
                    <Visual />
                  </div>
                  {/* Numéro en filigrane */}
                  <span
                    aria-hidden
                    className="font-display absolute top-4 right-5 text-sm tracking-[0.24em] text-[color:var(--color-gold-700)] uppercase italic"
                    style={{ letterSpacing: '0.32em' }}
                  >
                    {number}
                  </span>
                </div>

                {/* Texte — paddings explicites par axe (px/pt/pb) pour éviter
                    la cascade Tailwind v4 entre shorthand `p-*` et longhand
                    `pt-*`. Pour les cards non-wide (visuel en haut), pt
                    augmenté pour aérer le boundary blush/blanc. */}
                <div
                  className={[
                    'flex flex-1 flex-col gap-4',
                    isWide
                      ? 'px-7 pt-7 pb-7 sm:px-8 sm:pt-8 sm:pb-8 lg:order-1 lg:px-10 lg:pt-10 lg:pb-10'
                      : 'px-7 pt-12 pb-7 sm:px-8 sm:pt-14 sm:pb-8',
                  ].join(' ')}
                >
                  <h3
                    className="text-2xl font-medium tracking-tight text-balance text-[color:var(--color-ink-900)] sm:text-3xl"
                    style={{ letterSpacing: '-0.022em', lineHeight: 1.05 }}
                  >
                    {t(`${key}.title`)}
                  </h3>
                  <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)] sm:text-base">
                    {t(`${key}.description`)}
                  </p>

                  <ul className="mt-auto flex flex-col gap-2 border-t border-[color:var(--color-border)] pt-5">
                    {[0, 1, 2].map((i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-sm text-[color:var(--color-ink-700)]"
                      >
                        <Check
                          aria-hidden
                          className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-gold-500)]"
                          strokeWidth={2}
                        />
                        {t(`${key}.highlights.${i}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
