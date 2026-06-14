'use client';

import { motion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import { Check, ChevronLeft, MoreVertical, Phone, Video } from 'lucide-react';
import { type InvitationStyleId, renderInvitationPreview } from '@/lib/whatsapp/templates';

/**
 * WhatsAppMessageMockup — simule visuellement comment l'invitation arrive
 * dans le téléphone de l'invité. Pas pixel-perfect WhatsApp, juste assez
 * pour donner au couple une idée concrète du rendu (texte personnalisé +
 * bouton CTA + timestamp).
 *
 * Update live selon les valeurs du form parent (style, mot perso, etc.).
 */
export function WhatsAppMessageMockup({
  styleId,
  ctaLabel,
  guestFirstName,
  coupleNames,
  eventDate,
  invitationUrl,
  personalMessage,
}: {
  styleId: InvitationStyleId;
  ctaLabel: string;
  guestFirstName: string;
  coupleNames: string;
  eventDate: string;
  invitationUrl: string;
  personalMessage: string;
}) {
  const t = useTranslations('Events');
  const format = useFormatter();
  const renderedText = renderInvitationPreview(styleId, {
    guestFirstName,
    coupleNames,
    eventDate,
    invitationUrl,
    personalMessage,
  });

  // Heure courante localisée pour le timestamp de la bulle
  const timestamp = format.dateTime(new Date(), { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
        {t('mockupGuestPreview')}
      </span>

      {/* Phone frame */}
      <div className="relative w-full max-w-[340px] overflow-hidden rounded-[2.25rem] border-[8px] border-[color:var(--color-ink-900)] bg-[color:var(--color-ink-900)] shadow-[0_24px_48px_-16px_oklch(20%_0.02_28/45%)]">
        <div className="paper-grain flex h-[600px] flex-col" style={{ background: '#E5DDD5' }}>
          {/* WhatsApp header */}
          <div
            className="flex items-center gap-3 px-3 py-3 text-white"
            style={{ background: '#075E54' }}
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
              style={{ background: 'oklch(72% 0.09 20)' }}
              aria-hidden
            >
              W
            </div>
            <div className="flex flex-1 flex-col leading-tight">
              <span className="text-sm font-semibold">Wedillybird</span>
              <span className="text-[10px] opacity-80">{t('mockupOnline')}</span>
            </div>
            <Video className="h-4 w-4 opacity-90" strokeWidth={2} aria-hidden />
            <Phone className="h-4 w-4 opacity-90" strokeWidth={2} aria-hidden />
            <MoreVertical className="h-4 w-4 opacity-90" strokeWidth={2} aria-hidden />
          </div>

          {/* Message stream */}
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
            {/* Date stamp */}
            <div className="my-2 flex justify-center">
              <span
                className="rounded-md px-2.5 py-1 text-[10px] font-medium tracking-wide text-[color:var(--color-ink-500)]"
                style={{ background: 'rgba(255, 255, 255, 0.85)' }}
              >
                {t('mockupToday')}
              </span>
            </div>

            {/* Bubble */}
            <motion.div
              key={styleId + personalMessage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } }}
              className="flex max-w-[88%] flex-col gap-2 self-start rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm"
              style={{ background: '#FFFFFF' }}
            >
              <p className="text-[13.5px] leading-snug whitespace-pre-line text-[#202121]">
                {renderedText}
              </p>
              <div
                className="-mx-1 flex items-center justify-center rounded-lg border-t-2 border-[#075E54]/12 px-3 py-2"
                style={{ borderColor: 'rgba(7, 94, 84, 0.12)' }}
              >
                <span className="text-sm font-medium" style={{ color: '#075E54' }}>
                  {ctaLabel}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1 text-[10px] text-[color:var(--color-ink-500)]">
                <span>{timestamp}</span>
                <Check
                  className="h-3 w-3"
                  strokeWidth={2.5}
                  aria-hidden
                  style={{ color: '#34B7F1' }}
                />
                <Check
                  className="-ml-2 h-3 w-3"
                  strokeWidth={2.5}
                  aria-hidden
                  style={{ color: '#34B7F1' }}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <p className="max-w-[340px] text-center text-xs text-[color:var(--color-ink-500)]">
        {t('mockupDisclaimer')}
      </p>
    </div>
  );
}
