'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { MessageSquare, Globe, Link2 } from 'lucide-react';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

/**
 * Landing — « Your guests, wherever they are » (canal dual SMS / WhatsApp).
 *
 * Positionne le routage par pays comme un argument de vente plutôt qu'un
 * détail technique : SMS aux US, WhatsApp à l'international, un seul lien qui
 * choisit le bon canal par invité. Inséré après les 4 piliers (features).
 *
 * Style aligné sur features-grid / pricing-pros : eyebrow mono caps, titre
 * Migra italic (font-display), cards blanches arrondies, halo blush au hover,
 * reveals Motion via les presets partagés.
 */
const CHANNELS = [
  { key: 'sms', Icon: MessageSquare },
  { key: 'whatsapp', Icon: Globe },
  { key: 'oneLink', Icon: Link2 },
] as const;

export function LandingChannels() {
  const t = useTranslations('Landing.channels');

  return (
    <section id="channels" className="paper-grain relative bg-[color:var(--color-surface)] py-32">
      <div className="container-page">
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={inViewOnce}
          className="mb-10 inline-block font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase"
        >
          {t('chapter')}
        </motion.span>

        <motion.header
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mb-16 flex max-w-3xl flex-col gap-6"
        >
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

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="grid grid-cols-1 gap-5 md:grid-cols-3"
        >
          {CHANNELS.map(({ key, Icon }) => (
            <motion.article
              key={key}
              variants={scrollReveal}
              className="group relative flex flex-col gap-4 rounded-3xl border border-[color:var(--color-border)] bg-white p-8 transition-[transform,box-shadow,border-color] duration-300 [@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:border-[color:var(--color-blush-300)] [@media(hover:hover)]:hover:shadow-[var(--shadow-blush)]"
            >
              <span
                aria-hidden
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: 'oklch(91% 0.045 22)', color: 'var(--color-blush-700)' }}
              >
                <Icon className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <h3
                className="text-2xl font-medium tracking-tight text-[color:var(--color-ink-900)]"
                style={{ letterSpacing: '-0.022em', lineHeight: 1.05 }}
              >
                {t(`${key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)] sm:text-base">
                {t(`${key}.description`)}
              </p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
