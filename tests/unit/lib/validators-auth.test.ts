import { describe, expect, it } from 'vitest';
import {
  onboardingSchema,
  otpCodeSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from '@/lib/validators/auth';

describe('requestOtpSchema', () => {
  it('normalizes and accepts valid French phone', () => {
    const result = requestOtpSchema.safeParse({ phone: '06 12 34 56 78' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe('+33612345678');
  });

  it('rejects invalid phone', () => {
    const result = requestOtpSchema.safeParse({ phone: 'abc' });
    expect(result.success).toBe(false);
  });
});

describe('otpCodeSchema', () => {
  it('accepts 6 digits', () => {
    expect(otpCodeSchema.safeParse('123456').success).toBe(true);
  });

  it('rejects shorter / longer / non-numeric', () => {
    expect(otpCodeSchema.safeParse('12345').success).toBe(false);
    expect(otpCodeSchema.safeParse('1234567').success).toBe(false);
    expect(otpCodeSchema.safeParse('abcdef').success).toBe(false);
  });
});

describe('verifyOtpSchema', () => {
  it('accepts a valid combo', () => {
    const r = verifyOtpSchema.safeParse({ phone: '+33612345678', code: '123456' });
    expect(r.success).toBe(true);
  });

  it('fails on invalid code', () => {
    const r = verifyOtpSchema.safeParse({ phone: '+33612345678', code: '12' });
    expect(r.success).toBe(false);
  });
});

describe('onboardingSchema', () => {
  it('accepts minimal valid input (with email — required since avril 2026)', () => {
    const r = onboardingSchema.safeParse({
      fullName: 'Alice Martin',
      role: 'couple',
      email: 'alice@example.com',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('alice@example.com');
  });

  it('lowercases email', () => {
    const r = onboardingSchema.safeParse({
      fullName: 'Alice Martin',
      role: 'pro',
      email: 'Alice@Example.COM',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('alice@example.com');
  });

  it('rejects missing email', () => {
    const r = onboardingSchema.safeParse({ fullName: 'Alice Martin', role: 'couple' });
    expect(r.success).toBe(false);
  });

  it('rejects empty email', () => {
    const r = onboardingSchema.safeParse({
      fullName: 'Alice Martin',
      role: 'couple',
      email: '',
    });
    expect(r.success).toBe(false);
  });

  it('rejects short name', () => {
    const r = onboardingSchema.safeParse({
      fullName: 'A',
      role: 'couple',
      email: 'alice@example.com',
    });
    expect(r.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const r = onboardingSchema.safeParse({
      fullName: 'Alice Martin',
      role: 'admin',
      email: 'alice@example.com',
    });
    expect(r.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const r = onboardingSchema.safeParse({
      fullName: 'Alice Martin',
      role: 'couple',
      email: 'not-an-email',
    });
    expect(r.success).toBe(false);
  });
});
