import { describe, expect, it } from 'vitest';
import { addGuestSchema, updateGuestSchema } from '@/lib/validators/guests';

describe('validators/guests — addGuestSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = addGuestSchema.safeParse({
      fullName: 'Aminata Diallo',
      plusOnesAllowed: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe('Aminata Diallo');
      expect(result.data.plusOnesAllowed).toBe(0);
      expect(result.data.phone).toBeUndefined();
      expect(result.data.email).toBeUndefined();
    }
  });

  it('trims fullName and rejects empty string', () => {
    const ok = addGuestSchema.safeParse({ fullName: '  Aminata  ', plusOnesAllowed: 0 });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.fullName).toBe('Aminata');

    const empty = addGuestSchema.safeParse({ fullName: '   ', plusOnesAllowed: 0 });
    expect(empty.success).toBe(false);
  });

  it('accepts plusOnesAllowed passed as string', () => {
    const result = addGuestSchema.safeParse({ fullName: 'X', plusOnesAllowed: '3' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.plusOnesAllowed).toBe(3);
  });

  it('rejects plusOnesAllowed out of range', () => {
    expect(addGuestSchema.safeParse({ fullName: 'X', plusOnesAllowed: -1 }).success).toBe(false);
    expect(addGuestSchema.safeParse({ fullName: 'X', plusOnesAllowed: 11 }).success).toBe(false);
    expect(addGuestSchema.safeParse({ fullName: 'X', plusOnesAllowed: 2.5 }).success).toBe(false);
  });

  it('accepts valid E.164 phone and strips empty phone to undefined', () => {
    const withPhone = addGuestSchema.safeParse({
      fullName: 'X',
      phone: '+33612345678',
      plusOnesAllowed: 0,
    });
    expect(withPhone.success).toBe(true);
    if (withPhone.success) expect(withPhone.data.phone).toBe('+33612345678');

    const empty = addGuestSchema.safeParse({ fullName: 'X', phone: '', plusOnesAllowed: 0 });
    expect(empty.success).toBe(true);
    if (empty.success) expect(empty.data.phone).toBeUndefined();
  });

  it('rejects phone without + prefix', () => {
    const bad = addGuestSchema.safeParse({
      fullName: 'X',
      phone: '0612345678',
      plusOnesAllowed: 0,
    });
    expect(bad.success).toBe(false);
  });

  it('lowercases a valid email and rejects invalid', () => {
    const ok = addGuestSchema.safeParse({
      fullName: 'X',
      email: 'Aminata@Example.COM',
      plusOnesAllowed: 0,
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.email).toBe('aminata@example.com');

    const bad = addGuestSchema.safeParse({
      fullName: 'X',
      email: 'nope',
      plusOnesAllowed: 0,
    });
    expect(bad.success).toBe(false);
  });

  it('rejects fullName longer than 120 chars', () => {
    const long = 'a'.repeat(121);
    expect(addGuestSchema.safeParse({ fullName: long, plusOnesAllowed: 0 }).success).toBe(false);
  });

  it('strips empty category and notes to undefined', () => {
    const result = addGuestSchema.safeParse({
      fullName: 'X',
      category: '',
      notes: '   ',
      plusOnesAllowed: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBeUndefined();
      expect(result.data.notes).toBeUndefined();
    }
  });
});

describe('validators/guests — updateGuestSchema', () => {
  it('accepts an empty payload (nothing to change)', () => {
    const result = updateGuestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('applies the same rules as addGuestSchema when fields are present', () => {
    const bad = updateGuestSchema.safeParse({ plusOnesAllowed: 42 });
    expect(bad.success).toBe(false);

    const good = updateGuestSchema.safeParse({ fullName: ' Kwame ', plusOnesAllowed: 2 });
    expect(good.success).toBe(true);
    if (good.success) {
      expect(good.data.fullName).toBe('Kwame');
      expect(good.data.plusOnesAllowed).toBe(2);
    }
  });
});
