'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createOrganizationAction } from '@/app/[locale]/(app)/pro/actions';
import { currencyForLocale, currencyOptions } from '@/lib/currency';

export function OrgOnboardingForm() {
  const t = useTranslations('Pro');
  const tCommon = useTranslations('Common');
  const tCurrency = useTranslations('CurrencySwitcher');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createOrganizationAction(formData);
      if (result.ok) {
        router.push('/pro/dashboard');
        router.refresh();
        return;
      }
      setError(t(`errors.${result.error.toLowerCase()}` as const));
    });
  }

  return (
    <form
      action={onSubmit}
      className="flex flex-col gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6"
      data-testid="org-onboarding-form"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t('orgNameLabel')}</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          placeholder={t('orgNamePlaceholder')}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="primaryColor">{t('primaryColorLabel')}</Label>
          <Input id="primaryColor" name="primaryColor" type="color" defaultValue="#2c1a11" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="accentColor">{t('accentColorLabel')}</Label>
          <Input id="accentColor" name="accentColor" type="color" defaultValue="#c8a165" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="currency">{tCurrency('chooseLabel')}</Label>
        <Select name="currency" defaultValue={currencyForLocale(locale)}>
          <SelectTrigger id="currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currencyOptions(locale).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} data-testid="submit-org">
        {pending ? tCommon('loading') : t('createOrg')}
      </Button>
    </form>
  );
}
