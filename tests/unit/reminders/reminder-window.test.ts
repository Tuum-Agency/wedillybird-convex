import { describe, expect, it } from 'vitest';
import {
  REMINDER_DEDUP_WINDOW_MS,
  isWithinDedupWindow,
  reminderWindow,
  shouldSendEmail,
  shouldSendWhatsapp,
} from '@/lib/reminders/window';

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

describe('reminderWindow', () => {
  it('centers a ±12h window around now + daysFromNow', () => {
    const now = Date.parse('2026-05-01T09:00:00Z');
    const window = reminderWindow(now, 7);
    expect(window.start).toBe(now + 7 * MS_PER_DAY - 12 * MS_PER_HOUR);
    expect(window.end).toBe(now + 7 * MS_PER_DAY + 12 * MS_PER_HOUR);
  });

  it('window width is exactly 24h', () => {
    const window = reminderWindow(0, 1);
    expect(window.end - window.start).toBe(MS_PER_DAY);
  });

  it('catches an event scheduled exactly J-7 from cron run', () => {
    const now = Date.parse('2026-05-01T09:00:00Z');
    const eventTimestamp = now + 7 * MS_PER_DAY;
    const window = reminderWindow(now, 7);
    expect(eventTimestamp).toBeGreaterThanOrEqual(window.start);
    expect(eventTimestamp).toBeLessThanOrEqual(window.end);
  });

  it('catches an event 11h before the perfect J-7 mark (cron drift tolerance)', () => {
    const now = Date.parse('2026-05-01T09:00:00Z');
    const eventTimestamp = now + 7 * MS_PER_DAY - 11 * MS_PER_HOUR;
    const window = reminderWindow(now, 7);
    expect(eventTimestamp).toBeGreaterThan(window.start);
    expect(eventTimestamp).toBeLessThan(window.end);
  });

  it('does NOT catch events more than 12h outside the window', () => {
    const now = Date.parse('2026-05-01T09:00:00Z');
    const tooEarly = now + 7 * MS_PER_DAY - 13 * MS_PER_HOUR;
    const tooLate = now + 7 * MS_PER_DAY + 13 * MS_PER_HOUR;
    const window = reminderWindow(now, 7);
    expect(tooEarly).toBeLessThan(window.start);
    expect(tooLate).toBeGreaterThan(window.end);
  });

  it('J-1 and J-7 windows do not overlap', () => {
    const now = Date.parse('2026-05-01T09:00:00Z');
    const w1 = reminderWindow(now, 1);
    const w7 = reminderWindow(now, 7);
    expect(w1.end).toBeLessThan(w7.start);
  });
});

describe('reminder channel routing (shouldSendEmail / shouldSendWhatsapp)', () => {
  it('par défaut (config absente) envoie email seulement (back-compat)', () => {
    expect(shouldSendEmail(undefined)).toBe(true);
    expect(shouldSendWhatsapp(undefined)).toBe(false);
  });

  it('canal "email" → email seul', () => {
    expect(shouldSendEmail('email')).toBe(true);
    expect(shouldSendWhatsapp('email')).toBe(false);
  });

  it('canal "whatsapp" → WhatsApp seul', () => {
    expect(shouldSendEmail('whatsapp')).toBe(false);
    expect(shouldSendWhatsapp('whatsapp')).toBe(true);
  });

  it('canal "both" → email + WhatsApp', () => {
    expect(shouldSendEmail('both')).toBe(true);
    expect(shouldSendWhatsapp('both')).toBe(true);
  });
});

describe('isWithinDedupWindow (anti-doublon court-terme)', () => {
  it('skip si lastReminderSentAt < 12h', () => {
    const now = Date.parse('2026-05-01T09:00:00Z');
    const elevenHoursAgo = now - 11 * 3_600_000;
    expect(isWithinDedupWindow(elevenHoursAgo, now)).toBe(true);
  });

  it('ne skip pas si lastReminderSentAt >= 12h', () => {
    const now = Date.parse('2026-05-01T09:00:00Z');
    const twelveHoursAgo = now - 12 * 3_600_000;
    expect(isWithinDedupWindow(twelveHoursAgo, now)).toBe(false);
    const thirteenHoursAgo = now - 13 * 3_600_000;
    expect(isWithinDedupWindow(thirteenHoursAgo, now)).toBe(false);
  });

  it('ne skip jamais si lastReminderSentAt est undefined (premier rappel)', () => {
    const now = Date.parse('2026-05-01T09:00:00Z');
    expect(isWithinDedupWindow(undefined, now)).toBe(false);
  });

  it('utilise une fenêtre custom si fournie', () => {
    const now = Date.parse('2026-05-01T09:00:00Z');
    const oneHourAgo = now - 3_600_000;
    expect(isWithinDedupWindow(oneHourAgo, now, 30 * 60 * 1000)).toBe(false);
    expect(isWithinDedupWindow(oneHourAgo, now, 2 * 3_600_000)).toBe(true);
  });

  it('expose une constante REMINDER_DEDUP_WINDOW_MS de 12 h', () => {
    expect(REMINDER_DEDUP_WINDOW_MS).toBe(12 * 60 * 60 * 1000);
  });
});
