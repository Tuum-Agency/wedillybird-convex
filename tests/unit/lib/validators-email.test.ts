import { describe, expect, it } from 'vitest';
import {
  EMAIL_REGEX,
  emailSchema,
  isValidEmail,
  optionalEmailSchema,
} from '@/lib/validators/email';

describe('isValidEmail', () => {
  it('accepts simple emails', () => {
    expect(isValidEmail('alice@example.com')).toBe(true);
    expect(isValidEmail('first.last@sub.domain.fr')).toBe(true);
  });

  it('accepts plus-addressed emails', () => {
    expect(isValidEmail('alice+wedding@example.com')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('rejects missing @', () => {
    expect(isValidEmail('alice.example.com')).toBe(false);
  });

  it('rejects missing TLD', () => {
    expect(isValidEmail('alice@example')).toBe(false);
  });

  it('rejects whitespace', () => {
    expect(isValidEmail('alice @example.com')).toBe(false);
    expect(isValidEmail(' alice@example.com')).toBe(false);
  });
});

describe('EMAIL_REGEX', () => {
  it('is exported and identical to the regex used in isValidEmail', () => {
    expect(EMAIL_REGEX.test('alice@example.com')).toBe(true);
    expect(EMAIL_REGEX.test('not-an-email')).toBe(false);
  });
});

describe('emailSchema', () => {
  it('trims and lowercases', () => {
    const r = emailSchema.safeParse('  Alice@Example.COM  ');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe('alice@example.com');
  });

  it('rejects invalid', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
});

describe('optionalEmailSchema', () => {
  it('returns undefined for empty string', () => {
    const r = optionalEmailSchema.safeParse('');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBeUndefined();
  });

  it('returns undefined when omitted', () => {
    const r = optionalEmailSchema.safeParse(undefined);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBeUndefined();
  });

  it('accepts valid', () => {
    const r = optionalEmailSchema.safeParse('Alice@Example.com');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe('alice@example.com');
  });

  it('rejects invalid non-empty', () => {
    expect(optionalEmailSchema.safeParse('garbage').success).toBe(false);
  });
});
