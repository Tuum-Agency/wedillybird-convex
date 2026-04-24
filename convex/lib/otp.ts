export function generateOtpCode(): string {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  const value = buffer[0]! % 1_000_000;
  return value.toString().padStart(6, '0');
}

export async function hashOtp(code: string, phone: string): Promise<string> {
  const material = `${phone}:${code}`;
  const data = new TextEncoder().encode(material);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(digest);
}

export async function verifyOtpHash(
  code: string,
  phone: string,
  expected: string,
): Promise<boolean> {
  const actual = await hashOtp(code, phone);
  return timingSafeEqual(actual, expected);
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export const OTP_EXPIRY_MS = 5 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const MAX_OTP_PER_HOUR = 5;
export const RATE_WINDOW_MS = 60 * 60 * 1000;
