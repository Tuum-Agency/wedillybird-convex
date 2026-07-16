'use client';

import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Send } from 'lucide-react';

type SubmitState = { kind: 'idle' } | { kind: 'error'; message: string } | { kind: 'success' };

/**
 * Newsletter form du footer — client component.
 *
 * POST /api/newsletter (JSON). Source = 'footer' pour distinguer dans la
 * notif admin si plus tard on a plusieurs sources. Honeypot `website` caché.
 */
export function NewsletterForm() {
  const t = useTranslations('Landing.footer');
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  function submit(formData: FormData) {
    startTransition(async () => {
      const payload = {
        email: String(formData.get('email') ?? ''),
        website: String(formData.get('website') ?? ''),
        source: 'footer',
      };
      try {
        const res = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
        if (res.ok && json.ok) {
          setState({ kind: 'success' });
          return;
        }
        setState({ kind: 'error', message: t('newsletterError') });
      } catch {
        setState({ kind: 'error', message: t('newsletterError') });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="wait">
        {state.kind === 'success' ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-3 rounded-full border border-[color:var(--color-blush-200)] bg-[color:var(--color-blush-50)] px-5 py-3 text-sm text-[color:var(--color-blush-800)]"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2
              className="h-4 w-4 flex-shrink-0 text-[color:var(--color-blush-700)]"
              strokeWidth={2}
              aria-hidden
            />
            <span>{t('newsletterSuccess')}</span>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            action={submit}
            className="flex flex-col gap-2 sm:flex-row"
            aria-label={t('newsletterAriaLabel')}
            noValidate
          >
            <label className="sr-only" htmlFor="footer-newsletter-email">
              {t('newsletterPlaceholder')}
            </label>
            <input
              id="footer-newsletter-email"
              type="email"
              name="email"
              required
              placeholder={t('newsletterPlaceholder')}
              className="focus-ring flex-1 rounded-full border border-[color:var(--color-border-strong)] bg-white px-5 py-3 text-sm text-[color:var(--color-ink-900)] placeholder:text-[color:var(--color-ink-400)]"
            />
            {/* Honeypot */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
              aria-hidden
              className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
            />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--color-blush-700)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--color-blush-800)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('newsletterCta')}
              <Send className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </button>
          </motion.form>
        )}
      </AnimatePresence>
      {state.kind === 'error' ? (
        <p role="alert" className="text-xs text-[color:var(--color-destructive)]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
