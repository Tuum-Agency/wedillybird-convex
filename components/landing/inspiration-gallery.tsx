'use client';

import Image from 'next/image';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

/**
 * Landing — Galerie inspiration V3.
 *
 * 6 photos Unsplash (libre de droit) en grid asymétrique masonry-like,
 * couvrant la diversité géographique du marché : Provence, Dakar, Abidjan,
 * Paris, Bamako, Lyon. Hover : nom couple + ville + nb invités slide-in.
 *
 * Photos servies via next/image avec optimisation auto (whitelist domain
 * dans next.config.ts).
 */
const ITEMS = [
  {
    key: 'provence',
    // Roses + couple, Provence, lumière chaude
    src: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
    span: 'lg:col-span-2 lg:row-span-2',
  },
  {
    key: 'dakar',
    src: 'https://images.unsplash.com/photo-1525772764200-be829a350797?auto=format&fit=crop&w=900&q=80',
    span: '',
  },
  {
    key: 'abidjan',
    src: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?auto=format&fit=crop&w=900&q=80',
    span: '',
  },
  {
    key: 'paris',
    src: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=80',
    span: '',
  },
  {
    key: 'bamako',
    src: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=900&q=80',
    span: '',
  },
  {
    key: 'lyon',
    src: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=900&q=80',
    span: 'lg:col-span-2',
  },
] as const;

export function LandingInspirationGallery() {
  const t = useTranslations('Landing.inspiration');

  return (
    <section className="container-page py-28">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        variants={scrollRevealParent}
        className="mx-auto mb-14 flex max-w-3xl flex-col items-center gap-3 text-center"
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
        className="grid auto-rows-[280px] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {ITEMS.map(({ key, src, span }) => (
          <motion.figure
            key={key}
            variants={scrollReveal}
            className={`group relative overflow-hidden rounded-2xl ${span}`}
          >
            <Image
              src={src}
              alt={t(`items.${key}.alt`)}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 [@media(hover:hover)]:group-hover:scale-105"
              loading="lazy"
            />
            {/* Overlay info qui slide depuis le bas */}
            <figcaption className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-[oklch(15%_0.018_28_/_85%)] via-[oklch(15%_0.018_28_/_45%)] to-transparent px-5 py-5 text-white opacity-100 transition-all duration-500 [@media(hover:hover)]:translate-y-6 [@media(hover:hover)]:opacity-90 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100">
              <p
                className="font-display text-xl italic"
                style={{ letterSpacing: '-0.018em', lineHeight: 1.1 }}
              >
                {t(`items.${key}.couple`)}
              </p>
              <p className="mt-0.5 text-xs tracking-wide text-white/80">
                {t(`items.${key}.location`)} · {t(`items.${key}.guests`)}
              </p>
            </figcaption>
          </motion.figure>
        ))}
      </motion.div>
    </section>
  );
}
