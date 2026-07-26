import { describe, expect, it } from 'vitest';
import {
  createEventSchema,
  normalizeCreateEvent,
  weddingStateSchema,
} from '@/lib/validators/events';

const HOUR = 60 * 60 * 1000;

function futureIso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString().slice(0, 16);
}

describe('createEventSchema', () => {
  it('accepts a minimal valid event', () => {
    const result = createEventSchema.safeParse({
      title: 'Mariage F & A',
      partnerA: 'Fatou',
      partnerB: 'Amadou',
      eventDate: futureIso(48 * HOUR),
      timezone: 'Europe/Paris',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.partnerA).toBe('Fatou');
      expect(result.data.partnerB).toBe('Amadou');
      expect(typeof result.data.eventDate).toBe('number');
      expect(result.data.eventDate).toBeGreaterThan(Date.now());
    }
  });

  it('rejects a date in the past', () => {
    const result = createEventSchema.safeParse({
      title: 'Past wedding',
      partnerA: 'A',
      partnerB: 'B',
      eventDate: new Date(Date.now() - 24 * HOUR).toISOString().slice(0, 16),
      timezone: 'Europe/Paris',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown timezone', () => {
    const result = createEventSchema.safeParse({
      title: 'Wedding',
      partnerA: 'A',
      partnerB: 'B',
      eventDate: futureIso(48 * HOUR),
      timezone: 'Pluto/Nope',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty partner names', () => {
    const result = createEventSchema.safeParse({
      title: 'Wedding',
      partnerA: '',
      partnerB: 'Amadou',
      eventDate: futureIso(48 * HOUR),
      timezone: 'Europe/Paris',
    });
    expect(result.success).toBe(false);
  });

  it('validates hex colors when provided', () => {
    const ok = createEventSchema.safeParse({
      title: 'Wedding',
      partnerA: 'A',
      partnerB: 'B',
      eventDate: futureIso(48 * HOUR),
      timezone: 'Europe/Paris',
      themePrimary: '#112233',
      themeAccent: '#FF9900',
      themeFont: 'Inter',
    });
    expect(ok.success).toBe(true);

    const ko = createEventSchema.safeParse({
      title: 'Wedding',
      partnerA: 'A',
      partnerB: 'B',
      eventDate: futureIso(48 * HOUR),
      timezone: 'Europe/Paris',
      themePrimary: 'not-a-color',
      themeAccent: '#000',
      themeFont: 'Inter',
    });
    expect(ko.success).toBe(false);
  });
});

describe('normalizeCreateEvent', () => {
  it('omits venue when partial fields', () => {
    const out = normalizeCreateEvent({
      title: 'Wedding',
      partnerA: 'A',
      partnerB: 'B',
      eventDate: Date.now() + 48 * HOUR,
      timezone: 'Europe/Paris',
      venueName: 'Only name',
    });
    expect(out.venue).toBeUndefined();
  });

  it('keeps venue when both name and address present', () => {
    const out = normalizeCreateEvent({
      title: 'Wedding',
      partnerA: 'A',
      partnerB: 'B',
      eventDate: Date.now() + 48 * HOUR,
      timezone: 'Europe/Paris',
      venueName: 'Domaine des Lilas',
      venueAddress: '12 avenue',
    });
    expect(out.venue).toEqual({ name: 'Domaine des Lilas', address: '12 avenue' });
  });

  it('builds theme when all three fields provided', () => {
    const out = normalizeCreateEvent({
      title: 'Wedding',
      partnerA: 'A',
      partnerB: 'B',
      eventDate: Date.now() + 48 * HOUR,
      timezone: 'Europe/Paris',
      themePrimary: '#C4996C',
      themeAccent: '#2B2B2B',
      themeFont: 'Playfair Display',
    });
    expect(out.theme).toEqual({
      primaryColor: '#C4996C',
      accentColor: '#2B2B2B',
      fontFamily: 'Playfair Display',
    });
  });

  it('passes weddingState through when provided', () => {
    const out = normalizeCreateEvent({
      title: 'Wedding',
      partnerA: 'A',
      partnerB: 'B',
      eventDate: Date.now() + 48 * HOUR,
      timezone: 'Europe/Paris',
      weddingState: 'IL',
    });
    expect(out.weddingState).toBe('IL');
  });
});

describe('weddingStateSchema', () => {
  it('accepts a US state code and uppercases it', () => {
    const result = weddingStateSchema.safeParse('il');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('IL');
  });

  it('accepts a Canadian province code (CA- prefix)', () => {
    const result = weddingStateSchema.safeParse('ca-qc');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('CA-QC');
  });

  it('is optional (undefined passes)', () => {
    expect(weddingStateSchema.safeParse(undefined).success).toBe(true);
  });

  it('rejects a malformed code', () => {
    expect(weddingStateSchema.safeParse('Illinois').success).toBe(false);
    expect(weddingStateSchema.safeParse('U').success).toBe(false);
    expect(weddingStateSchema.safeParse('USA-IL').success).toBe(false);
  });
});
