import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RATE_BPS,
  MAX_COMBINED_BPS,
  MIN_VEST_FLOOR_MS,
  rewardMinor,
  isRewardConfigSafe,
  vestsAt,
  isVestable,
  settledStatusFor,
  canReverse,
  isSelfReferral,
  normalizeAffiliateCode,
  isValidAffiliateCode,
  generateReferralCode,
  selectReferralsToConsume,
} from '../../../convex/lib/affiliate';

describe('rewardMinor — commission/crédit sur le NET', () => {
  it('20 % du net, arrondi entier', () => {
    expect(rewardMinor(4000, DEFAULT_RATE_BPS)).toBe(800); // $40 → $8
    expect(rewardMinor(8000, DEFAULT_RATE_BPS)).toBe(1600); // $80 → $16
    expect(rewardMinor(2700, DEFAULT_RATE_BPS)).toBe(540); // HD $27 → $5.40
  });
  it('arrondit correctement (pas de flottant qui fuit)', () => {
    expect(rewardMinor(3999, DEFAULT_RATE_BPS)).toBe(800); // 799.8 → 800
    expect(rewardMinor(15, 1500)).toBe(2); // 2.25 → 2
  });
  it('borné à 0 sur entrées non valides / négatives', () => {
    expect(rewardMinor(0, DEFAULT_RATE_BPS)).toBe(0);
    expect(rewardMinor(-100, DEFAULT_RATE_BPS)).toBe(0);
    expect(rewardMinor(4000, 0)).toBe(0);
    expect(rewardMinor(Number.NaN, DEFAULT_RATE_BPS)).toBe(0);
  });
});

describe('isRewardConfigSafe — garde-fou marge (pas de cumul destructeur)', () => {
  it('défaut « 0 % remise + 20 % commission » : OK', () => {
    expect(isRewardConfigSafe({ rateBps: 2000, buyerDiscountBps: 0 })).toBe(true);
  });
  it('split « 10 % remise + 15 % commission » (=25 %) : OK', () => {
    expect(isRewardConfigSafe({ rateBps: 1500, buyerDiscountBps: 1000 })).toBe(true);
  });
  it('cumul « 10 % remise + 20 % commission » (=30 %) : BLOQUÉ (marge Essentiel)', () => {
    expect(isRewardConfigSafe({ rateBps: 2000, buyerDiscountBps: 1000 })).toBe(false);
  });
  it('exactement au plafond MAX_COMBINED_BPS : OK ; au-dessus : bloqué', () => {
    expect(isRewardConfigSafe({ rateBps: MAX_COMBINED_BPS, buyerDiscountBps: 0 })).toBe(true);
    expect(isRewardConfigSafe({ rateBps: MAX_COMBINED_BPS + 1, buyerDiscountBps: 0 })).toBe(false);
  });
  it('taux négatifs / non entiers : bloqués', () => {
    expect(isRewardConfigSafe({ rateBps: -100, buyerDiscountBps: 0 })).toBe(false);
    expect(isRewardConfigSafe({ rateBps: 2000.5, buyerDiscountBps: 0 })).toBe(false);
  });
});

describe('vestsAt — vesting à la date event, plancher J+7', () => {
  const purchase = 1_000_000_000_000;
  it('event lointain (mariage dans des mois) → vest à la date event', () => {
    const eventDate = purchase + 120 * 24 * 60 * 60 * 1000; // +120 j
    expect(vestsAt(eventDate, purchase)).toBe(eventDate);
  });
  it('event proche (< J+7) → plancher purchase + J+7', () => {
    const eventDate = purchase + 2 * 24 * 60 * 60 * 1000; // +2 j
    expect(vestsAt(eventDate, purchase)).toBe(purchase + MIN_VEST_FLOOR_MS);
  });
  it('date event absente → plancher J+7', () => {
    expect(vestsAt(Number.NaN, purchase)).toBe(purchase + MIN_VEST_FLOOR_MS);
  });
});

describe('isVestable — bascule pending → vested', () => {
  it('pending et horloge ≥ vestsAt → true', () => {
    expect(isVestable({ status: 'pending', vestsAt: 100 }, 100)).toBe(true);
    expect(isVestable({ status: 'pending', vestsAt: 100 }, 101)).toBe(true);
  });
  it('pending mais avant vestsAt → false', () => {
    expect(isVestable({ status: 'pending', vestsAt: 100 }, 99)).toBe(false);
  });
  it('déjà vested/paid → false (pas de re-vesting)', () => {
    expect(isVestable({ status: 'vested', vestsAt: 100 }, 200)).toBe(false);
    expect(isVestable({ status: 'paid', vestsAt: 100 }, 200)).toBe(false);
  });
});

describe('statut de versement + reversal', () => {
  it('crédit → credited, cash → paid', () => {
    expect(settledStatusFor('credit')).toBe('credited');
    expect(settledStatusFor('cash')).toBe('paid');
  });
  it('reversal possible tant que non terminal', () => {
    expect(canReverse('pending')).toBe(true);
    expect(canReverse('vested')).toBe(true);
    expect(canReverse('paid')).toBe(false);
    expect(canReverse('credited')).toBe(false);
    expect(canReverse('reversed')).toBe(false);
  });
});

describe('isSelfReferral — anti-fraude', () => {
  it('même userId → self-referral', () => {
    expect(isSelfReferral({ affiliateOwnerUserId: 'u1', buyerUserId: 'u1' })).toBe(true);
  });
  it('même email (insensible à la casse/espaces) → self-referral', () => {
    expect(isSelfReferral({ affiliateEmail: ' Norah@X.com ', buyerEmail: 'norah@x.com' })).toBe(
      true,
    );
  });
  it('utilisateurs/emails différents → pas self-referral', () => {
    expect(isSelfReferral({ affiliateOwnerUserId: 'u1', buyerUserId: 'u2' })).toBe(false);
    expect(isSelfReferral({ affiliateEmail: 'a@x.com', buyerEmail: 'b@x.com' })).toBe(false);
  });
  it('champs manquants → pas de faux positif', () => {
    expect(isSelfReferral({})).toBe(false);
    expect(isSelfReferral({ affiliateOwnerUserId: 'u1' })).toBe(false);
  });
});

describe('code affilié — normalisation & validation', () => {
  it('normalise en A-Z0-9 majuscules, ≤ 24 car.', () => {
    expect(normalizeAffiliateCode(' norah-10 ')).toBe('NORAH10');
    expect(normalizeAffiliateCode('a'.repeat(40))).toHaveLength(24);
  });
  it('valide 3–24 caractères A-Z0-9', () => {
    expect(isValidAffiliateCode('OCE10')).toBe(true);
    expect(isValidAffiliateCode('AB')).toBe(false); // trop court
    expect(isValidAffiliateCode('bad-code')).toBe(false); // minuscules + tiret
    expect(isValidAffiliateCode('')).toBe(false);
  });
});

describe('generateReferralCode — code parrain auto', () => {
  it('produit toujours un code VALIDE (A-Z0-9, 3-24 car.)', () => {
    for (const seed of ['user_abc', 'x', 'ZZZ999', 'utilisateur-éàü']) {
      for (let a = 0; a < 5; a++) {
        expect(isValidAffiliateCode(generateReferralCode(seed, a))).toBe(true);
      }
    }
  });
  it('déterministe (même seed+attempt → même code)', () => {
    expect(generateReferralCode('user_1', 0)).toBe(generateReferralCode('user_1', 0));
  });
  it('la tentative change le code (résolution de collision)', () => {
    expect(generateReferralCode('user_1', 0)).not.toBe(generateReferralCode('user_1', 1));
  });
});

describe('selectReferralsToConsume — application du crédit (FIFO, atomique)', () => {
  it('consomme les récompenses entières dont le cumul reste ≤ commande', () => {
    const rewards = [
      { id: 'a', rewardMinor: 800 },
      { id: 'b', rewardMinor: 800 },
    ];
    // commande $12 : on prend $8 (a), $8+$8=$16 > $12 donc on s'arrête → $8.
    expect(selectReferralsToConsume(rewards, 1200)).toEqual({
      referralIds: ['a'],
      consumedMinor: 800,
    });
  });
  it('prend tout si la commande couvre le cumul', () => {
    const rewards = [
      { id: 'a', rewardMinor: 800 },
      { id: 'b', rewardMinor: 800 },
    ];
    expect(selectReferralsToConsume(rewards, 4000)).toEqual({
      referralIds: ['a', 'b'],
      consumedMinor: 1600,
    });
  });
  it('packe une récompense plus petite quand la grosse déborde', () => {
    const rewards = [
      { id: 'big', rewardMinor: 2000 },
      { id: 'small', rewardMinor: 500 },
    ];
    // commande $10 : big ($20) déborde → skip ; small ($5) rentre → $5.
    expect(selectReferralsToConsume(rewards, 1000)).toEqual({
      referralIds: ['small'],
      consumedMinor: 500,
    });
  });
  it('rien si commande ≤ 0 ou aucune récompense ne rentre', () => {
    expect(selectReferralsToConsume([{ id: 'a', rewardMinor: 800 }], 0)).toEqual({
      referralIds: [],
      consumedMinor: 0,
    });
    expect(selectReferralsToConsume([{ id: 'a', rewardMinor: 800 }], 500)).toEqual({
      referralIds: [],
      consumedMinor: 0,
    });
  });
  it('ignore les montants non positifs', () => {
    const rewards = [
      { id: 'z', rewardMinor: 0 },
      { id: 'a', rewardMinor: 800 },
    ];
    expect(selectReferralsToConsume(rewards, 4000)).toEqual({
      referralIds: ['a'],
      consumedMinor: 800,
    });
  });
});
