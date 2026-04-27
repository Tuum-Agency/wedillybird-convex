'use client';

import { useState, useTransition } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Heart, Briefcase, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';
import { completeOnboardingAction } from '@/app/[locale]/(auth)/actions';

type Role = 'couple' | 'pro';

interface FormState {
  fullName: string;
  email: string;
  role: Role | null;
}

const ROLE_OPTIONS: ReadonlyArray<{
  value: Role;
  titleKey: 'roleCouple' | 'rolePro';
  descriptionKey: 'roleCoupleDescription' | 'roleProDescription';
  Icon: typeof Heart;
}> = [
  { value: 'couple', titleKey: 'roleCouple', descriptionKey: 'roleCoupleDescription', Icon: Heart },
  { value: 'pro', titleKey: 'rolePro', descriptionKey: 'roleProDescription', Icon: Briefcase },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * OnboardingWizard V4 — wizard 2 steps avec animations Motion sobres.
 *
 * Step 0 : profil (nom + email **obligatoire** depuis avril 2026)
 * Step 1 : rôle (couple vs pro) avec radio cards
 *
 * Email policy :
 *  - Si l'user vient de magic link → `initialEmail` pré-rempli + readonly
 *  - Si l'user vient de WhatsApp → champ vide, obligatoire, validé client
 *  - Empêche les doublons (cf. convex/users.completeOnboarding EMAIL_TAKEN)
 */
export function OnboardingWizard({ initialEmail = '' }: { initialEmail?: string }) {
  const t = useTranslations('Onboarding');
  const tCommon = useTranslations('Common');
  const reduced = useReducedMotion();
  const [step, setStep] = useState<0 | 1>(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [form, setForm] = useState<FormState>({
    fullName: '',
    email: initialEmail,
    role: null,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const emailLocked = initialEmail.length > 0;
  const canGoNext =
    step === 0 && form.fullName.trim().length >= 2 && EMAIL_RE.test(form.email.trim());
  const canSubmit = step === 1 && form.role !== null;

  function goToStep1() {
    const trimmed = form.fullName.trim();
    const trimmedEmail = form.email.trim();
    const errors: Record<string, string | undefined> = {};
    if (trimmed.length < 2) errors.fullName = t('fullNameLabel');
    if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail)) {
      errors.email = t('emailInvalid');
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setDirection(1);
    setStep(1);
  }

  function submit() {
    if (!form.role) return;
    setError(null);
    const formData = new FormData();
    formData.set('fullName', form.fullName.trim());
    formData.set('role', form.role);
    formData.set('email', form.email.trim());

    startTransition(async () => {
      const result = await completeOnboardingAction(formData);
      if (!result || result.ok) return;
      if (result.fieldErrors) {
        const flat: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(result.fieldErrors)) {
          if (v && v.length > 0) flat[k] = v[0];
        }
        setFieldErrors(flat);
        if (flat.fullName || flat.email) {
          setDirection(-1);
          setStep(0);
        }
        return;
      }
      setError('Une erreur est survenue. Réessayez.');
    });
  }

  const variants = {
    enter: (dir: 1 | -1) => ({ opacity: 0, x: reduced ? 0 : dir * 24 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: 1 | -1) => ({ opacity: 0, x: reduced ? 0 : dir * -24 }),
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Eyebrow + progress */}
      <div className="flex flex-col gap-4">
        <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-gold-700)] uppercase">
          ÉTAPE {String(step + 1).padStart(2, '0')} — {step === 0 ? 'PROFIL' : 'PARCOURS'}
        </span>
        <Progress current={step} total={2} />
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        {step === 0 ? (
          <motion.section
            key="step-0"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-col gap-6"
          >
            <header className="flex flex-col gap-3">
              <h2
                className="font-display italic"
                style={{
                  fontSize: 'clamp(1.75rem, 2.8vw, 2.25rem)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.022em',
                  color: 'var(--color-ink-900)',
                }}
              >
                {t('stepProfile')}
              </h2>
              <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)] sm:text-base">
                {t('stepProfileDescription')}
              </p>
            </header>

            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">{t('fullNameLabel')}</Label>
              <Input
                id="fullName"
                name="fullName"
                autoFocus
                autoComplete="name"
                placeholder={t('fullNamePlaceholder')}
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                aria-invalid={!!fieldErrors.fullName}
              />
              {fieldErrors.fullName ? (
                <p className="text-xs text-[color:var(--color-destructive)]">
                  {fieldErrors.fullName}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t('emailLabel')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                readOnly={emailLocked}
                placeholder={t('emailPlaceholder')}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                aria-invalid={!!fieldErrors.email}
              />
              {emailLocked ? (
                <p className="text-xs text-[color:var(--color-ink-500)]">{t('emailLockedHint')}</p>
              ) : (
                <p className="text-xs text-[color:var(--color-ink-500)]">
                  {t('emailRequiredHint')}
                </p>
              )}
              {fieldErrors.email ? (
                <p className="text-xs text-[color:var(--color-destructive)]">{fieldErrors.email}</p>
              ) : null}
            </div>

            <Button size="lg" onClick={goToStep1} disabled={!canGoNext}>
              {t('next')}
            </Button>
          </motion.section>
        ) : (
          <motion.section
            key="step-1"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-col gap-6"
          >
            <header className="flex flex-col gap-3">
              <h2
                className="font-display italic"
                style={{
                  fontSize: 'clamp(1.75rem, 2.8vw, 2.25rem)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.022em',
                  color: 'var(--color-ink-900)',
                }}
              >
                {t('stepRole')}
              </h2>
              <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)] sm:text-base">
                {t('stepRoleDescription')}
              </p>
            </header>

            <div role="radiogroup" aria-label={t('stepRole')} className="flex flex-col gap-3">
              {ROLE_OPTIONS.map((opt) => {
                const selected = form.role === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setForm({ ...form, role: opt.value })}
                    className={cn(
                      'focus-ring group relative flex items-start gap-4 overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200',
                      selected
                        ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-blush-50)] shadow-[var(--shadow-blush)]'
                        : 'border-[color:var(--color-border)] bg-white hover:border-[color:var(--color-blush-300)] hover:shadow-[var(--shadow-soft)]',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-colors',
                        selected
                          ? 'bg-[color:var(--color-blush-700)] text-white'
                          : 'bg-[color:var(--color-ivory-100)] text-[color:var(--color-ink-700)]',
                      )}
                    >
                      <opt.Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="flex flex-1 flex-col gap-1">
                      <span className="text-base font-medium text-[color:var(--color-ink-900)]">
                        {t(opt.titleKey)}
                      </span>
                      <span className="text-sm text-[color:var(--color-ink-500)]">
                        {t(opt.descriptionKey)}
                      </span>
                    </div>
                    {selected && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                        aria-hidden
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--color-blush-700)] text-white"
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </motion.span>
                    )}
                  </button>
                );
              })}
            </div>

            {error ? (
              <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setDirection(-1);
                  setStep(0);
                }}
                disabled={pending}
                type="button"
              >
                {tCommon('back')}
              </Button>
              <Button size="lg" onClick={submit} disabled={!canSubmit || pending}>
                {pending ? tCommon('loading') : t('finish')}
              </Button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Étape ${current + 1} sur ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn('h-1 flex-1 overflow-hidden rounded-full bg-[color:var(--color-border)]')}
        >
          <motion.span
            className="block h-full bg-[color:var(--color-gold-500)]"
            initial={{ width: '0%' }}
            animate={{ width: i <= current ? '100%' : '0%' }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        </span>
      ))}
    </div>
  );
}
