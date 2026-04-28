import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { ProShell, ProNav } from '@/components/pro/pro-shell';
import { BrandingForm } from '@/components/pro/branding-form';

const DEFAULT_PRIMARY = '#2c1a11';
const DEFAULT_ACCENT = '#c8a165';

/**
 * /pro/settings — page de réglages de l'organisation pro.
 *
 * Pour le moment elle ne contient que le branding (logo + couleurs). On
 * pourra y ajouter d'autres sections plus tard (préférences notifications,
 * domaine custom, etc.) sans changer la route.
 *
 * Pattern auth/Convex aligné sur `/pro/billing` :
 *  - session HMAC requise (sinon redirect /sign-in)
 *  - org doit exister (sinon redirect /pro/onboarding)
 *  - on précharge `myOrganization` pour pré-remplir les inputs et afficher
 *    la preview du logo via l'URL signée Convex (`logoUrl`).
 */
export default async function ProSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session!.userId });
  if (!org) redirect({ href: '/pro/onboarding', locale });

  const user = await convex.query(convexApi.currentUser, { userId: session!.userId });
  const t = await getTranslations('Branding');

  // Couleurs : on assure un format hex 6-digit pour les inputs natifs (ils
  // n'acceptent pas la forme courte). Si l'orga a une valeur invalide
  // historique, on retombe sur le default.
  const isHex6 = (value: string | undefined): value is string =>
    !!value && /^#[0-9a-fA-F]{6}$/.test(value);
  const initialPrimary = isHex6(org!.primaryColor) ? org!.primaryColor : DEFAULT_PRIMARY;
  const initialAccent = isHex6(org!.accentColor) ? org!.accentColor : DEFAULT_ACCENT;

  return (
    <ProShell
      orgName={org!.name}
      orgPrimaryColor={org!.primaryColor ?? undefined}
      userName={user?.fullName}
      nav={<ProNav current="settings" />}
    >
      <div className="container-page mx-auto flex max-w-3xl flex-col gap-10 py-12 sm:py-16">
        <header className="flex flex-col gap-3">
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
            {t('eyebrow')}
          </span>
          <h1
            className="font-display text-balance italic"
            style={{
              fontSize: 'clamp(2rem, 4.5vw, 3rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
              color: 'var(--color-foreground)',
            }}
          >
            {t('title')}
          </h1>
          <p className="text-base leading-relaxed text-[color:var(--color-muted-foreground)] sm:text-lg">
            {t('subtitle')}
          </p>
        </header>

        <BrandingForm
          initialLogoUrl={org!.logoUrl}
          initialPrimaryColor={initialPrimary}
          initialAccentColor={initialAccent}
        />
      </div>
    </ProShell>
  );
}
