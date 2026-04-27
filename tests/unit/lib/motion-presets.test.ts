import { describe, expect, it } from 'vitest';
import {
  EASE_OUT_EXPO_VALUES,
  EASE_OUT_QUINT_VALUES,
  EASE_SPRING_VALUES,
  cardReveal3D,
  hoverLift,
  inViewOnce,
  numberTickerSpring,
  pageTransition,
  pageVariants,
  scrollRevealParent,
  skeletonShimmer,
  successPop,
  toastSlideIn,
} from '@/lib/motion/presets';

describe('motion presets — easings', () => {
  it('expose 3 easings standardisées (quint, expo, spring)', () => {
    expect(EASE_OUT_QUINT_VALUES).toEqual([0.22, 1, 0.36, 1]);
    expect(EASE_OUT_EXPO_VALUES).toEqual([0.16, 1, 0.3, 1]);
    expect(EASE_SPRING_VALUES).toEqual([0.34, 1.56, 0.64, 1]);
  });
});

describe('motion presets — patterns canoniques', () => {
  it('pageTransition est rapide (250 ms)', () => {
    expect(pageTransition.duration).toBe(0.25);
  });

  it('pageVariants définit initial / animate / exit', () => {
    expect(pageVariants).toHaveProperty('initial');
    expect(pageVariants).toHaveProperty('animate');
    expect(pageVariants).toHaveProperty('exit');
  });

  it('hoverLift a un translation Y subtle de -2 px', () => {
    expect(hoverLift.whileHover.y).toBe(-2);
  });

  it('scrollReveal est paire avec scrollRevealParent (stagger 60 ms)', () => {
    expect(scrollRevealParent.visible).toMatchObject({
      transition: { staggerChildren: 0.06 },
    });
  });

  it("inViewOnce est marqué once=true (n'anime qu'une fois)", () => {
    expect(inViewOnce.once).toBe(true);
  });

  it('successPop est une spring (feedback tactile RSVP)', () => {
    const animateConfig = successPop.animate as { transition: { type: string } };
    expect(animateConfig.transition.type).toBe('spring');
  });

  it('skeletonShimmer tourne en loop sur 1.6 s', () => {
    expect(skeletonShimmer.repeat).toBe(Infinity);
    expect(skeletonShimmer.duration).toBe(1.6);
  });

  it('toastSlideIn entre par le bas (drawer-from-bottom mobile)', () => {
    const initial = toastSlideIn.initial as { y: number };
    expect(initial.y).toBe(24);
  });

  it('numberTickerSpring est une spring lente (90 stiffness)', () => {
    expect(numberTickerSpring.type).toBe('spring');
    expect(numberTickerSpring.stiffness).toBe(90);
  });

  it('cardReveal3D dure 1.4 s (cinématique invitation)', () => {
    const animateConfig = cardReveal3D.animate as { transition: { duration: number } };
    expect(animateConfig.transition.duration).toBe(1.4);
  });
});
