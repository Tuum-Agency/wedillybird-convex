import 'server-only';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import {
  PLAN_LABELS,
  formatInvoiceAmount,
  formatInvoiceDate,
  invoiceNumber,
  type InvoicePdfProps,
} from './invoice-pdf-types';

export {
  invoiceNumber,
  formatInvoiceAmount,
  type InvoicePdfPayment,
  type InvoicePdfOrganization,
  type InvoicePdfOwner,
  type InvoicePdfProps,
} from './invoice-pdf-types';

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  brand: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  brandTag: {
    fontSize: 9,
    color: '#666',
    marginTop: 2,
  },
  invoiceMeta: {
    textAlign: 'right',
    fontSize: 10,
    color: '#444',
  },
  metaTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 9,
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 11,
    color: '#1a1a1a',
  },
  twoCols: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
    marginBottom: 24,
  },
  col: {
    flex: 1,
  },
  table: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e5e7',
    marginTop: 12,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowLast: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  cellDesc: {
    flex: 4,
  },
  cellAmount: {
    flex: 1,
    textAlign: 'right',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  totalsLabel: {
    width: 120,
    textAlign: 'right',
    color: '#666',
    paddingRight: 12,
  },
  totalsValue: {
    width: 100,
    textAlign: 'right',
  },
  totalStrong: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 48,
    right: 48,
    fontSize: 8,
    color: '#888',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
    lineHeight: 1.5,
  },
});

export function InvoicePDF({ payment, organization, owner }: InvoicePdfProps): ReactElement {
  const amountFormatted = formatInvoiceAmount(payment.amountMinor, payment.currency);
  const number = invoiceNumber(payment);
  const issuedAt = formatInvoiceDate(payment.createdAt);
  // Wedillybird est sous franchise en base (art. 293 B du CGI). On affiche une ligne TVA 0 %
  // pour les EUR à titre informatif côté client.
  const showVat = payment.currency === 'EUR';

  return (
    <Document
      title={`Facture ${number}`}
      author="Wedillybird"
      creator="Wedillybird"
      producer="Wedillybird"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Wedillybird</Text>
            <Text style={styles.brandTag}>Mariage SaaS — wedillybird.com</Text>
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.metaTitle}>Facture</Text>
            <Text>{number}</Text>
            <Text>Émise le {issuedAt}</Text>
          </View>
        </View>

        <View style={styles.twoCols}>
          <View style={styles.col}>
            <Text style={styles.label}>Émise par</Text>
            <Text style={styles.value}>Wedillybird</Text>
            <Text style={styles.value}>contact@wedillybird.com</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Facturée à</Text>
            <Text style={styles.value}>{organization.name}</Text>
            {owner.fullName ? <Text style={styles.value}>{owner.fullName}</Text> : null}
            {owner.email ? <Text style={styles.value}>{owner.email}</Text> : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={[styles.cellDesc, { fontWeight: 'bold' }]}>Description</Text>
            <Text style={[styles.cellAmount, { fontWeight: 'bold' }]}>Montant</Text>
          </View>
          <View style={styles.rowLast}>
            <View style={styles.cellDesc}>
              <Text>{PLAN_LABELS[payment.plan]}</Text>
              <Text style={{ fontSize: 9, color: '#888', marginTop: 2 }}>
                Référence paiement : {payment._id}
              </Text>
            </View>
            <Text style={styles.cellAmount}>{amountFormatted}</Text>
          </View>
        </View>

        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Sous-total</Text>
          <Text style={styles.totalsValue}>{amountFormatted}</Text>
        </View>
        {showVat ? (
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>TVA (0 %)</Text>
            <Text style={styles.totalsValue}>0,00 €</Text>
          </View>
        ) : null}
        <View style={styles.totalsRow}>
          <Text style={[styles.totalsLabel, styles.totalStrong]}>Total</Text>
          <Text style={[styles.totalsValue, styles.totalStrong]}>{amountFormatted}</Text>
        </View>

        <View style={[styles.section, { marginTop: 32 }]}>
          <Text style={styles.label}>Statut</Text>
          <Text style={styles.value}>
            {payment.status === 'succeeded' ? 'Payée' : payment.status}
          </Text>
        </View>

        <Text style={styles.footer}>
          Wedillybird — SAS au capital de 1 000 € — RCS Paris — TVA non applicable, art. 293 B du
          CGI sauf mention contraire.{'\n'}
          Pour toute question : contact@wedillybird.com
        </Text>
      </Page>
    </Document>
  );
}
