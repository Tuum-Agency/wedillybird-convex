'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Check, Heart } from 'lucide-react';

/**
 * Mockup phone WhatsApp — figure centrale du Hero V3.
 *
 * SVG/CSS pur, pas d'image rasterisée. Cadre arrondi avec en-tête WhatsApp,
 * trois bulles de messages staggered, et un CTA "Ouvrir mon invitation".
 *
 * Pesé < 8 ko sur le wire → critique pour la perf 3G Afrique.
 */
export function PhoneMockup() {
  const t = useTranslations('Landing.hero.mockup');
  const reduced = useReducedMotion();

  const bubbleAnim = (delay: number) => ({
    initial: { opacity: 0, y: 10, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: reduced
      ? { duration: 0 }
      : { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      {/* Halo blush flou derrière le téléphone */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 scale-110 rounded-[3rem] blur-3xl"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 40%, oklch(85% 0.06 22 / 60%) 0%, transparent 70%)',
        }}
      />

      {/* Cadre du téléphone — bezel ivoire chaud, pas noir */}
      <div
        className="relative overflow-hidden rounded-[2.5rem] bg-[oklch(15%_0.018_28)] p-2.5 shadow-[var(--shadow-blush)]"
        style={{
          boxShadow: '0 30px 60px -20px oklch(48% 0.085 22 / 25%), 0 0 0 1px oklch(28% 0.02 28)',
        }}
      >
        {/* Notch */}
        <div className="absolute top-3 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[oklch(15%_0.018_28)]" />

        {/* Écran */}
        <div className="relative overflow-hidden rounded-[2rem] bg-white">
          {/* Status bar */}
          <div className="flex items-center justify-between bg-[oklch(96%_0.018_80)] px-5 pt-4 pb-2 text-[10px] font-semibold text-[color:var(--color-ink-700)]">
            <span>{t('phoneTime')}</span>
            <div className="flex items-center gap-1">
              <span aria-hidden>•••</span>
              <span aria-hidden>📶</span>
            </div>
          </div>

          {/* WhatsApp header — vert WA brand */}
          <div className="flex items-center gap-3 bg-[oklch(45%_0.13_152)] px-4 py-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/30">
              <Heart className="h-4 w-4 fill-white" strokeWidth={1.5} aria-hidden />
            </div>
            <div className="flex flex-1 flex-col leading-tight">
              <span className="text-[13px] font-semibold">{t('groupName')}</span>
              <span className="text-[10px] text-white/80">{t('groupSubtitle')}</span>
            </div>
          </div>

          {/* Conversation */}
          <div className="flex flex-col gap-2.5 bg-[oklch(98%_0.012_85)] p-4 pb-6">
            {/* Bulle 1 — sortie (les mariés) */}
            <motion.div
              {...bubbleAnim(0.2)}
              className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-[oklch(92%_0.07_142)] px-3.5 py-2 text-[12px] text-[color:var(--color-ink-900)] shadow-sm"
            >
              {t('messageBride')}
            </motion.div>

            {/* Bulle 2 — sortie */}
            <motion.div
              {...bubbleAnim(0.5)}
              className="ml-auto max-w-[78%] rounded-2xl rounded-tr-md bg-[oklch(92%_0.07_142)] px-3.5 py-2 text-[12px] text-[color:var(--color-ink-900)] shadow-sm"
            >
              {t('messageGroom')}
            </motion.div>

            {/* Bulle 3 — entrée (un invité) */}
            <motion.div
              {...bubbleAnim(0.85)}
              className="max-w-[80%] rounded-2xl rounded-tl-md bg-white px-3.5 py-2 text-[12px] text-[color:var(--color-ink-900)] shadow-sm"
            >
              {t('messageGuest')}
            </motion.div>

            {/* Lien d'invitation embed */}
            <motion.div
              {...bubbleAnim(1.15)}
              className="ml-auto w-[88%] overflow-hidden rounded-2xl rounded-tr-md bg-white shadow-md"
            >
              <div
                className="flex h-20 items-center justify-center"
                style={{
                  background:
                    'linear-gradient(135deg, oklch(91% 0.045 22) 0%, oklch(88% 0.05 80) 100%)',
                }}
                aria-hidden
              >
                <span
                  className="font-display text-2xl italic"
                  style={{ color: 'oklch(36% 0.07 24)', letterSpacing: '-0.02em' }}
                >
                  Camille &amp; Hugo
                </span>
              </div>
              <div className="flex flex-col gap-0.5 px-3 py-2.5">
                <span className="text-[11px] font-semibold text-[color:var(--color-ink-900)]">
                  {t('ctaOpenInvite')}
                </span>
                <span className="text-[9.5px] text-[color:var(--color-ink-500)]">
                  wedillybird.com/i/abc-2026
                </span>
              </div>
            </motion.div>

            {/* Indicateur "vu" */}
            <div className="ml-auto flex items-center gap-1 pr-1 text-[9px] text-[color:var(--color-sage-700)]">
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
              <Check className="-ml-2 h-3 w-3" strokeWidth={3} aria-hidden />
              <span>21:04</span>
            </div>
          </div>
        </div>
      </div>

      {/* Confettis flottants autour du phone */}
      <FloatingPetal
        className="absolute -top-6 -right-4 h-8 w-8 text-[color:var(--color-blush-400)]"
        delay={0}
      />
      <FloatingPetal
        className="absolute top-1/4 -left-8 h-6 w-6 text-[color:var(--color-champagne-500)]"
        delay={1.5}
      />
      <FloatingPetal
        className="absolute right-1/4 -bottom-4 h-7 w-7 text-[color:var(--color-blush-300)]"
        delay={3}
      />
    </div>
  );
}

function FloatingPetal({ className, delay }: { className: string; delay: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      animate={
        reduced
          ? undefined
          : {
              y: [0, -12, 0],
              rotate: [0, 8, -4, 0],
            }
      }
      transition={{
        duration: 6,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <path d="M12 2c2 4 6 6 10 6-4 2-6 6-6 10-2-4-6-6-10-6 4-2 6-6 6-10z" />
    </motion.svg>
  );
}
