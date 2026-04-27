import { afterEach, describe, expect, it } from 'vitest';
import { sendEmail } from '@/lib/email';
import { clearMockSentEmails, getMockSentEmails } from '@/lib/email/drivers/mock';
import {
  renderGuestReminder,
  renderProNotification,
  renderStripeInvoice,
} from '@/lib/email/templates';
import { escapeHtml } from '@/lib/email/templates/_layout';

describe('email driver (mock auto in test env)', () => {
  afterEach(() => clearMockSentEmails());

  it('captures sent emails', async () => {
    const rendered = renderGuestReminder({
      guestName: 'Awa',
      eventTitle: 'Mariage Salif & Awa',
      eventDate: '12 juillet 2026',
      invitationUrl: 'https://wedillybird.com/i/abc123',
      daysUntilEvent: 7,
    });
    const result = await sendEmail({ to: 'awa@example.com', rendered });
    expect(result.ok).toBe(true);
    const captured = getMockSentEmails();
    expect(captured).toHaveLength(1);
    const first = captured[0]!;
    expect(first.rendered.subject).toContain('J-7');
    expect(first.rendered.html).toContain('Awa');
  });
});

describe('templates rendering', () => {
  it('renders guest reminder with day-1 wording', () => {
    const out = renderGuestReminder({
      guestName: 'Salif',
      eventTitle: 'Réception',
      eventDate: 'demain',
      invitationUrl: 'https://wedillybird.com/i/x',
      daysUntilEvent: 1,
    });
    expect(out.subject).toBe("C'est demain : Réception");
    expect(out.text).toContain('Plus que 1 jour avant');
  });

  it('renders pro notification with cta', () => {
    const out = renderProNotification({
      recipientName: 'Awa',
      organizationName: 'Studio Lumière',
      kind: 'team-member-added',
      detail: 'Mamadou a rejoint votre équipe.',
      ctaLabel: "Voir l'équipe",
      ctaUrl: 'https://wedillybird.com/pro/team',
    });
    expect(out.subject).toContain('Studio Lumière');
    expect(out.html).toContain('Voir l');
  });

  it('renders stripe invoice', () => {
    const out = renderStripeInvoice({
      recipientName: 'Awa',
      organizationName: 'Studio Lumière',
      invoiceNumber: 'INV-001',
      amountFormatted: '79,00 €',
      periodLabel: 'Mai 2026',
      invoiceUrl: 'https://invoice.stripe.com/x',
    });
    expect(out.subject).toBe('Facture INV-001 — 79,00 €');
    expect(out.html).toContain('79,00 €');
    expect(out.html).toContain('Mai 2026');
    expect(out.html).toContain('https://invoice.stripe.com/x');
    expect(out.text).toContain('Facture INV-001 pour Studio Lumière.');
  });

  it('renders stripe invoice with optional pdf url', () => {
    const out = renderStripeInvoice({
      recipientName: 'Awa',
      organizationName: 'Studio Lumière',
      invoiceNumber: 'INV-002',
      amountFormatted: '179,00 €',
      periodLabel: 'Juin 2026',
      invoiceUrl: 'https://invoice.stripe.com/y',
      pdfUrl: 'https://invoice.stripe.com/y.pdf',
    });
    expect(out.html).toContain('https://invoice.stripe.com/y.pdf');
    expect(out.text).toContain('https://invoice.stripe.com/y.pdf');
  });

  it('renders subscription-renewed pro notification with correct subject', () => {
    const out = renderProNotification({
      recipientName: 'Awa',
      organizationName: 'Studio Lumière',
      kind: 'subscription-renewed',
      detail: 'Votre abonnement a été renouvelé.',
    });
    expect(out.subject).toBe('Abonnement renouvelé — Studio Lumière');
    expect(out.html).toContain('Votre abonnement a été renouvelé.');
  });

  it('renders subscription-failed pro notification with correct subject', () => {
    const out = renderProNotification({
      recipientName: 'Awa',
      organizationName: 'Studio Lumière',
      kind: 'subscription-failed',
      detail: 'Le paiement a échoué.',
      ctaLabel: 'Mettre à jour',
      ctaUrl: 'https://wedillybird.com/pro/billing',
    });
    expect(out.subject).toBe('Échec de paiement — Studio Lumière');
    expect(out.html).toContain('https://wedillybird.com/pro/billing');
  });

  it('escapes HTML in user-provided values', () => {
    const out = renderGuestReminder({
      guestName: '<script>alert(1)</script>',
      eventTitle: 'Test',
      eventDate: '2026-05-01',
      invitationUrl: 'https://wedillybird.com/i/x',
      daysUntilEvent: 3,
    });
    expect(out.html).not.toContain('<script>alert');
    expect(out.html).toContain('&lt;script&gt;');
  });
});

describe('escapeHtml', () => {
  it('escapes special chars', () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
    );
  });
});
