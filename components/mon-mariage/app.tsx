'use client';
// AUTO-PORTED from Claude Design bundle (couple/mc-app.jsx), typed.
// Espace couple self-serve — shell : sidebar (desktop) / bottom tab bar (mobile).
// LIGHT « mariage éditorial ». Données mock pour l'instant (props Convex à venir).

import { useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import './mc.css';
import './seating.css';
import { Icon, Mark } from './icons';
import { HomeScreen } from './screen-home';
import { DashScreen } from './screen-dashboard';
import { PlanningScreen } from './screen-planning';
import { VendorsScreen } from './screen-vendors';
import { BudgetScreen } from './screen-budget';
import { ForfaitScreen } from './screen-forfait';
import { SeatingScreen } from './screen-seating';
import {
  MC_COUPLE,
  MC_RSVP,
  MC_USAGE,
  MC_ACTIVE,
  MC_GUESTS,
  mcInitials,
  mcJ,
  type McCouple,
  type McRsvp,
  type McUsage,
  type McActive,
  type McGuest,
} from './data';

export type McScreenKey =
  | 'home'
  | 'dashboard'
  | 'planning'
  | 'vendors'
  | 'budget'
  | 'seating'
  | 'forfait';

// libellé via clé i18n `MonMariage.nav.<k>`, traduit au render
const MC_NAV: ReadonlyArray<{ k: McScreenKey; icon: string }> = [
  { k: 'home', icon: 'Home' },
  { k: 'dashboard', icon: 'Heart' },
  { k: 'planning', icon: 'ListChecks' },
  { k: 'vendors', icon: 'Store' },
  { k: 'budget', icon: 'Wallet' },
  { k: 'seating', icon: 'Armchair' },
  { k: 'forfait', icon: 'CreditCard' },
];
const MC_TABS: ReadonlyArray<McScreenKey> = ['home', 'dashboard', 'planning', 'vendors', 'seating'];

/* squelette shimmer (chargement) */
function DashSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} aria-hidden="true">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span className="mc-skel" style={{ width: 260, height: 42, borderRadius: 12 }} />
        <span className="mc-skel" style={{ width: 320, height: 16 }} />
      </div>
      <div className="mc-grid2">
        <span className="mc-skel" style={{ height: 248, borderRadius: 20 }} />
        <span className="mc-skel" style={{ height: 248, borderRadius: 20 }} />
      </div>
      <span className="mc-skel" style={{ height: 320, borderRadius: 20 }} />
    </div>
  );
}

export interface MonMariageData {
  couple: McCouple;
  rsvp: McRsvp;
  usage: McUsage;
  active: McActive;
  guests: McGuest[];
}

export function MonMariageApp({
  data = {
    couple: MC_COUPLE,
    rsvp: MC_RSVP,
    usage: MC_USAGE,
    active: MC_ACTIVE,
    guests: MC_GUESTS,
  },
  userName,
  loading = false,
  empty = false,
  initialScreen = 'home',
  forfaitView = 'actif',
}: {
  data?: MonMariageData;
  userName?: string;
  loading?: boolean;
  empty?: boolean;
  initialScreen?: McScreenKey;
  forfaitView?: 'choix' | 'actif';
}) {
  const [screen, setScreen] = useState<McScreenKey>(initialScreen);
  const t = useTranslations('MonMariage.nav');
  const tc = useTranslations('MonMariage.common');
  const { couple, rsvp, usage, active, guests } = data;
  const initials = mcInitials(couple.names);
  const j = mcJ(couple.weddingDate);
  const jLabel =
    j.kind === 'day'
      ? tc('jDay')
      : j.kind === 'before'
        ? tc('jBefore', { n: j.n })
        : tc('jAfter', { n: j.n });

  const render = () => {
    if (loading) return <DashSkeleton />;
    switch (screen) {
      case 'home':
        return (
          <HomeScreen
            couple={couple}
            rsvp={rsvp}
            empty={empty}
            onNav={(k) => setScreen(k as McScreenKey)}
          />
        );
      case 'dashboard':
        return (
          <DashScreen couple={couple} rsvp={rsvp} usage={usage} active={active} guests={guests} />
        );
      case 'planning':
        return <PlanningScreen />;
      case 'vendors':
        return <VendorsScreen onNav={(k) => setScreen(k as McScreenKey)} />;
      case 'budget':
        return <BudgetScreen onNav={(k) => setScreen(k as McScreenKey)} />;
      case 'seating':
        return <SeatingScreen />;
      case 'forfait':
        return <ForfaitScreen active={active} usage={usage} view={forfaitView} />;
      default:
        return null;
    }
  };

  return (
    <div className="mc-app paper-grain">
      <div className="mc-shell">
        {/* sidebar desktop */}
        <aside className="mc-side" aria-label={tc('navLabel')}>
          <div className="mc-side-brand">
            <span className="mk">
              <Mark size={26} />
            </span>
            <span className="bn">
              <b>wedillybird</b>
              <span>{tc('coupleSpace')}</span>
            </span>
          </div>
          {MC_NAV.map((n) => (
            <button
              key={n.k}
              className={'mc-navitem' + (screen === n.k ? ' on' : '')}
              onClick={() => setScreen(n.k)}
              aria-current={screen === n.k ? 'page' : undefined}
            >
              <span className="ni">
                <Icon name={n.icon} size={18} stroke={1.9} />
              </span>
              {t(n.k)}
            </button>
          ))}
          <div className="mc-side-foot">
            <div className="mc-side-mini">
              <span className="av">{initials}</span>
              <span className="nm">
                <b>{userName || couple.names}</b>
                <span>{jLabel}</span>
              </span>
              <button className="mc-logout" aria-label={tc('signOut')} title={tc('signOut')}>
                <Icon name="LogOut" size={16} stroke={1.85} />
              </button>
            </div>
          </div>
        </aside>

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 } as CSSProperties}>
          {/* topbar mobile */}
          <header className="mc-topbar">
            <span className="mc-wbrand">
              <span className="mk">
                <Mark size={22} />
              </span>
              <span className="bn">
                <b>wedillybird</b>
                <span>{tc('coupleSpace')}</span>
              </span>
            </span>
            <span className="sp" />
            <button className="mc-icon-btn" aria-label={tc('notifications')}>
              <Icon name="BellRing" size={18} stroke={1.85} />
            </button>
            <button className="mc-icon-btn" aria-label={tc('signOut')}>
              <Icon name="LogOut" size={18} stroke={1.85} />
            </button>
          </header>

          <main
            className={
              'mc-main' +
              (screen === 'seating' ? ' seating' : '') +
              (screen === 'vendors' ? ' vendors' : '')
            }
            aria-label={t(screen)}
          >
            {render()}
          </main>
        </div>
      </div>

      {/* bottom tab bar mobile */}
      <nav className="mc-tabbar" aria-label={tc('mainNavLabel')}>
        {MC_TABS.map((k) => {
          const n = MC_NAV.find((x) => x.k === k)!;
          return (
            <button
              key={k}
              className={'mc-tab' + (screen === k ? ' on' : '')}
              onClick={() => setScreen(k)}
              aria-current={screen === k ? 'page' : undefined}
            >
              <span className="ti">
                <Icon name={n.icon} size={21} stroke={1.9} />
              </span>
              {t(k)}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
