import { describe, expect, it } from 'vitest';
import {
  defaultMessaging,
  mergeMessaging,
  isMsgChannel,
  isMsgTemplate,
} from '../../../lib/pro/messaging-defaults';

describe('defaultMessaging', () => {
  it('utilise le nom de l’agence comme expéditeur par défaut', () => {
    expect(defaultMessaging('Studio Lumière')).toEqual({
      channel: 'whatsapp',
      senderName: 'Studio Lumière',
      defaultTemplate: 'editorial',
      reminderJ7: true,
      reminderJ1: true,
    });
  });
});

describe('mergeMessaging', () => {
  it('retourne les défauts quand rien n’est stocké', () => {
    expect(mergeMessaging('Agence X', null)).toEqual(defaultMessaging('Agence X'));
  });
  it('respecte les valeurs valides stockées', () => {
    const merged = mergeMessaging('Agence X', { channel: 'sms', reminderJ1: false });
    expect(merged.channel).toBe('sms');
    expect(merged.reminderJ1).toBe(false);
    expect(merged.reminderJ7).toBe(true); // défaut conservé
  });
  it('ignore une valeur invalide et retombe sur le défaut', () => {
    const merged = mergeMessaging('Agence X', {
      channel: 'pigeon' as 'whatsapp',
      defaultTemplate: 'xxx' as 'editorial',
    });
    expect(merged.channel).toBe('whatsapp');
    expect(merged.defaultTemplate).toBe('editorial');
  });
});

describe('gardes de type', () => {
  it('isMsgChannel / isMsgTemplate', () => {
    expect(isMsgChannel('sms')).toBe(true);
    expect(isMsgChannel('email')).toBe(false);
    expect(isMsgTemplate('festive')).toBe(true);
    expect(isMsgTemplate('nope')).toBe(false);
  });
});
