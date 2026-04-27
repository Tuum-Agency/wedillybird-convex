import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INVITATION_STYLE,
  DEFAULT_PERSONAL_MESSAGE_FALLBACK,
  INVITATION_STYLES,
  getMetaTemplateName,
  renderInvitationPreview,
} from '@/lib/whatsapp/templates';

describe('INVITATION_STYLES', () => {
  it('définit 5 styles avec les bons IDs', () => {
    expect(Object.keys(INVITATION_STYLES).sort()).toEqual([
      'african',
      'classic',
      'festive',
      'minimal',
      'warm',
    ]);
  });

  it('chaque style a les 4 placeholders {{1}}…{{4}} séquentiels (Meta exige indices contigus)', () => {
    for (const style of Object.values(INVITATION_STYLES)) {
      expect(style.bodyText).toContain('{{1}}');
      expect(style.bodyText).toContain('{{2}}');
      expect(style.bodyText).toContain('{{3}}');
      expect(style.bodyText).toContain('{{4}}');
      expect(style.bodyText).not.toContain('{{5}}');
    }
  });

  it('chaque style a un metaTemplateName unique', () => {
    const names = Object.values(INVITATION_STYLES).map((s) => s.metaTemplateName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('default style est warm (le plus chaleureux pour des particuliers)', () => {
    expect(DEFAULT_INVITATION_STYLE).toBe('warm');
    expect(INVITATION_STYLES[DEFAULT_INVITATION_STYLE]).toBeDefined();
  });
});

describe('renderInvitationPreview', () => {
  const baseParams = {
    guestFirstName: 'Aminata',
    coupleNames: 'Mamadou & Marie',
    eventDate: '30 avril 2026',
    invitationUrl: 'https://wedillybird.com/i/abc123',
    personalMessage: 'On compte sur toi !',
  };

  it('substitue les variables dans le body warm', () => {
    const out = renderInvitationPreview('warm', baseParams);
    expect(out).toContain('Aminata');
    expect(out).toContain('Mamadou & Marie');
    expect(out).toContain('30 avril 2026');
    expect(out).toContain('On compte sur toi !');
    expect(out).not.toContain('{{1}}');
    expect(out).not.toContain('{{4}}');
  });

  it('substitue les variables dans le body classic', () => {
    const out = renderInvitationPreview('classic', baseParams);
    expect(out).toContain('Aminata');
    expect(out).toContain('Mamadou & Marie');
    expect(out.startsWith('Bonjour')).toBe(true);
  });

  it('utilise le fallback poli quand personalMessage est vide', () => {
    const out = renderInvitationPreview('warm', { ...baseParams, personalMessage: '' });
    expect(out).toContain(DEFAULT_PERSONAL_MESSAGE_FALLBACK);
  });

  it('utilise le fallback quand personalMessage est uniquement du whitespace', () => {
    const out = renderInvitationPreview('warm', { ...baseParams, personalMessage: '   \n   ' });
    expect(out).toContain(DEFAULT_PERSONAL_MESSAGE_FALLBACK);
  });
});

describe('getMetaTemplateName', () => {
  it('retourne le nom par défaut si pas d’override env', () => {
    expect(getMetaTemplateName('warm', {})).toBe('wedding_invitation_warm');
    expect(getMetaTemplateName('classic', {})).toBe('wedding_invitation_classic');
  });

  it('honore les env vars override', () => {
    expect(
      getMetaTemplateName('warm', {
        WHATSAPP_INVITATION_TEMPLATE_WARM: 'wedding_invitation_warm_v2',
      }),
    ).toBe('wedding_invitation_warm_v2');
  });
});
