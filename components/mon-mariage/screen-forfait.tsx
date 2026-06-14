'use client';
/* Wedillybird — Espace couple · Écran 3 — Mon forfait (achat & gestion · one-shot)
   Achat UNIQUE — jamais d'abonnement. (a) Choix · (b) Forfait actif + factures + upsell HD. */

import { useLocale, useTranslations } from 'next-intl';
import { Icon } from './icons';
import { McBtn, Fleuron, Ornament, QuotaGauge } from './parts';
import {
  MC_PLANS,
  MC_HD,
  MC_INVOICES,
  MC_OVERAGES,
  mcEUR,
  mcDateLongNoWeekday,
  mcNum,
  mcGo,
  type McActive,
  type McUsage,
  type McPlan,
  type McPlanId,
} from './data';

/* ---------- (a) CHOIX — deux cartes premium ---------- */
function PlanCardBuy({ plan, currentId }: { plan: McPlan; currentId: McPlanId | null }) {
  const t = useTranslations('MonMariage.forfait');
  const tRoot = useTranslations('MonMariage');
  const tr = (key: string) => tRoot(key.replace(/^MonMariage\./, ''));
  const locale = useLocale();
  const isCurrent = plan.id === currentId;
  const planName = tr(plan.name);
  return (
    <div className={'mc-plan-card' + (plan.featured ? ' featured' : '')}>
      {plan.featured && (
        <span className="mc-ribbon">
          <Fleuron size={9} style={{ color: 'var(--color-primary-foreground)' }} />
          {t('recommended')}
        </span>
      )}
      <div>
        <div className="pname">{planName}</div>
        <div className="ptag">{tr(plan.tagline)}</div>
      </div>
      <div className="mc-plan-price">
        <span className="amt">{mcEUR(plan.price, locale)}</span>
        <span className="per">{t('once')}</span>
      </div>
      <ul className="mc-plan-feats">
        {plan.feats.map(([f, strong], i) => (
          <li key={i} className={strong ? 'strong' : ''}>
            <span className="fl">✦</span>
            {tr(f)}
          </li>
        ))}
      </ul>
      {isCurrent ? (
        <span className="mc-current-tag">
          <Icon name="CheckCircle" size={14} stroke={2} />
          {t('currentPlan')}
        </span>
      ) : (
        <McBtn variant={plan.featured ? 'halo' : 'outline'} size="lg" block>
          <Icon name="Heart" size={16} stroke={1.9} />
          {t('choosePlan', { name: planName })}
        </McBtn>
      )}
    </div>
  );
}

function ForfaitChoix({ currentId }: { currentId: McPlanId | null }) {
  const t = useTranslations('MonMariage.forfait');
  return (
    <>
      <div className="mc-hero" style={{ paddingBottom: 0 }}>
        <span className="mc-hello">{t('eyebrow')}</span>
        <h1 className="mc-hero-names" style={{ fontSize: 'clamp(2rem, 7vw, 3rem)' }}>
          {t('choixTitle')}
        </h1>
        <Ornament size={13} />
        <p className="mc-sec-sub" style={{ maxWidth: '40ch', textAlign: 'center', fontSize: 14 }}>
          {t('choixSubtitle')}
        </p>
      </div>
      <p className="mc-plans-note">{t('oneTimeNote')}</p>
      <div className="mc-plans">
        <PlanCardBuy plan={MC_PLANS.essentiel} currentId={currentId} />
        <PlanCardBuy plan={MC_PLANS.premium} currentId={currentId} />
      </div>
      <div className="mc-reassure">
        <span className="r">
          <Icon name="ShieldCheck" size={15} stroke={1.8} />
          {t('reassureRefund')}
        </span>
        <span className="r">
          <Icon name="Heart" size={15} stroke={1.8} />
          {t('reassurePostpone')}
        </span>
      </div>
    </>
  );
}

/* ---------- (b) FORFAIT ACTIF ---------- */
function ForfaitActif({ active, usage }: { active: McActive; usage: McUsage }) {
  const t = useTranslations('MonMariage.forfait');
  const tRoot = useTranslations('MonMariage');
  const tr = (key: string) => tRoot(key.replace(/^MonMariage\./, ''));
  const locale = useLocale();
  const plan = MC_PLANS[active.planId];
  return (
    <div className="mc-active">
      {/* carte Votre forfait */}
      <div className="mc-active-card">
        <div className="mc-active-head">
          <div className="lhs">
            <span className="eb">{t('yourPlan')}</span>
            <span className="nm">
              {tr(plan.name)}
              <small>
                {t('purchasedOn', {
                  date: mcDateLongNoWeekday(active.purchasedAt, locale),
                })}
              </small>
            </span>
          </div>
          <span className="mc-pill ok">
            <span className="d" />
            {t('activeOneTime')}
          </span>
        </div>
        <div className="mc-active-quotas">
          <QuotaGauge
            icon="Users"
            label={t('quotaGuests')}
            sub={t('quotaGuestsSub')}
            used={usage.guests}
            cap={active.guestCap}
            fmt={(n) => mcNum(n, locale)}
          />
          <QuotaGauge
            icon="HardDrive"
            label={t('quotaStorage')}
            sub={t('quotaStorageSub')}
            used={usage.storageGo}
            cap={active.storageCap}
            fmt={(n) => mcGo(n, locale)}
            gold
          />
        </div>
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <span className="mc-expire">
            <Icon name="Calendar" size={15} stroke={1.8} />
            {t.rich('galleryActiveUntil', {
              date: mcDateLongNoWeekday(active.galleryExpires, locale),
              b: (chunks) => <b>{chunks}</b>,
            })}
          </span>
        </div>
      </div>

      {/* surclassement unique (Essentiel → Premium) — un seul paiement, jamais un abonnement */}
      {active.planId === 'essentiel' && (
        <div className="mc-upgrade">
          <span className="uv">
            <Icon name="ArrowUpRight" size={24} stroke={1.9} />
          </span>
          <div className="ub">
            <span className="eb">{t('upgradeEyebrow')}</span>
            <h3>{t('upgradeTitle')}</h3>
            <p>{t('upgradeDesc')}</p>
          </div>
          <div className="ua">
            <span className="pr">
              +{mcEUR(MC_PLANS.premium.price - MC_PLANS.essentiel.price, locale)}
              <small>{t('onceShort')}</small>
            </span>
            <McBtn variant="primary" size="md">
              <Icon name="Sparkles" size={16} stroke={1.9} />
              {t('upgradeToPremium')}
            </McBtn>
          </div>
        </div>
      )}

      {/* upsell HD post-event */}
      <div className="mc-upsell">
        <span className="uv">
          <Icon name="Archive" size={26} stroke={1.7} />
        </span>
        <div className="ub">
          <span className="eb">{t('upsellEyebrow')}</span>
          <h3>{t('upsellTitle')}</h3>
          <p>{t('upsellDesc')}</p>
        </div>
        <div className="ua">
          <span className="pr">
            {mcEUR(MC_HD.price, locale)}
            <small>{t('onceShort')}</small>
          </span>
          <McBtn variant="halo" size="md">
            <Icon name="Download" size={16} stroke={1.9} />
            {t('archiveForever')}
          </McBtn>
        </div>
      </div>

      {/* factures */}
      <section className="mc-card">
        <div className="mc-sec-head">
          <h2 className="mc-sec-title">{t('invoices')}</h2>
          <Fleuron size={13} />
        </div>
        <div className="mc-invoices" style={{ marginTop: 10 }}>
          {MC_INVOICES.map((inv) => (
            <div className="mc-invoice" key={inv.id}>
              <span className="iic">
                <Icon name="FileText" size={18} stroke={1.7} />
              </span>
              <div className="ii">
                <b>{inv.id}</b>
                <span>
                  {tr(inv.label)} · {mcDateLongNoWeekday(inv.date, locale)}
                </span>
              </div>
              <span className="iamt">{mcEUR(inv.amount, locale)}</span>
              <McBtn variant="outline" size="sm" className="idl" ariaLabel={t('downloadReceipt')}>
                <Icon name="Download" size={14} stroke={1.9} />
                {t('receiptPdf')}
              </McBtn>
            </div>
          ))}
        </div>
      </section>

      {/* dépassements informatifs */}
      <div className="mc-overages">
        <div className="oh">
          <Icon name="Info" size={15} stroke={1.9} />
          <b>{t('overagesTitle')}</b>
          <span>{t('overagesHint')}</span>
        </div>
        <ul>
          {MC_OVERAGES.map(([l, sub, pr], i) => (
            <li key={i}>
              <span>
                {tr(l)} <span style={{ color: 'var(--color-muted-foreground)' }}>· {tr(sub)}</span>
              </span>
              <span className="pr">{tr(pr)}</span>
            </li>
          ))}
        </ul>
        <p className="foot">{t('overagesFoot')}</p>
      </div>
    </div>
  );
}

/* Achat one-shot : pas d'abonnement, donc pas de « changement de forfait ».
   view='choix' = état AVANT achat (page d'acquisition) · view='actif' = gestion après achat. */
export function ForfaitScreen({
  active,
  usage,
  view = 'actif',
}: {
  active: McActive;
  usage: McUsage;
  view?: 'choix' | 'actif';
}) {
  return view === 'choix' ? (
    <ForfaitChoix currentId={null} />
  ) : (
    <ForfaitActif active={active} usage={usage} />
  );
}
