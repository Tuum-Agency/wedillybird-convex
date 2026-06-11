import { describe, expect, it } from 'vitest';
import { paymentRequestMessage } from '../../../lib/pro/payments';

/**
 * Message pré-écrit à copier/envoyer au client, dans la langue de l'agence.
 * Cible : salutation (avec/sans nom), libellé + montant formaté, URL, remerciement.
 */
const base = { amountMinor: 150000, description: 'Acompte mariage', url: 'https://pay.test/abc' };

describe('paymentRequestMessage', () => {
  it('FR : nom + libellé + montant formaté + url + remerciement', () => {
    const m = paymentRequestMessage('fr', { ...base, clientName: 'Awa & Karim' });
    expect(m).toContain('Bonjour Awa & Karim,');
    expect(m).toContain('Acompte mariage');
    expect(m).toContain('1500,00 €');
    expect(m).toContain('https://pay.test/abc');
    expect(m).toMatch(/Merci/i);
  });

  it('sans nom de client → salutation générique', () => {
    expect(paymentRequestMessage('fr', base)).toContain('Bonjour,');
    expect(paymentRequestMessage('fr', { ...base, clientName: '  ' })).toContain('Bonjour,');
  });

  it('EN : salutation + corps anglais', () => {
    const m = paymentRequestMessage('en', { ...base, clientName: 'Awa' });
    expect(m).toContain('Hello Awa,');
    expect(m).toContain('secure payment link');
    expect(m).toMatch(/Thank you/i);
  });

  it('locale inconnue → fallback FR', () => {
    expect(paymentRequestMessage('zz', base)).toContain('Bonjour,');
  });

  it('les 7 locales produisent un message non vide incluant l’URL', () => {
    for (const loc of ['fr', 'en', 'es', 'it', 'pt', 'de', 'ar']) {
      const m = paymentRequestMessage(loc, base);
      expect(m).toContain('https://pay.test/abc');
      expect(m.length).toBeGreaterThan(20);
    }
  });
});
