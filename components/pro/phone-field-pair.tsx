'use client';

/**
 * Paire de champs téléphone + WhatsApp pour les formulaires agence (prestataires,
 * clients…). Utilise `PhoneInput` (sélecteur d'indicatif) pour les deux. Comme
 * le numéro WhatsApp est très souvent le même que le téléphone, la case
 * « WhatsApp = même numéro » (cochée par défaut) évite de tout retaper : le
 * numéro WhatsApp soumis recopie alors le téléphone en direct.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PhoneInput } from '@/components/auth/phone-input';

export function PhoneFieldPair({
  phone,
  whatsapp,
  phoneLabel,
  whatsappLabel,
}: {
  phone?: string;
  whatsapp?: string;
  phoneLabel?: string;
  whatsappLabel?: string;
}) {
  const t = useTranslations('Pro.main');
  const phoneLbl = phoneLabel ?? t('phoneFieldPair.phoneLabel');
  const whatsappLbl = whatsappLabel ?? t('phoneFieldPair.whatsappLabel');
  const [phoneVal, setPhoneVal] = useState(phone ?? '');
  // Par défaut « même numéro » si pas de WhatsApp distinct enregistré.
  const [same, setSame] = useState(() => !whatsapp || whatsapp === phone);

  return (
    <div className="flex flex-col gap-2.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
          {phoneLbl}
        </span>
        <PhoneInput name="phone" defaultValue={phone} onValueChange={setPhoneVal} />
      </label>

      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[color:var(--color-foreground)]">
        <input
          type="checkbox"
          checked={same}
          onChange={(e) => setSame(e.target.checked)}
          className="h-4 w-4 accent-[color:var(--color-blush-400)]"
        />
        {t('phoneFieldPair.sameNumber', { label: whatsappLbl })}
      </label>

      {same ? (
        <input type="hidden" name="whatsapp" value={phoneVal} />
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
            {whatsappLbl}
          </span>
          <PhoneInput name="whatsapp" defaultValue={whatsapp} />
        </label>
      )}
    </div>
  );
}
