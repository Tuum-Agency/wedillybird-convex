export interface InvoicePdfPayment {
  _id: string;
  plan: 'essential' | 'premium';
  currency: 'EUR' | 'XOF' | 'MAD' | 'TND';
  amountMinor: number;
  provider: 'stripe' | 'cinetpay' | 'mock';
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  createdAt: number;
}

export interface InvoicePdfOrganization {
  name: string;
}

export interface InvoicePdfOwner {
  fullName?: string;
  email?: string;
}

export interface InvoicePdfProps {
  payment: InvoicePdfPayment;
  organization: InvoicePdfOrganization;
  owner: InvoicePdfOwner;
}

export const PLAN_LABELS: Record<InvoicePdfPayment['plan'], string> = {
  essential: 'Plan Essential',
  premium: 'Plan Premium',
};

export function formatInvoiceAmount(
  amountMinor: number,
  currency: InvoicePdfPayment['currency'],
): string {
  const amount = amountMinor / 100;
  switch (currency) {
    case 'EUR':
      return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`;
    case 'XOF':
      return `${amount.toLocaleString('fr-FR')} FCFA`;
    case 'MAD':
      return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`;
    case 'TND':
      return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} TND`;
  }
}

export function formatInvoiceDate(timestamp: number): string {
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(timestamp));
}

export function invoiceNumber(payment: InvoicePdfPayment): string {
  // Stable, human-readable invoice number derived from the payment id + createdAt.
  const date = new Date(payment.createdAt);
  const yyyymm = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  const tail = payment._id.slice(-6).toUpperCase();
  return `WDB-${yyyymm}-${tail}`;
}
