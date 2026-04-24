import { describe, it, expect } from 'vitest';
import { routing } from '@/i18n/routing';
import fr from '@/messages/fr.json';

describe('i18n routing', () => {
  it('expose la locale par défaut fr', () => {
    expect(routing.defaultLocale).toBe('fr');
    expect(routing.locales).toContain('fr');
  });

  it('utilise as-needed pour le préfixe de locale', () => {
    expect(routing.localePrefix).toBe('as-needed');
  });
});

describe('messages FR', () => {
  it('contient toutes les clés communes attendues', () => {
    const requiredCommon = [
      'appName',
      'tagline',
      'signIn',
      'signUp',
      'signOut',
      'continue',
      'cancel',
      'save',
      'loading',
      'error',
    ];
    for (const key of requiredCommon) {
      expect(fr.Common, `clé Common.${key}`).toHaveProperty(key);
    }
  });

  it('contient le bloc Landing complet', () => {
    expect(fr.Landing).toHaveProperty('hero.title');
    expect(fr.Landing).toHaveProperty('hero.ctaPrimary');
    expect(fr.Landing.features).toHaveProperty('invites');
    expect(fr.Landing.features).toHaveProperty('rsvp');
    expect(fr.Landing.features).toHaveProperty('checkin');
    expect(fr.Landing.features).toHaveProperty('gallery');
    expect(fr.Landing.pricing).toHaveProperty('free');
    expect(fr.Landing.pricing).toHaveProperty('essential');
    expect(fr.Landing.pricing).toHaveProperty('premium');
  });

  it("contient le bloc Auth pour l'OTP WhatsApp", () => {
    expect(fr.Auth).toHaveProperty('phoneLabel');
    expect(fr.Auth).toHaveProperty('codeLabel');
    expect(fr.Auth).toHaveProperty('sendCode');
    expect(fr.Auth).toHaveProperty('verifyCode');
    expect(fr.Auth.errors).toHaveProperty('invalidPhone');
    expect(fr.Auth.errors).toHaveProperty('invalidCode');
  });

  it('les valeurs ne sont jamais vides', () => {
    const walk = (obj: unknown, path = ''): void => {
      if (typeof obj === 'string') {
        expect(obj.length, `message vide à ${path}`).toBeGreaterThan(0);
        return;
      }
      if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          walk(v, path ? `${path}.${k}` : k);
        }
      }
    };
    walk(fr);
  });
});
