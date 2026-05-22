'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

/**
 * CookieConsent — Bannière de consentement RGPD.
 * Conforme aux obligations légales (CNIL) :
 * - Informations claires sur la finalité des cookies.
 * - Bouton "Continuer sans accepter" visible et au même niveau que "Accepter".
 * - Lien vers la politique de confidentialité / cookies.
 */
export function CookieConsent() {
  const t = useTranslations('CookieConsent');
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Délai pour une apparition plus fluide (ne pas bloquer le LCP)
    const timer = setTimeout(() => {
      const consent = localStorage.getItem('wedillybird-cookie-consent');
      if (!consent) {
        setShow(true);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleAccept = () => {
    localStorage.setItem('wedillybird-cookie-consent', 'accepted');
    setShow(false);
  };

  const handleDecline = () => {
    localStorage.setItem('wedillybird-cookie-consent', 'declined');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="animate-in slide-in-from-bottom-5 fade-in fixed right-0 bottom-0 left-0 z-[100] p-4 duration-500 sm:p-6 md:right-auto md:bottom-6 md:left-6 md:w-[420px]">
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-[color:var(--color-ink-900)]">{t('title')}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-ink-500)]">
          {t('bodyBefore')}
          <Link
            href="/legal/cookies"
            className="font-medium text-[color:var(--color-ink-700)] underline transition-colors hover:text-[color:var(--color-blush-700)]"
          >
            {t('policyLink')}
          </Link>
          {t('bodyAfter')}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse sm:items-center">
          <Button onClick={handleAccept} className="w-full sm:w-auto" variant="primary" size="sm">
            {t('accept')}
          </Button>
          <Button onClick={handleDecline} variant="outline" size="sm" className="w-full sm:w-auto">
            {t('decline')}
          </Button>
        </div>
      </div>
    </div>
  );
}
