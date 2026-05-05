'use client';

import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translateZodMessage } from '@/lib/validators/translate-zod';

type FieldErrors = Partial<Record<'name' | 'email' | 'subject' | 'message', string[]>>;

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'error'; message: string; fieldErrors?: FieldErrors }
  | { kind: 'success' };

/**
 * Formulaire de contact public.
 *
 * POST /api/contact (JSON). Honeypot `website` caché en CSS pour piéger les
 * bots. Success state animé Motion. Champs obligatoires : nom, email, sujet
 * (>= 3 chars), message (>= 20 chars).
 */
export function ContactForm() {
  const t = useTranslations('Contact.form');
  const tRoot = useTranslations();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  function submit(formData: FormData) {
    startTransition(async () => {
      const payload = {
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
        subject: String(formData.get('subject') ?? ''),
        message: String(formData.get('message') ?? ''),
        website: String(formData.get('website') ?? ''),
      };

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          fieldErrors?: FieldErrors;
        };
        if (res.ok && json.ok) {
          setState({ kind: 'success' });
          return;
        }
        if (json.error === 'INVALID_INPUT') {
          setState({
            kind: 'error',
            message: t('errorValidation'),
            fieldErrors: json.fieldErrors,
          });
          return;
        }
        setState({ kind: 'error', message: t('errorGeneric') });
      } catch {
        setState({ kind: 'error', message: t('errorNetwork') });
      }
    });
  }

  if (state.kind === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }}
        className="flex flex-col items-center gap-5 rounded-2xl border border-[color:var(--color-blush-200)] bg-[color:var(--color-blush-50)] px-6 py-10 text-center"
      >
        <motion.span
          initial={{ scale: 0, rotate: -90 }}
          animate={{
            scale: 1,
            rotate: 0,
            transition: { type: 'spring', stiffness: 240, damping: 18 },
          }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[color:var(--color-blush-700)] shadow-[var(--shadow-soft)]"
          aria-hidden
        >
          <Mail className="h-6 w-6" strokeWidth={1.75} />
        </motion.span>
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-blush-700)] uppercase">
            {t('successEyebrow')}
          </p>
          <p
            className="font-display text-balance italic"
            style={{
              fontSize: 'clamp(1.25rem, 2.2vw, 1.5rem)',
              lineHeight: 1.2,
              letterSpacing: '-0.018em',
              color: 'var(--color-ink-900)',
            }}
          >
            {t('successTitle')}
          </p>
          <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)]">
            {t('successDescription')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setState({ kind: 'idle' })}
          className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-blush-700)]"
        >
          ← {t('successBack')}
        </button>
      </motion.div>
    );
  }

  const fieldErrors = state.kind === 'error' ? state.fieldErrors : undefined;
  const tr = (k: string) => tRoot(k as never);
  const nameError = translateZodMessage(fieldErrors?.name?.[0], tr);
  const emailError = translateZodMessage(fieldErrors?.email?.[0], tr);
  const subjectError = translateZodMessage(fieldErrors?.subject?.[0], tr);
  const messageError = translateZodMessage(fieldErrors?.message?.[0], tr);
  const generalError = state.kind === 'error' ? state.message : null;

  return (
    <form action={submit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-name">{t('nameLabel')}</Label>
        <Input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          placeholder={t('namePlaceholder')}
          aria-invalid={!!nameError}
        />
        {nameError ? (
          <p className="text-xs text-[color:var(--color-destructive)]">{nameError}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-email">{t('emailLabel')}</Label>
        <Input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder={t('emailPlaceholder')}
          aria-invalid={!!emailError}
        />
        {emailError ? (
          <p className="text-xs text-[color:var(--color-destructive)]">{emailError}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-subject">{t('subjectLabel')}</Label>
        <Input
          id="contact-subject"
          name="subject"
          type="text"
          required
          minLength={3}
          maxLength={140}
          placeholder={t('subjectPlaceholder')}
          aria-invalid={!!subjectError}
        />
        {subjectError ? (
          <p className="text-xs text-[color:var(--color-destructive)]">{subjectError}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-message">{t('messageLabel')}</Label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={20}
          maxLength={5000}
          rows={6}
          placeholder={t('messagePlaceholder')}
          aria-invalid={!!messageError}
          className="focus-ring resize-vertical w-full rounded-xl border border-[color:var(--color-border-strong)] bg-white px-4 py-3 text-sm text-[color:var(--color-ink-900)] placeholder:text-[color:var(--color-ink-300)]"
        />
        {messageError ? (
          <p className="text-xs text-[color:var(--color-destructive)]">{messageError}</p>
        ) : null}
      </div>

      {/* Honeypot — caché aux humains via CSS, les bots remplissent. */}
      <div aria-hidden className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0">
        <Label htmlFor="contact-website">{t('websiteLabel')}</Label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {generalError ? (
        <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
          {generalError}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? (
          t('sending')
        ) : (
          <>
            <Send className="h-4 w-4" strokeWidth={2} aria-hidden />
            {t('submit')}
          </>
        )}
      </Button>
    </form>
  );
}
