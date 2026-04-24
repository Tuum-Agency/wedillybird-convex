export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

export function normalizePhone(input: string, defaultCountryCode = '33'): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  if (!digits) return null;

  if (digits.startsWith('+')) {
    const rest = digits.slice(1);
    if (!/^\d{8,15}$/.test(rest)) return null;
    return `+${rest}`;
  }

  if (digits.startsWith('00')) {
    const rest = digits.slice(2);
    if (!/^\d{8,15}$/.test(rest)) return null;
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
