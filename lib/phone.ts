const DEFAULT_COUNTRY_CODE = '33';

export function normalizePhoneE164(
  input: string,
  defaultCountryCode = DEFAULT_COUNTRY_CODE,
): string | null {
  const digits = input.replace(/[^\d+]/g, '');

  if (!digits) return null;

  if (digits.startsWith('+')) {
    const rest = digits.slice(1);
    if (rest.length < 8 || rest.length > 15 || !/^\d+$/.test(rest)) return null;
    return `+${rest}`;
  }

  if (digits.startsWith('00')) {
    const rest = digits.slice(2);
    if (rest.length < 8 || rest.length > 15 || !/^\d+$/.test(rest)) return null;
    return `+${rest}`;
  }

  if (digits.startsWith('0')) {
    const rest = digits.slice(1);
    if (rest.length < 7 || rest.length > 14) return null;
    return `+${defaultCountryCode}${rest}`;
  }

  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

/**
 * Sépare un numéro E.164 (`+33612345678`) en indicatif connu + numéro local, en
 * choisissant le **plus long** indicatif qui correspond (évite que `+1` mange
 * `+1xx`). Renvoie null si l'entrée n'est pas un E.164 ou si aucun indicatif ne
 * correspond. Pur → utilisé par `PhoneInput` (pré-remplissage en édition) et testé.
 */
export function splitE164(
  e164: string,
  dialCodes: readonly string[],
): { dial: string; local: string } | null {
  if (typeof e164 !== 'string' || !e164.startsWith('+')) return null;
  const digits = e164.slice(1).replace(/[^\d]/g, '');
  if (!digits) return null;
  const dial = [...dialCodes].sort((a, b) => b.length - a.length).find((d) => digits.startsWith(d));
  if (!dial) return null;
  return { dial, local: digits.slice(dial.length) };
}

export function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  const prefix = phone.slice(0, 3);
  const suffix = phone.slice(-2);
  return `${prefix}\u2022\u2022\u2022\u2022\u2022\u2022${suffix}`;
}
