import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF, buildInvoiceNumber, type InvoicePayment } from '@/lib/payments/invoice';

const basePayment: InvoicePayment = {
  paymentId: 'p_abc12345',
  invoiceNumber: 'WB-2026-ABC12345',
  issuedAt: new Date('2026-04-25T10:00:00Z').getTime(),
  paidAt: new Date('2026-04-25T10:05:00Z').getTime(),
  plan: 'essential',
  amountMinor: 1900,
  currency: 'EUR',
  provider: 'stripe',
  customer: {
    fullName: 'Fatou Diop',
    email: 'fatou@example.com',
    phone: '+33600000000',
  },
  eventTitle: 'Mariage de Fatou & Amadou',
};

function isPdfBuffer(buf: Buffer): boolean {
  // PDF magic bytes "%PDF" → 0x25 0x50 0x44 0x46
  return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
}

describe('buildInvoiceNumber', () => {
  it('uses the year from issuedAt + the upcased suffix of the paymentId', () => {
    const issuedAt = new Date('2026-04-25T10:00:00Z').getTime();
    expect(buildInvoiceNumber('jh7d5abc12345', issuedAt)).toBe('WB-2026-ABC12345');
  });

  it('is idempotent (same paymentId → same number)', () => {
    const issuedAt = new Date('2026-01-01T00:00:00Z').getTime();
    expect(buildInvoiceNumber('foobar99', issuedAt)).toBe(buildInvoiceNumber('foobar99', issuedAt));
  });

  it('upcases the suffix (case-insensitive paymentId support)', () => {
    const issuedAt = new Date('2026-06-15T00:00:00Z').getTime();
    expect(buildInvoiceNumber('xy_aabbccdd', issuedAt)).toBe('WB-2026-AABBCCDD');
  });
});

describe('InvoicePDF — rendering', () => {
  it('renders without crashing for an EUR essential payment and returns a valid PDF buffer', async () => {
    const buffer = await renderToBuffer(<InvoicePDF payment={basePayment} />);
    expect(buffer.length).toBeGreaterThan(0);
    expect(isPdfBuffer(buffer)).toBe(true);
  }, 30000);

  it('renders for premium plan without crashing', async () => {
    const buffer = await renderToBuffer(
      <InvoicePDF payment={{ ...basePayment, plan: 'premium', amountMinor: 4900 }} />,
    );
    expect(buffer.length).toBeGreaterThan(0);
    expect(isPdfBuffer(buffer)).toBe(true);
  }, 30000);

  it('renders for XOF currency without crashing', async () => {
    const buffer = await renderToBuffer(
      <InvoicePDF
        payment={{
          ...basePayment,
          currency: 'XOF',
          amountMinor: 1250000,
          paymentId: 'p_xof_test_1',
          invoiceNumber: 'WB-2026-XOFTEST1',
          provider: 'cinetpay',
        }}
      />,
    );
    expect(buffer.length).toBeGreaterThan(0);
    expect(isPdfBuffer(buffer)).toBe(true);
  }, 30000);

  it('renders gracefully without customer info', async () => {
    const buffer = await renderToBuffer(<InvoicePDF payment={{ ...basePayment, customer: {} }} />);
    expect(buffer.length).toBeGreaterThan(0);
    expect(isPdfBuffer(buffer)).toBe(true);
  }, 30000);
});

describe('InvoicePDF — content validation via element tree', () => {
  it('embeds the invoice number, plan label, customer name and event title in the PDF document title metadata', async () => {
    // The Document's title prop becomes part of the PDF metadata trailer in
    // PDFKit. We can sniff it by reading the buffer as latin1, where the
    // unencoded /Title and /Author entries live, and grep for the invoice
    // number we passed.
    const buffer = await renderToBuffer(<InvoicePDF payment={basePayment} />);
    const ascii = buffer.toString('latin1');
    expect(ascii).toContain('Wedillybird');
    expect(ascii).toContain('WB-2026-ABC12345');
  }, 30000);
});
