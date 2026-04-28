import { describe, expect, it } from 'vitest';
import { renderContactMessage, renderNewsletterSignup } from '@/lib/email/templates';

describe('renderContactMessage', () => {
  it('builds a subject prefixed with [Contact]', () => {
    const out = renderContactMessage({
      fromName: 'Aminata Diallo',
      fromEmail: 'aminata@example.com',
      subject: 'Mariage en juin',
      message: 'Bonjour, j’aimerais en savoir plus.',
    });
    expect(out.subject).toBe('[Contact] Mariage en juin');
  });

  it('includes sender info in HTML and text', () => {
    const out = renderContactMessage({
      fromName: 'Aminata',
      fromEmail: 'aminata@example.com',
      subject: 'Sujet test',
      message: 'Un message clair et net.',
    });
    expect(out.html).toContain('Aminata');
    expect(out.html).toContain('aminata@example.com');
    expect(out.text).toContain('Aminata <aminata@example.com>');
    expect(out.text).toContain('Un message clair et net.');
  });

  it('escapes HTML in user-provided values', () => {
    const out = renderContactMessage({
      fromName: '<script>x</script>',
      fromEmail: 'bad@example.com',
      subject: 'Sujet <img src=x>',
      message: 'Body <b>bold</b>',
    });
    expect(out.html).not.toContain('<script>x</script>');
    expect(out.html).not.toContain('<img src=x>');
    expect(out.html).toContain('&lt;script&gt;');
  });

  it('preserves paragraph breaks in HTML body', () => {
    const out = renderContactMessage({
      fromName: 'A',
      fromEmail: 'a@b.com',
      subject: 'X',
      message: 'Premier paragraphe.\n\nDeuxième paragraphe.',
    });
    const paragraphCount = (out.html.match(/<p style="margin:0 0 16px 0;">/g) ?? []).length;
    expect(paragraphCount).toBeGreaterThanOrEqual(2);
  });

  it('mentions request IP in footer when provided', () => {
    const out = renderContactMessage({
      fromName: 'A',
      fromEmail: 'a@b.com',
      subject: 'X',
      message: 'Un message normal.',
      requestIp: '203.0.113.42',
    });
    expect(out.html).toContain('203.0.113.42');
    expect(out.text).toContain('203.0.113.42');
  });
});

describe('renderNewsletterSignup', () => {
  it('builds a subject mentioning the email', () => {
    const out = renderNewsletterSignup({ email: 'me@example.com' });
    expect(out.subject).toBe('[Newsletter] Nouvelle inscription — me@example.com');
  });

  it('includes the email in HTML and text', () => {
    const out = renderNewsletterSignup({ email: 'me@example.com', source: 'footer' });
    expect(out.html).toContain('me@example.com');
    expect(out.html).toContain('footer');
    expect(out.text).toContain('me@example.com');
    expect(out.text).toContain('Source : footer');
  });

  it('omits source line in text when not provided', () => {
    const out = renderNewsletterSignup({ email: 'me@example.com' });
    expect(out.text).not.toContain('Source :');
  });

  it('escapes HTML in source field', () => {
    const out = renderNewsletterSignup({
      email: 'me@example.com',
      source: '<script>x</script>',
    });
    expect(out.html).not.toContain('<script>x</script>');
    expect(out.html).toContain('&lt;script&gt;');
  });
});
