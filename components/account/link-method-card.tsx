'use client';

import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { ArrowRight, CheckCircle2, MessageCircle, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OtpInput } from '@/components/auth/otp-input';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

type Method = 'phone' | 'email';
type Step = 'input' | 'verify' | 'success';

const ENDPOINTS: Record<Method, { request: string; verify: string }> = {
  phone: {
    request: '/api/account/link/phone/request',
    verify: '/api/account/link/phone/verify',
  },
  email: {
    request: '/api/account/link/email/request',
    verify: '/api/account/link/email/verify',
  },
};

/**
 * LinkMethodCard — carte dashboard pour activer la 2e méthode de connexion.
 *
 * Affichée seulement si l'user n'a qu'une seule méthode (phone XOR email).
 * Au clic du CTA, ouvre un drawer en 2 étapes :
 *  1. Saisie de l'identifiant (phone E.164 ou email) → POST request → envoi OTP
 *  2. Saisie du code 6 chiffres reçu → POST verify → patch user
 *
 * Anti-doublon : si l'identifiant appartient déjà à un autre compte, l'API
 * retourne PHONE_TAKEN/EMAIL_TAKEN et on affiche un message clair.
 */
export function LinkMethodCard({ method }: { method: Method }) {
  const t = useTranslations(`Account.link.${method}`);
  const tShared = useTranslations('Account.link');
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('input');
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const Icon = method === 'phone' ? MessageCircle : Mail;
  const inputType = method === 'phone' ? 'tel' : 'email';
  const inputAutoComplete = method === 'phone' ? 'tel' : 'email';
  const inputMode = method === 'phone' ? ('tel' as const) : ('email' as const);

  function reset() {
    setStep('input');
    setValue('');
    setCode('');
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function sendCode() {
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setError(tShared(`errors.${method === 'phone' ? 'invalidPhone' : 'invalidEmail'}`));
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(ENDPOINTS[method].request, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ [method === 'phone' ? 'phone' : 'email']: trimmed }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          [k: string]: unknown;
        };
        if (res.ok && json.ok) {
          setStep('verify');
          return;
        }
        setError(mapErrorToCopy(json.error ?? 'UNKNOWN', tShared));
      } catch {
        setError(tShared('errors.network'));
      }
    });
  }

  function verifyCode() {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError(tShared('errors.invalidCode'));
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(ENDPOINTS[method].verify, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            [method === 'phone' ? 'phone' : 'email']: value.trim(),
            code,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (res.ok && json.ok) {
          setStep('success');
          // refresh dashboard pour que la card disparaisse
          router.refresh();
          return;
        }
        setError(mapErrorToCopy(json.error ?? 'UNKNOWN', tShared));
      } catch {
        setError(tShared('errors.network'));
      }
    });
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <article
        className="flex flex-col gap-4 rounded-3xl border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-soft)]"
        data-testid={`link-card-${method}`}
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[color:var(--color-blush-50)] text-[color:var(--color-blush-700)]"
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-gold-700)] uppercase">
              {tShared('eyebrow')}
            </span>
            <h3
              className="font-display text-lg italic"
              style={{ letterSpacing: '-0.018em', lineHeight: 1.2 }}
            >
              {t('title')}
            </h3>
            <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)]">
              {t('description')}
            </p>
          </div>
        </div>
        <DrawerTrigger asChild>
          <Button variant="primary" size="md" className="self-start">
            {t('cta')}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          </Button>
        </DrawerTrigger>
      </article>

      <DrawerContent className="md:mx-auto md:max-w-md md:rounded-3xl">
        <DrawerHeader>
          <DrawerTitle>{t('drawer.title')}</DrawerTitle>
          <DrawerDescription>
            {step === 'input'
              ? t('drawer.step1Description')
              : step === 'verify'
                ? t('drawer.step2Description', { value: value.trim() })
                : t('drawer.successDescription')}
          </DrawerDescription>
        </DrawerHeader>

        {step === 'input' ? (
          <div className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`link-input-${method}`}>
                {method === 'phone' ? tShared('phoneLabel') : tShared('emailLabel')}
              </Label>
              <Input
                id={`link-input-${method}`}
                type={inputType}
                autoComplete={inputAutoComplete}
                inputMode={inputMode}
                placeholder={
                  method === 'phone' ? tShared('phonePlaceholder') : tShared('emailPlaceholder')
                }
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-invalid={!!error}
                autoFocus
              />
              {error ? (
                <p role="alert" className="text-xs text-[color:var(--color-destructive)]">
                  {error}
                </p>
              ) : null}
            </div>
            <Button onClick={sendCode} disabled={pending} size="lg">
              {pending ? tShared('sending') : tShared('sendCode')}
            </Button>
          </div>
        ) : step === 'verify' ? (
          <div className="flex flex-col gap-4 pt-4">
            <Label>{tShared('codeLabel')}</Label>
            <OtpInput onChange={setCode} error={error ?? undefined} />
            <Button onClick={verifyCode} disabled={pending || code.length < 6} size="lg">
              {pending ? tShared('verifying') : tShared('verify')}
            </Button>
            <button
              type="button"
              onClick={() => {
                setStep('input');
                setError(null);
              }}
              className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-blush-700)]"
            >
              ← {tShared('changeValue')}
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } }}
            className="flex flex-col items-center gap-4 py-8 text-center"
          >
            <motion.span
              initial={{ scale: 0, rotate: -90 }}
              animate={{
                scale: 1,
                rotate: 0,
                transition: { type: 'spring', stiffness: 240, damping: 18 },
              }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-blush-50)] text-[color:var(--color-blush-700)]"
              aria-hidden
            >
              <CheckCircle2 className="h-7 w-7" strokeWidth={1.75} />
            </motion.span>
            <p
              className="font-display text-balance italic"
              style={{
                fontSize: 'clamp(1.25rem, 2.2vw, 1.5rem)',
                lineHeight: 1.2,
                letterSpacing: '-0.018em',
                color: 'var(--color-ink-900)',
              }}
            >
              {t('drawer.successTitle')}
            </p>
            <Button onClick={() => setOpen(false)} variant="outline" size="md">
              {tShared('done')}
            </Button>
          </motion.div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function mapErrorToCopy(code: string, tShared: (k: string) => string): string {
  switch (code) {
    case 'PHONE_TAKEN':
      return tShared('errors.phoneTaken');
    case 'EMAIL_TAKEN':
      return tShared('errors.emailTaken');
    case 'ALREADY_LINKED':
      return tShared('errors.alreadyLinked');
    case 'RATE_LIMITED':
      return tShared('errors.rateLimited');
    case 'NO_ACTIVE_LINK':
      return tShared('errors.noActiveLink');
    case 'LINK_EXPIRED':
      return tShared('errors.expired');
    case 'TOO_MANY_ATTEMPTS':
      return tShared('errors.tooManyAttempts');
    case 'INVALID_CODE':
      return tShared('errors.invalidCode');
    case 'INVALID_PHONE':
      return tShared('errors.invalidPhone');
    case 'INVALID_EMAIL':
      return tShared('errors.invalidEmail');
    case 'SEND_FAILED':
      return tShared('errors.sendFailed');
    case 'UNAUTHENTICATED':
      return tShared('errors.unauthenticated');
    default:
      return tShared('errors.unknown');
  }
}
