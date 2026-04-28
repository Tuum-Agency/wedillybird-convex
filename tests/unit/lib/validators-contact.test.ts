import { describe, expect, it } from 'vitest';
import { contactFormSchema, isHoneypotTriggered, newsletterSchema } from '@/lib/validators/contact';

describe('contactFormSchema', () => {
  const validBase = {
    name: 'Aminata Diallo',
    email: 'aminata@example.com',
    subject: 'Mariage en juin',
    message: "Bonjour, j'aimerais en savoir plus sur vos formules.",
  };

  it('accepts a valid contact submission', () => {
    const r = contactFormSchema.safeParse(validBase);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('aminata@example.com');
  });

  it('lowercases email', () => {
    const r = contactFormSchema.safeParse({ ...validBase, email: 'Aminata@Example.COM' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('aminata@example.com');
  });

  it('rejects short name', () => {
    const r = contactFormSchema.safeParse({ ...validBase, name: 'A' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const r = contactFormSchema.safeParse({ ...validBase, email: 'not-email' });
    expect(r.success).toBe(false);
  });

  it('rejects subject too short', () => {
    const r = contactFormSchema.safeParse({ ...validBase, subject: 'ok' });
    expect(r.success).toBe(false);
  });

  it('rejects subject too long', () => {
    const r = contactFormSchema.safeParse({ ...validBase, subject: 'x'.repeat(141) });
    expect(r.success).toBe(false);
  });

  it('rejects message under 20 chars', () => {
    const r = contactFormSchema.safeParse({ ...validBase, message: 'Trop court' });
    expect(r.success).toBe(false);
  });

  it('rejects message over 5000 chars', () => {
    const r = contactFormSchema.safeParse({ ...validBase, message: 'x'.repeat(5001) });
    expect(r.success).toBe(false);
  });

  it('defaults website (honeypot) to empty string', () => {
    const r = contactFormSchema.safeParse(validBase);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.website).toBe('');
  });

  it('passes when honeypot is filled (validation does not block, route does)', () => {
    const r = contactFormSchema.safeParse({ ...validBase, website: 'http://spam.example' });
    expect(r.success).toBe(true);
    if (r.success) expect(isHoneypotTriggered(r.data)).toBe(true);
  });
});

describe('newsletterSchema', () => {
  it('accepts a valid email', () => {
    const r = newsletterSchema.safeParse({ email: 'me@example.com' });
    expect(r.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const r = newsletterSchema.safeParse({ email: 'nope' });
    expect(r.success).toBe(false);
  });

  it('treats empty website as no honeypot', () => {
    const r = newsletterSchema.safeParse({ email: 'me@example.com', website: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(isHoneypotTriggered(r.data)).toBe(false);
  });
});

describe('isHoneypotTriggered', () => {
  it('returns false when website is undefined', () => {
    expect(isHoneypotTriggered({})).toBe(false);
  });

  it('returns false when website is empty / whitespace', () => {
    expect(isHoneypotTriggered({ website: '' })).toBe(false);
    expect(isHoneypotTriggered({ website: '   ' })).toBe(false);
  });

  it('returns true when website is filled', () => {
    expect(isHoneypotTriggered({ website: 'evil.com' })).toBe(true);
  });
});
