'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { Clapperboard, Music, Image as ImageIcon } from 'lucide-react';
import { CINEMATIC_META, type CinematicId } from '@/components/invitation/cinematics/registry';
import { THEME_SWATCH } from '@/components/invitation/cinematics/theme-visuals';
import { CinematicPlayer } from '@/components/invitation/cinematics/player';
import { MUSIC_TRACK_IDS } from '@/lib/invitation/music';
import { formatSampleDate } from '@/lib/invitation/sample-date';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';
import heroBg from './hero-bg.jpg';
import './universes.css';

/**
 * Landing — Chapitre 04B « Les univers » (bento vivant).
 *
 * CHAQUE cellule joue sa vraie cinématique d'ouverture (les onze), et non plus
 * des vignettes figées : on voit réellement ce que donne chaque thème. Perf
 * tenue par un montage paresseux (la scène ne se monte qu'à l'approche du
 * viewport) + lecture seulement quand la cellule est visible ; hors-vue elle
 * reste figée. `prefers-reduced-motion` → état apaisé (aucune animation).
 *
 * La date est formatée PAR PAYS via `Intl.DateTimeFormat(locale)` — « 8 juin
 * 2026 » en France, « June 8, 2026 » aux États-Unis — exactement comme la vraie
 * page d'invitation. Libellés déjà traduits dans les 7 locales
 * (`InvitationDesign.themes/*`, `tracks/*`).
 */

const SAMPLE_A = 'Camille';
const SAMPLE_B = 'Hugo';

// Douze cellules portrait uniformes et grandes : chaque cinématique est vue
// entière, à taille égale. Ordre = clair/sombre alterné pour le rythme ;
// le faire-part (photo) ouvre la grille.
const BENTO: readonly CinematicId[] = [
  'fairepart',
  'floral',
  'feux',
  'rivage',
  'theatre',
  'royal',
  'etoiles',
  'seal',
  'lanternes',
  'voyage',
  'cake',
  'deco',
];

/** Couleurs de texte posées sur la vignette selon la luminance de la scène. */
function tileInk(dark: boolean) {
  return {
    strong: dark ? 'oklch(97% 0.012 88)' : 'var(--color-ink-900)',
  };
}

/** Voile de bas de cellule — garantit la lisibilité du cartel sur la scène. */
function labelScrim(dark: boolean): string {
  return dark
    ? 'linear-gradient(to top, oklch(10% 0.02 280 / 0.86) 0%, oklch(10% 0.02 280 / 0.42) 46%, transparent 82%)'
    : 'linear-gradient(to top, oklch(99.5% 0.008 88 / 0.92) 0%, oklch(99.5% 0.008 88 / 0.44) 46%, transparent 82%)';
}

const CELL_BASE =
  'group relative row-span-2 overflow-hidden rounded-[var(--radius-3xl)] border border-[color:var(--color-border)] [--cine-scale:0.72] transition-[transform,box-shadow] duration-300 sm:[--cine-scale:0.62] lg:[--cine-scale:0.68] [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-[var(--shadow-lifted)]';

/**
 * Cellule qui joue une vraie cinématique d'ouverture.
 * - montage paresseux : la scène (lourde) ne se monte qu'à ~300 px du viewport ;
 * - lecture rejouée à chaque entrée en vue (le bump de playKey est dans le
 *   handler IO, pas dans un effet → conforme `react-hooks/set-state-in-effect`) ;
 * - hors-vue : figée en phase 0 (enveloppe close) pour ne rien animer d'invisible.
 */
function LiveCell({
  id,
  formattedDate,
  photoUrl,
}: {
  id: CinematicId;
  formattedDate: string;
  photoUrl?: string;
}) {
  const tt = useTranslations('InvitationDesign.themes');
  const tu = useTranslations('Landing.universes');
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [inView, setInView] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const dark = CINEMATIC_META[id].dark;
  const ink = tileInk(dark);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ioMount = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setMounted(true);
          ioMount.disconnect();
        }
      },
      { rootMargin: '300px 0px' },
    );
    const ioPlay = new IntersectionObserver(
      (es) => {
        const vis = es.some((e) => e.isIntersecting);
        setInView(vis);
        if (vis && !reduced) setPlayKey((k) => k + 1);
      },
      { threshold: 0.3 },
    );
    ioMount.observe(el);
    ioPlay.observe(el);
    return () => {
      ioMount.disconnect();
      ioPlay.disconnect();
    };
  }, [reduced]);

  return (
    <motion.article
      ref={ref}
      variants={scrollReveal}
      className={CELL_BASE}
      style={{ background: THEME_SWATCH[id] } as CSSProperties}
    >
      {mounted && (
        <div className="uni-live">
          <CinematicPlayer
            cinematic={id}
            partnerA={SAMPLE_A}
            partnerB={SAMPLE_B}
            formattedDate={formattedDate}
            photoUrl={photoUrl}
            playKey={playKey}
            holdPhase={inView && !reduced ? null : reduced ? 5 : 0}
          />
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-5"
        style={{ background: labelScrim(dark) }}
      >
        <h3
          className="font-display text-xl italic"
          style={{ color: ink.strong, letterSpacing: '-0.018em' }}
        >
          {tt(`${id}.name`)}
        </h3>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[0.22em] uppercase"
          style={{
            color: ink.strong,
            background: dark ? 'oklch(100% 0 0 / 0.14)' : 'oklch(28% 0.02 40 / 0.08)',
          }}
        >
          <span className="uni-livedot" aria-hidden />
          {tu('liveTag')}
        </span>
      </div>
    </motion.article>
  );
}

const CUSTOM_PILLARS = [
  { key: 'cinematic', Icon: Clapperboard },
  { key: 'music', Icon: Music },
  { key: 'photo', Icon: ImageIcon },
] as const;

export function LandingUniverses() {
  const t = useTranslations('Landing.universes');
  const tk = useTranslations('InvitationDesign.tracks');
  const locale = useLocale();
  const formattedDate = formatSampleDate(locale);

  return (
    <section id="universes" className="paper-grain relative bg-[color:var(--color-surface)] py-32">
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
          className="mb-6 flex max-w-3xl flex-col gap-6"
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

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={inViewOnce}
          className="mb-10 flex items-center gap-3 font-mono text-[11px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase"
        >
          <span aria-hidden className="text-[color:var(--color-gold-500)]">
            ✦
          </span>
          {t('galleryNote')}
        </motion.p>

        {/* Bento — les onze cinématiques, chacune jouée */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="grid auto-rows-[210px] grid-cols-1 gap-4 sm:auto-rows-[190px] sm:grid-cols-2 lg:auto-rows-[204px] lg:grid-cols-3"
        >
          {BENTO.map((id) => (
            <LiveCell
              key={id}
              id={id}
              formattedDate={formattedDate}
              photoUrl={id === 'fairepart' ? heroBg.src : undefined}
            />
          ))}
        </motion.div>

        {/* Personnalisation — cinématique · musique · photo */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mt-16 overflow-hidden rounded-[var(--radius-3xl)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-warm)] p-8 sm:p-10"
        >
          <motion.h3
            variants={scrollReveal}
            className="font-display mb-8 text-2xl italic"
            style={{ color: 'var(--color-ink-900)', letterSpacing: '-0.02em' }}
          >
            {t('custom.heading')}
          </motion.h3>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {CUSTOM_PILLARS.map(({ key, Icon }) => (
              <motion.div key={key} variants={scrollReveal} className="flex flex-col gap-3">
                <span
                  aria-hidden
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ background: 'oklch(91% 0.045 22)', color: 'var(--color-blush-700)' }}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <h4 className="text-lg font-medium tracking-tight text-[color:var(--color-ink-900)]">
                  {t(`custom.${key}.title`)}
                </h4>
                <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)]">
                  {t(`custom.${key}.desc`)}
                </p>

                {key === 'music' && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {MUSIC_TRACK_IDS.map((trackId) => (
                      <span
                        key={trackId}
                        className="rounded-full border border-[color:var(--color-border)] bg-white px-2.5 py-1 text-[11px] text-[color:var(--color-ink-700)]"
                      >
                        {tk(`${trackId}.name`)}
                      </span>
                    ))}
                    <span className="rounded-full bg-[color:var(--color-blush-100)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--color-blush-700)]">
                      {t('custom.musicYours')}
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          <motion.p
            variants={scrollReveal}
            className="mt-8 flex items-center gap-2 border-t border-[color:var(--color-border)] pt-6 text-sm text-[color:var(--color-ink-500)]"
          >
            <span aria-hidden className="text-[color:var(--color-gold-500)]">
              ✦
            </span>
            {t('custom.included')}
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
