'use client';

/* Carte « Parrainage » de l'espace couple — le parrain partage son lien
   (`?ref=CODE`) et voit son crédit disponible. Alimentée par le store
   (`referral` du bundle Convex). Le crédit s'applique automatiquement au
   prochain achat (upsell HD). */

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Icon } from './icons';
import { McBtn } from './parts';
import { useMonMariage } from '@/stores/mon-mariage';

export function ReferralCard() {
  const t = useTranslations('MonMariage.home.referral');
  const format = useFormatter();
  const referral = useMonMariage((s) => s.referral);
  const currency = useMonMariage((s) => s.event?.currency ?? 'EUR');
  const [copied, setCopied] = useState(false);

  if (!referral?.code) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://wedillybird.com';
  const link = `${origin}/?ref=${referral.code}`;
  const creditLabel = format.number(referral.availableMinor / 100, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard indisponible — l'input reste sélectionnable manuellement.
    }
  }

  return (
    <section className="mc-card feature">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span
            aria-hidden
            style={{
              flex: 'none',
              display: 'grid',
              placeItems: 'center',
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'var(--brand-soft)',
              color: 'var(--brand-strong)',
            }}
          >
            <Icon name="Gift" size={19} stroke={1.8} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0 }}>{t('title')}</h3>
            <p style={{ margin: 0 }}>{t('desc')}</p>
          </div>
        </div>

        {referral.availableMinor > 0 ? (
          <span
            className="mc-pill brand"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
          >
            <span className="d" style={{ background: 'var(--brand)' }} />
            {t('credit', { amount: creditLabel })}
          </span>
        ) : null}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={t('linkAria')}
            style={{
              flex: 1,
              minWidth: 0,
              height: 40,
              padding: '0 12px',
              borderRadius: 10,
              border: '1px solid var(--color-border, oklch(88% 0.015 60))',
              background: 'oklch(99% 0.005 85)',
              fontSize: 13,
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--color-ink-700)',
            }}
          />
          <McBtn variant="halo" size="md" onClick={copy}>
            <Icon name={copied ? 'Check' : 'Copy'} size={15} stroke={2} />
            {copied ? t('copied') : t('copy')}
          </McBtn>
        </div>
      </div>
    </section>
  );
}
