'use client';
/* Wedillybird — Espace couple · Écran — Budget (perso)
   Postes liés aux prestataires · donut + barres · alerte dépassement douce.
   Échéancier interactif : enregistrer un paiement (total ou PARTIEL) et joindre
   la facture directement sur la dépense. PAS de marge ni de rentabilité agence. */

import { useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from './icons';
import { McBtn, RingChart } from './parts';
import { McModal, McField, McInput, Attachments, AttachChip } from './modal';
import {
  MC_CATS,
  mcBudgetPostes,
  mcEUR,
  mcDateNum,
  mcDaysTo,
  type McAttachment,
  type McPayment,
  type McVendorCat,
} from './data';
import { currencySymbol } from '@/lib/currency';
import { useMmCurrency, useMonMariage } from '@/stores/mon-mariage';

/* Paiement enrichi côté état local (montant payé, date, factures) */
interface McPaymentState extends McPayment {
  paidAmount: number;
  payDate: string | null;
  factures: McAttachment[];
}

/* ---------- modale : enregistrer un paiement ---------- */
function PaymentModal({
  pay,
  onClose,
  onSave,
}: {
  pay: McPaymentState;
  onClose: () => void;
  onSave: (vd: McPaymentState) => void;
}) {
  const t = useTranslations('MonMariage.budget');
  const tRoot = useTranslations('MonMariage');
  const locale = useLocale();
  const currency = useMmCurrency();
  const now = useMonMariage((st) => st.now);
  const due = pay.amount;
  const [amount, setAmount] = useState(String(pay.paidAmount || pay.amount));
  const [date, setDate] = useState(
    pay.payDate || (now ? new Date(now).toISOString().slice(0, 10) : ''),
  );
  const [factures, setFactures] = useState<McAttachment[]>(pay.factures || []);
  const num = Number(amount) || 0;
  const partial = num > 0 && num < due;
  const save = () => {
    onSave({ ...pay, paidAmount: num, payDate: date, factures, paid: num >= due });
    onClose();
  };
  return (
    <McModal
      eyebrow={pay.vendor}
      title={t('recordPayment')}
      onClose={onClose}
      footer={
        <>
          <McBtn variant="ghost" size="md" onClick={onClose}>
            {t('cancel')}
          </McBtn>
          <McBtn variant="halo" size="md" onClick={save}>
            <Icon name="Check" size={16} stroke={2.2} />
            {t('save')}
          </McBtn>
        </>
      }
    >
      <div className="mc-pay-sum">
        <div>
          <span className="l">{tRoot(pay.kind.replace(/^MonMariage\./, ''))}</span>
          <span className="v">{mcEUR(due, locale, currency)}</span>
        </div>
        <span className={'mc-pill ' + (num >= due ? 'ok' : partial ? 'gold' : 'muted')}>
          <span className="d" />
          {num >= due ? t('paidInFull') : partial ? t('partialPayment') : t('unpaid')}
        </span>
      </div>
      <div className="mc-formgrid">
        <McField label={t('amountPaidLabel')}>
          <McInput
            prefix={currencySymbol(currency)}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            inputMode="decimal"
          />
        </McField>
        <McField label={t('paymentDateLabel')}>
          <McInput
            icon="Calendar"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </McField>
        <div className="mc-pay-quick full">
          <button
            type="button"
            className="mc-btn sm outline"
            onClick={() => setAmount(String(due))}
          >
            {t('payInFull')}
          </button>
          <button
            type="button"
            className="mc-btn sm outline"
            onClick={() => setAmount(String(Math.round(due / 2)))}
          >
            {t('deposit50')}
          </button>
          {num > 0 && (
            <button type="button" className="mc-btn ghost sm" onClick={() => setAmount('0')}>
              {t('cancelPayment')}
            </button>
          )}
        </div>
        <div className="full">
          <Attachments
            value={factures}
            onChange={setFactures}
            kinds={[
              ['facture', 'MonMariage.data.attachKinds.facture'],
              ['autre', 'MonMariage.data.attachKinds.receiptOther'],
            ]}
            label={t('attachInvoice')}
          />
        </div>
      </div>
    </McModal>
  );
}

function PaymentRow({ e, onRecord }: { e: McPaymentState; onRecord: () => void }) {
  const t = useTranslations('MonMariage.budget');
  const tRoot = useTranslations('MonMariage');
  const locale = useLocale();
  const currency = useMmCurrency();
  const now = useMonMariage((st) => st.now);
  const cat = MC_CATS[e.cat];
  const days = mcDaysTo(e.date, now || undefined);
  const paidAmt = e.paidAmount || 0;
  const full = paidAmt >= e.amount;
  const partial = paidAmt > 0 && paidAmt < e.amount;
  const soon = !full && days >= 0 && days <= 20;
  const [pk, plKey] = full
    ? ['ok', 'statusPaid']
    : partial
      ? ['gold', 'statusPartial']
      : soon
        ? ['wait', 'statusToPay']
        : ['muted', 'statusPlanned'];
  return (
    <div className={'mc-pay' + (full ? ' paid' : '')}>
      <span className="pdate">
        <b>{mcDateNum(e.date, locale)}</b>
      </span>
      <span className="pdot" style={{ background: cat.tint }} />
      <div className="pinfo">
        <b>{e.vendor}</b>
        <span>
          {tRoot(e.kind.replace(/^MonMariage\./, ''))}
          {partial
            ? ` · ${mcEUR(paidAmt, locale, currency)} / ${mcEUR(e.amount, locale, currency)}`
            : ''}
        </span>
        {e.factures && e.factures.length > 0 && (
          <div className="pfact">
            {e.factures.map((a) => (
              <AttachChip key={a.id} a={a} />
            ))}
          </div>
        )}
      </div>
      <div className="pright">
        <span className="pamt">{mcEUR(e.amount, locale, currency)}</span>
        <span className={'mc-pill ' + pk}>
          <span className="d" />
          {t(plKey)}
        </span>
        <button className="mc-pay-btn" onClick={onRecord}>
          {full || partial ? (
            <>
              <Icon name="Pencil" size={13} stroke={1.9} />
              {t('edit')}
            </>
          ) : (
            <>
              <Icon name="Banknote" size={14} stroke={1.9} />
              {t('settle')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function BudgetScreen({ onNav }: { onNav: (k: string) => void }) {
  const t = useTranslations('MonMariage.budget');
  const tRoot = useTranslations('MonMariage');
  const locale = useLocale();
  const currency = useMmCurrency();
  const catLabel = (cat: McVendorCat) => tRoot(MC_CATS[cat].label.replace(/^MonMariage\./, ''));
  const vendors = useMonMariage((st) => st.vendors);
  const storePayments = useMonMariage((st) => st.payments);
  const budgetTotal = useMonMariage((st) => st.budgetTotal);
  const storeSetPaymentPaid = useMonMariage((st) => st.setPaymentPaid);
  const storeSetBudgetTotal = useMonMariage((st) => st.setBudgetTotal);
  const postes = mcBudgetPostes(vendors);
  const engaged = postes.reduce((a, p) => a + p.planned, 0);
  const total = budgetTotal ?? 0;
  const payments: McPaymentState[] = storePayments.map((e) => ({
    ...e,
    paidAmount: e.paid ? e.amount : (e.paidAmount ?? 0),
    payDate: e.payDate ?? null,
    factures: e.factures ?? [],
  }));
  const [modal, setModal] = useState<McPaymentState | null>(null);
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalDraft, setTotalDraft] = useState('');

  const paid = payments.reduce((a, e) => a + (e.paidAmount || 0), 0);
  const remaining = engaged - paid;
  const engagedPct = total > 0 ? Math.round((engaged / total) * 100) : 0;
  const over = total > 0 && engaged > total;
  const segments = postes.map((p) => ({ value: p.planned, color: MC_CATS[p.cat].tint }));
  const sorted = payments.slice().sort((a, b) => a.date.localeCompare(b.date));

  const record = (e: McPaymentState) => setModal(e);
  const savePay = (vd: McPaymentState) =>
    void storeSetPaymentPaid(
      vd.id,
      vd.paidAmount,
      vd.payDate ?? undefined,
      vd.factures.map((f) => ({ name: f.name, kind: f.kind })),
    );
  const commitTotal = () => {
    const n = Number(totalDraft.replace(/[^\d.]/g, ''));
    if (Number.isFinite(n) && n > 0) void storeSetBudgetTotal(n);
    setEditingTotal(false);
  };

  return (
    <>
      <header className="mc-pagehead">
        <div className="ph-l">
          <span className="mc-eyebrow">{t('eyebrow')}</span>
          <h1>{t('title')}</h1>
        </div>
        <p className="ph-sub">{t('subtitle')}</p>
      </header>

      <section className="mc-card">
        <div className="mc-budget-top">
          <RingChart
            segments={segments}
            center={
              <>
                <span className="l">{t('engaged')}</span>
                <span className="v">{mcEUR(engaged, locale, currency)}</span>
                <span className="c">{t('postsCount', { count: postes.length })}</span>
              </>
            }
          />
          <div className="mc-budget-side">
            <div className="mc-budget-fig">
              <span className="l">{t('plannedBudget')}</span>
              {editingTotal ? (
                <McInput
                  prefix={currencySymbol(currency)}
                  value={totalDraft}
                  onChange={(e) => setTotalDraft(e.target.value.replace(/[^\d.]/g, ''))}
                  onBlur={commitTotal}
                  onKeyDown={(e) => e.key === 'Enter' && commitTotal()}
                  inputMode="decimal"
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  className="v"
                  style={{
                    background: 'none',
                    border: 0,
                    padding: 0,
                    cursor: 'pointer',
                    font: 'inherit',
                    textAlign: 'inherit',
                  }}
                  onClick={() => {
                    setTotalDraft(total ? String(total) : '');
                    setEditingTotal(true);
                  }}
                  title={t('setBudget')}
                >
                  {total > 0 ? mcEUR(total, locale, currency) : t('setBudget')}
                </button>
              )}
            </div>
            <div className="mc-budget-fig">
              <span className="l">{t('paid')}</span>
              <span className="v ok">{mcEUR(paid, locale, currency)}</span>
            </div>
            <div className="mc-budget-fig">
              <span className="l">{t('remainingToPay')}</span>
              <span className="v wait">{mcEUR(remaining, locale, currency)}</span>
            </div>
            <div className="mc-budget-bar" style={total > 0 ? undefined : { display: 'none' }}>
              <div className="lab">
                <span>{t('engagedVsPlanned')}</span>
                <span className={over ? 'over' : ''}>{t('percent', { pct: engagedPct })}</span>
              </div>
              <div className="track">
                <i
                  style={{ width: Math.min(100, engagedPct) + '%' }}
                  className={over ? 'over' : engagedPct >= 80 ? 'warn' : ''}
                />
              </div>
              {(over || engagedPct >= 80) && (
                <span className={'mc-budget-alert' + (over ? ' over' : '')}>
                  <Icon name={over ? 'CircleAlert' : 'Info'} size={13} stroke={1.9} />
                  {over
                    ? t('overBudget', { amount: mcEUR(engaged - total, locale, currency) })
                    : t('budgetMargin', { amount: mcEUR(total - engaged, locale, currency) })}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mc-card">
        <div className="mc-sec-head">
          <h2 className="mc-sec-title">{t('expensesByPost')}</h2>
          <button className="mc-budgetlink sm" onClick={() => onNav('vendors')}>
            <Icon name="Store" size={14} stroke={1.9} />
            {t('vendorsLink')}
          </button>
        </div>
        <div className="mc-postes" style={{ marginTop: 12 }}>
          {postes.map((p) => {
            const pPct = Math.round((p.paid / p.planned) * 100);
            const cat = MC_CATS[p.cat];
            return (
              <div className="mc-poste" key={p.cat}>
                <div className="ptop">
                  <span className="pic" style={{ '--tint': cat.tint } as CSSProperties}>
                    <Icon name={cat.icon} size={15} stroke={1.9} />
                  </span>
                  <div className="pnm">
                    <b>{catLabel(p.cat)}</b>
                    <span>{p.vendors.join(' · ')}</span>
                  </div>
                  <div className="pamt">
                    <span className="a">{mcEUR(p.planned, locale, currency)}</span>
                    <span className="r">
                      {p.paid > 0
                        ? t('postPaid', { amount: mcEUR(p.paid, locale, currency) })
                        : t('toSettle')}
                    </span>
                  </div>
                </div>
                <div className="ptrack">
                  <i style={{ width: pPct + '%', background: cat.tint }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mc-card">
        <div className="mc-sec-head">
          <div>
            <h2 className="mc-sec-title">{t('scheduleTitle')}</h2>
            <p className="mc-sec-sub">{t('scheduleSub')}</p>
          </div>
          <span className="mc-due">
            <span className="l">{t('remainingDue')}</span>
            <span className="v">{mcEUR(remaining, locale, currency)}</span>
          </span>
        </div>
        <div className="mc-pays" style={{ marginTop: 12 }}>
          {sorted.map((e) => (
            <PaymentRow key={e.id} e={e} onRecord={() => record(e)} />
          ))}
        </div>
      </section>

      {modal && <PaymentModal pay={modal} onClose={() => setModal(null)} onSave={savePay} />}
    </>
  );
}
