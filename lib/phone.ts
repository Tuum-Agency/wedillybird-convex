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

export function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  const prefix = phone.slice(0, 3);
  const suffix = phone.slice(-2);
  return `${prefix}\u2022\u2022\u2022\u2022\u2022\u2022${suffix}`;
}
