'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
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
}> = [
  { value: 'couple', titleKey: 'roleCouple', descriptionKey: 'roleCoupleDescription' },
  { value: 'pro', titleKey: 'rolePro', descriptionKey: 'roleProDescription' },
];

export function OnboardingWizard() {
  const t = useTranslations('Onboarding');
  const tCommon = useTranslations('Common');
  const [step, setStep] = useState<0 | 1>(0);
  const [form, setForm] = useState<FormState>({ fullName: '', email: '', role: null });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canGoNext = step === 0 && form.fullName.trim().length >= 2;
  const canSubmit = step === 1 && form.role !== null;

  function goToStep1() {
    const trimmed = form.fullName.trim();
    const errors: Record<string, string | undefined> = {};
    if (trimmed.length < 2) errors.fullName = t('fullNameLabel');
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = t('emailLabel');
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setStep(1);
  }

  function submit() {
    if (!form.role) return;
    setError(null);
    const formData = new FormData();
    formData.set('fullName', form.fullName.trim());
    formData.set('role', form.role);
    if (form.email.trim()) formData.set('email', form.email.trim());

    startTransition(async () => {
      const result = await completeOnboardingAction(formData);
      if (!result || result.ok) return;
      if (result.fieldErrors) {
        const flat: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(result.fieldErrors)) {
          if (v && v.length > 0) flat[k] = v[0];
        }
        setFieldErrors(flat);
        if (flat.fullName) setStep(0);
        return;
      }
      setError('Une erreur est survenue. Réessayez.');
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Progress current={step} total={2} />

      {step === 0 ? (
        <section className="flex flex-col gap-5">
          <header className="flex flex-col gap-1.5">
            <h2 className="font-display text-2xl font-semibold">{t('stepProfile')}</h2>
            <p className="text-sm text-[color:var(--color-muted)]">{t('stepProfileDescription')}</p>
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
              placeholder={t('emailPlaceholder')}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              aria-invalid={!!fieldErrors.email}
            />
            {fieldErrors.email ? (
              <p className="text-xs text-[color:var(--color-destructive)]">{fieldErrors.email}</p>
            ) : null}
          </div>

          <Button size="lg" onClick={goToStep1} disabled={!canGoNext}>
            {t('next')}
          </Button>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="flex flex-col gap-5">
          <header className="flex flex-col gap-1.5">
            <h2 className="font-display text-2xl font-semibold">{t('stepRole')}</h2>
            <p className="text-sm text-[color:var(--color-muted)]">{t('stepRoleDescription')}</p>
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
                    'focus-ring flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors',
                    selected
                      ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/5'
                      : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-primary)]/40',
                  )}
                >
                  <span className="font-medium">{t(opt.titleKey)}</span>
                  <span className="text-sm text-[color:var(--color-muted)]">
                    {t(opt.descriptionKey)}
                  </span>
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
            <Button variant="ghost" onClick={() => setStep(0)} disabled={pending} type="button">
              {tCommon('back')}
            </Button>
            <Button size="lg" onClick={submit} disabled={!canSubmit || pending}>
              {pending ? tCommon('loading') : t('finish')}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Étape ${current + 1} sur ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full',
            i <= current ? 'bg-[color:var(--color-primary)]' : 'bg-[color:var(--color-border)]',
          )}
        />
      ))}
    </div>
  );
}
