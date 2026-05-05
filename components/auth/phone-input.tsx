'use client';

import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import type { Locale } from '@/i18n/routing';

interface Country {
  code: string;
  dial: string;
  name: string;
  flag: string;
}

const FR: Country = { code: 'FR', dial: '33', name: 'France', flag: '🇫🇷' };

const COUNTRIES: ReadonlyArray<Country> = [
  FR,
  { code: 'BE', dial: '32', name: 'Belgique', flag: '🇧🇪' },
  { code: 'CH', dial: '41', name: 'Suisse', flag: '🇨🇭' },
  { code: 'LU', dial: '352', name: 'Luxembourg', flag: '🇱🇺' },
  { code: 'GB', dial: '44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', dial: '1', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', dial: '1', name: 'Canada', flag: '🇨🇦' },
  { code: 'IE', dial: '353', name: 'Ireland', flag: '🇮🇪' },
  { code: 'ES', dial: '34', name: 'España', flag: '🇪🇸' },
  { code: 'PT', dial: '351', name: 'Portugal', flag: '🇵🇹' },
  { code: 'BR', dial: '55', name: 'Brasil', flag: '🇧🇷' },
  { code: 'IT', dial: '39', name: 'Italia', flag: '🇮🇹' },
  { code: 'DE', dial: '49', name: 'Deutschland', flag: '🇩🇪' },
  { code: 'AT', dial: '43', name: 'Österreich', flag: '🇦🇹' },
  { code: 'NL', dial: '31', name: 'Nederland', flag: '🇳🇱' },
  { code: 'SA', dial: '966', name: 'المملكة العربية السعودية', flag: '🇸🇦' },
  { code: 'AE', dial: '971', name: 'الإمارات', flag: '🇦🇪' },
  { code: 'EG', dial: '20', name: 'مصر', flag: '🇪🇬' },
  { code: 'SN', dial: '221', name: 'Sénégal', flag: '🇸🇳' },
  { code: 'CI', dial: '225', name: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: 'MA', dial: '212', name: 'Maroc', flag: '🇲🇦' },
  { code: 'DZ', dial: '213', name: 'Algérie', flag: '🇩🇿' },
  { code: 'TN', dial: '216', name: 'Tunisie', flag: '🇹🇳' },
  { code: 'CM', dial: '237', name: 'Cameroun', flag: '🇨🇲' },
  { code: 'ML', dial: '223', name: 'Mali', flag: '🇲🇱' },
  { code: 'CD', dial: '243', name: 'RD Congo', flag: '🇨🇩' },
  { code: 'CG', dial: '242', name: 'Congo', flag: '🇨🇬' },
  { code: 'BF', dial: '226', name: 'Burkina Faso', flag: '🇧🇫' },
  { code: 'GN', dial: '224', name: 'Guinée', flag: '🇬🇳' },
  { code: 'TG', dial: '228', name: 'Togo', flag: '🇹🇬' },
  { code: 'BJ', dial: '229', name: 'Bénin', flag: '🇧🇯' },
  { code: 'NE', dial: '227', name: 'Niger', flag: '🇳🇪' },
  { code: 'GA', dial: '241', name: 'Gabon', flag: '🇬🇦' },
  { code: 'MG', dial: '261', name: 'Madagascar', flag: '🇲🇬' },
  { code: 'MU', dial: '230', name: 'Maurice', flag: '🇲🇺' },
  { code: 'HT', dial: '509', name: 'Haïti', flag: '🇭🇹' },
];

const LOCALE_TO_COUNTRY: Record<Locale, string> = {
  fr: 'FR',
  en: 'GB',
  es: 'ES',
  it: 'IT',
  pt: 'PT',
  de: 'DE',
  ar: 'SA',
};

interface PhoneInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name'> {
  name?: string;
  error?: string;
  defaultCountry?: string;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, error, id = 'phone', name = 'phone', defaultCountry, ...props }, ref) => {
    const locale = useLocale() as Locale;
    const t = useTranslations('Auth');
    const fallbackCode = defaultCountry ?? LOCALE_TO_COUNTRY[locale] ?? FR.code;
    const initial = COUNTRIES.find((c) => c.code === fallbackCode) ?? FR;
    const [country, setCountry] = useState<Country>(initial);
    const [local, setLocal] = useState('');

    const describedBy = error ? `${id}-error` : undefined;
    const sanitizedLocal = local.replace(/[^\d]/g, '').replace(/^0+/, '');
    const fullPhone = sanitizedLocal ? `+${country.dial}${sanitizedLocal}` : '';

    function handleChange(value: string) {
      const trimmed = value.trimStart();
      if (trimmed.startsWith('+')) {
        const digits = trimmed.slice(1).replace(/[^\d]/g, '');
        const match = [...COUNTRIES]
          .sort((a, b) => b.dial.length - a.dial.length)
          .find((c) => digits.startsWith(c.dial));
        if (match) {
          setCountry(match);
          setLocal(digits.slice(match.dial.length));
          return;
        }
      }
      setLocal(value);
    }

    return (
      <div className="flex flex-col gap-1.5">
        <div
          className={cn(
            'flex h-11 items-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] focus-within:ring-2 focus-within:ring-[color:var(--color-primary)]/40',
            error ? 'border-[color:var(--color-destructive)]' : '',
          )}
        >
          <div className="relative flex h-full items-center border-r border-[color:var(--color-border)]">
            <span aria-hidden className="pr-1 pl-3 text-base">
              {country.flag}
            </span>
            <span className="pr-2 text-sm text-[color:var(--color-muted)]">+{country.dial}</span>
            <select
              aria-label={t('countryCodeLabel')}
              value={country.code}
              onChange={(e) => {
                const next = COUNTRIES.find((c) => c.code === e.target.value);
                if (next) setCountry(next);
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} (+{c.dial})
                </option>
              ))}
            </select>
          </div>
          <input
            ref={ref}
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            aria-invalid={!!error}
            aria-describedby={describedBy}
            value={local}
            onChange={(e) => handleChange(e.target.value)}
            className={cn(
              'h-full w-full bg-transparent px-3 text-sm outline-none placeholder:text-[color:var(--color-muted)]',
              className,
            )}
            placeholder="6 12 34 56 78"
            {...props}
          />
          <input type="hidden" name={name} value={fullPhone} />
        </div>
        {error ? (
          <p id={describedBy} className="text-xs text-[color:var(--color-destructive)]">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
PhoneInput.displayName = 'PhoneInput';
