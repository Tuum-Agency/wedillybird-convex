import { describe, expect, it } from 'vitest';
import { renderPaygCreditActivated } from '@/lib/email/templates/payg-credit-activated';

/**
 * Tests pour le template email "Crédit Pay-as-you-go activé". Ce template est
 * envoyé après un achat PAYG confirmé via Stripe (cf.
 * `convex/paygPurchases.ts:markPurchase`). On vérifie :
 *  - subject + bonne accroche
 *  - solde de crédits affiché (singulier vs pluriel)
 *  - lien facture optionnel rendu/omis selon présence
 *  - HTML escapé pour les inputs user-controlled (defense-in-depth)
 *  - cohérence text vs html (mêmes infos)
 */

describe('renderPaygCreditActivated', () => {
  it('renders subject line', () => {
    const out = renderPaygCreditActivated({
      recipientName: 'Awa',
      remainingCredits: 1,
    });
    expect(out.subject).toBe('Votre crédit Pay-as-you-go est activé');
  });

  it('uses singular wording when remainingCredits is 1', () => {
    const out = renderPaygCreditActivated({
      recipientName: 'Awa',
      remainingCredits: 1,
    });
    expect(out.html).toContain('1 crédit disponible');
    expect(out.text).toContain('1 crédit disponible');
    // pas de pluriel parasite
    expect(out.html).not.toContain('crédits disponibles');
  });

  it('uses plural wording when remainingCredits > 1', () => {
    const out = renderPaygCreditActivated({
      recipientName: 'Awa',
      remainingCredits: 3,
    });
    expect(out.html).toContain('3 crédits disponibles');
    expect(out.text).toContain('3 crédits disponibles');
  });

  it('includes recipient name in greeting', () => {
    const out = renderPaygCreditActivated({
      recipientName: 'Mamadou',
      remainingCredits: 2,
    });
    expect(out.html).toContain('Mamadou');
    expect(out.text).toContain('Bonjour Mamadou');
  });

  it('includes invoiceUrl when provided', () => {
    const url = 'https://invoice.stripe.com/abc123';
    const out = renderPaygCreditActivated({
      recipientName: 'Awa',
      remainingCredits: 1,
      invoiceUrl: url,
    });
    expect(out.html).toContain(url);
    expect(out.text).toContain(url);
  });

  it('omits invoiceUrl block when not provided', () => {
    const out = renderPaygCreditActivated({
      recipientName: 'Awa',
      remainingCredits: 1,
    });
    expect(out.html).not.toContain('Voir ma facture Stripe');
    expect(out.text).not.toContain('Facture Stripe');
  });

  it('escapes HTML in recipient name', () => {
    const out = renderPaygCreditActivated({
      recipientName: '<script>alert(1)</script>',
      remainingCredits: 1,
    });
    expect(out.html).not.toContain('<script>alert');
    expect(out.html).toContain('&lt;script&gt;');
  });

  it('returns text + html + subject (EmailRendered shape)', () => {
    const out = renderPaygCreditActivated({
      recipientName: 'Awa',
      remainingCredits: 5,
    });
    expect(out).toHaveProperty('subject');
    expect(out).toHaveProperty('html');
    expect(out).toHaveProperty('text');
    expect(typeof out.subject).toBe('string');
    expect(typeof out.html).toBe('string');
    expect(typeof out.text).toBe('string');
  });
});
