'use client';

import { useMemo, useState, useTransition } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Heart, Briefcase, Check, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OtpInput } from '@/components/auth/otp-input';
import { cn } from '@/lib/cn';
import { completeOnboardingAction } from '@/app/[locale]/(auth)/actions';
import { isValidEmail } from '@/lib/validators/email';

type Role = 'couple' | 'pro';
type StepKey = 'profile' | 'secure' | 'role';
type SecureSubStep = 'input' | 'verify';

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

const STEP_EYEBROW: Record<StepKey, string> = {
  profile: 'PROFIL',
  secure: 'SÉCURITÉ',
  role: 'PARCOURS',
};

/**
 * OnboardingWizard V5 — wizard 2 ou 3 steps avec animations Motion sobres.
 *
 * Politique d'identité unique (avril 2026) : un compte doit avoir email ET phone.
 *
 * Steps dynamiques :
 *  - profile : nom + email (obligatoire)
 *  - secure  : phone WhatsApp via OTP (n'apparaît que si l'user n'en a pas)
 *  - role    : couple vs pro (toujours dernier)
 *
 * Logique d'apparition du step `secure` :
 *  - initialEmail rempli + initialPhone vide (magic link) → step `secure` ajouté.
 *  - initialPhone rempli (WhatsApp) → step `secure` masqué (l'email est déjà
 *    demandé au step profile).
 *  - aucun des deux (rare) → step `secure` ajouté pour récolter le phone après
 *    l'email saisi au profile.
 */
export function OnboardingWizard({
  initialEmail = '',
  initialPhone = '',
}: {
  initialEmail?: string;
  initialPhone?: string;
}) {
  const t = useTranslations('Onboarding');
  const tCommon = useTranslations('Common');
  const reduced = useReducedMotion();

  const needsPhone = initialPhone.trim().length === 0;
  const steps = useMemo<ReadonlyArray<StepKey>>(
    () => (needsPhone ? ['profile', 'secure', 'role'] : ['profile', 'role']),
    [needsPhone],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [form, setForm] = useState<FormState>({
    fullName: '',
    email: initialEmail,
    role: null,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // État local du step `secure` (phone OTP)
  const [secureSubStep, setSecureSubStep] = useState<SecureSubStep>('input');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [secureError, setSecureError] = useState<string | null>(null);
  const [securePending, startSecureTransition] = useTransition();

  const currentStep = steps[stepIndex]!;
  const emailLocked = initialEmail.length > 0;

  const canGoFromProfile = form.fullName.trim().length >= 2 && isValidEmail(form.email.trim());
  const canSubmitRole = currentStep === 'role' && form.role !== null;

  function goNext() {
    setDirection(1);
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function goPrev() {
    setDirection(-1);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function handleProfileNext() {
    const trimmed = form.fullName.trim();
    const trimmedEmail = form.email.trim();
    const errors: Record<string, string | undefined> = {};
    if (trimmed.length < 2) errors.fullName = t('fullNameLabel');
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      errors.email = t('emailInvalid');
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    goNext();
  }

  function sendPhoneCode() {
    setSecureError(null);
    const trimmed = phone.trim();
    if (!trimmed) {
      setSecureError(t('errors.invalidPhone'));
      return;
    }
    startSecureTransition(async () => {
      try {
        const res = await fetch('/api/account/link/phone/request', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ phone: trimmed }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (res.ok && json.ok) {
          setSecureSubStep('verify');
          setOtpCode('');
          return;
        }
        setSecureError(mapLinkErrorToCopy(json.error ?? 'UNKNOWN', t));
      } catch {
        setSecureError(t('errors.network'));
      }
    });
  }

  function verifyPhoneCode() {
    setSecureError(null);
    if (!/^\d{6}$/.test(otpCode)) {
      setSecureError(t('errors.invalidCode'));
      return;
    }
    startSecureTransition(async () => {
      try {
        const res = await fetch('/api/account/link/phone/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ phone: phone.trim(), code: otpCode }),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (res.ok && json.ok) {
          // succès → on avance vers le step rôle
          goNext();
          return;
        }
        setSecureError(mapLinkErrorToCopy(json.error ?? 'UNKNOWN', t));
      } catch {
        setSecureError(t('errors.network'));
      }
    });
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
          setStepIndex(0);
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
          ÉTAPE {String(stepIndex + 1).padStart(2, '0')} — {STEP_EYEBROW[currentStep]}
        </span>
        <Progress current={stepIndex} total={steps.length} />
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        {currentStep === 'profile' ? (
          <motion.section
            key="step-profile"
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

            <Button size="lg" onClick={handleProfileNext} disabled={!canGoFromProfile}>
              {t('next')}
            </Button>
          </motion.section>
        ) : currentStep === 'secure' ? (
          <motion.section
            key="step-secure"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-col gap-6"
          >
            <header className="flex flex-col gap-3">
              <span
                aria-hidden
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--color-blush-50)] text-[color:var(--color-blush-700)]"
              >
                <ShieldCheck className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <h2
                className="font-display italic"
                style={{
                  fontSize: 'clamp(1.75rem, 2.8vw, 2.25rem)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.022em',
                  color: 'var(--color-ink-900)',
                }}
              >
                {t('stepSecure')}
              </h2>
              <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)] sm:text-base">
                {t('stepSecureDescription')}
              </p>
            </header>

            {secureSubStep === 'input' ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="onboarding-phone">{t('phoneLabel')}</Label>
                  <Input
                    id="onboarding-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    autoFocus
                    placeholder={t('phonePlaceholder')}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    aria-invalid={!!secureError}
                  />
                  <p className="text-xs text-[color:var(--color-ink-500)]">
                    {t('phoneRequiredHint')}
                  </p>
                  {secureError ? (
                    <p role="alert" className="text-xs text-[color:var(--color-destructive)]">
                      {secureError}
                    </p>
                  ) : null}
                </div>
                <Button
                  size="lg"
                  onClick={sendPhoneCode}
                  disabled={securePending || phone.trim().length === 0}
                >
                  {securePending ? t('sending') : t('sendCode')}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-[color:var(--color-ink-500)]">
                  {t('codeSentTo', { phone: phone.trim() })}
                </p>
                <OtpInput onChange={setOtpCode} error={secureError ?? undefined} autoFocus />
                <Button
                  size="lg"
                  onClick={verifyPhoneCode}
                  disabled={securePending || otpCode.length < 6}
                >
                  {securePending ? t('verifying') : t('verifyCode')}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setSecureSubStep('input');
                    setSecureError(null);
                    setOtpCode('');
                  }}
                  className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-blush-700)]"
                >
                  ← {t('changeNumber')}
                </button>
              </div>
            )}
          </motion.section>
        ) : (
          <motion.section
            key="step-role"
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
              <Button variant="ghost" onClick={goPrev} disabled={pending} type="button">
                {tCommon('back')}
              </Button>
              <Button size="lg" onClick={submit} disabled={!canSubmitRole || pending}>
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

/**
 * Map des codes d'erreur retournés par l'API `/api/account/link/phone/*` vers
 * la copie FR de l'onboarding. Pas de fusion avec un user existant : si le
 * numéro est déjà utilisé, on guide vers la connexion WhatsApp.
 */
function mapLinkErrorToCopy(
  code: string,
  t: (k: string, v?: Record<string, string>) => string,
): string {
  switch (code) {
    case 'PHONE_TAKEN':
      return t('errors.phoneTaken');
    case 'ALREADY_LINKED':
      return t('errors.alreadyLinked');
    case 'INVALID_PHONE':
      return t('errors.invalidPhone');
    case 'INVALID_CODE':
      return t('errors.invalidCode');
    case 'LINK_EXPIRED':
    case 'NO_ACTIVE_LINK':
      return t('errors.expiredCode');
    case 'TOO_MANY_ATTEMPTS':
      return t('errors.tooManyAttempts');
    case 'RATE_LIMITED':
      return t('errors.rateLimited');
    case 'SEND_FAILED':
      return t('errors.sendFailed');
    default:
      return t('errors.network');
  }
}
