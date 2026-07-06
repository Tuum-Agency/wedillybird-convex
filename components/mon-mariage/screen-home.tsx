'use client';
/* Wedillybird — Espace couple · Écran 1 — Accueil « Mon mariage »
   Hero éditorial + aperçu (3 stats Bodoni) + grille de navigation + empty states.
   Câblé Convex : couple / RSVP dérivés du store mon-mariage. */

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Icon, Mark } from './icons';
import { McBtn, Ornament, CoupleNames } from './parts';
import { mcDateLong, mcDateShort, mcJ, type McCouple, type McRsvp } from './data';
import { rsvpFromGuests } from '@/lib/mon-mariage/adapt';
import { useMonMariage } from '@/stores/mon-mariage';

/** Libellé « J− » localisé depuis le descripteur de `mcJ`. */
function useJLabel(iso: string): string {
  const tc = useTranslations('MonMariage.common');
  const now = useMonMariage((s) => s.now);
  const j = mcJ(iso, now || undefined);
  return j.kind === 'day'
    ? tc('jDay')
    : j.kind === 'before'
      ? tc('jBefore', { n: j.n })
      : tc('jAfter', { n: j.n });
}

function HomeHero({ couple }: { couple: McCouple }) {
  const t = useTranslations('MonMariage.home');
  const locale = useLocale();
  const jLabel = useJLabel(couple.weddingDate);
  return (
    <section className="mc-hero" aria-label={t('heroAria')}>
      <span className="mc-hello">{t('hello')}</span>
      <h1 className="mc-hero-names">
        <CoupleNames names={couple.names} />
      </h1>
      <Ornament size={14} />
      <div className="mc-hero-meta">
        <div className="mc-hero-date">
          <span className="dt">{mcDateLong(couple.weddingDate, locale)}</span>
          <span className="mc-jchip">
            <Icon name="Clock" size={12} stroke={2.1} />
            {jLabel}
          </span>
        </div>
        <span className="mc-venue">
          <Icon name="MapPin" size={14} stroke={1.8} />
          {couple.venue}
        </span>
      </div>
    </section>
  );
}

/* aperçu — confirmés / en attente / attendus */
function HomeApercu({ rsvp }: { rsvp: McRsvp }) {
  const t = useTranslations('MonMariage.home');
  return (
    <div className="mc-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="mc-aperçu">
        <div className="mc-apx ok">
          <span className="v">{rsvp.confirmed}</span>
          <span className="l">{t('confirmed')}</span>
        </div>
        <div className="mc-apx wait">
          <span className="v">{rsvp.pending}</span>
          <span className="l">{t('pending')}</span>
        </div>
        <div className="mc-apx">
          <span className="v">{rsvp.expected}</span>
          <span className="l">{t('expected')}</span>
        </div>
      </div>
    </div>
  );
}

interface McNavCard {
  k: string;
  to: string;
  icon: string;
}

// titres/descriptions via clés `MonMariage.home.cards.<k>.title|desc`
const MC_NAVCARDS: McNavCard[] = [
  { k: 'guests', to: 'dashboard', icon: 'Users' },
  { k: 'plan', to: 'planning', icon: 'ListChecks' },
  { k: 'vendors', to: 'vendors', icon: 'Store' },
  { k: 'budget', to: 'budget', icon: 'Wallet' },
  { k: 'seating', to: 'seating', icon: 'Armchair' },
  { k: 'forfait', to: 'forfait', icon: 'CreditCard' },
];

function HomeNavGrid({ couple, onNav }: { couple: McCouple; onNav: (k: string) => void }) {
  const t = useTranslations('MonMariage.home');
  const tCards = useTranslations('MonMariage.home.cards');
  const locale = useLocale();
  return (
    <section
      aria-label={t('navAria')}
      style={{ display: 'flex', flexDirection: 'column', gap: 13 }}
    >
      {/* invitation publique — carte large avec mini-aperçu */}
      <button className="mc-navcard wide" onClick={() => onNav('dashboard')}>
        <div className="nchead">
          <span className="ic">
            <Icon name="Mail" size={20} stroke={1.8} />
          </span>
          <Icon name="ArrowUpRight" size={20} stroke={2} className="arr" />
        </div>
        <div className="mc-invmini">
          <div className="prev">
            <span className="mk">
              <Mark size={16} />
            </span>
            <span className="nn">
              <CoupleNames names={couple.names} />
            </span>
            <span className="dd">{mcDateShort(couple.weddingDate, locale)}</span>
          </div>
          <div>
            <h3>{t('invitation.title')}</h3>
            <p>{t('invitation.desc')}</p>
            <span
              className="mc-pill brand"
              style={{
                marginTop: 10,
                background: 'var(--brand-soft)',
                color: 'var(--brand-strong)',
              }}
            >
              <span className="d" style={{ background: 'var(--brand)' }} />
              {t('online')}
            </span>
          </div>
        </div>
      </button>

      <div className="mc-navgrid">
        {MC_NAVCARDS.map((c) => (
          <button key={c.k} className="mc-navcard" onClick={() => onNav(c.to)}>
            <div className="nchead">
              <span className="ic">
                <Icon name={c.icon} size={20} stroke={1.8} />
              </span>
              <Icon name="ArrowUpRight" size={18} stroke={2} className="arr" />
            </div>
            <div>
              <h3>{tCards(`${c.k}.title`)}</h3>
              <p>{tCards(`${c.k}.desc`)}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* empty state chaleureux (aucun invité encore ajouté) */
function HomeEmpty({ onNav }: { onNav: (k: string) => void }) {
  const t = useTranslations('MonMariage.home');
  return (
    <section className="mc-card feature">
      <div className="mc-empty">
        <span className="ill">
          <Icon name="Heart" size={32} stroke={1.7} />
        </span>
        <h3>{t('empty.title')}</h3>
        <p>{t('empty.body')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          <McBtn variant="halo" size="lg" onClick={() => onNav('dashboard')}>
            <Icon name="Plus" size={17} stroke={2} />
            {t('empty.addGuests')}
          </McBtn>
          <McBtn variant="outline" size="lg" onClick={() => onNav('dashboard')}>
            <Icon name="Eye" size={16} stroke={1.9} />
            {t('empty.viewInvitation')}
          </McBtn>
        </div>
      </div>
    </section>
  );
}

/* empty state « aucun mariage » (pas encore d'event self-serve) → création */
function HomeNoEvent() {
  const t = useTranslations('MonMariage.home');
  const router = useRouter();
  return (
    <section className="mc-card feature">
      <div className="mc-empty">
        <span className="ill">
          <Icon name="Heart" size={32} stroke={1.7} />
        </span>
        <h3>{t('noEvent.title')}</h3>
        <p>{t('noEvent.body')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          <McBtn variant="halo" size="lg" onClick={() => router.push('/events/new')}>
            <Icon name="Plus" size={17} stroke={2} />
            {t('noEvent.cta')}
          </McBtn>
        </div>
      </div>
    </section>
  );
}

interface HomeScreenProps {
  empty?: boolean;
  onNav: (k: string) => void;
}

export function HomeScreen({ empty, onNav }: HomeScreenProps) {
  const couple = useMonMariage((s) => s.couple);
  const guests = useMonMariage((s) => s.guests);
  const rsvp: McRsvp = useMemo(() => rsvpFromGuests(guests), [guests]);

  if (empty || !couple) return <HomeNoEvent />;

  return (
    <>
      <HomeHero couple={couple} />
      {guests.length === 0 ? (
        <HomeEmpty onNav={onNav} />
      ) : (
        <>
          <HomeApercu rsvp={rsvp} />
          <HomeNavGrid couple={couple} onNav={onNav} />
        </>
      )}
    </>
  );
}
