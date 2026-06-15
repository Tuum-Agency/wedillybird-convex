import { describe, expect, it, beforeAll } from 'vitest';
import { renderNewsletterCampaign } from '../../../lib/email/templates/newsletter-campaign';
import { signUnsubscribe, verifyUnsubscribe } from '../../../lib/email/unsubscribe-token';

const UNSUB = 'https://wedillybird.com/api/newsletter/unsubscribe?email=a%40b.com&token=x';

describe('renderNewsletterCampaign', () => {
  it('rend le sujet + html + texte', () => {
    const r = renderNewsletterCampaign({
      subject: 'Nouveautés de juin',
      bodyText: 'Bonjour,\n\nVoici les news.',
      unsubscribeUrl: UNSUB,
    });
    expect(r.subject).toBe('Nouveautés de juin');
    expect(r.html).toContain('Voici les news.');
    expect(r.text).toContain('Voici les news.');
  });

  it('découpe les paragraphes sur les lignes vides', () => {
    const r = renderNewsletterCampaign({
      subject: 's',
      bodyText: 'Para 1.\n\nPara 2.',
      unsubscribeUrl: UNSUB,
    });
    const paragraphs = r.html.match(/<p style/g) ?? [];
    // 2 paragraphes de corps + 1 paragraphe footer (désinscription)
    expect(paragraphs.length).toBe(3);
  });

  it('échappe le HTML (anti-XSS)', () => {
    const r = renderNewsletterCampaign({
      subject: 's',
      bodyText: '<script>alert(1)</script>',
      unsubscribeUrl: UNSUB,
    });
    expect(r.html).not.toContain('<script>alert(1)</script>');
    expect(r.html).toContain('&lt;script&gt;');
  });

  it('rend les liens http(s) cliquables', () => {
    const r = renderNewsletterCampaign({
      subject: 's',
      bodyText: 'Voir https://wedillybird.com ici',
      unsubscribeUrl: UNSUB,
    });
    expect(r.html).toContain('<a href="https://wedillybird.com"');
  });

  it('inclut le lien de désinscription dans le footer html + texte', () => {
    const r = renderNewsletterCampaign({ subject: 's', bodyText: 'x', unsubscribeUrl: UNSUB });
    expect(r.html).toContain(UNSUB.replace(/&/g, '&amp;'));
    expect(r.text).toContain(UNSUB);
  });
});

describe('unsubscribe token (HMAC)', () => {
  beforeAll(() => {
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'test-secret-at-least-32-chars-long-xxxxxxxx';
  });

  it('round-trip : un token signé se vérifie', () => {
    const token = signUnsubscribe('Alice@Example.com');
    expect(verifyUnsubscribe('alice@example.com', token)).toBe(true);
  });

  it('normalise la casse/espaces de l’email', () => {
    const token = signUnsubscribe('  alice@example.com  ');
    expect(verifyUnsubscribe('ALICE@EXAMPLE.COM', token)).toBe(true);
  });

  it('rejette un token bidon', () => {
    expect(verifyUnsubscribe('alice@example.com', 'deadbeef')).toBe(false);
    expect(verifyUnsubscribe('alice@example.com', '')).toBe(false);
  });

  it('rejette le token d’une autre adresse', () => {
    const token = signUnsubscribe('alice@example.com');
    expect(verifyUnsubscribe('bob@example.com', token)).toBe(false);
  });
});
