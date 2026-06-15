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
  MC_BUDGET_TOTAL,
  MC_PAYMENTS,
  MC_CATS,
  MC_CURRENCY,
  mcBudgetPostes,
  mcEUR,
  mcDateNum,
  mcDaysTo,
  type McAttachment,
  type McPayment,
  type McVendorCat,
} from './data';
import { currencySymbol } from '@/lib/currency';

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
  const due = pay.amount;
  const [amount, setAmount] = useState(String(pay.paidAmount || pay.amount));
  const [date, setDate] = useState(pay.payDate || '2026-06-11');
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
          <span className="v">{mcEUR(due, locale)}</span>
        </div>
        <span className={'mc-pill ' + (num >= due ? 'ok' : partial ? 'gold' : 'muted')}>
          <span className="d" />
          {num >= due ? t('paidInFull') : partial ? t('partialPayment') : t('unpaid')}
        </span>
      </div>
      <div className="mc-formgrid">
        <McField label={t('amountPaidLabel')}>
          <McInput
            prefix={currencySymbol(MC_CURRENCY)}
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
  const cat = MC_CATS[e.cat];
  const days = mcDaysTo(e.date);
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
          {partial ? ` · ${mcEUR(paidAmt, locale)} / ${mcEUR(e.amount, locale)}` : ''}
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
        <span className="pamt">{mcEUR(e.amount, locale)}</span>
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
  const catLabel = (cat: McVendorCat) => tRoot(MC_CATS[cat].label.replace(/^MonMariage\./, ''));
  const postes = mcBudgetPostes();
  const total = MC_BUDGET_TOTAL;
  const engaged = postes.reduce((a, p) => a + p.planned, 0);
  const [payments, setPayments] = useState<McPaymentState[]>(() =>
    MC_PAYMENTS.map((e) => ({
      ...e,
      paidAmount: e.paid ? e.amount : 0,
      payDate: e.paid ? e.date : null,
      factures: [],
    })),
  );
  const [modal, setModal] = useState<McPaymentState | null>(null);

  const paid = payments.reduce((a, e) => a + (e.paidAmount || 0), 0);
  const remaining = engaged - paid;
  const engagedPct = Math.round((engaged / total) * 100);
  const over = engaged > total;
  const segments = postes.map((p) => ({ value: p.planned, color: MC_CATS[p.cat].tint }));
  const sorted = payments.slice().sort((a, b) => a.date.localeCompare(b.date));

  const record = (e: McPaymentState) => setModal(e);
  const savePay = (vd: McPaymentState) =>
    setPayments((ps) => ps.map((p) => (p.id === vd.id ? vd : p)));

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
                <span className="v">{mcEUR(engaged, locale)}</span>
                <span className="c">{t('postsCount', { count: postes.length })}</span>
              </>
            }
          />
          <div className="mc-budget-side">
            <div className="mc-budget-fig">
              <span className="l">{t('plannedBudget')}</span>
              <span className="v">{mcEUR(total, locale)}</span>
            </div>
            <div className="mc-budget-fig">
              <span className="l">{t('paid')}</span>
              <span className="v ok">{mcEUR(paid, locale)}</span>
            </div>
            <div className="mc-budget-fig">
              <span className="l">{t('remainingToPay')}</span>
              <span className="v wait">{mcEUR(remaining, locale)}</span>
            </div>
            <div className="mc-budget-bar">
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
                    ? t('overBudget', { amount: mcEUR(engaged - total, locale) })
                    : t('budgetMargin', { amount: mcEUR(total - engaged, locale) })}
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
                    <span className="a">{mcEUR(p.planned, locale)}</span>
                    <span className="r">
                      {p.paid > 0
                        ? t('postPaid', { amount: mcEUR(p.paid, locale) })
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
            <span className="v">{mcEUR(remaining, locale)}</span>
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
