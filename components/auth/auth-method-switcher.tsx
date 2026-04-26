'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { MessageCircle, Mail } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SignInForm } from './sign-in-form';
import { MagicLinkForm } from './magic-link-form';

type Method = 'whatsapp' | 'email';

/**
 * AuthMethodSwitcher — toggle entre SignInForm OTP WhatsApp (par défaut)
 * et MagicLinkForm email (fallback pour ceux qui n'ont pas WhatsApp).
 *
 * Pattern visuel : 2 boutons radio en haut, contenu animé en dessous.
 * Animation Motion niveau B sobre (cross-fade rapide entre les forms).
 */
export function AuthMethodSwitcher() {
  const t = useTranslations('Auth');
  const reduced = useReducedMotion();
  const [method, setMethod] = useState<Method>('whatsapp');

  return (
    <div className="flex flex-col gap-7">
      {/* Toggle methods */}
      <div
        role="tablist"
        aria-label={t('methodSwitcherLabel')}
        className="grid grid-cols-2 gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-ivory-100)] p-1.5"
      >
        <MethodButton
          method="whatsapp"
          active={method === 'whatsapp'}
          onClick={() => setMethod('whatsapp')}
          Icon={MessageCircle}
          label={t('methodWhatsapp')}
        />
        <MethodButton
          method="email"
          active={method === 'email'}
          onClick={() => setMethod('email')}
          Icon={Mail}
          label={t('methodEmail')}
        />
      </div>

      {/* Form animé selon la méthode sélectionnée */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={method}
          initial={{ opacity: 0, y: reduced ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          role="tabpanel"
        >
          {method === 'whatsapp' ? <SignInForm /> : <MagicLinkForm />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

interface MethodButtonProps {
  method: Method;
  active: boolean;
  onClick: () => void;
  Icon: typeof MessageCircle;
  label: string;
}

function MethodButton({ method, active, onClick, Icon, label }: MethodButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={`auth-panel-${method}`}
      onClick={onClick}
      className={cn(
        'focus-ring relative flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'text-[color:var(--color-ink-900)]'
          : 'text-[color:var(--color-ink-500)] hover:text-[color:var(--color-ink-700)]',
      )}
    >
      {active && (
        <motion.span
          aria-hidden
          layoutId="auth-method-active"
          className="absolute inset-0 rounded-xl bg-white shadow-[var(--shadow-soft)]"
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        />
      )}
      <span className="relative flex items-center gap-2">
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        {label}
      </span>
    </button>
  );
}
