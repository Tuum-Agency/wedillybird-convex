import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import wedillybirdLogo from '@/public/wedillybird-logo.png';

/**
 * Footer minimal des pages d'invitation THÉMATISÉES — remplace le footer
 * marketing (newsletter/sitemap) qui cassait l'univers du thème. Hérite
 * entièrement des tokens remappés par `data-inv-theme` : filet, encre douce,
 * logo. Le thème sceau conserve le footer riche historique.
 */
export async function InvitationFooter() {
  const t = await getTranslations('Invitation');
  return (
    <footer className="mt-4 flex flex-col items-center gap-4 px-6 pt-2 pb-12 text-center">
      <span aria-hidden className="h-px w-14 bg-[color:var(--color-border-strong)]" />
      <a
        href="https://wedillybird.com"
        target="_blank"
        rel="noreferrer"
        className="focus-ring inline-flex items-center gap-2 opacity-80 transition-opacity hover:opacity-100"
      >
        <span className="font-mono text-[9px] tracking-[0.28em] text-[color:var(--color-ink-500)] uppercase">
          {t('poweredBy')}
        </span>
        <Image src={wedillybirdLogo} alt="Wedillybird" width={22} height={22} />
        <span
          className="font-display text-sm italic"
          style={{ color: 'var(--color-ink-700)', letterSpacing: '-0.01em' }}
        >
          wedillybird
        </span>
      </a>
    </footer>
  );
}
