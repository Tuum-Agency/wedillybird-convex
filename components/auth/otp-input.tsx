'use client';

import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import { cn } from '@/lib/cn';

interface OtpInputProps {
  length?: number;
  name?: string;
  error?: string;
  autoFocus?: boolean;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
}

export function OtpInput({
  length = 6,
  name = 'code',
  error,
  autoFocus = true,
  onChange,
  onComplete,
}: OtpInputProps) {
  const t = useTranslations('Auth');
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length }, () => ''));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const value = digits.join('');

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  useEffect(() => {
    onChange?.(value);
    if (value.length === length && !digits.includes('')) {
      onComplete?.(value);
    }
  }, [value, digits, length, onChange, onComplete]);

  const setDigit = useCallback(
    (index: number, raw: string) => {
      const clean = raw.replace(/\D/g, '');
      if (!clean) {
        setDigits((prev) => {
          const next = [...prev];
          next[index] = '';
          return next;
        });
        return;
      }
      setDigits((prev) => {
        const next = [...prev];
        const chars = clean.split('').slice(0, length - index);
        for (let i = 0; i < chars.length; i++) next[index + i] = chars[i]!;
        return next;
      });
      const nextIndex = Math.min(index + clean.length, length - 1);
      refs.current[nextIndex]?.focus();
    },
    [length],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
      setDigits((prev) => {
        const next = [...prev];
        next[index - 1] = '';
        return next;
      });
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!/\d/.test(text)) return;
    e.preventDefault();
    setDigit(0, text);
  };

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div
        role="group"
        aria-label={t('otpGroupLabel')}
        className="flex justify-center gap-1.5 sm:gap-2"
        onPaste={handlePaste}
      >
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            value={digit}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            aria-label={t('otpDigitLabel', { position: i + 1, total: length })}
            aria-invalid={!!error}
            className={cn(
              // Fluid boxes: grow to fill the row, cap at 48px (w-12). Never overflows
              // the AuthCard on narrow phones (≥320px); identical 48px look from ~390px up.
              'focus-ring h-14 max-w-12 min-w-0 flex-1 rounded-lg border bg-[color:var(--color-surface)] text-center font-mono text-xl',
              error
                ? 'border-[color:var(--color-destructive)]'
                : 'border-[color:var(--color-border)]',
            )}
          />
        ))}
      </div>
      {error ? <p className="mt-2 text-xs text-[color:var(--color-destructive)]">{error}</p> : null}
    </div>
  );
}
