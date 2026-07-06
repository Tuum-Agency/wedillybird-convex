'use client';
// AUTO-PORTED from Claude Design bundle (couple/mc-app.jsx), typed.
// Espace couple self-serve — shell : sidebar (desktop) / bottom tab bar (mobile).
// LIGHT « mariage éditorial ». Câblé Convex : le bundle serveur hydrate le store
// Zustand (stores/mon-mariage.ts), les écrans lisent le store et mutent en
// optimiste via les server actions.

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
import { mcInitials, mcJ } from './data';
import type { MmBundle } from '@/lib/mon-mariage/types';
import { guestsView, useMonMariage } from '@/stores/mon-mariage';

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

export function MonMariageApp({
  bundle,
  now,
  userName,
  loading = false,
  initialScreen = 'home',
  forfaitViewOverride,
}: {
  /** Snapshot Convex de l'espace couple (null = aucun mariage self-serve). */
  bundle: MmBundle | null;
  /** Horloge serveur (epoch ms) — évite tout mismatch d'hydratation sur les J−. */
  now: number;
  userName?: string;
  loading?: boolean;
  initialScreen?: McScreenKey;
  /** Force la vue forfait (utilisé par /capture-mm). */
  forfaitViewOverride?: 'choix' | 'actif';
}) {
  const [screen, setScreen] = useState<McScreenKey>(initialScreen);
  const t = useTranslations('MonMariage.nav');
  const tc = useTranslations('MonMariage.common');

  // Hydrate le store une fois par montage, de façon synchrone (avant le premier
  // render des écrans) — pattern initialiseur, pas d'effet.
  const [hydratedOnce] = useState(() => {
    useMonMariage.getState().hydrate(bundle, now);
    return true;
  });
  void hydratedOnce;

  const store = useMonMariage();
  const empty = store.event === null;
  const couple = store.couple;
  const guests = guestsView(store.guests);
  const initials = couple ? mcInitials(couple.names) : (userName?.[0]?.toUpperCase() ?? '·');
  const j = couple ? mcJ(couple.weddingDate, store.now) : null;
  const jLabel = !j
    ? tc('coupleSpace')
    : j.kind === 'day'
      ? tc('jDay')
      : j.kind === 'before'
        ? tc('jBefore', { n: j.n })
        : tc('jAfter', { n: j.n });

  const render = () => {
    if (loading || !store.hydrated) return <DashSkeleton />;
    switch (screen) {
      case 'home':
        return <HomeScreen empty={empty} onNav={(k) => setScreen(k as McScreenKey)} />;
      case 'dashboard':
        return <DashScreen guests={guests} />;
      case 'planning':
        return <PlanningScreen />;
      case 'vendors':
        return <VendorsScreen onNav={(k) => setScreen(k as McScreenKey)} />;
      case 'budget':
        return <BudgetScreen onNav={(k) => setScreen(k as McScreenKey)} />;
      case 'seating':
        return <SeatingScreen onNav={(k) => setScreen(k as McScreenKey)} />;
      case 'forfait':
        return <ForfaitScreen view={forfaitViewOverride ?? (store.active ? 'actif' : 'choix')} />;
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
                <b>{userName || couple?.names || tc('coupleSpace')}</b>
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
