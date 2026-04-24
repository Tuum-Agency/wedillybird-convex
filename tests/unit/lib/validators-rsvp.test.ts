import { describe, expect, it } from 'vitest';
import { rsvpSubmitSchema } from '@/lib/validators/rsvp';

describe('validators/rsvp — rsvpSubmitSchema', () => {
  it('accepts attending with no extras', () => {
    const result = rsvpSubmitSchema.safeParse({ rsvpStatus: 'attending' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rsvpStatus).toBe('attending');
      expect(result.data.plusOnesNames).toEqual([]);
      expect(result.data.dietaryRestrictions).toBeUndefined();
      expect(result.data.notes).toBeUndefined();
    }
  });

  it('accepts declined answer', () => {
    const result = rsvpSubmitSchema.safeParse({ rsvpStatus: 'declined' });
    expect(result.success).toBe(true);
  });

  it('accepts maybe answer', () => {
    const result = rsvpSubmitSchema.safeParse({ rsvpStatus: 'maybe' });
    expect(result.success).toBe(true);
  });

  it('rejects pending as submitted status', () => {
    const result = rsvpSubmitSchema.safeParse({ rsvpStatus: 'pending' });
    expect(result.success).toBe(false);
  });

  it('normalizes plusOnesNames: trims and drops empties', () => {
    const result = rsvpSubmitSchema.safeParse({
      rsvpStatus: 'attending',
      plusOnesNames: ['  Awa  ', '', '   ', 'Mamadou'],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.plusOnesNames).toEqual(['Awa', 'Mamadou']);
  });

  it('accepts single plusOnesNames string (FormData shape)', () => {
    const result = rsvpSubmitSchema.safeParse({
      rsvpStatus: 'attending',
      plusOnesNames: 'Awa',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.plusOnesNames).toEqual(['Awa']);
  });

  it('rejects plusOnesNames when not attending', () => {
    const result = rsvpSubmitSchema.safeParse({
      rsvpStatus: 'declined',
      plusOnesNames: ['Awa'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 10 plusOnesNames', () => {
    const many = Array.from({ length: 11 }, (_, i) => `Name${i}`);
    const result = rsvpSubmitSchema.safeParse({
      rsvpStatus: 'attending',
      plusOnesNames: many,
    });
    expect(result.success).toBe(false);
  });

  it('rejects plusOnes name longer than 120 chars', () => {
    const long = 'a'.repeat(121);
    const result = rsvpSubmitSchema.safeParse({
      rsvpStatus: 'attending',
      plusOnesNames: [long],
    });
    expect(result.success).toBe(false);
  });

  it('trims and caps dietaryRestrictions at 200 chars', () => {
    const long = 'x'.repeat(250);
    const result = rsvpSubmitSchema.safeParse({
      rsvpStatus: 'attending',
      dietaryRestrictions: `  ${long}  `,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dietaryRestrictions?.length).toBe(200);
    }
  });

  it('strips empty dietary/notes to undefined', () => {
    const result = rsvpSubmitSchema.safeParse({
      rsvpStatus: 'attending',
      dietaryRestrictions: '   ',
      notes: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dietaryRestrictions).toBeUndefined();
      expect(result.data.notes).toBeUndefined();
    }
  });

  it('caps notes at 500 chars', () => {
    const long = 'y'.repeat(600);
    const result = rsvpSubmitSchema.safeParse({
      rsvpStatus: 'attending',
      notes: long,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.notes?.length).toBe(500);
  });
});
