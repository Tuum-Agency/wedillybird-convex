'use client';

import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { Save, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';
import { INVITATION_STYLES, type InvitationStyleId } from '@/lib/whatsapp/templates';
import { WhatsAppMessageMockup } from '@/components/events/whatsapp-message-mockup';
import { TemplateStatusCard } from '@/components/events/template-status-card';
import { CustomTemplateForm } from '@/components/events/custom-template-form';
import { updateMessagingConfigAction } from '@/app/[locale]/(app)/events/actions';

export interface CustomTemplateSummary {
  _id: string;
  name: string;
  bodyText: string;
  ctaLabel: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled';
  rejectionReason?: string;
  submittedAt?: number;
  reviewedAt?: number;
  createdAt: number;
}

type ActiveStyle = InvitationStyleId | 'custom';

const STYLES_ORDER: InvitationStyleId[] = ['warm', 'classic', 'african', 'festive', 'minimal'];

const CHANNEL_VALUES = ['whatsapp', 'email', 'both'] as const;

const PERSONAL_MESSAGE_MAX = 60;

interface Props {
  eventId: string;
  coupleNames: string;
  eventDate: string;
  previewInvitationUrl: string;
  initialValues: {
    templateStyle: InvitationStyleId;
    personalMessage: string;
    preferredChannel: 'whatsapp' | 'email' | 'both';
    customTemplateId?: string;
    templateNotifyChannel?: 'whatsapp' | 'email' | 'both';
  };
  customTemplates?: CustomTemplateSummary[];
}

/**
 * EventMessagingForm — split éditorial form (gauche) + mockup WhatsApp
 * (droite, sticky). Update live du mockup quand l'utilisateur change un
 * input.
 */
export function EventMessagingForm({
  eventId,
  coupleNames,
  eventDate,
  previewInvitationUrl,
  initialValues,
  customTemplates = [],
}: Props) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('Events');
  // Le custom est sélectionné par défaut si l'event y est rattaché ET qu'il
  // existe au moins un template (peu importe son state).
  const hasActiveCustom =
    !!initialValues.customTemplateId &&
    customTemplates.some((t) => t._id === initialValues.customTemplateId);
  const latestCustom = customTemplates[0] ?? null;
  const customApproved = latestCustom?.status === 'approved';

  const [style, setStyle] = useState<InvitationStyleId>(initialValues.templateStyle);
  const [activeMode, setActiveMode] = useState<ActiveStyle>(hasActiveCustom ? 'custom' : style);
  const [personalMessage, setPersonalMessage] = useState(initialValues.personalMessage);
  const [preferredChannel, setPreferredChannel] = useState<'whatsapp' | 'email' | 'both'>(
    initialValues.preferredChannel,
  );
  const notifyChannel = initialValues.templateNotifyChannel ?? 'email';
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const ctaLabel = INVITATION_STYLES[style].ctaLabel;

  function submit() {
    setError(null);
    setSuccess(false);
    const fd = new FormData();
    fd.set('eventId', eventId);
    fd.set('templateStyle', style);
    fd.set('personalMessage', personalMessage.trim());
    fd.set('preferredChannel', preferredChannel);
    // Si l'utilisateur revient sur un préfab, on détache explicitement le
    // custom (clearCustomTemplate=1). Sinon on n'envoie rien et le backend
    // préserve l'existant.
    if (activeMode !== 'custom') {
      fd.set('clearCustomTemplate', '1');
    }

    startTransition(async () => {
      const result = await updateMessagingConfigAction(fd);
      if (result.ok) {
        setSuccess(true);
        router.refresh();
        return;
      }
      if (result.error === 'PERSONAL_MESSAGE_TOO_LONG') {
        setError(t('messagingErrorPersonalTooLong', { max: PERSONAL_MESSAGE_MAX }));
        return;
      }
      setError(t('messagingErrorSave'));
    });
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_auto] lg:gap-16">
      {/* Form column */}
      <form action={submit} className="flex flex-col gap-10">
        <Section
          title={t('messagingStyleSectionTitle')}
          description={t('messagingStyleSectionDescription')}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {STYLES_ORDER.map((id) => {
              const selected = activeMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setStyle(id);
                    setActiveMode(id);
                  }}
                  className={cn(
                    'focus-ring flex flex-col items-start gap-2 rounded-2xl border p-5 text-left transition-all',
                    selected
                      ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-blush-50)] shadow-[var(--shadow-blush)]'
                      : 'border-[color:var(--color-border)] bg-white hover:border-[color:var(--color-blush-300)] hover:shadow-[var(--shadow-soft)]',
                  )}
                >
                  <span
                    className="font-display text-lg italic"
                    style={{ letterSpacing: '-0.018em', lineHeight: 1.2 }}
                  >
                    {t(`messagingStyles.${id}.label`)}
                  </span>
                  <span className="text-sm leading-relaxed text-[color:var(--color-ink-500)]">
                    {t(`messagingStyles.${id}.tagline`)}
                  </span>
                  {selected ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1, transition: { type: 'spring', stiffness: 300 } }}
                      className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-blush-700)] uppercase"
                    >
                      {t('messagingSelected')}
                    </motion.span>
                  ) : null}
                </button>
              );
            })}

            <button
              type="button"
              role="radio"
              aria-checked={activeMode === 'custom'}
              onClick={() => setActiveMode('custom')}
              className={cn(
                'focus-ring relative flex flex-col items-start gap-2 rounded-2xl border p-5 text-left transition-all sm:col-span-2',
                activeMode === 'custom'
                  ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-blush-50)] shadow-[var(--shadow-blush)]'
                  : 'border-[color:var(--color-border)] bg-white hover:border-[color:var(--color-blush-300)] hover:shadow-[var(--shadow-soft)]',
              )}
            >
              <span className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-[color:var(--color-gold-100)] px-2.5 py-0.5 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-gold-700)] uppercase">
                <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden />{' '}
                {t('messagingPremiumBadge')}
              </span>
              <span
                className="font-display text-lg italic"
                style={{ letterSpacing: '-0.018em', lineHeight: 1.2 }}
              >
                {t('messagingCustomTitle')}
              </span>
              <span className="text-sm leading-relaxed text-[color:var(--color-ink-500)]">
                {t('messagingCustomDescription')}
                {customApproved
                  ? ` ${t('messagingCustomApproved')}`
                  : latestCustom
                    ? ` ${t('messagingCustomPending')}`
                    : null}
              </span>
              {activeMode === 'custom' ? (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, transition: { type: 'spring', stiffness: 300 } }}
                  className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-blush-700)] uppercase"
                >
                  {t('messagingSelected')}
                </motion.span>
              ) : null}
            </button>
          </div>

          {activeMode === 'custom' ? (
            <div className="flex flex-col gap-4">
              {latestCustom ? (
                <TemplateStatusCard
                  template={{
                    name: latestCustom.name,
                    status: latestCustom.status,
                    rejectionReason: latestCustom.rejectionReason,
                    submittedAt: latestCustom.submittedAt,
                    reviewedAt: latestCustom.reviewedAt,
                  }}
                  notifyChannel={notifyChannel}
                  locale={locale}
                />
              ) : null}
              {!latestCustom ||
              latestCustom.status === 'rejected' ||
              latestCustom.status === 'disabled' ? (
                <CustomTemplateForm eventId={eventId} defaultNotifyChannel={notifyChannel} />
              ) : null}
            </div>
          ) : null}
        </Section>

        <Section
          title={t('messagingPersonalSectionTitle')}
          description={t('messagingPersonalSectionDescription', {
            placeholder: '{{5}}',
            max: PERSONAL_MESSAGE_MAX,
          })}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="personalMessage">{t('messagingPersonalLabel')}</Label>
            <textarea
              id="personalMessage"
              name="personalMessage"
              maxLength={PERSONAL_MESSAGE_MAX}
              rows={3}
              placeholder={t('messagingPersonalPlaceholder')}
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              className="focus-ring resize-vertical w-full rounded-xl border border-[color:var(--color-border-strong)] bg-white px-4 py-3 text-sm text-[color:var(--color-ink-900)] placeholder:text-[color:var(--color-ink-400)]"
            />
            <p className="text-right font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-500)] uppercase">
              {personalMessage.length}/{PERSONAL_MESSAGE_MAX}
            </p>
          </div>
        </Section>

        <Section
          title={t('messagingChannelSectionTitle')}
          description={t('messagingChannelSectionDescription')}
        >
          <div className="flex flex-col gap-2">
            {CHANNEL_VALUES.map((value) => {
              const selected = preferredChannel === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPreferredChannel(value)}
                  className={cn(
                    'focus-ring flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all',
                    selected
                      ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-blush-50)]'
                      : 'border-[color:var(--color-border)] bg-white hover:border-[color:var(--color-blush-300)]',
                  )}
                >
                  <span className="text-sm font-medium text-[color:var(--color-ink-900)]">
                    {t(`messagingChannelOptions.${value}`)}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border',
                      selected
                        ? 'border-[color:var(--color-blush-700)] bg-[color:var(--color-blush-700)] text-white'
                        : 'border-[color:var(--color-border-strong)] bg-white',
                    )}
                  >
                    {selected ? '✦' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        {error ? (
          <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
            {error}
          </p>
        ) : null}
        {success ? (
          <p role="status" className="text-sm text-[color:var(--color-blush-700)]">
            {t('messagingSuccess')}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-6 sm:flex-row sm:justify-end">
          <Button type="submit" variant="primary" size="lg" disabled={pending}>
            <Save className="h-4 w-4" strokeWidth={2} aria-hidden />
            {pending ? t('messagingSaving') : t('messagingSave')}
          </Button>
        </div>
      </form>

      {/* Mockup column — sticky on desktop */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <WhatsAppMessageMockup
          styleId={style}
          ctaLabel={ctaLabel}
          guestFirstName="Aminata"
          coupleNames={coupleNames}
          eventDate={eventDate}
          invitationUrl={previewInvitationUrl}
          personalMessage={personalMessage}
        />
      </aside>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2
          className="font-display italic"
          style={{
            fontSize: 'clamp(1.25rem, 1.8vw, 1.5rem)',
            lineHeight: 1.2,
            letterSpacing: '-0.018em',
            color: 'var(--color-ink-900)',
          }}
        >
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-[color:var(--color-ink-500)]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
