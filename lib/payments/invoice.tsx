import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Currency, PlanTier } from './plans';
import { formatAmount } from './plans';

/**
 * Génération d'une facture PDF post-paiement Stripe pour les particuliers
 * (Essentiel / Premium). Téléchargeable depuis le compte ou depuis l'email
 * post-paiement (l'envoi par mail est géré séparément côté Convex).
 *
 * Notes TVA :
 *  - EUR (FR) : TVA 20 % incluse dans le prix annoncé. La facture l'isole en
 *    HT + TVA pour la conformité comptable.
 *  - XOF / MAD / TND : TVA non applicable côté Wedillybird (refacturation
 *    locale par le client si requise). Affichage TTC seulement.
 */

export interface InvoicePayment {
  paymentId: string;
  invoiceNumber: string;
  /** Date d'émission en ms epoch. */
  issuedAt: number;
  /** Date de paiement (paid). */
  paidAt: number;
  plan: PlanTier;
  amountMinor: number;
  currency: Currency;
  /** Provider d'origine — utile pour la mention "réglé via Stripe / CinetPay". */
  provider: 'stripe' | 'cinetpay' | 'mock';
  customer: {
    fullName?: string;
    email?: string;
    phone?: string;
  };
  /** Titre de l'événement à inscrire en référence. */
  eventTitle?: string;
}

const PLAN_LABEL: Record<PlanTier, string> = {
  essential: 'Wedillybird — Essentiel',
  premium: 'Wedillybird — Premium',
};

const PROVIDER_LABEL: Record<'stripe' | 'cinetpay' | 'mock', string> = {
  stripe: 'Stripe',
  cinetpay: 'CinetPay',
  mock: 'Test',
};

/** TVA applicable seulement en EUR (vendeur FR). */
function vatBreakdown(payment: InvoicePayment): {
  ht: number;
  vatRate: number;
  vatAmount: number;
} {
  if (payment.currency === 'EUR') {
    const rate = 0.2;
    const ht = Math.round(payment.amountMinor / (1 + rate));
    return { ht, vatRate: rate, vatAmount: payment.amountMinor - ht };
  }
  return { ht: payment.amountMinor, vatRate: 0, vatAmount: 0 };
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(ms));
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#d4a574',
  },
  brand: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#b85d2e',
  },
  brandTag: {
    fontSize: 9,
    color: '#666',
    marginTop: 2,
  },
  invoiceTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
  },
  invoiceMeta: {
    fontSize: 9,
    color: '#444',
    marginTop: 4,
    textAlign: 'right',
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
  },
  column: {
    flex: 1,
  },
  blockTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  blockBody: {
    fontSize: 10,
    lineHeight: 1.4,
  },
  table: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#faf5ef',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  th: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  td: {
    fontSize: 10,
  },
  colDescription: {
    flex: 3,
  },
  colAmount: {
    flex: 1,
    textAlign: 'right',
  },
  totals: {
    marginTop: 18,
    alignSelf: 'flex-end',
    width: '50%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalRowGrand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  totalLabel: {
    fontSize: 10,
    color: '#444',
  },
  totalLabelGrand: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  totalValue: {
    fontSize: 10,
  },
  totalValueGrand: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#888',
    lineHeight: 1.5,
    textAlign: 'center',
  },
});

export interface InvoicePDFProps {
  payment: InvoicePayment;
}

export function InvoicePDF({ payment }: InvoicePDFProps) {
  const { ht, vatRate, vatAmount } = vatBreakdown(payment);
  const planLabel = PLAN_LABEL[payment.plan];
  const customerLines = [
    payment.customer.fullName,
    payment.customer.email,
    payment.customer.phone,
  ].filter((line): line is string => Boolean(line));

  return (
    <Document
      title={`Facture Wedillybird ${payment.invoiceNumber}`}
      author="Wedillybird"
      subject={`Facture ${payment.invoiceNumber}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Wedillybird</Text>
            <Text style={styles.brandTag}>Votre mariage, organisé sans stress</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>Facture</Text>
            <Text style={styles.invoiceMeta}>N° {payment.invoiceNumber}</Text>
            <Text style={styles.invoiceMeta}>Émise le {formatDate(payment.issuedAt)}</Text>
            <Text style={styles.invoiceMeta}>Réglée le {formatDate(payment.paidAt)}</Text>
          </View>
        </View>

        <View style={styles.twoColumns}>
          <View style={styles.column}>
            <Text style={styles.blockTitle}>Émetteur</Text>
            <Text style={styles.blockBody}>
              Wedillybird (Tuum Agency){'\n'}
              contact@wedillybird.com{'\n'}
              SIRET — à compléter{'\n'}
              TVA intracom. — à compléter
            </Text>
          </View>
          <View style={styles.column}>
            <Text style={styles.blockTitle}>Client</Text>
            <Text style={styles.blockBody}>
              {customerLines.length > 0 ? customerLines.join('\n') : 'Client particulier'}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colDescription]}>Désignation</Text>
            <Text style={[styles.th, styles.colAmount]}>Montant TTC</Text>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.colDescription}>
              <Text style={styles.td}>{planLabel}</Text>
              {payment.eventTitle ? (
                <Text style={[styles.td, { color: '#888', marginTop: 2 }]}>
                  Événement : {payment.eventTitle}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.td, styles.colAmount]}>
              {formatAmount(payment.amountMinor, payment.currency)}
            </Text>
          </View>
        </View>

        <View style={styles.totals}>
          {vatRate > 0 ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total HT</Text>
                <Text style={styles.totalValue}>{formatAmount(ht, payment.currency)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TVA ({(vatRate * 100).toFixed(0)} %)</Text>
                <Text style={styles.totalValue}>{formatAmount(vatAmount, payment.currency)}</Text>
              </View>
            </>
          ) : (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TVA non applicable, art. 293 B du CGI</Text>
              <Text style={styles.totalValue}>—</Text>
            </View>
          )}
          <View style={styles.totalRowGrand}>
            <Text style={styles.totalLabelGrand}>Total TTC</Text>
            <Text style={styles.totalValueGrand}>
              {formatAmount(payment.amountMinor, payment.currency)}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Paiement réglé via {PROVIDER_LABEL[payment.provider]} le {formatDate(payment.paidAt)}.
          Cette facture est conservée 10 ans conformément au Code de commerce.{'\n'}
          Pour toute question relative à cette facture, écrivez-nous à billing@wedillybird.com en
          précisant le numéro de facture {payment.invoiceNumber}.
        </Text>
      </Page>
    </Document>
  );
}

/**
 * Génère un numéro de facture lisible : `WB-YYYY-XXXXX` où XXXXX dérive de
 * l'identifiant Convex du paiement (8 derniers chars upcase). Stable et
 * idempotent : la même row payments produira toujours le même numéro.
 */
export function buildInvoiceNumber(paymentId: string, issuedAt: number): string {
  const year = new Date(issuedAt).getFullYear();
  const suffix = paymentId.slice(-8).toUpperCase();
  return `WB-${year}-${suffix}`;
}
